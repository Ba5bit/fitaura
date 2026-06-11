# 011 — Logo as home navigation on the Result page

## Problem

The Result page had no obvious way back to the landing page. The FITAURA
wordmark in the top-left should act as the home control, as it conventionally
does.

## Change

The top-left brand (`.rs-brand`, in `Result.tsx`) was a non-interactive `<div>`
(dot + "FITAURA" wordmark). Converted it to a `<button>` that navigates to `/`
(the Landing route — confirmed in `App.tsx:20`). `useNavigate` was already in
the component (used for `/account`, `/credits`).

Used a real `<button>` (not an `onClick` on the div) so it's keyboard-focusable
and screen-reader-announced; added `aria-label`/`title` for "back to home".

`result-shell.css` resets the button's native chrome so it still looks like the
wordmark, plus a hover background + brightened wordmark and a `:focus-visible`
ring for affordance. Negative `margin-left` keeps the optical left edge aligned
despite the added padding.

## Files

- `apps/web/src/features/result/Result.tsx` — brand `<div>` → `<button>` with
  `onClick={() => navigate('/')}`.
- `apps/web/src/design/result-shell.css` — `button.rs-brand` reset + hover/focus
  states.

## Verification

- Landing route `/` confirmed in `App.tsx`.
- Manual: on the Result page, click the FITAURA logo → lands on the landing
  page; Tab to it + Enter works; hover/focus affordances show.
- NOTE: `tsc --noEmit` could not be run this pass — the harness command
  classifier was temporarily unavailable. Change is a `div`→`button` swap using
  an existing `navigate`, so it is type-safe; re-run `tsc` when the tool is back.
