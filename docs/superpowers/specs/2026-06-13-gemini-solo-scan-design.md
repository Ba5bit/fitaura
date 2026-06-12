# Cycle 3 — Gemini 2.5 Flash Solo Scan (real AI generation)

**Date:** 2026-06-13
**Status:** Approved design, ready for implementation plan
**Scope:** Replace the mock generation path with a real Gemini 2.5 Flash analysis of
the user's face + outfit photos, behind a Supabase Edge Function. This is Deferred
Cycle #3 from the backend integration plan ("Server-side AI generation — Edge
Function replacing `apps/web/src/data/mockGenerations.ts`").

Backreferences: rules doc `~/Downloads/fitaura_gemini_2_5_flash_solo_scan.md`
(the Solo Scan AI specification — section numbers below cite it as §N);
`docs/superpowers/specs/2026-06-12-supabase-auth-credits-design.md` (Cycle 1, the
service seam + credits this builds on); `packages/shared/src/result.ts` (the
`FullGenerationResult` render contract).

---

## 1. Goal & non-goals

**Goal.** When a user scans, send their (locally cropped) face + outfit photos to a
Supabase Edge Function that calls Gemini 2.5 Flash, gets back a strict rubric, runs
deterministic scoring, and returns a fully-assembled `FullGenerationResult` the
existing Result page renders unchanged. The API key never reaches the browser. A
failed scan never costs a credit.

**Central rule (rules doc §5, §30):**
> Gemini observes and classifies. The backend (Edge Function) decides and
> calculates. The frontend presents and exports.

**Backend shape:** Supabase-direct. The rules doc is written against a NestJS
backend; this codebase dropped NestJS for Supabase Edge Functions (Deno). Every
"NestJS backend" responsibility in the doc maps to the `solo-scan` Edge Function,
except where Deno runtime differs (see §3).

**Non-goals (deferred, noted where relevant):**
- **`scan_jobs` table + durable observability** — this pass logs token/cost/latency
  to the function's stdout only (Supabase Edge logs). The durable table + analytics
  dashboards (rules doc §24–§25) come with Cycle #1 credit hardening, which needs
  the same ledger.
- **Credit reserve/consume/release RPC** (rules doc §23) — Cycle #1 work. This pass
  refunds via the existing `creditsService` (grant +1 on failure). Design is
  forward-compatible with the RPC.
- **Questionnaire input** (rules doc §6 optional context) — the app collects none
  today; the schema carries an optional slot but the client sends none this pass.
- **Server-side `sharp` preprocessing / Files API** (rules doc §7) — replaced by
  the existing client-side canvas crop (see §3).
- **Evaluation dataset of 100–200 examples** (rules doc §27), job queue (§26),
  age/safety gating beyond the prompt's prohibited-inference list.
- **Friend-vs-Friend / Glow-Up modes** — Solo Scan only.

---

## 2. Data flow

```
React (Scan)
  └─ soloScanService.runSoloScan(faceDataUrl, outfitDataUrl)
       └─ POST Edge Function `solo-scan`  { faceB64, outfitB64, schemaVersion, promptVersion }
            ├─ Gemini 2.5 Flash  → solo_scan_v1 rubric JSON  (GEMINI_API_KEY secret)
            ├─ Zod validate (syntactic guarantee + semantic checks, §21)
            ├─ input-quality gate (§8) → on fail, return RETAKE (no scoring)
            ├─ deterministic scoring + verdict (§17–§18)
            ├─ content-bank selection from allowlist (§12)
            └─ assemble FullGenerationResult (imageUrl = null)
       └─ client re-attaches local data-URL images to face/outfit cards
  └─ render existing Result page (unchanged)
```

The photos transit the function and are discarded — never persisted server-side
(privacy rule: "never permanently stored on our servers"). Card `imageUrl`s remain
local data URLs, exactly as `runGeneration` sets them today.

---

## 3. Two Deno-runtime adaptations of the rules doc

