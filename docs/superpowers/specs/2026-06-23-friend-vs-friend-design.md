# Friend vs Friend — Design Spec

> Status: approved design, ready for implementation planning.
> Date: 2026-06-23.
> Source handoff: `~/Downloads/friend-vs-friend-handoff/` (DESIGN.md, `.dc.html` reference
> screens, `fitaura-ds-additions/`). The `.dc.html` files and the `support.js` /
> `image-slot.js` runtime are **visual reference / prototype scaffolding only** — not code to port.

## 1. What we're building

A head-to-head mode: two friends ("A" and "B") upload photos, watch a versus scan, and get a
crowned verdict comparing **Face**, **Outfit**, or **Both**. One winner, one loser, a shareable
card at the end.

```
Upload (arena) → Versus Scan → Result Deck → (Share Cards) → Rematch ↺ Upload
```

FvF already exists in the app as a **locked "Coming soon"** tile in the Vault mode selector
(`apps/web/src/features/vault/modes.ts`, id `friend`). This work makes it real.

## 2. Scoping decisions (locked)

1. **Analysis engine — UI-first, AI later.** Build the entire FvF frontend on the real design
   system with the verdict computed **deterministically** from placeholder metric arrays (exactly
   the prototype's "swap in real model output when wired"). Real AI is its own later cycle.
2. **Exposure — dev-only until AI lands.** The Vault tile stays `locked` in production; the feature
   and its routes are reachable **only in dev** (`import.meta.env.DEV`), mirroring the existing
   hidden Google sign-in and the dev-only `/dev/cards` route. No credits are charged. One flag
   flips it live when AI is wired. No fabricated "winner" ever reaches production users.
3. **Persistence — transient flow.** Battles are handed between screens via a dedicated React
   context plus `sessionStorage` (so a refresh on Scan/Result survives), with `Player A` / `Player B`
   fallbacks. **No IndexedDB, no per-account saved-battle gallery.** The Vault FvF tile (in dev) is
   a launcher + "how it works," not a collection. History can be added later when verdicts become real.

## 3. The color reconciliation (the central integration concern)

The prototype palette is **identical** to the live tokens in `apps/web/src/design/fitaura.css`
(`--icy #83b4ff`, `--magenta #ff52a6`, `--gold #ffcf66`, `--lime #b6ff3c`, `--bg-0 #06070a`,
`--ink #f3f6f9`, …). Nothing needs re-hexing. The real difference is **semantic**:

| Token | Meaning on the live site today | Meaning in Friend vs Friend |
|-------|--------------------------------|-----------------------------|
| `--icy` | universal brand `--accent`; the masc/default card identity | Contender **A** (left), regardless of gender |
| `--magenta` | **femme** card identity (gender theming remaps `--accent` → magenta) | Contender **B** (right), regardless of gender |
| `--gold` | femme detailing (wordmark + footer index) | **reserved**: crown / winner's name glow / tie ("Dead heat") only |

If FvF were applied naively, a male "Contender B" would be painted magenta (currently the "female"
color) and the gold crown could collide with femme gold detailing.

**Why there is no literal CSS collision:** today's gender theming (`apps/web/src/design/gender-theme.css`)
is scoped to exactly two host classes — `.rs-card-mount[data-gender="femme"]` and
`.rs-export-card[data-gender="femme"]`. It does not leak onto arbitrary pages.

**The rules that keep the semantics clean:**
- FvF contender subtrees **must not** set `data-gender`, and **must not** mount inside
  `.rs-card-mount` / `.rs-export-card`. That alone keeps `magenta = Contender B` from ever reading
  as "female" and keeps `gold` free for crown/winner/tie.
- Page chrome (logo dot, `FITAURA` wordmark) stays **icy** — only the contender subtree recolors.

## 4. Architecture & routing

New feature module `apps/web/src/features/versus/`, mirroring how Solo is structured:

| Screen | File | Route |
|--------|------|-------|
| Upload arena | `VersusUpload.tsx` | `/versus` |
| Versus Scan | `VersusScan.tsx` | `/versus/run` |
| Result Deck | `VersusResult.tsx` | `/versus/result` |

- Routes are added to `apps/web/src/App.tsx` as **lazy** chunks, wrapped so they only mount under
  `import.meta.env.DEV` (same gating as the existing `/dev/cards` route).
- Pure, deterministic verdict logic lives in `packages/shared/src/versus/` (testable, mirrors how
  the solo-scan logic sits in `packages/shared/src/solo-scan/`).
- Rejected alternatives: folding FvF into `GenerationProvider`/Upload/Scan/Result (those files carry
  subtle per-account + post-await safety logic; branching them for a second mode makes focused files
  do two jobs); a single self-contained `Versus.tsx` with internal step state (diverges from the
  app's route-per-screen IA — scroll-to-top, back button — and bloats one file).

## 5. Versus-theming DS layer

New stylesheet `apps/web/src/design/versus.css` plus small presentational components under
`apps/web/src/features/versus/components/`. These are real DS additions, not per-screen one-offs.

### The `--c` token + the `--accent` bridge
- Each contender subtree sets a single local `--c` (`var(--icy)` on A, `var(--magenta)` on B). One
  token drives border, ambient glow, name underline, conic ring, corner brackets, score numeral and
  bar fill.
- **In the same subtree, also remap `--accent: var(--c)`.** This is the bridge: any reused DS
  component that already paints off `--accent` (`.mstat` bars, selfie/conic rings, score badges,
  and the `FaceCard`/`OutfitCard` used in share cards) auto-recolors to the contender color with no
  per-element overrides — while we still avoid `data-gender`.

### State styling
- **Winner:** full opacity, colored glow shadow in `--c`, **gold crown** above the avatar (the
  Fitaura mountain/`▲` mark).
- **Loser:** `opacity: .5–.6` + `filter: grayscale(.5–.55)`, transition ~.4s.
- **Tie:** gold **"Dead heat"** (the only non-crown use of gold besides the winner's name glow).

### New primitives (components)
- `VersusMedallion` — icy→magenta conic ring spinning over a dark core with dual radial glow.
- `DualGlowButton` — primary CTA: gradient split left→right (icy→magenta) + two shadows (icy left,
  magenta right). Plus a gradient-text headline helper using the same `background-clip:text` recipe.
- `SplitBar` — one track, A fills from the left, B from the right, bright white divider at the share
  point; leading numeral glows, trailing drops to `opacity .4`.
- `CrownAvatar` — crowned-or-dimmed avatar in a conic ring (`--c`).
- `FlagChip` — lime green-flag (`--lime`) / red-flag (`--red`). Gold is **not** used for chips.
- `ModeSelector` — Face / Fit / Both segmented control (≥44px targets).

All animated motifs (conic spins, pulsing glows, scan sweep) honor `prefers-reduced-motion`.

## 6. Battle state contract

`apps/web/src/state/battle.tsx` — a small `BattleProvider` + `useBattle()` hook holding:

```ts
interface Battle {
  mode: 'face' | 'fit' | 'both';   // default 'both'
  nameA: string;                    // ≤14 chars; fallback 'Player A'
  nameB: string;                    // ≤14 chars; fallback 'Player B'
  imgs: { aFace?: string; aFit?: string; bFace?: string; bFit?: string }; // dataURLs
}
```

- Persisted to `sessionStorage` under key `fvf:battle` (keeps the handoff's shape so the screens stay
  decoupled, but session-scoped rather than the prototype's `localStorage`).
- Upload **writes** it on launch; Scan & Result **read** on mount and fall back to `Player A` /
  `Player B` and empty images.
- Navigation is plain relative routing between the three routes.

## 7. Screens

Built from DS tokens/components above — **not** the prototype's inline styles.

### 7.1 Upload arena (`/versus`)
- Header: brand wordmark + "Friend vs Friend" eyebrow; "Step 01 / 03 — Upload"; H1 with `head to head`
  in gradient text.
- **Mode selector** (segmented): Face / Fit / Both (default Both). Mode controls which drop zones show
  and the CTA copy.
- **Arena:** A card (icy) — VS medallion — B card (magenta). Each card: A/B badge, editable name input
  (≤14 chars), then drop zone(s):
  - **Face** = circular slot with conic ring.
  - **Fit** = rounded slot with corner brackets.
  - Reuse the existing `UploadZone` + crop math (`features/upload/`) for ingest; the circular/bracketed
    framing is versus-theming chrome around it.
  - Per-zone state: "Required" → "✓ Ready" (lime pill).
- CTA (`DualGlowButton`): disabled until all required slots for the chosen mode are filled; label
  reflects progress (`Add photos — n/total in` → `Compare & crown a winner`). On launch, write
  `fvf:battle` and navigate to `/versus/run`.
- Footer: format chips (JPG/PNG/WEBP/HEIC) and the existing privacy line.

### 7.2 Versus Scan (`/versus/run`)
- Reads `fvf:battle`. Single scan panel themed by the **currently-scanning** contender's `--c`,
  alternating A↔B ~every 1s.
- Left: specimen photo (the outfit image when present, else face) with scan-line sweep, grid overlay,
  corner brackets, and a small face inset in a spinning conic ring.
- Right readout: `Stage NN / 05` (Prep · Face · Fit · Aura · Verdict), animated "Reading the {stage}",
  live ticker line, A-vs-B pill, big percent + progress bar, 5-step checklist (queued/active/done).
- ~7.5s total; honors `prefers-reduced-motion` (jumps to 100% / done). On done, show "Reveal the
  verdict" dual-glow CTA → navigate to `/versus/result`.

### 7.3 Result Deck (`/versus/result`)
- Top tabs/stepper: `01 Face` / `02 Outfit` / `03 Verdict` (tabs shown follow the battle mode).
- **Face / Outfit tabs:** winner banner; 3-col layout — A column / center head-to-head `SplitBar`s /
  B column. Each column: crowned-or-dimmed `CrownAvatar`, name, big score `/100`, lime `FlagChip`s,
  top-3 trait bars. Center: 5 metrics as split bars.
- **Verdict tab:** left = swipeable card stack (Face card = horizontal split, Outfit card = vertical
  split, Both card = overall verdict) with dots + **Download card** (PNG export via the existing
  `apps/web/src/lib/exportCard.ts` at high DPR). Right = breakdown panel: winner name, verdict word,
  A/B scores, stat strip, explanation copy, chips, per-metric reads, **Rematch** + "Share the verdict".
- Header "New battle" and "Rematch" → `/versus`.
- Scores come from `computeBattle` (§8). The result reads the verdict object; this is the seam where
  real model output drops in later.

### 7.4 Share Cards
- Versus variants of the export cards (duel photos, VS medallion, scores, `FITAURA` wordmark +
  barcode footer), driven by `--c` per side. Where the existing `FaceCard`/`OutfitCard` components are
  reused, color is driven by overriding `--accent` to the contender's `--c` — **not** by `data-gender`.

## 8. Deterministic verdict

`packages/shared/src/versus/computeBattle.ts` (pure, unit-tested):

- Input: per-metric arrays for each side (face metrics and/or fit metrics, per the mode).
- Output: per-metric split percentages, per-side averages (face score, fit score, overall), the
  winner (`'a' | 'b' | 'tie'`), and the tie determination (within a small band → "Dead heat").
- Winner = higher average; ties resolved by a fixed band so equal-ish scores read as a dead heat.
- This module is the only place verdict math lives; screens render its output.

## 9. Vault integration + dev gating

- `apps/web/src/features/vault/modes.ts`: `friend` mode stays `status: 'locked'`.
- New `apps/web/src/features/vault/FriendMode.tsx`: when `import.meta.env.DEV`, renders a launcher
  ("Start a battle" → `/versus`) + a short "how it works"; otherwise renders today's `LockedMode`
  (so production is byte-for-byte the current locked tile).
- `Vault.tsx` currently dispatches `active.status === 'live' ? <SoloMode/> : <LockedMode/>`. Add a
  small id-aware branch so `active.id === 'friend'` renders `<FriendMode/>` (which itself decides dev
  launcher vs locked); every other mode keeps the existing status-based dispatch.
- `/versus`, `/versus/run`, `/versus/result` in `App.tsx` are gated behind `import.meta.env.DEV`
  (same pattern as `/dev/cards`).

## 10. Explicitly NOT ported

- `support.js` — the dc-runtime that renders `.dc.html` prototypes. Prototype infrastructure.
- `image-slot.js` — prototype drag-drop image custom element (omelette sidecar). The app uses the
  existing `UploadZone` + crop instead.
- The `.dc.html` inline styles and markup — visual reference only.

## 11. Testing

- TDD `computeBattle`: winner A, winner B, tie band, single-mode (face-only / fit-only) inputs,
  boundary scores.
- `battle.tsx` serialize/restore: write → reload from `sessionStorage` → fallbacks for missing
  names/images.
- Reuse existing test conventions (`scanGuards.test.ts`, `swipeGesture.test.ts`).

## 12. Build phasing (for the implementation plan)

1. **Foundation** — `versus.css` (tokens/`--c`/`--accent` bridge, win/lose/tie, medallion, dual-glow,
   split bar, chips), `state/battle.tsx`, routing skeleton + dev gating, `FriendMode.tsx`.
2. **Upload arena** (`VersusUpload.tsx`).
3. **Versus Scan** (`VersusScan.tsx`).
4. **Result deck + verdict** (`computeBattle` in shared + `VersusResult.tsx`).
5. **Share cards + PNG export.**
