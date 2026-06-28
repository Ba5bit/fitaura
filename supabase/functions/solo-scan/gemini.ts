// supabase/functions/solo-scan/gemini.ts
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Fail a stalled request fast so retries still fit the platform budget.
 * 2.5-flash finishes in ~8s, so 30s only ever trips on a genuine hang. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Retry policy. 429 / 5xx fail fast, so a few backed-off retries ride out brief
 * rate-limit bursts; the network-timeout path is capped tighter (each attempt can
 * cost the full 30s) and an overall budget bounds the worst case under the
 * platform wall-clock limit. */
const MAX_ATTEMPTS = 3;             // 1 try + up to 2 retries (429 / 5xx / garbled JSON)
const NETWORK_MAX_ATTEMPTS = 2;    // 1 try + 1 retry for the slow 30s-timeout path
const BASE_BACKOFF_MS = 600;       // exponential base: 600ms, 1200ms, …
const MAX_BACKOFF_MS = 5_000;      // cap one computed backoff sleep
const MAX_RETRY_AFTER_MS = 10_000; // cap a server-supplied Retry-After
const OVERALL_BUDGET_MS = 75_000;  // stop retrying past this (keeps total < platform limit)

export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface GeminiCallResult {
  raw: unknown;
  usage: { input: number; output: number; total: number };
}

export interface GeminiOpts {
  apiKey: string;
  model: string;
  face?: InlineImage;
  outfit?: InlineImage;
  /** System instruction (the v4 prompt). */
  systemInstruction: string;
  /** OpenAPI-subset structured-output schema (the v4 response schema). */
  responseSchema: Record<string, unknown>;
  /** generationConfig.thinkingConfig (default { thinkingBudget: 0 }). */
  thinkingConfig?: Record<string, unknown>;
  /** generationConfig.maxOutputTokens (default 2900). */
  maxOutputTokens?: number;
}

/** Error carrying a `transient` flag (caller's retry policy) plus an optional
 * server-supplied retry delay parsed from a 429/5xx response. */
class GeminiError extends Error {
  transient: boolean;
  detail: string;
  retryAfterMs?: number;
  constructor(message: string, transient: boolean, detail = '', retryAfterMs?: number) {
    super(message);
    this.name = 'GeminiError';
    this.transient = transient;
    this.detail = detail;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) or Gemini's
 * `retryDelay: "27s"` body hint into milliseconds. Undefined when absent. */
function parseRetryAfterMs(header: string | null, body: string): number | undefined {
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
    const when = Date.parse(header);
    if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  }
  const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  return undefined;
}

function buildBody(opts: GeminiOpts) {
  const parts: Array<Record<string, unknown>> = [];
  if (opts.face) {
    parts.push({ text: 'IMAGE: FACE PHOTO' });
    parts.push({ inlineData: { mimeType: opts.face.mimeType, data: opts.face.data } });
  }
  if (opts.outfit) {
    parts.push({ text: 'IMAGE: OUTFIT PHOTO' });
    parts.push({ inlineData: { mimeType: opts.outfit.mimeType, data: opts.outfit.data } });
  }
  return {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: [{ role: 'user', parts }],
    // Relax the CONFIGURABLE safety filters. This is an intentionally edgy roast /
    // rating app; the default thresholds were blocking benign ADULT photos (empty
    // response → 3 wasted retries → "garbled" error). BLOCK_ONLY_HIGH still stops
    // genuinely severe content. NOTE: Google's child-safety filter is NOT
    // configurable and still applies — apparent minors are handled separately in
    // index.ts (age estimate + an unblockable safety block).
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 2900,
      responseMimeType: 'application/json',
      responseSchema: opts.responseSchema,
      thinkingConfig: opts.thinkingConfig ?? { thinkingBudget: 0 },
    },
  };
}

async function once(opts: GeminiOpts): Promise<GeminiCallResult> {
  const url = `${ENDPOINT}/${opts.model}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
      body: JSON.stringify(buildBody(opts)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    // Network failure or the 30s timeout — both worth a retry.
    throw new GeminiError('gemini_network_error', true, (e as Error).message);
  }
  if (!res.ok) {
    const body = await res.text();
    const transient = res.status === 429 || res.status >= 500;
    const retryAfterMs = transient ? parseRetryAfterMs(res.headers.get('retry-after'), body) : undefined;
    throw new GeminiError(`gemini_http_${res.status}`, transient, body.slice(0, 300), retryAfterMs);
  }
  const json = await res.json();
  const cand = json?.candidates?.[0];
  const text: string | undefined = cand?.content?.parts?.[0]?.text;
  if (!text) {
    // Distinguish a safety/policy BLOCK from a transient empty blip. A block is NOT
    // transient (retrying just burns the budget), and — since the configurable
    // filters are relaxed in buildBody — a block that still happens on a personal
    // photo is almost always Google's non-configurable minor-safety filter. Surface
    // it as a distinct, non-retried code so index.ts can show the 18+ message.
    const blockReason = json?.promptFeedback?.blockReason;
    const finish = cand?.finishReason;
    const SAFETY_FINISH = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY'];
    if (blockReason || (finish && SAFETY_FINISH.includes(finish))) {
      throw new GeminiError('gemini_blocked', false, String(blockReason ?? finish));
    }
    throw new GeminiError('gemini_empty_response', true);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Truncated/malformed model output — a temporary glitch, so retry.
    throw new GeminiError('gemini_invalid_json', true);
  }
  const u = json?.usageMetadata ?? {};
  return {
    raw,
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, total: u.totalTokenCount ?? 0 },
  };
}

/** Backoff before the Nth retry (1-based): honor a server Retry-After when
 * present, else exponential with full jitter — each capped. */
function backoffMs(retryIndex: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** (retryIndex - 1), MAX_BACKOFF_MS);
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

/** Call Gemini with backed-off retries on transient failures (rate-limit, 5xx,
 * timeout, garbled JSON). Bounded by a per-error attempt cap and an overall
 * wall-clock budget so a sustained outage can't hang the request. */
export async function callGemini(opts: GeminiOpts): Promise<GeminiCallResult> {
  const deadline = Date.now() + OVERALL_BUDGET_MS;
  let lastErr: unknown;
  for (let attempt = 1; ; attempt++) {
    try {
      return await once(opts);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof GeminiError) || !e.transient) break;
      const cap = e.message === 'gemini_network_error' ? NETWORK_MAX_ATTEMPTS : MAX_ATTEMPTS;
      if (attempt >= cap) break;
      const wait = backoffMs(attempt, e.retryAfterMs);
      // Don't start a sleep we can't afford inside the budget.
      if (Date.now() + wait >= deadline) break;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