**(a) Image preprocessing moves client-side (rules doc §7).** `sharp` does not run
in Deno Edge Functions. The app already crops and bakes each photo to a data URL via
canvas before scanning — canvas re-encode normalizes orientation and drops EXIF for
free. The client downscales the long edge to ~1024px during that bake and sends
base64. The Edge Function validates MIME/size and forwards inline to Gemini (inline
is within limits for two ~1024px JPEGs; no Files API). The function never logs image
bytes (rules doc §25).

**(b) No `sharp`, no separate decode step.** MIME/size/decoded-validity checks the
doc assigns to the backend are split: the client guarantees JPEG/PNG/WebP from the
canvas export; the function rejects anything else and enforces a max base64 size.

---

## 4. The AI contract — Gemini owns (rules doc §9–§16, §19–§20)

Gemini returns **only** the `solo_scan_v1` object (`SoloScanAIOutput`, rules doc
§15/§16):

- `inputQuality` — usability gate (`usable`, `faceUsable`, `outfitUsable`,
  `samePersonLikely`, `issues[]`, `retakeInstruction`).
- `faceAnalysis` — 7 rubric categories (`photoPresentation`, `faceHarmony`,
  `jawPresence`, `haircutMatch`, `groomingCoherence`, `visualPresence`,
  `mainCharacterEnergy`), each `{ rating: 1–5|null, confidence: 0–1, evidence }`.
- `outfitAnalysis` — 9 rubric categories (`fit`, `silhouette`, `proportions`,
  `colorCoherence`, `physiqueMatch`, `layering`, `accessories`, `stylingIntent`,
  `overallCohesion`), same shape.
- `faceCopy` (`strongestPoint`/`improvement`/`summary`) and `outfitCopy`
  (`works`/`hurts`/`verdict`) — one sentence each, constraints per §11.
- `contentSelection` and `receiptContent` — **candidate IDs only** (archetype,
  caption, sticker, content tags, metric, punchline), ranked.

**Gemini config (rules doc §20):** model from `GEMINI_SOLO_SCAN_MODEL`
(default `gemini-2.5-flash`), `temperature 0.2`, `maxOutputTokens 2500`,
`thinkingBudget 0`, `responseMimeType: application/json`, `responseSchema` from the
Zod schema, no search grounding. System instruction per §19 (visible-evidence-only,
prohibited inferences §14, 1–5 rubric, IDs from allowlist, do NOT compute final
scores/verdict).

Gemini must **never** infer the prohibited list in §14 (identity, ethnicity, health,
real character, romantic compatibility, etc.).

---

## 5. Deterministic scoring & assembly — backend owns (rules doc §17–§18)

A pure module maps rubric → `FullGenerationResult`:

- **rating→score** base map `1→35, 2→50, 3→65, 4→80, 5→92` (§17). `null` is dropped
  from its weighted average and the remaining weights redistribute proportionally;
  if too many key categories are `null`, the scan is rejected (treated as a retake).
- **Face Score / Outfit Score** = weighted averages using the §17 starting weights.
- **Aura Index** = `Face×0.45 + Outfit×0.45 + normalizedVisualPresence×0.10` (§17).
- **Deterministic seeded jitter** of ±3 on each displayed score, keyed on
  `scanId + categoryKey + promptVersion` (§17), so a saved result renders identical
  numbers every time (no fresh `Math.random` per render — the bug class called out
  in `fitaura-architecture.md`).
- **Dating verdict** (§18): computed from an Aura+Outfit composite plus seeded
  entertainment logic, thresholded to exactly one of `green_flag | normie | red_flag`.
  Assigned by code, never by Gemini. Drives `--verdict` theming as today.
- **Receipt** (§13): `datingScore` (0–10), `auraValue`, humorous `rows` (from
  selected metric candidates), `finalPunchline` (from punchline candidate), `summary`
  (templated from `faceCopy.summary` + `outfitCopy.verdict`).

