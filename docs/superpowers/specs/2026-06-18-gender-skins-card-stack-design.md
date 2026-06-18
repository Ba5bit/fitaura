# Gender-Aware Card Skins + Card-Stack Switcher — Design

- **Date:** 2026-06-18
- **Status:** Draft for review
- **Author:** brainstormed with Claude
- **Area:** `apps/web` (Result page, cards), `packages/shared` (result model, assemble), `supabase/functions/solo-scan` (edge redeploy only)

---

## 1. Summary

Give the Result page **gender-aware visual card identities** and **switchable card skins**:

1. **Gender-dedicated cards** — the AI decides gender at submission (fixed). A femme
   submission gets a magenta + gold identity with femme archetype/caption/punchline/sticker
   copy; masc gets the current icy/cyan with masc copy. No manual gender toggle.
2. **Three switchable skins** per image card — the current **Dossier** (default),
   plus two full-bleed designs adapted from the prototype: **Clean** (Tinder-style)
   and **Lore** (collectible). A landing-style fanned card stack switches between them.
3. **Premium receipt** — a holo "verified pass" added as a 3rd paper (alongside Dark
   Neon and Thermal), carrying a **real QR code** that links to the homepage.

All three are built **in the existing system color tokens and CSS** — the prototype in
`new card modes/` is a *reference for layout ideas only*. None of its code, web
components (`<image-slot>`), `window.*` globals, or palette are copied.

## 2. Non-goals

- No change to the Gemini prompt or the AI schema — `presentation.gender` already exists.
- **No manual gender toggle.** Gender is the AI's determination at submission, fixed per
  result (§5.2). Mode/skin switching changes style only, never gender.
- No per-result public share URL / sharing infrastructure (QR points to the homepage).
- The "Buffering" prototype skin is **not** adopted.

## 3. Key findings from the current system

- **Content is already gender-aware.** The AI returns `presentation.gender`
  (`femme | masc | unsure`) + confidence; `assemble.ts` already forks archetypes,
  outfit captions, punchlines, and the face metric label (Femininity ↔ Masculinity)
  on a resolved `confidentlyFemme = gender === 'femme' && genderConfidence >= 0.60`.
- **Gender is dropped from the result.** `FullGenerationResult` carries none of it, so
  the Result page cannot theme on gender today. Surfacing it is the keystone change.
- **Colors already exist.** `:root` defines `--magenta:#ff52a6` and `--gold:#ffcf66`
  next to the icy/cyan accent. Femme = magenta + gold, masc = icy/cyan needs **no new
  tokens**.
- **Export is snapdom-based** (`lib/exportCard.ts`) — it rasterizes the real DOM
  faithfully (shadows, gradients, backdrop-filter). A real QR rendered as inline SVG or
  a CSS grid of cells will export correctly.
- **`assembleResult` runs in the edge function** (`solo-scan/index.ts:75`), so adding a
  field to the result requires one **manual edge redeploy** (no Gemini changes).
- **Backward compat precedent:** `partsOf()` resolves a missing `parts` on legacy rows.
  We mirror it with `genderOf()` (default `masc`).

## 4. Decisions (locked with the user)

| Topic | Decision |
|---|---|
| Skin set (face/outfit) | Keep Dossier as default + add Clean + Lore = **3 switchable skins** |
| Receipt | **Premium added as 3rd paper** (neon / thermal / premium) |
| QR target | **`https://fitaura.studio/`** (static, same on every card) |
| Gender | **AI-determined at submission, fixed per result** — no manual toggle. A femme submission gets femme-dedicated cards; masc gets masc |
| Mode switching | **Style/skin only** (Dossier / Clean / Lore) — switching never changes gender |
| Stickers on new skins | **Keep full swap + drag reposition**, with **per-skin default anchors** |
| Sticker bank | **Gender-filtered** by the result's fixed gender — femme sees femme + neutral, masc sees masc + neutral |
| Color rule | **System tokens only**; rebuild prototype layouts in current CSS |

## 5. Architecture

### 5.1 Surface gender into the result model

- Add `gender: 'femme' | 'masc'` to `FullGenerationResult` (`packages/shared/src/result.ts`),
  set from the existing `contentGender` (`confidentlyFemme ? 'femme' : 'masc'`). This is a
  **single, fixed value** decided by the AI at scan time.
- Add `genderOf(r)` helper (mirrors `partsOf`) defaulting to `'masc'` for legacy rows.
- **Edge redeploy** required (manual, documented step). The AI prompt/schema are unchanged.

### 5.2 Gender is fixed per result — no toggle

