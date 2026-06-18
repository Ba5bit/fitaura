/** Horizontal swipe gesture for switching Result tabs by dragging the card.
 * Pure + DOM-light so the threshold logic and the sticker-exclusion guard are
 * unit-testable without a browser. */

/** Min horizontal travel (px) before a drag counts as a tab swipe. */
const SWIPE_MIN = 52;
/** How much horizontal must dominate vertical (so scrolls aren't read as swipes). */
const SWIPE_RATIO = 1.4;

/** Tab step implied by a touch delta: +1 next, -1 prev, 0 = not a swipe. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) {
    return dx < 0 ? 1 : -1;
  }
  return 0;
}

/**
 * True when a gesture beginning on this target must NOT arm a card swipe.
 *
 * The sticker is draggable via its own pointer events, but on a touchscreen the
 * same finger also emits touch events that bubble up to the swipe frame. Without
 * this guard a horizontal drag on the sticker is double-counted as a card swipe
 * and flips the tab (e.g. face → receipt). We detect a touch that starts on the
 * sticker (or a child pip) and skip arming the swipe.
 */
export function startsOnInteractiveSticker(target: EventTarget | null): boolean {
  const el = target as { closest?: (selectors: string) => Element | null } | null;
  return typeof el?.closest === 'function' && el.closest('.st-sticker') != null;
}
