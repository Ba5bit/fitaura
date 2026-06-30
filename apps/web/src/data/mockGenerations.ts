import {
  STICKER_BANK,
  stickerFromPreset,
  type DatingVerdict,
  type FaceCardContent,
  type FullGenerationResult,
  type ScoreItem,
} from '@fitaura/shared';
import exampleFace from '../assets/example-face.jpg';
import exampleFit from '../assets/example-fit.jpg';
import gigachad from '../assets/example-face.jpg';
import mclovin from '../assets/hero-mclovin.jpg';
import bateman from '../assets/hero-bateman.jpg';

/**
 * Example demo photos baked into the mock so the Landing's example Face/Outfit
 * cards render real imagery (real generations override these with the user's own
 * uploads in `runGeneration`). Face Card ← portrait, Outfit Card ← full silhouette.
 */
const EXAMPLE_FACE = exampleFace;
const EXAMPLE_FIT = exampleFit;

/**
 * Ported content bank — the three mutually-exclusive verdict states from the
 * imported design (`cards.jsx` FITAURA_DATA, `result-analysis.jsx`
 * FACE_ANALYSIS + RESULT_READS), reshaped into the typed result model.
 *
 * All numbers are playful / subjective — never framed as medical, biometric or
 * attractiveness truth. This stands in for the AI-produced JSON until the
 * NestJS backend is wired in.
 */

function score(label: string, value: number, hot = false): ScoreItem {
  return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, value, hot };
}

/** Display-only age stat (no bar) for the face card's 2nd slot. */
function ageStat(age: number): ScoreItem {
  return { id: 'age', label: 'Est. Age', value: age, displayValue: `${age} y.o.`, noBar: true };
}

const FACE_STICKER = {
  red_flag: stickerFromPreset(STICKER_BANK.face[0]), // HEAR ME OUT
  normie: stickerFromPreset(STICKER_BANK.face[1]), // PLOT RELEVANT
  green_flag: stickerFromPreset(STICKER_BANK.face[2]), // AURA FARMER
} satisfies Record<DatingVerdict, ReturnType<typeof stickerFromPreset>>;

const outfitSticker = (id: string) => stickerFromPreset(STICKER_BANK.outfit.find((s) => s.id === id)!);
const OUTFIT_STICKER = {
  red_flag: outfitSticker('never-cook-again'),
  normie: outfitSticker('buffering'),
  green_flag: outfitSticker('let-him-cook'),
} satisfies Record<DatingVerdict, ReturnType<typeof stickerFromPreset>>;

