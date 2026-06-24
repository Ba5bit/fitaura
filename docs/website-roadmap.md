# Fitaura — Website Roadmap (future changes)

> Captured 2026-06-24. A backlog of agreed future work, in the order you plan to
> tackle it. The theme engine + promo system described here were **built and tested
> this session, then removed** (clean slate) — so the architecture below is
> *known-good* to rebuild, not speculative. Design work is going through **Claude
> Design**; this doc is the engineering + product reference.

## Build order (your priority)

1. **Finish polishing Friend vs Friend** *(in progress — your current focus)*
2. **Add a second Friend-vs-Friend mode** *(next)*
3. **Company skin** *(needs the theme engine + promo)*
4. **Football / World Cup theme** *(last — the flagship pack)*

*Parallel track:* **Light/White theme** — being designed in Claude Design separately
(free, no code). Not in the numbered order; slots in whenever its design is ready.

---

## 1. Friend vs Friend — polish + a second mode

- **Polish (now):** your in-flight work (uncommitted in the tree: `versus.css`,
  `Result.tsx`, `VersusResult.tsx`, `VersusScan.tsx`, `versusBits.tsx`,
  `useCountUp.ts`, `shared/versus/*`, dev-logs 064–071). Reference brief:
  `design-sync/fitaura/_drafts/friend-vs-friend-design.md`.
- **Second mode (next — define it):** not yet specced. Decide what the mode is
  (e.g. group/bracket of >2 people? same-person before/after? a themed head-to-head?),
  then write its own `_drafts/<mode>-design.md` brief in the FvsF format and build it
  on the existing versus flow (upload → scan → result deck). Reuse the per-person
  accent system (A icy `#83b4ff` / B magenta `#ff52a6`) and the VS divider motif.

---

## 2. Shared foundation — Theme/Skin Engine *(prerequisite for Company + Football)*

Both branded skins ride one engine. Architecture (built + verified this session):

- **Pack manifest:** `{ id, label, free, entitlement?, tokens, assets?, copy?, slots? }`.
  `tokens` = a CSS-var override map; `slots` = optional custom card/section components.
- **Registry + provider:** a static registry of manifests; a `ThemeProvider`
  (sibling of `PreferencesProvider`) resolves the active theme, sets
  `data-theme="<id>"` on `<html>`, and applies the token map as inline CSS vars.
  Heavy packs (football) should be **code-split** (dynamic import) so default users
  don't pay for them.
- **Resolution rule (pure, unit-test it):** `available = free ∪ {gated theme whose
  entitlement the account owns}`; active = requested-if-allowed else `default`.
- **Persistence:** active theme rides the **account-synced preferences**
  (`profiles.theme` column + localStorage mirror) — the same pattern already on main
  for receipt paper / reduce-motion (see `state/preferences.tsx`). **Guests = mirror
  only.** NOTE: `profiles.theme` is **not yet on prod** — add the column when you
  rebuild.
- **The default theme = today's dark look, byte-for-byte** (zero token overrides), so
  shipping the engine cannot regress the current site.

**Why it works cheaply:** ~270 component styles read 6 neon vars
(`--cyan/--lime/--magenta/--icy/--gold/--red`); remapping those in a manifest
recolors most of the app at once. The harder ~345 hardcoded `#fff` /
`rgba(255,255,255,…)` literals across ~18 CSS files are only needed for a *full*
re-skin (like light mode) — a branded *re-tint* (company/football) leans mostly on
the vars + per-pack card slots.

**Export gotcha:** the card exporter (snapdom) must render the **active theme's**
tokens/slot — mind the snapdom + StrictMode gotchas already noted for FvsF.

---

## 3. Promo-code / Entitlements system *(the gate for Company + Football)*

Unlocks a gated theme (or any future perk) on an account. Built + tested this session.

**Data model (3 additive, RLS-locked tables):**
- `promo_codes` — `code` (unique, normalized upper), `entitlements text[]`,
  `max_redemptions int null`, `redemptions_count`, `expires_at`, `active`.
- `code_redemptions` — `code_id`, `user_id`, **unique(code_id, user_id)** (per-account dedupe).
- `account_entitlements` — `user_id`, `entitlement`, **pk(user_id, entitlement)** (permanent grants).

**Redemption = one RPC** `redeem_code(p_code)` — `SECURITY DEFINER`, atomic: validate
(active / not expired / under cap) → per-user dedupe (friendly `already_owned`) →
insert redemption, bump counter, upsert entitlements. RLS: users read only their own
entitlements; **no client writes** — the RPC is the only grant path, and `promo_codes`
has no select policy (no enumeration). Grant execute to `authenticated` only.