### Rubric → render-model mapping (real rubric, relabeled)

The rubric categories don't 1:1 match the mock's labels, so the displayed
stats are **re-derived from the real rubric** (the card *layouts* are unchanged):

| `FullGenerationResult` field | Source rubric category |
|---|---|
| `face.card.scores`: Aura / Jaw Presence / Face Harmony / Main Character | Face Score / `jawPresence` / `faceHarmony` / `mainCharacterEnergy` |
| `face.card.index` "AURA INDEX n" | Aura Index |
| `face.analysis.breakdown` (6) | `jawPresence`, `faceHarmony`, `visualPresence`, `haircutMatch`, `groomingCoherence`, `mainCharacterEnergy` (icons: jaw, harmony, eye, brow, beard, star) |
| `face.analysis.aura` / `.explanation` / `.roast` | Aura Index / `faceCopy.summary` / `faceCopy.improvement` (or `strongestPoint`) |
| `outfit.card.scores`: Silhouette / Proportions / Fit / Physique Match | `silhouette` / `proportions` / `fit` / `physiqueMatch` |
| `outfit.card.overallScore` | Outfit Score |
| `outfit.analysis` works/hurts/verdict | `outfitCopy.works`/`.hurts`/`.verdict` |
| `outfit.analysis.supporting` (3–4) | `colorCoherence`, `layering`, `stylingIntent`, `overallCohesion` — `not_assessable` (`null`) categories are skipped |

---

## 6. Content bank / allowlist (rules doc §12)

The rules doc uses placeholder IDs (`sticker.hear_me_out`,
`outfit_caption.let_him_cook`…). This pass maps them onto the **real**
`STICKER_BANK` (`hear-me-out`, `plot-relevant`, `aura-farmer`, `chad`,
`main-character`; `fit-has-lore`, `let-him-cook`, `never-cook-again`, `buffering`,
`performative`) plus three new banks:

- **face archetype → { face-card two-part verdict line, face sticker id }**
- **outfit caption → { outfit-card caption, outfit sticker id }**
- **punchline → finalPunchline string**, grouped per verdict.

The function **validates every candidate ID against the allowlist**, picks the first
valid candidate, and **falls back to a safe per-verdict default** when the candidate
is missing/invalid (§12). Stickers are always bound from `STICKER_BANK` via
`stickerFromPreset` (the curated bank stays the source of truth — Gemini can only
*select*, never invent, a sticker).

---

## 7. Where the code lives

Pure, runtime-agnostic TypeScript (depends only on `zod`, which runs in Node **and**
Deno via `npm:zod`) goes in a new shared module:

```
packages/shared/src/solo-scan/
  schema.ts        # Zod solo_scan_v1 schema + inferred SoloScanAIOutput type
  scoring.ts       # rating→score, weights, Aura Index, seeded jitter, verdict
  content-bank.ts  # allowlists + per-verdict defaults + ID validation
  assemble.ts      # rubric (+ scanId) → FullGenerationResult
  index.ts
```

The Edge Function imports these via relative path; the React app imports them too if
needed. **Vitest unit-tests the pure logic** (single source of truth, no
cross-runtime duplication). Only the thin I/O shell is Deno-specific:

```
supabase/functions/solo-scan/
  index.ts         # Deno serve(): parse req, call Gemini, retry, validate, assemble, respond
  gemini.ts        # Gemini client + system instruction + config (rules doc §19–§20)
  deno.json        # import map (npm:zod, npm:@google/genai)
```

---

## 8. Frontend seam & failure UX (rules doc §8, §22–§23)

`runGeneration` becomes **async**. Today (`Scan.tsx`) the ~9s animation runs, then
`doReveal()` spends a credit and calls the synchronous `runGeneration()`.

