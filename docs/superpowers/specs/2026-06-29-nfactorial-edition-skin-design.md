# FITAURA × nFactorial Edition — design spec

> Captured 2026-06-29. Approved through brainstorming. The implementation plan is a
> separate document (`writing-plans`). This spec is the source of truth for *what*
> and *why*; the plan covers *how/in what order*.

## 1. Overview

A co-branded **"nFactorial Edition"** skin for Fitaura's result cards, unlocked by a
promo code (`NFACTORIAL2026`). It is a **re-tint of the real cards**, not a parallel
theme engine and not a clone of the design kit: the existing design-system cards stay,
and turning the Edition on re-skins them into nFactorial's **clean white identity with
a red accent**, laced with the ¡n! co-brand mark.

It applies to both result pages:

- **Solo Scan result** (`/result`) — Face + Outfit + Receipt, switched together.
- **Friend vs Friend result** (`/versus/result`) — the **share cards only** (the
  exported verdict/stats deck); the rest of the versus page is untouched.

Access is gated **per account**: the Edition switch only appears once the account owns
the `theme:company-nfactorial` entitlement, granted by redeeming the code.

Reference design kit (identity/colors only, **not** a verbatim port):
`C:\Users\progr\Downloads\nfactorial-skin-kit` (`nfactorial.css` is the re-tint
reference; `nfactorial.jsx` shows the co-brand lockup + receipt seal/watermark).

## 2. Goals / Non-goals

**Goals**
- Re-skin the existing Solo cards (Face/Outfit/Receipt) into the nFactorial white+red
  Edition via a scoped CSS overlay + a small co-brand overlay — no clone card components.
- Re-skin the FvsF **share cards** (full red re-tint), leaving the rest of the versus
  page as-is.
- One result-level **Edition switch** (Default ⟷ nFactorial) on each result page,
  flipping the whole co-brand set at once.
- A real **per-account promo/entitlements** gate so `NFACTORIAL2026` unlocks the Edition.
- Exports/shares match the on-screen Edition (WYSIWYG).
- Build the Edition layer so future packs (company-X, football/World Cup) are config/data.

**Non-goals (this build)**
- No `profiles.theme` column / account-level "active theme" — the Edition is chosen
  per-result, not as an account default.
- No re-skin of page chrome (header/nav/landing) — only the cards.
- No re-skin of FvsF non-card elements (split bars, banners, Superlatives/reads, the
  in-page head-to-head panel-shot).
- No locked/teaser UI — the switch is simply hidden until the account is entitled.
- No football/white packs (architecture is extensible to them; they are separate builds).

## 3. Decisions (resolved during brainstorming)

| # | Decision |
|---|---|
| D1 | **Re-tint the real cards**; the kit is a color/identity reference, not a copy. |
| D2 | nFactorial canonical look = **white edition** (clean white surface, ¡n! red accent). |
| D3 | One result-level **Edition switch**; nFactorial flips face+outfit+receipt together. The existing per-card dots stay for the Default edition only. |
| D4 | nFactorial skins are **not** added to the per-card `cs-dots` registry — Default UX is byte-for-byte unchanged. They live in a separate Edition layer. |
| D5 | Edition base is pinned to the canonical **Dossier** card (the kit mirrors the `facecard-fb`/`fc2-*` Dossier structure), so the co-brand is consistent regardless of which dot was last picked. |
| D6 | FvsF: **full red re-tint of the share cards only**; A-vs-B distinguished by **winner = nFactorial red, other = neutral charcoal/ink** (the one undesigned surface — to be eyeballed). |
| D7 | Unlock = **real per-account entitlement** (`theme:company-nfactorial`) via the promo/entitlements backend (roadmap §3). |
| D8 | Promo-code surfaces: `/unlock/:code` deep link + Settings field + **Vault announcement** (NOT Landing). |
| D9 | Gating UX: switch **hidden** until entitled, then it appears. No locked teasers. |
| D10 | Edition selection persists **per result** (client `usePerCardState`), not as an account preference. |

## 4. Architecture — the Edition layer

A thin layer above the existing per-card skin system.

**Edition registry** (`apps/web/src/components/cards/editions/registry.ts`):

```ts
export interface Edition {
  id: 'default' | 'nfactorial';
  label: string;                 // switch label
  entitlement?: string;          // gate key; undefined = always available (default)
  // For a CSS re-tint edition, the cards stay the real ones — the edition only
  // contributes a data-attribute scope + the co-brand overlay. Heavier future
  // packs (football) may instead carry bespoke slot components here.
}

export const EDITIONS: Edition[] = [
  { id: 'default',    label: 'Default' },
  { id: 'nfactorial', label: 'nFactorial', entitlement: 'theme:company-nfactorial' },
];
```

**How nFactorial renders (no clone components):**
- The card mount gets `data-edition="nfactorial"`.
- New scoped stylesheet `apps/web/src/design/nfactorial-skin.css` (following the
  `clean-skin.css` / `nameplate-skin.css` convention) re-tints the **Dossier** face/outfit
  cards under that scope: white surface tokens, `--accent`/badge/stat treatments remapped
  to nFactorial red, the red top-rule, readability fixes (mirroring the kit's
  `nfactorial.css`).
