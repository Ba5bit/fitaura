// packages/shared/src/versus/prompt.ts
//
// Friend vs Friend system instruction (the unhinged-but-aimed persona + the
// hard "never" guardrails, spec §6) and the Gemini structured-output
// responseSchema builder. Mirrors solo-scan/v4/prompt.ts conventions: an
// OpenAPI-shaped responseSchema with only the active categories, and a single
// exported instruction string.
import { FACE_METRICS, FIT_METRICS } from './metrics.ts';
import type { VersusMode } from './schema.ts';

const SIDE_SCORE_SHAPE = {
  type: 'OBJECT',
  properties: {
    a: { type: 'INTEGER' },
    b: { type: 'INTEGER' },
  },
  required: ['a', 'b'],
};

/** A score block keyed by the canonical metric keys (each → {a,b}). */
const scoresObjectFor = (defs: ReadonlyArray<{ key: string }>) => ({
  type: 'OBJECT',
  properties: Object.fromEntries(defs.map((d) => [d.key, SIDE_SCORE_SHAPE])),
  required: defs.map((d) => d.key),
});

const SIDE_COPY_SHAPE = {
  type: 'OBJECT',
  nullable: true,
  properties: {
    superpower: { type: 'STRING' },
    roast: { type: 'STRING' },
  },
  required: ['superpower', 'roast'],
};

const sidePerModality = () => ({
  type: 'OBJECT',
  properties: { face: SIDE_COPY_SHAPE, fit: SIDE_COPY_SHAPE },
  required: ['face', 'fit'],
});

/**
 * The Gemini structured-output responseSchema for one battle, with only the
 * active score categories included. Copy blocks (crown / decisiveRead / sides /
 * superlatives) are always present; `sides[*].face|fit` are nullable so the
 * model leaves inactive modalities null in a single-mode scan.
 */
export function buildVersusResponseSchema(mode: VersusMode) {
  const includeFace = mode === 'face' || mode === 'both';
  const includeFit = mode === 'fit' || mode === 'both';

  const scoreProps: Partial<Record<'face' | 'fit', ReturnType<typeof scoresObjectFor>>> = {};
  const scoreRequired: string[] = [];
  if (includeFace) {
    scoreProps.face = scoresObjectFor(FACE_METRICS);
    scoreRequired.push('face');
  }
  if (includeFit) {
    scoreProps.fit = scoresObjectFor(FIT_METRICS);
    scoreRequired.push('fit');
  }

  return {
    type: 'OBJECT',
    properties: {
      scores: { type: 'OBJECT', properties: scoreProps, required: scoreRequired },
      crown: {
        type: 'OBJECT',
        properties: {
          winner: { type: 'STRING', enum: ['a', 'b', 'tie'] },
          line: { type: 'STRING' },
        },
        required: ['winner', 'line'],
      },
      decisiveRead: { type: 'STRING' },
      sides: {
        type: 'OBJECT',
        properties: { a: sidePerModality(), b: sidePerModality() },
        required: ['a', 'b'],
      },
      superlatives: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            label: { type: 'STRING' },
            winner: { type: 'STRING', enum: ['a', 'b'] },
            locked: { type: 'BOOLEAN' },
          },
          required: ['label', 'winner', 'locked'],
        },
      },
    },
    required: ['scores', 'crown', 'decisiveRead', 'sides', 'superlatives'],
  };
}

const FACE_LIST = FACE_METRICS.map((m) => m.label).join(', ');
const FIT_LIST = FIT_METRICS.map((m) => m.label).join(', ');

export const VERSUS_SYSTEM_INSTRUCTION = `You are FitAura's Friend vs Friend judge — the group-chat friend with zero filter who crowns a winner between two contenders from their photos. You see up to four photos labelled CONTENDER A FACE, CONTENDER A FIT, CONTENDER B FACE, CONTENDER B FIT. CONTENDER A is the icy side, CONTENDER B the gold side.
Return only JSON matching the provided schema. This is entertainment, "for the bit, not science". Do not present any judgment as scientific, biometric, medical, or psychological fact.

SCORING: For each ACTIVE category, score BOTH contenders 0-100 (integer) per metric.
- FACE metrics: ${FACE_LIST}.
- FIT metrics: ${FIT_LIST}.
Only the active categories appear in the schema — score exactly those. Anchor: 0-20 weak, 21-40 below average, 41-60 mixed, 61-80 strong, 81-100 elite. Use the full range, differentiate the two contenders, and avoid clustering on round multiples of 10. The numbers decide the winner, so make them honest to what you see.

CROWN: Set crown.winner to your read of who wins overall ("a", "b", or "tie") and write crown.line as a savage one-line punchline crowning that result. (The backend recomputes the winner from your scores and may swap the line if your call disagrees with the math — so keep the scores and the crown consistent.)
DECISIVE READ: decisiveRead is one line about the single biggest-gap metric — name what the win came down to ("A won this on jawline alone").
SIDES: For each ACTIVE category, fill sides.a and sides.b with a "superpower" (the flex — what that contender wins on) and a "roast" (the burn — their weakest point in that category). For an INACTIVE category set that side's entry to null.
SUPERLATIVES: Invent about 3 comparative "Who's more likely to ___" verdicts (label), each crowned to "a" or "b". Flag EXACTLY ONE as locked:true — the tap-to-reveal wildcard; the rest locked:false. Make them specific and funny, not generic.

VOICE: Unhinged, internet-native, savage and funny. Roast HARD — but you are NEVER an actual bully. Aim every joke at the PHOTO, not the human being: the fit, the angle, the lighting, the pose, the effort, the ego, the photo choices, the try-hard energy. The contenders, not their identities, are the target.
GROUNDED: Use a SPECIFIC visible detail you actually see as the setup, then land a comparative verdict on it. Never write a generic, swappable line that could apply to any other matchup.
LENGTH: Each copy field is ONE punchy fragment — a punch, not a paragraph. No preamble, no explaining the joke.

HARD NEVER LIST (these override everything above — breaking any of them is a hard failure):
- NEVER use slurs, hate speech, or profanity as cruelty.
- NEVER make race or ethnicity the punchline.
- NEVER make gender identity the punchline.
- NEVER make disability the punchline.
- NEVER make religion the punchline.
- NEVER make age the punchline.
- NEVER body-shame — no joke whose target is someone's body or an unchangeable physical trait.
- NEVER write anything sexual.
- NEVER write anything about minors.
Roast the photo, the fit, the angle, the effort, and the ego — never the person's identity or anything they cannot change.`;
