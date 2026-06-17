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
    presentation: {
      type: 'OBJECT',
      properties: {
        gender: { type: 'STRING', enum: ['femme', 'masc', 'unsure'] },
        genderConfidence: { type: 'NUMBER' },
        expressionStrength: { type: 'INTEGER' },
        ageEstimate: { type: 'INTEGER', nullable: true },
        recognizedIcon: { type: 'STRING', nullable: true },
        recognizedConfidence: { type: 'NUMBER' },
        recognizedKind: { type: 'STRING', enum: ['meme', 'real_person'], nullable: true },
      },
      required: ['gender', 'genderConfidence', 'expressionStrength', 'ageEstimate', 'recognizedIcon', 'recognizedConfidence', 'recognizedKind'],
    },
    faceAnalysis: objOf(FACE_KEYS),
    outfitAnalysis: objOf(OUTFIT_KEYS),
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' } }, required: ['strongestPoint', 'improvement', 'summary'] },
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict'] },
    contentSelection: { type: 'OBJECT', properties: { faceArchetypeCandidates: STR_LIST, outfitCaptionCandidates: STR_LIST, stickerCandidates: STR_LIST, contentTags: STR_LIST }, required: ['faceArchetypeCandidates', 'outfitCaptionCandidates', 'stickerCandidates', 'contentTags'] },
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: STR_LIST, punchlineCandidates: STR_LIST }, required: ['metricCandidates', 'punchlineCandidates'] },
  },
  required: ['schemaVersion', 'inputQuality', 'presentation', 'faceAnalysis', 'outfitAnalysis', 'faceCopy', 'outfitCopy', 'contentSelection', 'receiptContent'],
};