export const MOCK_GENERATIONS: Record<DatingVerdict, FullGenerationResult> = {
  red_flag: {
    verdict: 'red_flag',
    chip: 'VERDICT · RED FLAG',
    gender: 'femme',
    parts: { face: true, outfit: true },
    face: {
      card: {
        imageUrl: null,
        eyebrow: 'FACE VERDICT',
        verdict: ['RED FLAG', 'WITH GOOD ANGLES'],
        index: 'AURA INDEX 71',
        scores: [
          score('Aura', 71),
          ageStat(26),
          score('Femininity', 66),
          score('Main Character', 55, true),
        ],
        sticker: FACE_STICKER.red_flag,
      },
      analysis: {
        aura: 71,
        explanation:
          'Top-tier jaw, mid-tier everything else. The aura is real — it is just renting space on a face that peaks at exactly one angle.',
        roast: 'Red flag, god-tier angles.',
        breakdown: [
          { id: 'jaw', label: 'Jawline Frame', value: 84, descriptor: 'Sharp', icon: 'jaw' },
          { id: 'harmony', label: 'Face Harmony', value: 63, descriptor: 'Off-axis', icon: 'harmony' },
          { id: 'presence', label: 'Eye Presence', value: 70, descriptor: 'Magnetic', icon: 'eye' },
          { id: 'eyebrows', label: 'Eyebrows', value: 78, descriptor: 'Expressive', icon: 'brow' },
          { id: 'facial-hair', label: 'Facial Hair', value: 52, descriptor: 'Patchy', icon: 'beard' },
          { id: 'main-character', label: 'Facial Structure', value: 55, descriptor: 'Side quest', icon: 'star' },
        ],
      },
    },
    outfit: {
      card: {
        imageUrl: null,
        caption: 'GYM BRO ATTEMPTS EDITORIAL',
        overallScore: 74,
        scores: [
          score('Silhouette', 68),
          score('Proportions', 61),
          score('Fit', 79),
          score('Physique Match', 86),
        ],
        sticker: OUTFIT_STICKER.red_flag,
      },
      analysis: {
        explanation:
          'Gym bro cosplaying as editorial. The physique match is genuinely unfair — the proportions are a cry for help wearing a nice fit.',
        works: 'The jacket creates a stronger shoulder line.',
        hurts: 'The trouser break shortens the silhouette.',
        verdict: 'Physique carried the whole fit.',
        tags: [
          { label: 'physique > fit', tone: 'good' },
          { label: 'tried something', tone: 'good' },
          { label: 'proportions need help', tone: 'bad' },
        ],
        supporting: [
          { id: 'shoulder-definition', label: 'Shoulder Definition', value: 82, note: 'Jacket structure pushes the shoulder line wider.' },
          { id: 'waist-definition', label: 'Waist Definition', value: 54, note: 'Loose hem hides where the waist actually sits.' },
          { id: 'leg-length-effect', label: 'Leg Length Effect', value: 61, note: 'High trouser break clips the leg line short.' },
          { id: 'body-balance', label: 'Body Balance', value: 58, note: 'Top-heavy — upper body outweighs the base.' },
        ],
      },
    },
    receipt: {
      generationId: '0xA73F',
      generatedAt: '2026-06-10T14:08:00.000Z',
      datingScore: 6.7,
      auraValue: 240,
      rows: [
        { id: 'dating-score', label: 'Dating Score', value: '6.7 / 10' },
        { id: 'aura-gained', label: 'Aura Gained', value: '+240', tone: 'good' },
        { id: 'ghosting', label: 'Ghosting Potential', value: 'HIGH', tone: 'hi' },
        { id: 'commitment', label: 'Commitment Risk', value: 'SEVERE', tone: 'hi' },
        { id: 'delusion', label: 'Delusion Index', value: '73%' },
        { id: 'lover-boy', label: 'Lover-Boy Prob.', value: '31%' },
      ],
      datingVerdict: 'red_flag',
      finalPunchline: 'RED FLAG WITH GOOD ANGLES',
      stamp: ['FITAURA', 'VERIFIED'],
      summary:
        'High aura, questionable commitment. Posts like a green flag, behaves like a plot twist. Date at your own risk; archive the receipt for evidence.',
    },
  },

  green_flag: {
    verdict: 'green_flag',
    chip: 'VERDICT · GREEN FLAG',
    gender: 'masc',
    parts: { face: true, outfit: true },
    face: {
      card: {
        imageUrl: EXAMPLE_FACE,
        eyebrow: 'FACE VERDICT',
        verdict: ['MAIN', 'CHARACTER'],
        index: 'AURA INDEX 92',
        scores: [
          score('Aura', 92),
          ageStat(27),
          score('Masculinity', 86),
          score('Main Character', 94),
        ],
        sticker: FACE_STICKER.green_flag,
      },
      analysis: {
        aura: 92,
        explanation:
          'Everything cooperated at once. Symmetry, structure and aura all showed up to the same meeting and, shockingly, agreed.',
        roast: 'Disgustingly photogenic. No notes.',
        breakdown: [
          { id: 'jaw', label: 'Jawline Frame', value: 88, descriptor: 'Carved', icon: 'jaw' },
          { id: 'harmony', label: 'Face Harmony', value: 90, descriptor: 'Balanced', icon: 'harmony' },
          { id: 'presence', label: 'Eye Presence', value: 93, descriptor: 'Commanding', icon: 'eye' },
          { id: 'eyebrows', label: 'Eyebrows', value: 86, descriptor: 'Elite', icon: 'brow' },
          { id: 'facial-hair', label: 'Facial Hair', value: 84, descriptor: 'Intentional', icon: 'beard' },
          { id: 'main-character', label: 'Facial Structure', value: 94, descriptor: 'Lead role', icon: 'star' },
        ],
      },
    },
    outfit: {
      card: {
        imageUrl: EXAMPLE_FIT,
        caption: 'LET HIM COOK',
        overallScore: 91,
        scores: [
          score('Silhouette', 90),
          score('Proportions', 88),
          score('Fit', 93),
          score('Physique Match', 89),
        ],
        sticker: OUTFIT_STICKER.green_flag,
        nameplate: {
          name: 'LET HIM COOK',
          eyebrow: 'Tailored streetwear, all intent',
          tagline: 'Quiet flex, loud silhouette',
          lane: 'Streetwear',
          accent: '#5b9dff',
          dossier: [
            { label: 'Signature', value: 'Boxy overshirt' },
            { label: 'Rule', value: 'Fit over flash' },
            { label: 'Palette', value: 'Ink & bone' },
            { label: 'Finish', value: 'Crisp white sole' },
          ],
        },
      },
      analysis: {
        explanation:
          'Let him cook. Fit, physique and proportions are in a group chat and, for once, they all agree on the plan.',
        works: 'Proportions are locked and the colour story is cohesive.',
        hurts: 'Almost too safe — one more risk would tip it to elite.',
        verdict: 'Repeat offender. Frame it.',
        tags: [
          { label: 'cohesive fit', tone: 'good' },
          { label: 'proportions locked', tone: 'good' },
          { label: 'repeat offender', tone: 'good' },
        ],
        supporting: [
          { id: 'shoulder-definition', label: 'Shoulder Definition', value: 88, note: 'Clean shoulder seam frames the upper body.' },
          { id: 'waist-definition', label: 'Waist Definition', value: 86, note: 'Tucked layer carves a clear waistline.' },
          { id: 'leg-length-effect', label: 'Leg Length Effect', value: 90, note: 'Rise and hem stretch the leg line.' },
          { id: 'body-balance', label: 'Body Balance', value: 91, note: 'Visual weight sits evenly top to bottom.' },
        ],
      },
    },
    receipt: {
      generationId: '0xC10E',
      generatedAt: '2026-06-10T14:08:00.000Z',
      datingScore: 9.1,
      auraValue: 610,
      rows: [
        { id: 'dating-score', label: 'Dating Score', value: '9.1 / 10', tone: 'good' },
        { id: 'aura-gained', label: 'Aura Gained', value: '+610', tone: 'good' },
        { id: 'lover-boy', label: 'Lover-Boy Prob.', value: '88%', tone: 'good' },
        { id: 'commitment', label: 'Commitment Risk', value: 'LOW', tone: 'good' },
        { id: 'ghosting', label: 'Ghosting Potential', value: '12%' },
        { id: 'main-char', label: 'Main-Char Energy', value: '94%', tone: 'good' },
      ],
      datingVerdict: 'green_flag',
      finalPunchline: 'CERTIFIED LOVER BOY',
      stamp: ['FITAURA', 'VERIFIED'],
      summary:
        'Face and fit both cooperated. Low ghosting risk, high lover-boy probability — the rare scan that survives a second look. Frame it.',
    },
  },

  normie: {
    verdict: 'normie',
    chip: 'VERDICT · NORMIE',
    gender: 'masc',
    parts: { face: true, outfit: true },
    face: {
      card: {
        imageUrl: null,
        eyebrow: 'FACE VERDICT',
        verdict: ['CLEAN NPC', 'WITH POTENTIAL'],
        index: 'AURA INDEX 58',
        scores: [
          score('Aura', 58),
          ageStat(24),
          score('Masculinity', 62),
          score('Main Character', 57),
        ],
        sticker: FACE_STICKER.normie,
      },
      analysis: {
        aura: 58,
        explanation:
          'Clean, balanced, completely unbothered. Nothing misfires — nothing detonates either. The face equivalent of a reliable mid.',
        roast: 'Mid, but immaculately clean.',
        breakdown: [
          { id: 'jaw', label: 'Jawline Frame', value: 64, descriptor: 'Soft', icon: 'jaw' },
          { id: 'harmony', label: 'Face Harmony', value: 70, descriptor: 'Even', icon: 'harmony' },
          { id: 'presence', label: 'Eye Presence', value: 61, descriptor: 'Quiet', icon: 'eye' },
          { id: 'eyebrows', label: 'Eyebrows', value: 66, descriptor: 'Fine', icon: 'brow' },
          { id: 'facial-hair', label: 'Facial Hair', value: 60, descriptor: 'Optional', icon: 'beard' },
          { id: 'main-character', label: 'Facial Structure', value: 49, descriptor: 'Background', icon: 'star' },
        ],
      },
    },
    outfit: {
      card: {
        imageUrl: null,
        caption: 'CLEAN NPC WITH POTENTIAL',
        overallScore: 66,
        scores: [
          score('Silhouette', 64),
          score('Proportions', 70),
          score('Fit', 62),
          score('Physique Match', 67),
        ],
        sticker: OUTFIT_STICKER.normie,
      },
      analysis: {
        explanation:
          'Safe to the point of stealth. Fits fine, reads fine, and is forgotten by the time the next slide loads. Inoffensive is a choice.',
        works: 'Nothing clashes — the fit is genuinely tidy.',
        hurts: 'Plays it so safe it disappears in the feed.',
        verdict: 'One bold move from greatness.',
        tags: [
          { label: 'stealth fit', tone: 'good' },
          { label: 'low risk', tone: 'good' },
          { label: 'one bold move away', tone: 'bad' },
        ],
        supporting: [
          { id: 'shoulder-definition', label: 'Shoulder Definition', value: 65, note: 'Shoulders read neutral — neither boxed nor sharp.' },
          { id: 'waist-definition', label: 'Waist Definition', value: 60, note: 'Straight cut keeps the waist undefined.' },
          { id: 'leg-length-effect', label: 'Leg Length Effect', value: 67, note: 'Standard break — legs read their true length.' },
          { id: 'body-balance', label: 'Body Balance', value: 70, note: 'Balanced, if a little flat.' },
        ],
      },
    },
    receipt: {
      generationId: '0x5B2D',
      generatedAt: '2026-06-10T14:08:00.000Z',
      datingScore: 5.9,
      auraValue: 90,
      rows: [
        { id: 'dating-score', label: 'Dating Score', value: '5.9 / 10' },
        { id: 'aura-gained', label: 'Aura Gained', value: '+90' },
        { id: 'ghosting', label: 'Ghosting Potential', value: 'MEDIUM' },
        { id: 'commitment', label: 'Commitment Risk', value: 'MODERATE' },
        { id: 'delusion', label: 'Delusion Index', value: '44%' },
        { id: 'lover-boy', label: 'Lover-Boy Prob.', value: '52%' },
      ],
      datingVerdict: 'normie',
      finalPunchline: 'CLEAN NPC WITH POTENTIAL',
      stamp: ['FITAURA', 'VERIFIED'],
      summary:
        'Clean NPC with upside. No red flags, no fireworks — a respectable mid that wins on consistency. One bold move from a re-rate.',
    },
  },
};

