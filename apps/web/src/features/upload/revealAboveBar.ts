/**
 * Scroll just enough to lift an action-button row (`el`) above the upload page's
 * fixed action bar (`.ua-foot`), so the buttons are reachable while the image/
 * camera preview above them stays as visible as possible. Deliberately a *minimal*
 * nudge (not `scrollIntoView({ block: 'center' })`, which over-scrolls and pushes
 * the preview off-screen). No-op when the buttons already clear the bar.
 *
 * Shared by UploadZone (crop Reset/Replace/Remove) and WebcamCapture (Capture/
 * Cancel); both upload pages — Solo and FvF — use the same `.ua-foot` bar.
 */
export function revealAboveBar(el: HTMLElement | null): void {
  if (!el) return;
  const bar = document.querySelector('.ua-foot');
  const barH = bar ? bar.getBoundingClientRect().height : 190;
  const safeLine = window.innerHeight - barH - 20; // a little breathing room above the bar
  const delta = el.getBoundingClientRect().bottom - safeLine;
  if (delta > 4) window.scrollBy({ top: delta, behavior: 'smooth' });
}