- A small **`<EditionLockup>`** overlay (the ¡n! mark + "FITAURA × nFACTORIAL") is rendered
  on the card by the Edition layer (the only added markup). Asset: the ¡n! logo copied into
  the web app's assets.

**Why this is cheap:** the app recolors through ~6 neon vars + `--accent` in
`design/fitaura.css`; a scoped remap recolors the cards at once. The kit's
`nfactorial.css` is already a truthful re-tint of these same `.asset`/`.fc2-*`/`.mstat`
classes, so it ports as a reference almost directly.

### 4.1 Solo result (`features/result/Result.tsx`)
- Add an `edition` state, persisted per generation: `fitaura.cardfx.<genId>.edition`
  (via `usePerCardState`, like the existing `skin`/`stamp` state). Default `'default'`.
- When `edition === 'nfactorial'` **and** the account is entitled:
  - Face/Outfit render the **Dossier** comps under `data-edition="nfactorial"` + lockup,
    regardless of the per-kind `faceSkin`/`outfitSkin` (those are restored when the
    Edition is turned back off). The per-card `cs-dots` are hidden while the Edition is on.
  - Receipt renders a **re-tinted receipt** (scoped `data-edition="nfactorial"` over the
    existing `Receipt`) plus a small **seal/watermark overlay**; the Paper segment bar
    (Neon/Thermal/Onyx/Ivory) is hidden while the Edition is on.
- Export: the offscreen export host renders the Edition-skinned face/outfit/receipt when
  the Edition is on, so downloads/shares are WYSIWYG.

### 4.2 FvsF result (`features/versus/VersusResult.tsx`)
- Add an `edition` state, persisted per battle (e.g. `fitaura.battlefx.<battleId>.edition`).
  Default `'default'`.
- When on + entitled, the **`VerdictShareCard`** (both verdict and stats views — on-screen
  fan deck *and* the offscreen export copies) renders under `data-edition="nfactorial"`,
  re-tinted red/white with the ¡n! lockup. Winner side = nFactorial red, other = charcoal
  (D6). Implemented via a scoped `nfactorial-versus.css` + (if needed) an `edition` prop
  on `VerdictShareCard` so the side colors switch to red/charcoal rather than `colA/colB`.
- **Untouched:** the head-to-head split bars, banners, Superlatives/reads, header/nav, and
  the in-page `renderPanelShot` head-to-head card. (Revisit only if asked.)

### 4.3 Edition switch UI (`components/EditionSwitch.tsx`)
- A small labeled segmented control: **"Edition · Default | nFactorial"**.
- Placed near the card actions on Solo, and near the share-card deck on FvsF.
- **Only rendered when** `hasEntitlement('theme:company-nfactorial')` is true (D9).
- Extensible: it maps over the entitled subset of `EDITIONS`.

## 5. Architecture — promo / entitlements gate

Follows roadmap §3 (`docs/website-roadmap.md`). Additive and RLS-locked.

### 5.1 Database (3 tables + 1 RPC)
- **`promo_codes`** — `code` (unique, normalized upper), `entitlements text[]`,
  `max_redemptions int null`, `redemptions_count int default 0`, `expires_at timestamptz`,
  `active boolean`. **No SELECT policy** (no client enumeration).
- **`code_redemptions`** — `code_id`, `user_id`, `unique(code_id, user_id)` (per-account
  dedupe). RLS: owner reads own rows.
- **`account_entitlements`** — `user_id`, `entitlement`, `pk(user_id, entitlement)`
  (permanent grant). RLS: **owner-only read; no client writes**.
- **`redeem_code(p_code text)`** — `SECURITY DEFINER`, atomic: normalize → validate
  (active / not expired / under cap) → per-user dedupe (return friendly `already_owned`)
  → insert redemption, bump `redemptions_count`, upsert entitlements. Returns a small
  status payload (`{ status: 'ok' | 'already_owned' | 'invalid' | 'expired' | 'exhausted',
  entitlements?: string[] }`). `EXECUTE` granted to `authenticated` only.
- **Seed:** `NFACTORIAL2026` → `entitlements = ['theme:company-nfactorial']`,
  `active = true`, `expires_at` = end of the nFactorial event window, `max_redemptions`
  null (or a cap if desired).

### 5.2 Client
- **`services/entitlementsService.ts`** (mirrors `preferencesService.ts`):
  - `getEntitlements(userId): Promise<string[]>` — `select entitlement from
    account_entitlements where user_id = …` (RLS scopes to self).
  - `redeemCode(code): Promise<RedeemResult>` — `supabase.rpc('redeem_code', { p_code })`.