/** The featured demo lands on GREEN FLAG — the example photos sit with the
 * highest scores (aura 92, dating 9.1, "Main Character / Certified Lover Boy"). */
export const DEFAULT_VERDICT: DatingVerdict = 'green_flag';

/**
 * Landing "distinct cards" fan → synced 2×2 breakdown.
 *
 * One HERO mock (the DEFAULT_VERDICT generation) feeds three faces of the same
 * verdict: the Face Card, the Outfit Card and the Receipt. `fanBreakdown(kind)`
 * returns the right-column copy + four breakdown blocks for whichever card is
 * front in the fan, all sourced from that single HERO generation.
 */
export type FanKind = 'face' | 'outfit' | 'receipt';
export interface FanBlock {
  label: string;
  value: string;
  tag: string;
  pct: number;
}
export interface FanBreakdown {
  eyebrow: string;
  title: string;
  blocks: FanBlock[];
  cap: string;
}

/** Playful tier label from a 0–100 score — drives the corner tag + bar color. */
function tierTag(v: number): string {
  return v >= 88 ? 'ELITE' : v >= 78 ? 'HIGH' : v >= 60 ? 'SOLID' : 'LOW';
}

export function fanBreakdown(kind: FanKind): FanBreakdown {
  const h = MOCK_GENERATIONS[DEFAULT_VERDICT];
  if (kind === 'face') {
    // Use the real breakdown traits (proper 0–100 scores incl. haircut) — the
    // card's own scores now include a no-bar age stat that shouldn't render here.
    const s = h.face!.analysis.breakdown.slice(0, 4);
    return {
      eyebrow: 'FACE · SCORE BREAKDOWN',
      title: h.face!.card.verdict.join(' '),
      blocks: s.map((x) => ({ label: x.label, value: String(x.value), tag: tierTag(x.value), pct: x.value })),
      cap: h.face!.analysis.roast,
    };
  }
  if (kind === 'outfit') {
    const s = h.outfit!.card.scores.slice(0, 4);
    return {
      eyebrow: 'OUTFIT · FIT & PHYSIQUE',
      title: h.outfit!.card.caption,
      blocks: s.map((x) => ({ label: x.label, value: String(x.value), tag: tierTag(x.value), pct: x.value })),
      cap: h.outfit!.analysis.verdict,
    };
  }
  const rows = h.receipt.rows.slice(0, 4);
  return {
    eyebrow: 'RECEIPT · VERDICT',
    title: 'Dating verdict',
    blocks: rows.map((r) => ({ label: r.label, value: String(r.value), tag: '', pct: 80 })),
    cap: h.receipt.summary,
  };
}

