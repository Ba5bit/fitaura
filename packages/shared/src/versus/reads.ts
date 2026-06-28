// packages/shared/src/versus/reads.ts
//
// Turn a computed battle (+ optional AI copy) into the view-ready breakdown rows
// the Verdict tab renders. The NUMBERS are always the real `computeBattle`
// metrics — a row's subject, score, tier, gap and bar all come from the metric.
// The AI supplies only the funny `title`, the flex/roast framing, and a full
// human-sounding `reason` sentence (no numbers). When there's no AI copy (legacy
// saved battles, the dev seed), a static title/reason bank in the same voice
// fills in so the panel is never empty.
import type { BattleVerdict, Metric, Side, VersusCopy } from './schema.ts';

/** A single view-ready breakdown row. Colours are left to CSS (`isRoast` + side). */
export interface DerivedRead {
  metricKey: string;
  metricLabel: string;
  /** Funny "most likely to…" title. */
  title: string;
  /** true = flex (crown the leader); false = roast (mock the trailer). */
  flex: boolean;
  /** `!flex` — convenience for styling. */
  isRoast: boolean;
  /** Resolved subject side (leader for a flex, trailer for a roast). */
  side: Side;
  /** Subject's display name. */
  name: string;
  /** Subject's score on this metric (the number shown big). */
  score: number;
  /** The other side's score. */
  other: number;
  /** |a − b|. */
  gap: number;
  /** Elite / Strong / Solid (flex) or Needs work (roast). */
  tier: string;
  /** Tag line, e.g. `JAWLINE · +8 AHEAD` or `ROAST · POSE · 3 BEHIND`. */
  tag: string;
  /** The full human-sounding read sentence (no numbers). */
  reason: string;
}

/** How many rows the breakdown shows at most. */
const MAX_READS = 5;

/**
 * Static fallback bank — one flex + one roast title/reason per metric key, in the
 * same savage-but-photo-aimed voice as the AI reads. No numbers, no names, no
 * identity/body jokes (every line targets the angle, the effort, the choices).
 */
const BANK: Record<string, { flex: { title: string; reason: string }; roast: { title: string; reason: string } }> = {
  // FACE
  jawline: {
    flex: { title: 'Could cut glass with that jawline', reason: 'The angle did the work for free — that jaw caught light like the shot was staged for it.' },
    roast: { title: 'Most likely to get IDed at thirty', reason: 'The jaw went into witness protection behind that chin-down angle and never checked back in.' },
  },
  hairline: {
    flex: { title: 'Hairline contract renewed for life', reason: 'Edges sharp enough to file taxes — not one strand stepped out of formation.' },
    roast: { title: 'Most likely to panic-buy a hat', reason: 'That part is staging a quiet retreat and the lighting flat-out refused to cover for it.' },
  },
  rizz: {
    flex: { title: 'Could talk their way into anywhere', reason: 'Looked at the lens like it owed them money — unbothered, magnetic, already winning.' },
    roast: { title: 'Most likely to get left on read', reason: 'The expression typed "hey u up" at 2am and earned the dry thumbs-up in return.' },
  },
  aura: {
    flex: { title: 'Pure main-character energy', reason: 'Walked into frame and the background politely blurred itself out of respect.' },
    roast: { title: 'Most likely to be the NPC in the photo', reason: 'Blended into the wall so hard the camera nearly autofocused on somebody else.' },
  },
  // FIT
  drip: {
    flex: { title: 'Dresses like they hired a stylist', reason: 'Committed to one palette and never blinked — every piece looked chosen, not grabbed.' },
    roast: { title: 'Most likely to fumble his first date', reason: 'The fit was clearly assembled in the dark by feel, and the photo aired out every choice.' },
  },
  physique: {
    flex: { title: 'Built the fit around the frame', reason: 'Every line landed exactly where it should — the cut and the build obviously negotiated first.' },
    roast: { title: 'Most likely to blame the tailor', reason: 'The fit and the frame argued the whole shoot and the fit lost in front of everyone.' },
  },
  pose: {
    flex: { title: 'Knows their angles in their sleep', reason: 'Hit the stance like it was rehearsed — weight, hands and chin all handled before the shutter.' },
    roast: { title: 'Most likely to peak in the group photo', reason: 'Stood like the photographer yelled "go" before anyone agreed on what to actually do.' },
  },
  confidence: {
    flex: { title: 'Owns the entire frame', reason: 'Wore it like the camera was lucky to be there — zero notes, zero flinch, all posture.' },
    roast: { title: 'Most likely to hide in the back row', reason: 'Half-committed to the look and the body language signed the apology before anyone asked.' },
  },
};

