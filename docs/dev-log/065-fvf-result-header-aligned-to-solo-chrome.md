# 065 — FvF result header aligned to the Solo Scan canonical chrome

**Date:** 2026-06-23
**Scope:** `apps/web/src/features/versus/VersusResult.tsx` (header right side) + `apps/web/src/design/versus.css` (one CSS-var override removed).

## Symptom
The Friend-vs-Friend verdict header (`/versus/result`) "didn't look like the Solo
Scan's header" and was reported as a **different size**. Side by side against the
Solo result header (the canonical chrome reference), two gaps:

1. **Smaller** — the FvF header/nav were shorter than Solo's.
2. **Sparser right side** — FvF only had `Vault` + `New battle`, where Solo carries
   `SAVED TO DEVICE` · credits pill · `Vault` · `New scan` · avatar.

## Root cause (the size half — the lesson)
The shell, header (`.rs-header`), and nav (`.rs-nav`) are all **shared** `rs-*`
classes whose heights come from two CSS vars defined on `:root` in
`result-shell.css`:

```css
:root{ --rs-header-h: 62px; --rs-nav-h: 66px; }
```

`.rs-header{ height:var(--rs-header-h) }`, and `.rs-nav` uses **both** vars
(`top:var(--rs-header-h)` for the sticky offset, `height:var(--rs-nav-h)`).

The versus result wraps its shell in an extra class, `vs-result-app`, and
`versus.css` quietly **shadowed those vars on that scope**:

```css
.vs-result-app { --rs-header-h: 56px; --rs-nav-h: 56px; }
```

So the *same* `.rs-header`/`.rs-nav` markup rendered 6px shorter (header) and 10px
shorter (nav) on the versus page than on Solo — the "different size." It was an
intentional tighten ("so each tab fits without scroll"), but it broke parity with
the reference chrome.

## Fix
- **Size:** removed the `.vs-result-app` var override so the versus shell inherits
  the root `62 / 66`, identical to Solo.
- **Right side:** rebuilt `.rs-h-right` in `VersusResult.tsx` to mirror Solo's
  structure exactly — `.rs-saved` (`SAVED TO DEVICE`, animated lime LED), an
  `.rs-credits` pill (`{credits} left` → `/credits`), and an `.rs-h-actions` group
  holding `Vault`, `New battle`, and `<ProfileMenu avatarClassName="rs-avatar" />`.
  Pulled `credits` from `useAccount()` (the page already lives under
  `BattleProvider`, which itself sits under `AccountProvider`, so the hook resolves).

All three additions reuse **already-styled** shared classes (including the mobile
`@media` rules that hide `.rs-saved span` and shrink `.rs-credits`), so no new CSS
was needed — only the override deletion.

The left side (`FRIEND VS FRIEND / VERDICT · {mode}` + the winner-colored
`verdict-chip`) was left intact: it already structurally mirrors Solo's
`RESULT · NO. x / date` + chip, with content/colour that's correct for a battle.

## Verification
- `tsc -p apps/web/tsconfig.json --noEmit` → clean (exit 0).
- Visual parity to be eyeballed live on `/versus/result` (hot-reload).

## Follow-up — tab numbering gap (same nav)
The tab pills drew their number from a **fixed** per-tab map
(`face:01, outfit:02, verdict:03`). In a single-category battle the active tab
list is `['face','verdict']`, so the nav read **`01 FACE` → `03 VERDICT`** —
skipping 02, while the stepper beside it already (correctly) said `01 / 02`.

Fix: number by **position in the active list**, matching Solo —
`{String(i + 1).padStart(2,'0')}` from `tabs.map((t, i) => …)` — and reduced
`TAB_LABEL` to a plain `Record<Tab, string>` (the `n` field was now dead). Now
face-only / outfit-only modes read `01 → 02` with no gap.

## Follow-up 2 — don't shade the losing player's stats
`versus.css` greyed the **whole losing column** in the Face/Outfit comparison
tabs: `.vs-c[data-state="lose"] { opacity: .55; filter: grayscale(.55); }` — so
the player who didn't win had their avatar, score, chips and top reads dimmed and
desaturated. Product call: never penalise the loser visually.

Removed the `lose`/`win` opacity+filter rules (and the now-dead `.vs-c`
transition). Both columns now read at full strength; the win still reads clearly
via **positive-only** highlights — the crown, the avatar halo
(`[data-state="win"] .vs-avatar .halo`) and the fit-frame glow
(`[data-state="win"] .vs-fitframe`). The share card and `.vs-scoreline` already
never dimmed the loser, so no change there. The per-metric split-bar dim
(`.vs-split[data-win] .na/.nb { opacity:.4 }`) was left — it's a symmetric
per-row "who leads this stat" cue, not a per-player shade.

## Follow-up 3 — drop the redundant per-player "Top reads"
Each comparison `Column` (Face/Outfit) carried its own `.vs-reads` "Top reads"
mini-bars, duplicating data already shown head-to-head in the center column's
`SplitBar`s. Removed the `.vs-reads` block (and the now-unused `top` sort) from
the shared `Column`, so it's gone for both players on both Face and Outfit. The
center splits are now the single home for the metric breakdown. The `.vs-reads*`
CSS is left in place (dead but harmless) for easy revert.

## Takeaway
When a page reuses a shared shell via an extra wrapper class, check that wrapper
for **CSS-var overrides** before assuming the chrome is identical — a single
`--rs-header-h` shadow is enough to silently desync "the same" header. Canonical
chrome lives in the vars; align by inheriting them, not re-declaring. And a
stepper's index should come from the **rendered list position**, never a static
per-item constant — the constant is only right when every item is always present.
