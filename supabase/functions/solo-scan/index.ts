// supabase/functions/solo-scan/index.ts
import { soloScanV4Schema, SOLO_SCAN_V4_SCHEMA_VERSION } from 'shared/solo-scan/v4/schema.ts';
import { shapeV4Result } from 'shared/solo-scan/v4/shape.ts';
import { V4_SYSTEM_INSTRUCTION, V4_RESPONSE_SCHEMA } from 'shared/solo-scan/v4/prompt.ts';
import { callGemini, type InlineImage } from './gemini.ts';

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

interface ReqBody {
  scanId: string;
  face?: InlineImage;
  outfit?: InlineImage;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, kind: 'error', message: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_SOLO_SCAN_MODEL') ?? 'gemini-3.5-flash';
  if (!apiKey) return json({ ok: false, kind: 'error', message: 'missing_api_key' }, 500);
  // Gemini 3.x uses thinking_level (not thinkingBudget) and is priced higher.
  const isGemini3 = model.startsWith('gemini-3');

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, kind: 'error', message: 'bad_request' }, 400);
  }
  const { scanId, face, outfit } = body ?? {};
  // ~20 MB decoded is Gemini's inline-data ceiling; base64 inflates ~4/3.
  const MAX_B64 = 27_000_000;
  const okImg = (i: InlineImage | undefined) =>
    !!i && typeof i.data === 'string' && i.data.length > 0 && i.data.length <= MAX_B64
    && /^image\/(jpeg|png|webp)$/.test(i.mimeType ?? '');
  const parts = { face: okImg(face), outfit: okImg(outfit) };
  if (!scanId || (!parts.face && !parts.outfit)) {
    return json({ ok: false, kind: 'error', message: 'invalid_images' }, 400);
  }

  const started = Date.now();
  try {
    const { raw, usage } = await callGemini({
      apiKey, model,
      face: parts.face ? face : undefined,
      outfit: parts.outfit ? outfit : undefined,
      systemInstruction: V4_SYSTEM_INSTRUCTION,
      responseSchema: V4_RESPONSE_SCHEMA,
      // 'low' (not 'minimal'): minimal bought ~no speed (latency is output generation)
      // and made the model narrate the photo instead of landing roasts. 'low' is the
      // validated quality.
      thinkingConfig: isGemini3 ? { thinkingLevel: 'low' } : { thinkingBudget: 0 },
      maxOutputTokens: 4096,
    });

    const parsed = soloScanV4Schema.safeParse(raw);
    if (!parsed.success) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'schema_invalid', latency_ms: Date.now() - started }));
      return json({ ok: false, kind: 'error', message: 'The AI returned an unreadable result. Give it another go.' }, 502);
    }
    const ai = parsed.data;

    if (!ai.inputQuality.usable) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'unusable_input', latency_ms: Date.now() - started }));
      return json({
        ok: false,
        kind: 'retake',
        faceUsable: parts.face ? ai.inputQuality.faceUsable : false,
        outfitUsable: parts.outfit ? ai.inputQuality.outfitUsable : false,
        instruction: ai.inputQuality.retakeInstruction ?? 'Try a clearer, well-lit photo.',
      });
    }

    let result;
    try {
      result = shapeV4Result(ai, scanId, parts);
    } catch {
      return json({
        ok: false, kind: 'retake', faceUsable: true, outfitUsable: true,
        instruction: 'We could not read enough detail — try a sharper, better-lit photo.',
      });
    }

    // §3 cost estimate (model-aware); §25 logging (never logs image bytes).
    const [priceIn, priceOut] = isGemini3 ? [1.5, 9.0] : [0.3, 2.5];
    const cost = (usage.input / 1e6) * priceIn + (usage.output / 1e6) * priceOut;
    console.log(JSON.stringify({
      scan_id: scanId, model, schema_version: SOLO_SCAN_V4_SCHEMA_VERSION,
      input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total,
      latency_ms: Date.now() - started, success: true, estimated_cost: Number(cost.toFixed(6)),
    }));

    return json({ ok: true, result });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: code, latency_ms: Date.now() - started }));
    return json({ ok: false, kind: 'error', message: reasonFor(code) }, 502);
  }
});
