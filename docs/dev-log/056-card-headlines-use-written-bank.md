# 056 — Card Headlines Use the Written Bank (not AI narration)

**Date:** 2026-06-18
**Commit:** `2315b08` (on `main`, local) · edge function redeployed

## Symptom

Live cards showed bland, literal verdicts: face line **"SELFIE GAME ALMOST THERE"**, outfit caption **"WHITE TOP, PURPLE LIGHTS"**, plus analysis like "Simple top, but the background's doing all the heavy lifting." The funny hand-written archetypes (`LET HER COOK`, `BRAT SUMMER FIT`, `IT GIRL`, …) had stopped showing.

## Root cause

Commit `c1e2f7f` (+ `308a6de`, "prompt grounding") made the AI's **written** verdict line / caption / punchline the *preferred* source, with the hand-written `content-bank.ts` as a **fallback**:

```ts
const verdictLine = lead && punch && !nameInLine ? [lead, punch] : archetype.line;
const captionText = acceptWritten(ai.outfitCopy.captionLine, 30, iconName) ?? caption.caption;
const punchline   = acceptWritten(ai.receiptContent.punchlineText, 26, iconName) ?? bankedPunchline;
```

`acceptWritten` only rejects empty / over-length / cliché-word lines. Gemini's "grounded" lines are **literal photo descriptions** — not clichés — so they passed the filter and beat the bank. A banned-word filter can't catch "WHITE TOP, PURPLE LIGHTS"; it's narration, not a cliché.

> Note: this went live as a side effect of redeploying `solo-scan` for the gender field (dev-log 055) — the redeploy bundled the current `assemble.ts` including `c1e2f7f`.

## Fix

The bank owns the three card **headlines**; the AI's free text stays only in the longer **analysis** block (works/hurts/summary), where a grounded description is appropriate. Dropped the `acceptWritten()` override at all three sites in `assemble.ts`:

```ts
const verdictLine: [string, string] = archetype.line;   // face headline
const captionText = caption.caption;                     // outfit headline
const punchline   = pickPunchline(...);                  // receipt headline
```

Removed the now-unused `acceptWritten` import (it stays exported from `copyFilter.ts` for its own tests). No prompt/schema/scoring change → **no version bump**; redeploy only.

## Decision rationale

User picked "bank-authoritative headlines" over tightening the filter, because the filter can't distinguish narration from a joke. "Funny" isn't programmatically detectable; the funny is in the bank, so the bank wins by default. The photo-grounding still adds value in the analysis prose.

## Testing

`apps/web/src/solo-scan/assemble.test.ts`: replaced the v3.4 "written copy wins" block with two tests — (1) the card headlines ignore valid AI copy and use the bank; (2) a regression test feeding the exact reported lines (`SELFIE GAME / ALMOST THERE`, `WHITE TOP, PURPLE LIGHTS`) and asserting the card does **not** use them. `npm run test --workspace @fitaura/web` → 147 pass. Typecheck clean. Edge function redeployed.

## Follow-ups

- [ ] Analysis-prose tone (the "background doing the heavy lifting" line) is AI text with no bank — separate prompt-tuning in `gemini.ts` if wanted.
- [ ] Femme card look (dev-log 055) still needs a **frontend push** to go live (backend emits `gender`; live Vercel frontend is unpushed).