**Entitlement keys** are namespaced strings: `theme:football`, `theme:company-<x>`;
the model also supports `feature:*` / `perk:*` later.

**Where the promo input goes (decided):**
1. **Deep-link redeem URL** (`fitaura.studio/unlock/<CODE>`) = the campaign funnel —
   applies the theme on arrival (sign-in if needed). **Primary; this is what goes on social.**
2. **Settings → "Have a code?"** field = the permanent manual home (beside the theme switch).
3. A small **"Have a code?"** link on the **Landing** for discovery. **Not** the header.

**Codes:** shared, time-boxed campaign codes (one code, many redemptions). Seed via
SQL — no admin UI in v1. Grants are **permanent** (code expiry only stops new redemptions).

**Gated theme discoverability:** show unowned gated themes as **locked 🔒 teasers** in
the switcher.

> ⚠️ **DB constraint (important):** the Supabase **MCP only reaches production** — there
> is no usable dev branch (its write tools take no project ref). So apply these
> additive migrations **deliberately** (they're inert until someone redeems/picks a
> theme), or stand up a separate isolated project first. The account-preferences
> columns are already live on prod; `profiles.theme` + the promo tables are not.

---

## 4. Company skin *(after FvsF; needs §2 + §3)*

A **parameterized brand template**, not N one-offs: one pack design takes
**logo + colors + name** as inputs, so each company is **config/data**, not a new build.

- **Gating:** a company-specific code → `theme:company-<x>` entitlement, distributed to
  that company's people.
- **Surfaces:** branded chrome (logo + brand color on topbar/nav/CTAs) + branded cards
  (the company's logo/name on the face/outfit cards) + branded receipt.
- **Truthful data:** the cards bind to the same real result fields as today (score,
  tier, face/outfit photo, sub-scores) — the brand is a skin over real data.
- **To do:** write a `_drafts/company-theme-design.md` brief (in the football/white
  format) defining the config inputs + how each surface consumes them, design it in
  Claude Design, then implement as a templated manifest (brand values as theme params).

---

## 5. Football / World Cup theme *(last; needs §2 + §3)*

The flagship "full custom" pack. Full brief already written:
**`design-sync/fitaura/_drafts/football-theme-design.md`.**

- **Hero = FUT player card.** Data mapping: score→**OVR**, verdict/tier→**position**,
  face→**player photo**, sub-scores→**stat row**. Pitch-green + gold, matchday copy.
- **Surfaces:** pitch-green chrome, FUT face + outfit cards, match-report receipt,
  broadcast-HUD scan, the unlock UI.
- **Gating + launch:** shared code `WORLDCUP2026`, World-Cup-window time-box. Social:
  the exported FUT card carries the QR/unlock link → the card *is* the ad (viral loop).
  Make a football variant of the social templates for the announcement.

---

## Light / White theme *(parallel — Claude Design)*

Brief: **`design-sync/fitaura/_drafts/white-theme-design.md`**. Free, no code.
**Monochrome editorial:** white surfaces, near-black ink, **one** Fitaura periwinkle-blue
accent (`#3a5bef`, **not red** — red was a company example). The whole neon palette
collapses to the one accent. **Key nuance:** text on dark **photo insets stays white**;
only card-body/panel text flips to ink. Receipt → the existing ivory paper.

---

## Claude Design assets prepared this session (temporary, untracked)

- **Design briefs:** `design-sync/fitaura/_drafts/football-theme-design.md`,
  `…/white-theme-design.md` (prompt-seeds ready).
- **Truthful screen exports:** `claude-design-import/screens/` — self-contained,
  byte-truthful snapshots of the live site (landing, upload, settings, versus-upload +
  shared chrome) captured from the running app; plus the existing truthful card /
  receipt / scan-HUD exports in `claude-design-import/`.
- **Gap:** dynamic pages (Result, scan animation, Versus scan/result) need a real
  generation to capture — re-snapshot `/result` + `/versus/result` with a signed-in
  result open.

## Cross-cutting notes / gotchas

- **Git hygiene:** the tree carries lots of unrelated in-flight work (FvsF, landing,
  `design-sync/`, `claude-design-import/`, iOS spec). Stage only a feature's own files;
  never `git add -A`.
- **`account-synced-preferences`** (receipt paper + reduce-motion) is **on main**
  (`4281511`) — the theme engine's persistence builds directly on it.
- **Solo-scan edge function** deploys manually (not via git/Vercel) — relevant if a
  pack ever needs new AI/copy.
- Build each pack as its own branch/slice; the theme engine + promo are the shared
  dependency to rebuild **once**, before company/football.
