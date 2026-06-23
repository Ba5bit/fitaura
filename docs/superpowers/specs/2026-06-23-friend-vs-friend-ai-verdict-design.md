# Friend vs Friend — Real AI Verdict (+ Deck Realign)

**Date:** 2026-06-23
**Branch:** `feat/friend-vs-friend`
**Status:** Design — approved, pending spec review
**Predecessor:** `docs/superpowers/specs/2026-06-23-friend-vs-friend-design.md` (the UI-first build this replaces the placeholder of)

---

## 1. What this is

Friend vs Friend is built UI-first: the head-to-head verdict is a deterministic
placeholder (`generateMetrics(seed)` → `computeBattle` in `packages/shared/src/versus/`),
and the feature is dev-gated (`import.meta.env.DEV`). This cycle replaces the placeholder
with a **real, unhinged, head-to-head AI verdict** and **realigns the result deck** to the
handoff card design (`~/Downloads/friend-vs-friend-handoff/Result Deck v2.dc.html`,
`Share Cards.dc.html`) in the **icy/gold** palette.

Two coupled workstreams, one spec:

1. **Backend AI** — one comparative Gemini call produces real scores + comparative roast copy.
2. **Verdict-deck realign** — render the verdict like the handoff cards, including a new
   superlatives row.

This cycle does **not** flip the dev gate to production — going live is a later launch step.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Verdict output | Scores **plus** comparative copy (full roast payload) |
| 2 | Call shape | **One comparative Gemini call** (sees both contenders); new prompt + schema |
| 3 | Credits | **2 credits** per battle, refunded on failure |
| 4 | Bad photos | **No retake flow** — always score; only a garbled/blocked response is a hard failure |
| 5 | Screenshots | **Visual target** — realign the deck to the handoff cards in **icy/gold** (not blue→pink) |
| 6 | Tone | **Unhinged**, aimed at the *photo* not the *person* (guardrails in §6) |
| 7 | Superlatives | **Yes** — a row of ~3 comparative superlatives, one locked "tap to reveal" wildcard |

---

## 3. The seam today

- `metrics.ts` → `generateMetrics(seed)` builds deterministic `Metric[]` for face + fit from a
  hash of the two names.
- `VersusResult.tsx` (≈ line 498) calls `generateMetrics` then `computeBattle({ mode, face, fit })`
  inside a `useMemo`, and renders the resulting `BattleVerdict` (+ `summarizeBattle`).
- `VersusScan.tsx` runs a purely cosmetic 7.5 s timeline, then a "Reveal the verdict" CTA.
- `state/battle.tsx` holds the transient `Battle` (mode, names, up to 4 images) in memory +
  `sessionStorage["fvf:battle"]`. No result is stored — it is recomputed on the Result screen.

**The swap:** the verdict stops being recomputed from the name seed and becomes a stored
`VersusResult` produced by the AI during the scan. `computeBattle` stays the single source of
truth for *who wins* — the AI copy only dresses the math.

---

## 4. Architecture

### 4.1 Edge function — `supabase/functions/versus-scan/`

Mirrors `solo-scan` exactly:

- `index.ts` — handler: CORS, `verify_jwt:false` (dev-gated; same guest-first posture as solo),
  parse body, validate images, call Gemini, parse with the zod schema, assemble, log, respond.
- `gemini.ts` — REST client adapted from `solo-scan/gemini.ts` to send **mode + up to 4 inline
  images** (`aFace`, `aFit`, `bFace`, `bFit`) with clear per-image labels in the prompt parts.
- `deno.json`; `_shared/` populated at deploy with `packages/shared` (the established manual-deploy
  ritual: `.ts` import extensions added, import map `shared/` → `./_shared/`).
- **Reuses the existing project-wide `GEMINI_API_KEY` secret** — no new secret to set.
- Model default `gemini-2.5-flash` (proven ~8 s / reliable on solo); overridable via a
  `GEMINI_VERSUS_MODEL` secret. `thinkingBudget: 0` (2.5) / `thinkingLevel: 'low'` (3.x).
- **Response envelope** matches solo: app-level errors return **HTTP 200** with `{ ok:false, kind:'error', message }`
  so `supabase-js`'s `functions.invoke` can read the body; only transport/infra failures are non-2xx.
- **Logging** mirrors solo: JSON line with `battle_id`, model, token usage, latency, success,
  estimated cost. **Never logs image bytes.**

> Per the Knip memory: the edge function + generated types get flagged as dead code. Never delete them.

### 4.2 Shared pure logic — `packages/shared/src/versus/`

New modules (mirroring `shared/solo-scan/v4/`), all unit-tested with Vitest:

- `aiSchema.ts` — zod schema for the raw Gemini comparative result (`VersusAIResult`) + a
  `VERSUS_SCHEMA_VERSION` const.
- `prompt.ts` — the system instruction (unhinged persona + guardrails, §6), the Gemini structured-output
  `responseSchema`, and the per-mode metric enumeration.
