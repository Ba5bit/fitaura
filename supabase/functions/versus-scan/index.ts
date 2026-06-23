// supabase/functions/versus-scan/index.ts
import { versusAiResultSchema, VERSUS_SCHEMA_VERSION } from 'shared/versus/aiSchema.ts';
import { VERSUS_SYSTEM_INSTRUCTION, buildVersusResponseSchema } from 'shared/versus/prompt.ts';
import { shapeVersusResult } from 'shared/versus/assemble.ts';
import { callGemini, type InlineImage, type LabeledImage } from './gemini.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

/** Map an internal failure code to a short, human reason shown on the result screen
 * (the technical code is still logged for debugging). */
function reasonFor(code: string): string {
  if (code === 'gemini_network_error') return 'The AI took too long or the connection dropped.';
  if (/^gemini_http_(429|5\d\d)$/.test(code)) return 'The AI service is busy right now.';
  if (/^gemini_http_4\d\d$/.test(code)) return 'The AI rejected the request.';
  if (code === 'gemini_empty_response' || code === 'gemini_invalid_json') return 'The AI returned a garbled response.';
  return 'Something went wrong on our end.';
}

type VersusMode = 'face' | 'fit' | 'both';

interface ReqImages {
  aFace?: InlineImage;
  aFit?: InlineImage;
  bFace?: InlineImage;
  bFit?: InlineImage;
}

interface ReqBody {
  battleId: string;
  mode: VersusMode;
  images?: ReqImages;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, kind: 'error', message: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  // 2.5-flash: proven 100% reliable + fast (~8s) on this app. 3.5-flash was too slow
  // (27-47s → timeouts) and rate-limited to be production-reliable. Override via the
  // GEMINI_VERSUS_MODEL secret if needed.
  const model = Deno.env.get('GEMINI_VERSUS_MODEL') ?? 'gemini-2.5-flash';
  if (!apiKey) return json({ ok: false, kind: 'error', message: 'missing_api_key' }, 500);
  // Gemini 3.x uses thinking_level (not thinkingBudget) and is priced higher.
  const isGemini3 = model.startsWith('gemini-3');

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, kind: 'error', message: 'bad_request' }, 400);
  }
  const { battleId, mode, images } = body ?? {};
  // ~20 MB decoded is Gemini's inline-data ceiling; base64 inflates ~4/3.
  const MAX_B64 = 27_000_000;
  const okImg = (i: InlineImage | undefined) =>
    !!i && typeof i.data === 'string' && i.data.length > 0 && i.data.length <= MAX_B64
    && /^image\/(jpeg|png|webp)$/.test(i.mimeType ?? '');

  const imgs = images ?? {};
  const has = {
    aFace: okImg(imgs.aFace),
    aFit: okImg(imgs.aFit),
    bFace: okImg(imgs.bFace),
    bFit: okImg(imgs.bFit),
  };
  // Required images per mode: face → A+B face; fit → A+B fit; both → all four.
  const validMode = mode === 'face' || mode === 'fit' || mode === 'both';
  const includeFace = mode === 'face' || mode === 'both';
  const includeFit = mode === 'fit' || mode === 'both';
  const imagesOk =
    validMode &&
    (!includeFace || (has.aFace && has.bFace)) &&
    (!includeFit || (has.aFit && has.bFit));
  if (!battleId || !imagesOk) {
    return json({ ok: false, kind: 'error', message: 'invalid_images' }, 400);
  }

  // Build the labelled image list for the active set, in a stable A→B order.
  const labeled: LabeledImage[] = [];
  if (includeFace) {
    labeled.push({ label: 'CONTENDER A — face', image: imgs.aFace! });
    labeled.push({ label: 'CONTENDER B — face', image: imgs.bFace! });
  }
  if (includeFit) {
    labeled.push({ label: 'CONTENDER A — outfit', image: imgs.aFit! });
    labeled.push({ label: 'CONTENDER B — outfit', image: imgs.bFit! });
  }

  const started = Date.now();
  try {
    const { raw, usage } = await callGemini({
      apiKey, model,
      images: labeled,
      systemInstruction: VERSUS_SYSTEM_INSTRUCTION,
      responseSchema: buildVersusResponseSchema(mode),
      // 'low' (not 'minimal'): minimal bought ~no speed (latency is output generation)
      // and made the model narrate the photo instead of landing roasts. 'low' is the
      // validated quality.
      thinkingConfig: isGemini3 ? { thinkingLevel: 'low' } : { thinkingBudget: 0 },
      maxOutputTokens: 6000,
    });

    const parsed = versusAiResultSchema.safeParse(raw);
    if (!parsed.success) {
      console.log(JSON.stringify({ battle_id: battleId, model, success: false, failure_code: 'schema_invalid', latency_ms: Date.now() - started }));
      // 200 (not 502): supabase-js functions.invoke discards the body on non-2xx, so
      // app-level errors return 200 with ok:false to let the client read the reason.
      return json({ ok: false, kind: 'error', message: 'The AI returned an unreadable result. Give it another go.' });
    }

    let result;
    try {
      result = shapeVersusResult(parsed.data, { mode, battleId });
    } catch {
      // Unrecoverable payload (missing/out-of-range active-category scores) — score
      // failed, so the client refunds. No retake flow (decision #4).
      return json({ ok: false, kind: 'error', message: 'We could not read enough detail to crown a winner.' });
    }

    // §3 cost estimate (model-aware); §25 logging (never logs image bytes).
    const [priceIn, priceOut] = isGemini3 ? [1.5, 9.0] : [0.3, 2.5];
    const cost = (usage.input / 1e6) * priceIn + (usage.output / 1e6) * priceOut;
    console.log(JSON.stringify({
      battle_id: battleId, model, schema_version: VERSUS_SCHEMA_VERSION,
      input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total,
      latency_ms: Date.now() - started, success: true, estimated_cost: Number(cost.toFixed(6)),
    }));

    return json({ ok: true, result });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    console.log(JSON.stringify({ battle_id: battleId, model, success: false, failure_code: code, latency_ms: Date.now() - started }));
    // 200 (not 502) so supabase-js exposes the body and the UI can show this reason.
    return json({ ok: false, kind: 'error', message: reasonFor(code) });
  }
});