/** A generic roast used only if a metric is missing from the bank (shouldn't happen). */
const GENERIC_ROAST = {
  title: 'Most likely to fumble the moment',
  reason: 'Came up short right where it counted and the photo kept every receipt.',
};

const tierFor = (flex: boolean, score: number): string =>
  !flex ? 'Needs work' : score >= 90 ? 'Elite' : score >= 82 ? 'Strong' : 'Solid';

/** Build one view-ready row from a metric + framing + copy. */
function buildRead(
  m: Metric,
  flex: boolean,
  title: string,
  reason: string,
  names: { a: string; b: string },
): DerivedRead {
  const gap = Math.abs(m.a - m.b);
  // Flex crowns the leader; a roast mocks the trailer. Ties never reach here
  // (gap === 0 rows are filtered out before building).
  const aIsSubject = flex ? m.a >= m.b : m.a < m.b;
  const side: Side = aIsSubject ? 'a' : 'b';
  const score = aIsSubject ? m.a : m.b;
  const other = aIsSubject ? m.b : m.a;
  const name = aIsSubject ? names.a : names.b;
  const tag = flex
    ? `${m.label.toUpperCase()} · +${gap} ahead`
    : `${m.label.toUpperCase()} · ${gap} behind`;
  return {
    metricKey: m.key,
    metricLabel: m.label,
    title,
    flex,
    isRoast: !flex,
    side,
    name,
    score,
    other,
    gap,
    tier: tierFor(flex, score),
    tag,
    reason,
  };
}

/** Convert a built flex row into a roast (smallest-gap safety net for "≥1 roast"). */
function asRoast(row: DerivedRead, byKey: Map<string, Metric>, names: { a: string; b: string }): DerivedRead {
  const m = byKey.get(row.metricKey)!;
  const bank = BANK[row.metricKey]?.roast ?? GENERIC_ROAST;
  return buildRead(m, false, bank.title, bank.reason, names);
}

/**
 * Derive the breakdown rows for the active modality.
 *
 * - Prefers `copy.reads` (AI-authored title/framing/reason) when present;
 *   otherwise builds every metric as a flex from the static bank.
 * - Skips dead-even metrics (gap 0), sorts by gap descending, caps at five.
 * - Guarantees at least one roast: if the selected rows are all flexes, the
 *   smallest-gap row is converted to a roast (so it reads last, like the design).
 */
export function deriveReads(
  verdict: BattleVerdict,
  copy: Pick<VersusCopy, 'reads'> | null | undefined,
  names: { a: string; b: string },
): DerivedRead[] {
  const group = verdict.face ?? verdict.fit;
  if (!group || group.metrics.length === 0) return [];
  const byKey = new Map(group.metrics.map((m) => [m.key, m]));

  const aiReads = copy?.reads ?? [];
  let rows: DerivedRead[];
  if (aiReads.length) {
    rows = aiReads
      .map((r) => {
        const m = byKey.get(r.metricKey);
        if (!m || m.a === m.b) return null;
        return buildRead(m, r.flex, r.title, r.reason, names);
      })
      .filter((r): r is DerivedRead => r !== null);
  } else {
    rows = group.metrics
      .filter((m) => m.a !== m.b)
      .map((m) => {
        const bank = BANK[m.key]?.flex ?? { title: m.label, reason: '' };
        return buildRead(m, true, bank.title, bank.reason, names);
      });
  }

  rows.sort((x, y) => y.gap - x.gap);
  let top = rows.slice(0, MAX_READS);
  if (top.length > 0 && !top.some((r) => r.isRoast)) {
    const last = top.length - 1;
    top = [...top.slice(0, last), asRoast(top[last], byKey, names)];
  }
  return top;
}