New flow:
1. **Scan start** — when the user enters `/scan/run` *and* `canScan` is already true
   (signed-in with credits, or a guest's free scan), kick off the Gemini call in
   parallel with the animation. Latency (~2–4s at `thinkingBudget 0`) usually hides
   under the ~9s animation. A guest who must sign in first starts the call right
   after auth resolves.
2. **Reveal** — `spendForScan()` (as today), then `await` the in-flight result:
   - **Success** → store result + history, navigate `/result#face`.
   - **Quality-gate retake** (`inputQuality.usable === false`, §8) → **refund the
     credit**, return to `/scan`, surface `retakeInstruction`, and preserve the
     *usable* image so the user replaces only the failed one (per-image).
   - **Technical error** (retry exhausted, schema-invalid, network) → **refund the
     credit**, show "scan failed — try again."
3. **Never charged for a failed scan.** Refund = `creditsService` grant +1 this pass
   (Cycle #1 replaces this with the reserve/release RPC).

`MOCK_GENERATIONS` is **retained only** for the Landing page's static example cards
(`example-face.jpg` / `example-fit.jpg`); the scan/generation path is AI-only with
no mock fallback (full replacement).

One automatic retry (rules doc §22) for transient 429/5xx/timeout/transient-invalid
only — never for policy rejection, unusable image, or auth failure.

---

## 9. Config & secrets

- Edge Function secrets: `GEMINI_API_KEY` (server-side key, billing-enabled
  project), `GEMINI_SOLO_SCAN_MODEL` (default `gemini-2.5-flash`).
- Client env: the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are enough
  to invoke the function via `supabase.functions.invoke('solo-scan', …)`.
- Constants: `SCHEMA_VERSION = 'solo_scan_v1'`, a `PROMPT_VERSION` string (bumped
  when the system instruction changes; feeds the seeded jitter + future logging).

---

## 10. Observability (this pass: console only)

After each call the function logs to stdout (rules doc §25, minus a DB table):
`scan_id, model, prompt_version, schema_version, input/output/total tokens,
latency_ms, retry_count, success|failure, failure_code, estimated_cost` (computed
from `usageMetadata` and the §3 pricing constants). **Never logs** raw images,
base64, API keys, or auth headers. Read via Supabase Edge logs. The durable
`scan_jobs` table + dashboards land with Cycle #1.

---

## 11. Testing (rules doc §28 acceptance, scoped to MVP)

**Vitest (pure logic, `packages/shared`):**
- rating→score map; `null` drop + weight redistribution; reject when too many nulls.
- Face/Outfit Score + Aura Index against hand-computed fixtures.
- seeded jitter is deterministic for a fixed `scanId` and varies across scanIds.
- verdict thresholds produce each of green/normie/red.
- content-bank: valid candidate chosen; invalid candidate → per-verdict default;
  sticker always from `STICKER_BANK`.
- `assemble`: full rubric fixture → a valid `FullGenerationResult` (every field the
  Result page reads is present and in range).
- Zod schema: accepts the §15 example; rejects out-of-range rating, confidence > 1,
  missing `retakeInstruction` when `usable:false`, bad schema version.

**Manual / live (a few, rules doc §28):** valid pair → result; cropped/missing
image → retake; forced Gemini error → credit refunded; repeated scan of the same
photos stays acceptably consistent; production build (`tsc + vite`) clean; mobile
upload flow.

---

## 12. Acceptance criteria (rules doc §28, MVP subset)

1. Both images process; result renders all five Solo Scan components from the
   function output.
2. Unusable photo → retake response, no credit consumed, failed image replaceable.
3. Response always conforms to `solo_scan_v1`; ratings bounded `1–5|null`; each has
   confidence + evidence.
4. Final scores + Aura Index + dating verdict are computed by code, not Gemini.
5. Captions/stickers come from the allowlist; invalid IDs fall back to defaults.
6. No API key in the browser bundle.
7. Technical failure refunds the credit; no charge for a failed scan.
8. Raw photos are never persisted server-side; card images stay local.
9. Token usage + estimated cost are logged (console).
10. The same photos produce acceptably consistent output (seeded determinism).