/**
 * Static character face cards used in the Landing hero fan.
 * Three meme-famous faces ordered [McLovin, Bateman, GigaChad] so that
 * Hero renders left=McLovin, right=Bateman, mid=GigaChad (front/center).
 */
export const HERO_CHARACTERS: { content: FaceCardContent; roast: string }[] = [
  {
    content: {
      imageUrl: gigachad,
      eyebrow: 'FACE VERDICT',
      verdict: ['GIGA', 'CHAD'],
      index: 'AURA INDEX 99',
      scores: [
        score('Aura', 99),
        ageStat(28),
        score('Masculinity', 98),
        score('Main Character', 97, true),
      ],
      sticker: FACE_STICKER.green_flag,
    },
    roast: 'Built different. Case closed.',
  },
  {
    content: {
      imageUrl: bateman,
      eyebrow: 'FACE VERDICT',
      verdict: ['SIGMA', 'MALE'],
      index: 'AURA INDEX 93',
      scores: [
        score('Aura', 93),
        ageStat(27),
        score('Masculinity', 94),
        score('Main Character', 90, true),
      ],
      sticker: FACE_STICKER.green_flag,
    },
    roast: 'Sigma energy. Slightly unhinged.',
  },
  {
    content: {
      imageUrl: mclovin,
      eyebrow: 'FACE VERDICT',
      verdict: ['HONORABLE', 'MENTION'],
      index: 'AURA INDEX 84',
      scores: [
        score('Aura', 84),
        ageStat(18),
        score('Masculinity', 70),
        score('Main Character', 95, true),
      ],
      sticker: FACE_STICKER.normie,
    },
    roast: 'Fake ID, real legend.',
  },
];
