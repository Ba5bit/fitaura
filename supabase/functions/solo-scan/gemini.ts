// supabase/functions/solo-scan/gemini.ts
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** 3.5 real scans run ~15-25s; 30s was clipping legit-slow ones. 45s leaves room
 * while still failing a truly stalled request before the platform budget. */
const REQUEST_TIMEOUT_MS = 45_000;

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

/** Error carrying a `transient` flag so the caller's one-retry policy is type-safe. */
class GeminiError extends Error {
  transient: boolean;
  detail: string;
  constructor(message: string, transient: boolean, detail = '') {
    super(message);
    this.name = 'GeminiError';
    this.transient = transient;
    this.detail = detail;
  }
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
    // Network failure or the 30s timeout — both worth one retry.
    throw new GeminiError('gemini_network_error', true, (e as Error).message);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new GeminiError(`gemini_http_${res.status}`, res.status === 429 || res.status >= 500, body.slice(0, 300));
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('gemini_empty_response', true);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Truncated/malformed model output — a temporary glitch, so retry once.
    throw new GeminiError('gemini_invalid_json', true);
  }
  const u = json?.usageMetadata ?? {};
  return {
    raw,
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, total: u.totalTokenCount ?? 0 },
  };
}

/** Call Gemini with exactly one retry on transient failures. */
export async function callGemini(opts: GeminiOpts): Promise<GeminiCallResult> {
  try {
    return await once(opts);
  } catch (e) {
    if (e instanceof GeminiError && e.transient) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
      return once(opts);
    }
    throw e;
  }
}
