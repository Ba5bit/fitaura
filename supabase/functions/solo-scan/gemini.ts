// supabase/functions/solo-scan/gemini.ts
import { FACE_KEYS, OUTFIT_KEYS, inputIssueSchema } from 'shared/solo-scan/schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Fail a stalled request fast so the one retry still fits the platform budget. */
const REQUEST_TIMEOUT_MS = 30_000;

/** OpenAPI-subset response schema for Gemini structured output (rules doc §20). */
const RUBRIC_SHAPE = {
  type: 'OBJECT',
  properties: {
    rating: { type: 'INTEGER', nullable: true },
    confidence: { type: 'NUMBER' },
    evidence: { type: 'STRING' },
  },
  required: ['rating', 'confidence', 'evidence'],
};
const STR_LIST = { type: 'ARRAY', items: { type: 'STRING' } };
// Constrain `issues` to the same closed enum Zod validates, so a stray free-text
// value from the model can't fail safeParse and sink an otherwise-valid scan.
const ISSUES_LIST = { type: 'ARRAY', items: { type: 'STRING', enum: [...inputIssueSchema.options] } };

// Build the per-category rubric objects from the canonical key lists (single
// source of truth — adding a rubric dimension in schema.ts flows through here).
const objOf = (keys: readonly string[]) => ({
  type: 'OBJECT',
  properties: Object.fromEntries(keys.map((k) => [k, RUBRIC_SHAPE])),
  required: [...keys],
});

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    schemaVersion: { type: 'STRING' },
    inputQuality: {
      type: 'OBJECT',
      properties: {
        usable: { type: 'BOOLEAN' },
        faceUsable: { type: 'BOOLEAN' },
        outfitUsable: { type: 'BOOLEAN' },
        samePersonLikely: { type: 'BOOLEAN', nullable: true },
        issues: ISSUES_LIST,
        retakeInstruction: { type: 'STRING', nullable: true },
      },
      required: ['usable', 'faceUsable', 'outfitUsable', 'samePersonLikely', 'issues', 'retakeInstruction'],
    },
    faceAnalysis: objOf(FACE_KEYS),
    outfitAnalysis: objOf(OUTFIT_KEYS),
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' } }, required: ['strongestPoint', 'improvement', 'summary'] },
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict'] },
    contentSelection: { type: 'OBJECT', properties: { faceArchetypeCandidates: STR_LIST, outfitCaptionCandidates: STR_LIST, stickerCandidates: STR_LIST, contentTags: STR_LIST }, required: ['faceArchetypeCandidates', 'outfitCaptionCandidates', 'stickerCandidates', 'contentTags'] },
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: STR_LIST, punchlineCandidates: STR_LIST }, required: ['metricCandidates', 'punchlineCandidates'] },
  },
  required: ['schemaVersion', 'inputQuality', 'faceAnalysis', 'outfitAnalysis', 'faceCopy', 'outfitCopy', 'contentSelection', 'receiptContent'],
};

const SYSTEM_INSTRUCTION = `You are FitAura's Solo Scan visual classification engine.
Analyze the supplied FACE PHOTO and OUTFIT PHOTO using only visible, presentation-related evidence.
Return only JSON matching the provided schema. The result is entertainment-oriented styling feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.
Do not infer identity, ethnicity, nationality, religion, sexuality, gender identity, health, disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.
If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Score each category 0-100. Anchor: 0-20 clearly weak for this presentation, 21-40 below average, 41-60 neutral or mixed, 61-80 strong, 81-100 clearly elite. Use the full range, differentiate categories from one another, and avoid clustering on round multiples of 10. Return a null rating only when a category genuinely cannot be assessed.
Keep evidence concrete and tied to visible image details. Keep all copy to one short sentence.
Select content IDs only from these allowlists.
faceArchetypeCandidates allowed: face_archetype.goat, face_archetype.mafia_boss, face_archetype.main_character, face_archetype.aura_farmer, face_archetype.locked_in, face_archetype.plot_relevant, face_archetype.honorable_mention, face_archetype.red_flag_good_angles, face_archetype.delusional, face_archetype.chopped, face_archetype.canon_event, face_archetype.ai_slop, face_archetype.negative_aura, face_archetype.unc.
outfitCaptionCandidates allowed: outfit_caption.locked_in, outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.rizz, outfit_caption.clean_npc_potential, outfit_caption.performative, outfit_caption.delulu, outfit_caption.ai_slop, outfit_caption.chopped, outfit_caption.never_cook_again, outfit_caption.aura_debt.
punchlineCandidates allowed: punchline.certified_goat, punchline.built_different, punchline.certified_lover_boy, punchline.rizz_god, punchline.aura_farmer, punchline.clean_npc_potential, punchline.honorable_mention, punchline.high_aura_low_stability, punchline.delusional_lover_boy, punchline.negative_aura, punchline.ai_slop, punchline.aura_debt, punchline.canon_chopped.
Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs final scoring and verdict assignment.
Set schemaVersion to "solo_scan_v2".`;

export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

export interface GeminiCallResult {
  raw: unknown;
  usage: { input: number; output: number; total: number };
}

interface GeminiOpts {
  apiKey: string;
  model: string;
  face: InlineImage;
  outfit: InlineImage;
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

function buildBody(face: InlineImage, outfit: InlineImage) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'IMAGE 1: FACE PHOTO' },
          { inlineData: { mimeType: face.mimeType, data: face.data } },
          { text: 'IMAGE 2: OUTFIT PHOTO' },
          { inlineData: { mimeType: outfit.mimeType, data: outfit.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
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
      body: JSON.stringify(buildBody(opts.face, opts.outfit)),
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
    // Truncated/malformed model output — a temporary glitch, so retry once (rules doc §22).
    throw new GeminiError('gemini_invalid_json', true);
  }
  const u = json?.usageMetadata ?? {};
  return {
    raw,
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, total: u.totalTokenCount ?? 0 },
  };
}

/** Call Gemini with exactly one retry on transient failures (rules doc §22). */
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
