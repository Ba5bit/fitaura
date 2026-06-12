// supabase/functions/solo-scan/gemini.ts
import type { SoloScanAIOutput } from 'shared/solo-scan/schema.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** OpenAPI-subset response schema for Gemini structured output (rules doc §20). */
const rubric = () => ({
  type: 'OBJECT',
  properties: {
    rating: { type: 'INTEGER', nullable: true },
    confidence: { type: 'NUMBER' },
    evidence: { type: 'STRING' },
  },
  required: ['rating', 'confidence', 'evidence'],
});
const faceKeys = ['photoPresentation', 'faceHarmony', 'jawPresence', 'haircutMatch', 'groomingCoherence', 'visualPresence', 'mainCharacterEnergy'];
const outfitKeys = ['fit', 'silhouette', 'proportions', 'colorCoherence', 'physiqueMatch', 'layering', 'accessories', 'stylingIntent', 'overallCohesion'];
const objOf = (keys: string[]) => ({
  type: 'OBJECT',
  properties: Object.fromEntries(keys.map((k) => [k, rubric()])),
  required: keys,
});
const strList = () => ({ type: 'ARRAY', items: { type: 'STRING' } });

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
        issues: strList(),
        retakeInstruction: { type: 'STRING', nullable: true },
      },
      required: ['usable', 'faceUsable', 'outfitUsable', 'samePersonLikely', 'issues', 'retakeInstruction'],
    },
    faceAnalysis: objOf(faceKeys),
    outfitAnalysis: objOf(outfitKeys),
    faceCopy: { type: 'OBJECT', properties: { strongestPoint: { type: 'STRING' }, improvement: { type: 'STRING' }, summary: { type: 'STRING' } }, required: ['strongestPoint', 'improvement', 'summary'] },
    outfitCopy: { type: 'OBJECT', properties: { works: { type: 'STRING' }, hurts: { type: 'STRING' }, verdict: { type: 'STRING' } }, required: ['works', 'hurts', 'verdict'] },
    contentSelection: { type: 'OBJECT', properties: { faceArchetypeCandidates: strList(), outfitCaptionCandidates: strList(), stickerCandidates: strList(), contentTags: strList() }, required: ['faceArchetypeCandidates', 'outfitCaptionCandidates', 'stickerCandidates', 'contentTags'] },
    receiptContent: { type: 'OBJECT', properties: { metricCandidates: strList(), punchlineCandidates: strList() }, required: ['metricCandidates', 'punchlineCandidates'] },
  },
  required: ['schemaVersion', 'inputQuality', 'faceAnalysis', 'outfitAnalysis', 'faceCopy', 'outfitCopy', 'contentSelection', 'receiptContent'],
};

const SYSTEM_INSTRUCTION = `You are FitAura's Solo Scan visual classification engine.
Analyze the supplied FACE PHOTO and OUTFIT PHOTO using only visible, presentation-related evidence.
Return only JSON matching the provided schema. The result is entertainment-oriented styling feedback. Do not present subjective judgments as scientific, biometric, medical, or psychological facts.
Do not infer identity, ethnicity, nationality, religion, sexuality, gender identity, health, disability, wealth, criminality, real trustworthiness, real personality, or romantic compatibility.
If an attribute cannot be assessed reliably, return a null rating and explain why briefly.
Use the 1-5 rubric consistently: 1 clearly weak in this presentation, 2 below average, 3 neutral or mixed, 4 strong, 5 clearly strong.
Keep evidence concrete and tied to visible image details. Keep all copy to one short sentence.
Select content IDs only from these allowlists.
faceArchetypeCandidates allowed: face_archetype.aura_farmer, face_archetype.main_character_intern, face_archetype.chad, face_archetype.plot_relevant, face_archetype.red_flag_good_angles.
outfitCaptionCandidates allowed: outfit_caption.let_him_cook, outfit_caption.fit_has_lore, outfit_caption.clean_npc_potential, outfit_caption.performative, outfit_caption.never_cook_again.
punchlineCandidates allowed: punchline.certified_lover_boy, punchline.high_aura_low_stability, punchline.clean_npc_potential, punchline.aura_farmer.
Do not calculate the final Aura Score, Dating Score, or categorical verdict. The backend performs final scoring and verdict assignment.
Set schemaVersion to "solo_scan_v1".`;

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
      temperature: 0.2,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

async function once(opts: GeminiOpts): Promise<GeminiCallResult> {
  const url = `${ENDPOINT}/${opts.model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify(buildBody(opts.face, opts.outfit)),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`gemini_http_${res.status}`);
    // Mark transient statuses so the caller can retry once.
    (err as { transient?: boolean }).transient = res.status === 429 || res.status >= 500;
    (err as { detail?: string }).detail = body.slice(0, 300);
    throw err;
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const err = new Error('gemini_empty_response');
    (err as { transient?: boolean }).transient = true;
    throw err;
  }
  const u = json?.usageMetadata ?? {};
  return {
    raw: JSON.parse(text) as unknown,
    usage: { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0, total: u.totalTokenCount ?? 0 },
  };
}

/** Call Gemini with exactly one retry on transient failures (rules doc §22). */
export async function callGemini(opts: GeminiOpts): Promise<GeminiCallResult> {
  try {
    return await once(opts);
  } catch (e) {
    if ((e as { transient?: boolean }).transient) {
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
      return once(opts);
    }
    throw e;
  }
}

export type { SoloScanAIOutput };