Gender is **decided once by the AI at submission** and never changes in the UI. A femme
submission yields femme-dedicated cards (femme theme + femme archetype/caption/punchline/
sticker — the content fork already lives in `assemble.ts`); masc yields masc. There is **no
manual gender flip**: the card-stack switcher changes **style/skin only** (§5.5), never
gender.

- Everything keys off the single `result.gender`: the visual identity (§5.3), the
  Femininity/Masculinity index label, and the eligible sticker set (§5.9).
- `unsure` / low-confidence reads resolve to `masc` (the existing `confidentlyFemme`
  rule), so there is exactly one deterministic gender per result.

### 5.3 Skin registry + component contract

A per-kind registry replaces the hardcoded single card:

```ts
// e.g. components/cards/skins/registry.ts
type SkinId = 'dossier' | 'clean' | 'lore';
interface CardSkin {
  id: SkinId;
  name: string;        // "Dossier" | "Clean" | "Lore"
  tag: string;         // small label, e.g. "SCANNER" | "TINDER" | "COLLECTIBLE"
  Comp: React.FC<SkinProps>;
}
const CARD_SKINS: Record<'face' | 'outfit', CardSkin[]>;
```

`SkinProps` is the same shape every skin accepts:

```ts
interface SkinProps {
  content: FaceCardContent | OutfitCardContent;
  gender: 'femme' | 'masc';
  sticker: StickerData;     // current selected sticker preset
  stickerOn: boolean;
  preview?: boolean;        // dimmed, non-interactive peeking card in the stack
  run?: boolean;            // entrance animation on the active card
  roast?: string;
}
```

- **Dossier skin** wraps the existing `FaceCard` / `OutfitCard` unchanged.
- **Clean** and **Lore** are new components built in system CSS (full-bleed photo +
  scrim, bottom-anchored copy). They reuse `CardImage` for the photo (not `<image-slot>`).
- Each skin's root carries `data-gender={gender}`; a scoped CSS rule remaps `--accent`
  to `--magenta` and enables gold detailing under `[data-gender="femme"]`.

### 5.4 Skin copy bank

Clean/Lore need flavor text the current model doesn't store (tier, rarity, vol,
class label, bio). Add a **static, display-only, gender-aware** bank in shared, keyed by
verdict with femme overrides, seeded from the prototype's `STYLE_COPY` strings:

```ts
// packages/shared/src/skin-copy.ts
SKIN_COPY[verdict] = { tier, rarity, vol, classLabel, bio /* , bioFemme? */ };
```

Deterministic, no AI/schema change. (The Buffering-only fields — quote, loadName — are dropped.)

### 5.5 The switcher (card stack)

A new `CardSwitcher` adapts the landing `CardFan` motion to skins:

- Reuses the fanned poses (`front / backRight / backLeft`) + dots and the tested
  `cardFanCycle` ordering logic.
- The **front card is the live one**: it mounts the real skin with the interactive
  sticker overlay + edit mode + export ref. Peeking cards render their skin with
  `preview` (dimmed, static, no sticker interactivity) — the one idea taken from the
  prototype's `CardStack`.
- Switching is **disabled while editing** a sticker (same guard the swipe nav uses).
- Selected skin per kind persists globally in `localStorage`
  (`fitaura.skin.face`, `fitaura.skin.outfit`), like `fitaura.paper` does today.
- Integrates into `rs-frame` in `Result.tsx`, replacing the single `rs-card-mount`.

### 5.6 Per-skin sticker geometry

- `CARD_GEOM` (in `result/stickerGeometry.ts`) gains a per-skin layer:
  `CARD_GEOM[kind][skinId]` → default position + bounds.
- The `StickerLayer` overlays only the **front** skin and reads the active skin's anchor.
- Sticker position state becomes keyed by `{ kind, skinId }` so each skin remembers its
  own placement.

### 5.7 Export

- The offscreen export host renders the **currently selected** skin for each kind
  (export already mounts per-kind hosts; each now picks the active skin).
- "Export all" exports the selected skin of each available kind.
- Premium receipt + QR export verified via snapdom (DOM/SVG rasterizes faithfully).

### 5.8 Premium receipt + real QR

- Extend `ReceiptPaper` to `'neon' | 'thermal' | 'premium'`; add `premium` to the paper
  segmented control.
- Rebuild the holo "verified pass" layout in system tokens (accent = gender identity,
  verdict color stays semantic — no gold-on-gold clashes).
- **Real QR:** compute the QR matrix from the homepage URL with a tiny encoder
  (e.g. `qrcode-generator`, ~3KB) and render it as an inline SVG (snapdom-safe). Replaces
  the prototype's random `premiumQR` matrix.
- The encoded URL is a single config constant `SITE_URL = 'https://fitaura.studio/'`.

### 5.9 Gender-filtered sticker bank