- `assemble.ts` — `shapeVersusResult(ai, meta)`: validates, maps AI scores → `Metric[]` for the active
  categories (labels looked up from `FACE_METRICS` / `FIT_METRICS`), runs `computeBattle` to get the
  authoritative winner, **reconciles the crown** (§5.3), and returns a `VersusResult`.

Additions to `schema.ts`:

```ts
export interface SideCopy { superpower: string; roast: string; }

export interface Superlative {
  label: string;        // AI-invented, e.g. "Most likely to get a free drink"
  winner: Side;         // 'a' | 'b'
  locked: boolean;      // exactly one true → the tap-to-reveal wildcard
}

export interface VersusCopy {
  crown: { winner: BattleWinner; line: string };  // headline punchline (reconciled, §5.3)
  decisiveRead: string;                            // line about the biggest-gap metric
  sides: Record<Side, { face: SideCopy | null; fit: SideCopy | null }>;
  superlatives: Superlative[];                     // ~3, exactly one locked
}

/** The stored verdict the result deck renders. */
export interface VersusResult {
  mode: VersusMode;
  face: Metric[] | null;   // present when mode includes face
  fit: Metric[] | null;    // present when mode includes fit
  copy: VersusCopy;
}
```

The client still calls `computeBattle({ mode, face, fit })` on the stored `Metric[]` to render
numbers (unchanged path); the copy renders alongside.

### 4.3 Client service — `apps/web/src/services/versusScanService.ts`

