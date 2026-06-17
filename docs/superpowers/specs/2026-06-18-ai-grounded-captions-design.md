# Design — AI-grounded captions, verdict lines & roasts (Hybrid)

- **Date:** 2026-06-18
- **Status:** Draft for review
- **Topic:** Make the solo-scan card lines, captions, punchlines and roasts feel unique and grounded in the actual face/outfit analysis, instead of recycled, templated, or copied across surfaces.

## Problem

The cards read as templated and same-y. Concretely:

1. **Hardcoded celebrity line.** `assemble.ts` (~L174-176) literally prepends
   `` `Giving ${recognizedIcon} energy. ` `` to the receipt summary whenever an icon
   is recognized ≥ 0.85 confidence. Every celeb/meme gets the identical stamp — the
   prompt even tells the model *not* to name the icon, then the backend names it.
2. **Recycled fixed pools.** The card line, outfit caption and punchline are drawn
   from small fixed, seeded, banded pools in `content-bank.ts` (~31 face / 21 outfit
   / 26 punchline). A small pool inevitably repeats, and several entries are dated
   cliché (`THE FIT HAS LORE`, the lingering `CERTIFIED …`). The same phrases also
   recur **across** pools (`AURA FARMER`, `IN AURA DEBT`, `CANON EVENT`, `AI SLOP`,
   `NPC WITH POTENTIAL`, `LOWKEY SIMP`).
3. **Roasts converge.** The prompt hands the model the entire archetype/caption/
   punchline vocabulary plus a fixed slang lexicon, so every roast gravitates to the
   same words. The per-rubric `evidence` the model already produces is **never used**
   to write the copy, and the BANNED list (which already bans "Giving"/"it's giving"/
   "in human form") is not honored. Nothing ties a roast to *this specific* photo.

## Goals

- Card line, outfit caption, punchline and roasts are **written by the model,
  grounded in the specific observed evidence**, and vary scan-to-scan.
- Keep the load-bearing guarantees the banks currently provide: **sticker art**,
  **score-band appropriateness**, **gender fit**, and a **safe deterministic fallback**.
- Recognized icons are referenced by **allusion, never by name** (e.g. MJ → `KING OF
  POP`/`MOONWALK`, Ronaldo → `SUUUIII`), and never via the old `Giving X` template.

## Non-goals

- Verdict-band recalibration (the 70/45 dating cutoffs, elite→dire bands) — separate.
- The solo-scan reliability / 502 / `maxOutputTokens` work — separate (tracked from
  the earlier investigation). We only note that new fields are tiny so output-size
  impact is minimal.
- A second Gemini pass / regeneration loop — explicitly avoided to protect latency,
  cost and the already-flaky single call.

## Approach: Hybrid

The model continues to **select** a category ID (which drives the sticker + a band
sanity-check + the fallback text) **and additionally writes** the short display line.
The written line is used when it passes a cliché/length/name filter; otherwise the
banked phrase for that band is used. Sticker + band always come from the selected ID,
so art and score safety never depend on the generated text.

```
AI output ── selected category ID ──▶ sticker art + band + fallback text
         └── written display line ──▶ filter (length / cliché / icon-name)
                                         ├─ pass → use written line
                                         └─ fail → use banked fallback text
```

---

## A. Schema (`packages/shared/src/solo-scan/schema.ts` + `gemini.ts` RESPONSE_SCHEMA)

Add short, length-capped written fields alongside the existing copy. New fields are
**required** (the structured-output schema is all-required).

- `faceCopy.verdictLine: { lead: string(≤16), punch: string(≤16) }`
  — the big face-card line; maps to the card's existing `[lead, highlight]` tuple.
- `outfitCopy.captionLine: string(≤28)` — the on-photo outfit caption.
- `receiptContent.punchlineText: string(≤24)` — the final viral punchline.

Bump `SOLO_SCAN_SCHEMA_VERSION` (`constants.ts`) `solo_scan_v3_3 → v3_4`, bump
`SOLO_SCAN_PROMPT_VERSION`, and update the prompt's `Set schemaVersion to "…"` line.
The hand-maintained `RESPONSE_SCHEMA` in `gemini.ts` must mirror the three new fields
(add to `required`).

> Note: `faceCopy.strongestPoint` is currently **unused** by `assemble.ts`. Keep it for
> the model's reasoning, or repurpose — out of scope to remove here, but flagged.

## B. Prompt (`gemini.ts` SYSTEM_INSTRUCTION)

- **Grounding rule (all copy):** every line/caption/punchline/roast must hang off a
  *specific observed detail* the model itself noted (name the feature; do not reach
  for a generic label).
- **Write the new fields:** `verdictLine`, `captionLine`, `punchlineText` — short,
  punchy, grounded, each *different* from the others and from the roasts.