const SYSTEM_INSTRUCTION = `You are FitAura's Solo Scan visual classification engine.
Analyze the supplied photo(s) using only visible, presentation-related evidence. You may receive a FACE PHOTO, an OUTFIT PHOTO, or both.
Return only JSON matching the provided schema. The result is entertainment-oriented styling feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.

GENDER PRESENTATION: Classify the subject's apparent gender presentation as "femme", "masc", or "unsure" with genderConfidence 0-1, for entertainment styling only. This is a read of presentation, NOT a claim about identity, and may be wrong; use "unsure" when genuinely ambiguous. Set expressionStrength 0-100 for how strongly the look reads as that presentation (a vanity stat, not attractiveness).
AGE: Set ageEstimate to the subject's apparent age in years (integer, ~13-90) for entertainment only — a playful guess from the visible face, NOT a factual claim. Use null only if no face is provided or age genuinely cannot be guessed.
Do not infer ethnicity, nationality, religion, sexuality, health, disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.

ICON RECOGNITION: You MAY recognize widely-known public figures or popular fictional/meme characters and set recognizedIcon to the name with recognizedConfidence 0-1. Also set recognizedKind: "meme" for a fictional, cartoon, comedic, or internet-meme character (e.g. McLovin), or "real_person" for a real public figure or celebrity (athlete, actor, musician, etc.). NEVER attempt to identify a private or ordinary individual; if the subject is not a widely-known public figure or meme character, set recognizedIcon to null and recognizedKind to null. A resemblance is entertainment, not a factual identity claim.

SINGLE IMAGE: If only one photo is provided, score only that modality. For the absent modality, set EVERY rating in its analysis block to null (confidence 0, brief evidence "not provided"). Do NOT add an input issue for the absent modality and do NOT request a retake because it is missing. Set the absent modality's *Usable flag to false but keep inputQuality.usable true as long as the provided photo(s) are usable.

If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Score each category 0-100. Anchor: 0-20 clearly weak for this presentation, 21-40 below average, 41-60 neutral or mixed, 61-80 strong, 81-100 clearly elite. Use the full range, differentiate categories from one another, and avoid clustering on round multiples of 10. Return a null rating only when a category genuinely cannot be assessed.

VOICE: Write every copy field as a savage, funny roast of the look, fit, pose and vibe — confident, internet-native, in the sticker lexicon (rizz, NPC, delulu, chopped, aura, sigma, mid). Roast hard, but ONLY the presentation. NEVER roast or reference ethnicity, nationality, religion, sexuality, disability, body in a hateful way, or any protected trait. One short, punchy sentence per field.
BANNED (never write like an AI or a corporate fashion app): "elevate", "in today's world", "let's dive in", "it's not just X it's Y", "a testament to", "when it comes to", "consider ...", em-dash sermons, hedging, polite filler. Be sharp, plain, human and funny.

Select content IDs only from these allowlists, matching the detected gender. If gender is "femme", pick from NEUTRAL or FEMME only. If gender is "masc" or "unsure", pick from NEUTRAL or MASC only. Femme copy must use female-coded language (never "lover boy").
faceArchetypeCandidates:
  NEUTRAL: face_archetype.goat, face_archetype.mafia_boss, face_archetype.main_character, face_archetype.aura_farmer, face_archetype.locked_in, face_archetype.plot_relevant, face_archetype.honorable_mention, face_archetype.red_flag_good_angles, face_archetype.delusional, face_archetype.chopped, face_archetype.canon_event, face_archetype.ai_slop, face_archetype.negative_aura, face_archetype.unc.
  MASC: face_archetype.gigachad, face_archetype.alpha_male, face_archetype.sigma_male, face_archetype.milf_hunter, face_archetype.performative_male, face_archetype.simp, face_archetype.beta_male, face_archetype.tate_follower.
  FEMME: face_archetype.mother, face_archetype.femme_fatale, face_archetype.it_girl, face_archetype.girlboss, face_archetype.material_girl, face_archetype.vip, face_archetype.clean_girl, face_archetype.brat, face_archetype.drama_queen.
outfitCaptionCandidates:
  NEUTRAL: outfit_caption.locked_in, outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.rizz, outfit_caption.clean_npc_potential, outfit_caption.performative, outfit_caption.delulu, outfit_caption.ai_slop, outfit_caption.chopped, outfit_caption.never_cook_again, outfit_caption.aura_debt.
  MASC: outfit_caption.sigma_grindset, outfit_caption.millennial_coded, outfit_caption.unc_fit, outfit_caption.old_money_temu, outfit_caption.boomer.
  FEMME: outfit_caption.fashion_girl, outfit_caption.vip_fit, outfit_caption.material_girl_fit, outfit_caption.brat_fit, outfit_caption.clean_girl_fit.
punchlineCandidates:
  NEUTRAL: punchline.certified_goat, punchline.built_different, punchline.certified_lover_boy, punchline.rizz_god, punchline.aura_farmer, punchline.clean_npc_potential, punchline.honorable_mention, punchline.high_aura_low_stability, punchline.delusional_lover_boy, punchline.negative_aura, punchline.ai_slop, punchline.aura_debt, punchline.canon_chopped, punchline.no_cap, punchline.bro_capping.
  MASC: punchline.alpha_confirmed, punchline.sigma_grindset, punchline.milf_hunter_license, punchline.certified_simp, punchline.beta_energy, punchline.tate_dropout.
  FEMME: punchline.mother_mothered, punchline.slay, punchline.it_girl, punchline.girlboss_trio, punchline.drama_queen_crowned.

Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs final scoring and verdict assignment. Do not write the recognized icon's name into the copy; the backend decides whether to surface it.
Set schemaVersion to "solo_scan_v3_3".`;

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
  face?: InlineImage;
  outfit?: InlineImage;
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

function buildBody(face?: InlineImage, outfit?: InlineImage) {
  const parts: Array<Record<string, unknown>> = [];
  if (face) {
    parts.push({ text: 'IMAGE: FACE PHOTO' });
    parts.push({ inlineData: { mimeType: face.mimeType, data: face.data } });
  }
  if (outfit) {
    parts.push({ text: 'IMAGE: OUTFIT PHOTO' });
    parts.push({ inlineData: { mimeType: outfit.mimeType, data: outfit.data } });
  }
  return {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts }],
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