Mirrors `soloScanService.ts`: `runVersusScan(battle)` converts the data-URL images to inline parts,
invokes `versus-scan`, and returns `{ kind:'result', result: VersusResult }` or `{ kind:'error', message }`.
(No `retake` kind — decision #4.)

### 4.4 State — `state/battle.tsx`

Extend the context with the produced verdict:

- Add `result: VersusResult | null` to context, persisted to `sessionStorage["fvf:result"]`
  (separate key so a stale result never rides along with a fresh `commit`).
- `commitResult(result)` (written by Scan) / cleared by `clear()` and by a new `commit()` (new battle).
- `VersusResult.tsx` reads the stored result. **`generateMetrics` is kept only as a dev fallback**
  when no stored result exists (e.g. refresh straight onto `/versus/result` in dev).

### 4.5 Credits — `AccountContext` + `creditsService`

- Generalize `creditsService.spendCredit(userId, amount = 1)` and `refundCredit(userId, amount = 1)`
  (today hardcoded to 1; `grantCredits` already takes `n`).
- Add `AccountContext.spendForBattle()` (spends 2) and `refundBattle()` (refunds 2), reusing the service.
- Insufficient balance → the existing paywall/credits scene. (FvF does **not** get the guest free-scan;
  it requires a signed-in user with ≥ 2 credits.)

> Concurrency caveat carried over from solo: refund is a read-modify-write, not yet RPC-safe (deferred cycle).

### 4.6 Flow — `VersusScan.tsx`

- On mount: `spendForBattle()`; if it fails → route to paywall. On success, fire `runVersusScan(battle)`.
- The scripted 7.5 s timeline **stays** as the loading visual.
- **"Reveal the verdict" gates on BOTH** the timeline finishing **AND** the result resolving.
  - Success → `commitResult(result)`, enable reveal → `/versus/result`.
  - Failure → `refundBattle()` + an inline error state (Retry / Back to upload). No retake.
- StrictMode: keep the existing no-re-entry-guard pattern; guard the *network call + spend* with an
  effect-scoped ref/abort so the double-invoke does not double-spend (the timeline can re-run harmlessly,
  the spend cannot).

---

## 5. The AI verdict

### 5.1 Metrics (scored, drive the winner)

Keep the current set (labels unchanged):

- **Face:** Skin, Symmetry, Jawline, Eyes, Aura
- **Fit:** Fit, Color, Drip, Silhouette, Freshness

The model returns integer `a`/`b` 0–100 per metric for the **active** categories only
(`face` mode → face metrics; `fit` → fit; `both` → both).

### 5.2 Copy payload

Returned in the same call (see `VersusCopy`):

- **`crown`** — winner + a savage one-line punchline.
- **`sides[a|b].{face,fit}`** — a `superpower` (the flex) and a `roast` (the burn) per active category, per side.
- **`decisiveRead`** — one line about the largest-gap metric ("won on socks").
- **`superlatives[]`** — ~3 AI-invented "Who's more likely to ___" verdicts, each crowned `a`/`b`,
  exactly one flagged `locked` (the tap-to-reveal wildcard).

### 5.3 Copy authority (winner reconciliation)

`computeBattle` over the scored `Metric[]` is the **single source of truth** for the winner, margin,
category chips, and metric leaders. The AI also returns `crown.winner`; `assemble.ts` compares it to the
computed winner:

- **Match** → use the AI's `crown.line`.
- **Mismatch** (only possible inside the `TIE_BAND`) → discard the AI line and use a **templated fallback**
  keyed to the computed winner.

So the displayed crown can never contradict the numbers on the card.

### 5.4 Raw AI schema (`VersusAIResult`)

```jsonc
{
  "scores": {
    "face": { "skin": {"a":88,"b":85}, "symmetry": {...}, ... },   // only for active categories
    "fit":  { "fit": {...}, ... }
  },
  "crown": { "winner": "a|b|tie", "line": "..." },
  "decisiveRead": "...",
  "sides": {
    "a": { "face": {"superpower":"...","roast":"..."}, "fit": {...} },  // null for inactive categories
    "b": { "face": {...}, "fit": {...} }
  },
  "superlatives": [
    { "label": "...", "winner": "a|b", "locked": false },
    { "label": "...", "winner": "a|b", "locked": false },
    { "label": "...", "winner": "a|b", "locked": true }
  ]
}
```

`assemble.ts` validates shape + ranges, fills metric labels, runs `computeBattle`, reconciles the crown,
and emits `VersusResult`. Missing/invalid scores or a malformed payload → hard failure (refund).

---

## 6. Tone & safety guardrails

**Unhinged = savage about the photo, not the person.** The system instruction frames the model as the
group-chat friend with no filter who is never an actual bully. It roasts: the fit, the angle, the lighting,
the pose, the effort, the ego, the photo choices.

**Hard "never" list (in the system prompt):**

- No slurs or profanity-as-cruelty.
- Never make race/ethnicity, gender identity, disability, religion, or age the punchline.
- No body-shaming as the joke; no comment that reads as cruelty about something unchangeable.
- Nothing sexual; nothing about minors.

**Platform safety:** Gemini's own safety filters stay **on** (not disabled). A safety block / empty
response is a hard failure → refund the 2 credits → error screen.

**On-card framing:** the "for the bit, not science · analyzed in-session only" line stays.

---

## 7. Frontend realign (icy/gold)

Bring the result deck in line with the handoff cards (`Result Deck v2.dc.html`, `Share Cards.dc.html`,
`fitaura-ds-additions/components/head-to-head-verdict.html`) in **icy (A) / gold (B)** — the blue→pink
gradients shown in the reference screenshots are **not** adopted.

- **Face / Outfit tabs:** full-bleed contender photos, big Anton numerals, named reads; surface each side's
  `superpower` / `roast` lines.
- **Verdict tab:** the `crown` punchline replaces the templated tagline; `decisiveRead` in the breakdown;
  margin / face / outfit stat boxes, split bars, barcode footer as today.
- **New UI — superlatives row:** small crowned chips (icy/gold) with one **locked "tap to reveal"** chip.
  Lives on the Verdict tab + the overall share card. New component in `components/versusBits.tsx`; styles in
  `design/versus.css`.
- **Share/export cards:** punchline + the top superlative; same `background-image` rasterization workaround
  for snapdom (per the FvF memory).

---

## 8. Testing & verification

- **Vitest (shared):** `aiSchema` parse (valid + each invalid shape), `assemble` (score→Metric mapping,
  range clamping/rejection, `computeBattle` integration, crown match + mismatch→fallback, superlatives
  shape incl. exactly-one-locked), `creditsService` amount arg.
- **Edge function:** boot probe (expect the known `missing_api_key` path is gone since the secret exists →
  a real call), then **live verify**: valid photos → verdict; garbled/forced error → `{ok:false}` + the
  client refunds 2; a non-person photo still returns a verdict (no retake).
- **Frontend:** `tsc` + `vite build` clean; **Playwright** the full dev flow (Upload → Scan → Result) on
  desktop + mobile, including a 2-credit spend and a forced-failure refund.

---

## 9. Deployment & secrets

- **Manual deploy** via the MCP `deploy_edge_function` ritual (multi-file: function files + `packages/shared`
  copied under `_shared/` with `.ts` extensions + import map). `verify_jwt:false`.
- Reuses the existing `GEMINI_API_KEY`. Optional `GEMINI_VERSUS_MODEL` override.
- Push / merge held per the project rule until the user says otherwise.

---

## 10. Out of scope (deferred)

- Flipping the `import.meta.env.DEV` gates to ship FvF to production (separate launch step).
- Abuse / rate-limiting (same posture & deferral as solo-scan).
- Per-account battle history — FvF stays transient (sessionStorage).
- Forgery-proof credit RPC (the shared deferred "harden credits" cycle).

---

## 11. Risks & edge cases

- **Latency** — up to 4 images + a large copy payload may exceed solo's ~8 s. Mitigate with a
  `maxOutputTokens` cap and `thinkingBudget: 0`; monitor logs and trim copy if needed.
- **Safety blocks** — "unhinged" raises the odds Gemini blocks/empties a response → hard fail → refund.
  Acceptable; copy guardrails reduce frequency.
- **Single-mode** — `face`-only / `fit`-only: `sides` carry only the active category; `decisiveRead` and
  superlatives still generated.
- **Tie** — `crown.winner: 'tie'` → "Dead heat" copy; gold neutral per the existing palette rule.
- **Double-spend** — guarded by an effect-scoped ref/abort around the spend + call (§4.6).
