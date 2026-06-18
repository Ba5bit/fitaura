# Gender-Aware Card Skins + Card-Stack Switcher — Design

- **Date:** 2026-06-18
- **Status:** Draft for review
- **Author:** brainstormed with Claude
- **Area:** `apps/web` (Result page, cards), `packages/shared` (result model, assemble), `supabase/functions/solo-scan` (edge redeploy only)

---

## 1. Summary

Give the Result page **gender-aware visual card identities** and **switchable card skins**:

1. **Gender theme** — femme results render in a magenta + gold identity, masc in the
   current icy/cyan. The gender is the AI's existing call, with a quiet manual flip
   for misreads.
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
- No per-result public share URL / sharing infrastructure (QR points to the homepage).
- The "Buffering" prototype skin is **not** adopted.
- The manual gender flip re-themes the card **visually**; it does not rewrite the AI's
  already-chosen archetype/caption/punchline copy (see §5.2).

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
| QR target | **Homepage URL** (static, same on every card) |
| Gender control | **Auto, with a quiet manual flip**; override persists per result |
| Stickers on new skins | **Keep full swap + drag reposition**, with **per-skin default anchors** |
| Color rule | **System tokens only**; rebuild prototype layouts in current CSS |

## 5. Architecture

### 5.1 Surface gender into the result model

- Add `gender: 'femme' | 'masc'` to `FullGenerationResult` (`packages/shared/src/result.ts`).
- In `assemble.ts`, set it from the existing `contentGender` (`confidentlyFemme ? 'femme' : 'masc'`),
  so the visual theme and the copy can never disagree.
- Add `genderOf(r)` helper (mirrors `partsOf`) defaulting to `'masc'` for legacy rows.
- **Edge redeploy** required (manual, documented step). The AI side is unchanged.

### 5.2 Manual gender override (theme-only)

- The Result page reads the effective gender as `override ?? result.gender`.
- A small, unobtrusive control in the card control bar flips it; the choice persists in
  `localStorage` keyed by generation id (`fitaura.gender.<generationId>`), so reopening
  the result keeps it and the canonical stored result is never mutated.
- Scope: the override swaps the **visual identity** (accent → magenta, gold detailing)
  and the **Femininity/Masculinity index label**. It does **not** re-pick the baked
  archetype/caption/punchline (those were the AI's content call; re-resolving them needs
  the raw AI output, which the stored result doesn't carry). This is an accepted
  tradeoff for the MVP — flagged here so reviewers can object.

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
- The encoded URL is a single config constant (`SITE_URL`) — **value to be confirmed**
  (see §9).

### 5.9 State / persistence summary

| State | Where | Scope |
|---|---|---|
| `gender` | result model (IndexedDB + vault) | per generation |
| gender override | `localStorage fitaura.gender.<genId>` | per generation |
| selected skin | `localStorage fitaura.skin.{face,outfit}` | global preference |
| receipt paper | `localStorage fitaura.paper` (existing) | global preference |
| sticker pos | component state keyed by `{kind, skinId}` | session |

## 6. Module boundaries

- `components/cards/skins/` — `CleanCard`, `LoreCard`, registry, shared bits (scrim,
  dot-meter, badge). Each skin understandable and testable in isolation via `SkinProps`.
- `components/cards/CardSwitcher.tsx` — stack/fan + skin selection; no business logic.
- `components/cards/ReceiptPremium.tsx` + `lib/qr.ts` — holo receipt + QR encoding.
- `packages/shared` — `result.ts` (`gender`, `genderOf`), `skin-copy.ts`, `ReceiptPaper`.
- `Result.tsx` — wires switcher + gender override + per-skin export; logic stays thin.

## 7. Phasing

- **Phase A — Gender plumbing + Premium QR receipt.**
  Surface `gender` (+ edge redeploy), theme the existing Dossier card femme/masc, add the
  manual flip, ship the Premium receipt with real QR. Delivers "different design for women"
  and the QR receipt fast, with the smallest blast radius.
- **Phase B — Skins + switcher.**
  Add Clean + Lore skins, the `CardSwitcher`, per-skin sticker geometry, and per-skin export.

## 8. Testing

- **Shared (unit):** `assembleResult` sets `gender` correctly across femme/masc/unsure +
  confidence boundary; `genderOf` legacy default; `SKIN_COPY` has every verdict.
- **QR (unit):** encoder produces a scannable matrix for `SITE_URL` (decode round-trip).
- **Switcher (unit):** reuse/extend `cardFanCycle` tests for skin ordering; front-card
  liveness; switching disabled while editing.
- **Manual / visual:** femme + masc × 3 skins × 3 verdicts render in-tokens; export
  WYSIWYG parity (snapdom) incl. QR; sticker reposition per skin; gender flip persists.

## 9. Open items

- **`SITE_URL` for the QR** — exact homepage URL to encode (e.g. `https://fitaura.app`).
  Single value; doesn't block building, only the final QR target.

## 10. Risks / watch-list

- **Edge redeploy** is a manual step (documented) — easy to forget; Phase A isn't live
  until it ships.
- **Theme/copy mismatch** after a manual flip (§5.2) — accepted for MVP.
- **Export surface grows** from 3 to up to 5 card variants — keep each skin's export host
  lean (only the selected skin renders).
- **Vault thumbnails / older results** — verify the vault browser tolerates the new
  `gender` field and the extra paper value (`genderOf` + default paper cover this).