Today the edit-mode sticker picker and the swap cycle show the **entire**
`STICKER_BANK[kind]`, so masc labels (ALPHA MALE, SIGMA, TATE) and femme labels
(GIRLBOSS, IT GIRL, BRAT, DELULU) appear for everyone. They must be gender-filtered.

- Tag each `StickerPreset` with optional `gender?: 'masc' | 'femme'` (untagged = neutral,
  shown to both). The classification is **derived from the existing gender tags in
  `content-bank.ts`** (its archetype/caption → `stickerId` maps already mark masc-only and
  femme-only entries) — not invented from scratch.
- Add a `stickersFor(kind, gender)` selector using the same eligibility rule as
  `content-bank.ts`'s `eligibleFor` (neutral always; femme-only iff femme; masc-only iff
  masc). The Result page feeds the picker and the swap cycle from this filtered list,
  keyed off the result's fixed `gender` (§5.2).
- Label nuance: a few archetypes carry femme label overrides (e.g. `unc` "UNC STATUS" →
  "AUNTIE"). Source those overrides from `content-bank.ts` so the femme bank reads
  correctly rather than showing the masc label. (Implementation detail for planning.)
- The auto-selected default sticker is already gender-correct (assemble picks from the
  gendered content bank); this change only fixes the **manual** picker + swap.

### 5.10 State / persistence summary

| State | Where | Scope |
|---|---|---|
| `gender` (fixed) | result model (IndexedDB + vault) | per generation |
| selected skin | `localStorage fitaura.skin.{face,outfit}` | global preference |
| receipt paper | `localStorage fitaura.paper` (existing) | global preference |
| sticker pos | component state keyed by `{kind, skinId}` | session |

## 6. Module boundaries

- `components/cards/skins/` — `CleanCard`, `LoreCard`, registry, shared bits (scrim,
  dot-meter, badge). Each skin understandable and testable in isolation via `SkinProps`.
- `components/cards/CardSwitcher.tsx` — stack/fan + skin selection; no business logic.
- `components/cards/ReceiptPremium.tsx` + `lib/qr.ts` — holo receipt + QR encoding.
- `packages/shared` — `result.ts` (`gender`, `genderOf`), `skin-copy.ts`, `ReceiptPaper`,
  `sticker-bank.ts` (per-preset `gender` tag + `stickersFor(kind, gender)` selector).
- `Result.tsx` — wires the skin switcher + gender theming + per-skin export; logic stays thin.

## 7. Phasing

- **Phase A — Gender plumbing + Premium QR receipt.**
  Surface the fixed `gender`, theme the existing Dossier card femme/masc, **gender-filter
  the sticker bank (§5.9)**, and ship the Premium receipt with real QR (+ one edge
  redeploy). Delivers "different design for women" + correct gendered stickers + the QR
  receipt fast, with the smallest blast radius.
- **Phase B — Skins + switcher.**
  Add Clean + Lore skins, the `CardSwitcher`, per-skin sticker geometry, and per-skin export.

## 8. Testing

- **Shared (unit):** `assembleResult` sets `gender` correctly across femme/masc/unsure +
  confidence boundary; `genderOf` legacy default; `SKIN_COPY` has every verdict;
  `stickersFor` returns neutral + own-gender only and excludes the other gender's stickers
  (e.g. no `girlboss` for masc, no `alpha` for femme).
- **Gender (unit):** a femme-detected scan produces femme copy + `gender === 'femme'`; a
  masc/unsure scan produces masc copy + `gender === 'masc'` (one fixed value, no toggle).
- **QR (unit):** encoder produces a scannable matrix for `SITE_URL` (decode round-trip).
- **Switcher (unit):** reuse/extend `cardFanCycle` tests for skin ordering; front-card
  liveness; switching disabled while editing.
- **Manual / visual:** femme + masc × 3 skins × 3 verdicts render in-tokens; export
  WYSIWYG parity (snapdom) incl. QR; sticker reposition per skin; the fixed gender drives
  theme + sticker filter per result.

## 9. Open items

- **Resolved:** `SITE_URL = https://fitaura.studio/`. No blocking open items remain.

## 10. Risks / watch-list

- **Edge redeploy** is a manual step (documented) — easy to forget; Phase A isn't live
  until it ships.
- **Legacy results** predate the `gender` field — `genderOf` defaults them to `masc`
  (theme + sticker filter), matching the existing copy fallback.
- **Export surface grows** from 3 to up to 5 card variants — keep each skin's export host
  lean (only the selected skin renders).
- **Vault thumbnails / older results** — verify the vault browser tolerates the new
  `gender` field and the extra paper value (`genderOf` + default paper cover this).
