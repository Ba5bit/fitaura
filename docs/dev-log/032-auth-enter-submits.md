# 032 — Auth modal: Enter submits sign-up / log-in

## Bug

In the auth modal, pressing **Enter** after typing email/password did nothing —
you had to click the button. The fields were standalone `WebField` inputs with a
click-only submit button and no surrounding `<form>`, so there was no
Enter-to-submit behaviour.

## Fix (`AccountModals.tsx`, `AuthGate`)

- Wrapped Email + Password + the submit button in a real `<form>` whose
  `onSubmit` `preventDefault()`s and calls the existing `submit()`. Browsers fire
  submit on Enter from any field in the form.
- Submit button changed to `type="submit"` (was click-only).
- The Sign up / Log in tab buttons are now `type="button"` so Enter can't
  accidentally trigger them (buttons default to `type="submit"` inside a form).
- `form { display: contents }` so the wrapper adds no box — layout/spacing is
  identical to the previous flat stack.

## Files

- `apps/web/src/features/account/AccountModals.tsx`