- **`AccountContext`** gains:
  - `entitlements: string[]` and `hasEntitlement(key): boolean`.
  - `redeemCode(code): Promise<RedeemResult>` — on `ok`/`already_owned`, refreshes
    `entitlements`.
  - Loaded in a **separate effect keyed on `userId`** (exactly like the credit-balance
    load) — **never** inside `onAuthChange` (auth-lock deadlock gotcha documented there).
  - Signed-out → `entitlements = []`.

### 5.3 Surfaces (D8)
- **`/unlock/:code` route** (new in `App.tsx`): the social funnel. On mount:
  - Signed in → call `redeemCode(code)`, toast the outcome, navigate to `/result` (if a
    result exists) else `/vault`.
  - Signed out → open the auth modal with a redirect back to `/unlock/:code`, redeem after
    sign-in.
- **Settings → "Have a code?" field** (`features/vault/Settings.tsx`): input + Redeem
  button → `redeemCode`, inline success/error.
- **Vault announcement** (`features/vault/*`): a dismissible "Editions / Unlock" banner
  with a code field (the durable home that future packs reuse). **Not** on the Landing.

### 5.4 Guests
Redemption is per-account, so a guest must sign in to redeem. A guest hitting
`/unlock/NFACTORIAL2026` gets the auth modal first, then the redeem completes (§5.3).

## 6. Persistence & export summary
- **Entitlement** = per account (server, RLS), loaded into `AccountContext`.
- **Edition selection** = per result (client `usePerCardState`), so a Vault reopen
  restores it; default is always `'default'` (current cards stay unless toggled).
- **Export** = offscreen hosts render the active Edition components; mind the existing
  snapdom + StrictMode export gotchas already noted for FvsF.

## 7. Files

**New**
- `apps/web/src/components/cards/editions/registry.ts` — `EDITIONS` + helpers.
- `apps/web/src/components/cards/EditionLockup.tsx` — ¡n! co-brand overlay.
- `apps/web/src/components/EditionSwitch.tsx` — the gated Default/nFactorial control.
- `apps/web/src/design/nfactorial-skin.css` — scoped Solo re-tint (face/outfit/receipt).
- `apps/web/src/design/nfactorial-versus.css` — scoped FvsF share-card re-tint.
- `apps/web/src/services/entitlementsService.ts` — `getEntitlements`, `redeemCode`.
- `apps/web/src/features/unlock/Unlock.tsx` — the `/unlock/:code` redeem screen.
- nFactorial ¡n! logo asset (copied from the kit into web assets).
- Supabase migration: 3 tables + `redeem_code` RPC + RLS + seed.
- Tests: `editions/registry.test.ts`; render smokes for the new components.

**Modified**
- `apps/web/src/features/result/Result.tsx` — edition state + switch + edition-aware
  render/export.
- `apps/web/src/features/versus/VersusResult.tsx` — edition state + switch + edition-aware
  share card/export.
- `apps/web/src/features/versus/components/VerdictShareCard.tsx` — optional `edition` prop
  for red/charcoal side colors.
- `apps/web/src/features/account/AccountContext.tsx` — entitlements/hasEntitlement/redeemCode.
- `apps/web/src/features/vault/Settings.tsx` — "Have a code?" field.
- Vault component — the "Editions / Unlock" announcement.
- `apps/web/src/App.tsx` — `/unlock/:code` route.

## 8. Testing
- Unit: edition-registry resolution (entitled subset, default fallback) — mirrors
  `registry.test.ts`. `redeem_code` paths exercised against a seeded code (ok /
  already_owned / expired / exhausted / invalid).
- Render smokes: nFactorial Face/Outfit/Receipt re-tint + FvsF share card.
- Manual export-parity check: on-screen Edition == downloaded PNG, both result pages.
- Consider extending the multi-skin regression fixture (renders all card variants per
  skin) noted in team memory, to include the Edition.

## 9. Operational caveat (must be explicit)
The Supabase MCP **only reaches production** — no usable dev branch. The migration is
**additive and inert until someone redeems or selects the Edition**, but it *does* touch
the prod database. Applying the migration + seeding the code is a **discrete, explicitly
approved step** in the implementation plan — never a silent side effect. Per team
convention, `git add` only this feature's files (the tree carries unrelated in-flight
work) and hold pushes during iterative tweaking until "that's enough." Write a dev-log
under `docs/dev-log/` after each crucial step.

## 10. Open / future (not in this build)
- **Promoting codes for future packs (football).** Open product question. Durable answer:
  the Vault "Editions / Unlock" area is the on-site home for announcing drops, and the
  **exported card's QR/unlock link is the social CTA** (the card is the ad — roadmap §5
  viral loop). When football ships, it reuses this exact gate (`theme:football`,
  `WORLDCUP2026`) and the Vault announcement; only the pack's slots/assets are new.
- **FvsF A-vs-B-under-red (D6)** is the one genuinely-undesigned surface; validate visually
  and adjust the red/charcoal split if legibility suffers.
- nFactorial **dark** variant and a receipt paper sub-option (the kit has both) — possible
  later refinement; v1 ships the single white edition.
