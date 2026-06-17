// supabase/functions/solo-scan/index.ts
import { soloScanSchema } from 'shared/solo-scan/schema.ts';
import { assembleResult } from 'shared/solo-scan/assemble.ts';
import { SOLO_SCAN_PROMPT_VERSION, SOLO_SCAN_SCHEMA_VERSION } from 'shared/solo-scan/constants.ts';
import { callGemini, type InlineImage } from './gemini.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

interface ReqBody {
  scanId: string;
  face?: InlineImage;
  outfit?: InlineImage;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, kind: 'error', message: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_SOLO_SCAN_MODEL') ?? 'gemini-2.5-flash';
  if (!apiKey) return json({ ok: false, kind: 'error', message: 'missing_api_key' }, 500);

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
    });

    const parsed = soloScanSchema.safeParse(raw);
    if (!parsed.success) {
      console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: 'schema_invalid', latency_ms: Date.now() - started }));
      return json({ ok: false, kind: 'error', message: 'schema_invalid' }, 502);
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
      result = assembleResult(ai, scanId, SOLO_SCAN_PROMPT_VERSION, parts);
    } catch {
      return json({
        ok: false, kind: 'retake', faceUsable: true, outfitUsable: true,
        instruction: 'We could not read enough detail — try a sharper, better-lit photo.',
      });
    }

    // rules doc §3 cost estimate; §25 logging (never logs image bytes).
    const cost = (usage.input / 1e6) * 0.3 + (usage.output / 1e6) * 2.5;
    console.log(JSON.stringify({
      scan_id: scanId, model, prompt_version: SOLO_SCAN_PROMPT_VERSION, schema_version: SOLO_SCAN_SCHEMA_VERSION,
      input_tokens: usage.input, output_tokens: usage.output, total_tokens: usage.total,
      latency_ms: Date.now() - started, success: true, estimated_cost: Number(cost.toFixed(6)),
    }));

    return json({ ok: true, result });
  } catch (e) {
    console.log(JSON.stringify({ scan_id: scanId, model, success: false, failure_code: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - started }));
    return json({ ok: false, kind: 'error', message: 'generation_failed' }, 502);
  }
});