- **Expanded BANNED** (append to existing): `Giving …`, `it's giving`, `… vibes`,
  `… energy` (as a suffix), `lore`, `certified`, `cultural reset`, `in human form`,
  `serving`, `a true …`, `<X>-coded` as filler.
- **Variety + de-dup across surfaces:** card line ≠ caption ≠ punchline ≠ summary ≠
  roast — each says something different about the same photo.
- **Icon allusion:** if `recognizedIcon` is set, you MAY use a signature
  epithet / catchphrase / known-for as a punchy line — **never the literal name**,
  and vary it across scans. (Backend also scrubs the name as defense-in-depth.)
- Keep all existing safety rules (no protected traits, entertainment framing).

## C. Assembly (`packages/shared/src/solo-scan/assemble.ts`)

- **Delete** the hardcoded `` `Giving ${icon} energy.` `` summary stamp (~L174-176).
- For each banked-backed display field — **face line**, **outfit caption**,
  **punchline** — resolve text as: `clean(written)` if it passes the filter, else the
  banked phrase from the selected entry. Sticker + band come from the selected entry
  regardless (existing `pickFaceArchetype` / `pickOutfitCaption` / `pickPunchline`
  still run to provide stickerId + fallback).
- **Name-scrub:** strip the literal `recognizedIcon` string (case-insensitive) from
  every copy field before use; if scrubbing empties a banked-backed field, fall back.
- Compose the receipt summary from the now-grounded distinct fields (no template).

## D. Content bank (`packages/shared/src/solo-scan/content-bank.ts`)

These are now **fallback-only**, but pruned per review.

**Remove (8):**
- Face: `red_flag_good_angles`, `plot_relevant`, `femme_fatale`, `delusional`
- Outfit: `clean_npc_potential`, `performative`
- Punchline: `mother_mothered`, `girlboss_trio`

**Rename (3):**
- Face `milf_hunter`: `['DEFINITELY A','MILF HUNTER']` → `['POTENTIAL','MILF HUNTER']`
- Outfit `locked_in`: `'THE FIT IS LOCKED IN'` → `'LOCKED IN'`
- Punchline `clean_npc_potential`: `'NPC WITH POTENTIAL'` → `'PROSPECTIVE NPC'`

**Add (6 mid-band, neutral outfit captions)** — refills the mid tier emptied by the
two outfit removals:
`PLAYS IT SAFE`, `DRESSED, NOT DRIPPING`, `SHOWS UP, DOESN'T SHOW OFF`,
`DECENT, NOT DANGEROUS`, `RESPECTABLE, NOT REMARKABLE`, `ROOM TO GROW`.
Each gets `band: 'mid'`, no gender tag, and a mid-tier **stickerId reused from an
existing outfit sticker** (confirm valid ids against `sticker-bank.ts` in
implementation; the id freed by removing `clean_npc_potential` is `buffering`). Add
their ids to the prompt's `outfitCaptionCandidates` allowlist so they're selectable
(for sticker assignment) as well as serving as mid-band fallback text.

> Accepted: `LOCKED IN` now appears as both the high-band face line and the outfit
> caption — fine per review (fallback-only, low collision risk).

## E. Cliché / copy filter (new: `packages/shared/src/solo-scan/copyFilter.ts`)

A small pure module, shared by assembly and unit tests:
- `isCliche(text): boolean` — case-insensitive match against the banned-pattern list
  (mirrors the prompt's BANNED list).
- `tooLong(text, max): boolean`.
- `scrubName(text, name): string` — remove the icon name (and empties → fallback).
- Helper `acceptWritten(written, max, iconName): string | null` — returns the cleaned
  written text or `null` (→ caller uses banked fallback). Roasts (no bank) use the
  same `scrubName` + a soft cliché check, but are **never regenerated** and have no
  fallback — they rely on prompt hardening.

## F. Tests

- `copyFilter.test.ts` (new): cliché detection (each banned pattern), length cap,
  name-scrub (incl. the empty-after-scrub case).
- `assemble.test.ts` (extend): written line used when valid; fallback used on
  empty/too-long/cliché/name-only; **sticker + band unaffected** in all cases; the
  `Giving X energy` stamp is gone; summary has no icon name.

## G. Rollout

1. `packages/shared` schema/constants/content-bank/filter + tests.
2. `gemini.ts` SYSTEM_INSTRUCTION + RESPONSE_SCHEMA mirror.
3. `assemble.ts` wiring.
4. **Manual edge-function deploy** (per project setup — not git/Vercel).
5. Watch output size / 502 rate after deploy (shared function with known 502 pressure).

## Risks

- **Schema mirror drift:** the Zod schema and the `gemini.ts` RESPONSE_SCHEMA are
  maintained separately; both must add the new fields or scans fail `schema_invalid`.
- **Weak written lines → fallback:** if the model often produces cliché/empty lines,
  users see fallbacks; mitigated by prompt hardening + a decent pruned bank.
- **Output size:** new fields are tiny; negligible truncation impact, but monitored.
