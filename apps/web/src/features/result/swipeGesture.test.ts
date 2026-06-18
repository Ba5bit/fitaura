import { describe, it, expect } from 'vitest';
import { swipeStep, startsOnInteractiveSticker } from './swipeGesture';

describe('swipeStep', () => {
  it('returns 0 for a tap (sub-threshold move)', () => {
    expect(swipeStep(0, 0)).toBe(0);
    expect(swipeStep(8, 3)).toBe(0);
    expect(swipeStep(52, 0)).toBe(0); // exactly at threshold is not a swipe
  });

  it('steps forward (next tab) on a leftward swipe', () => {
    expect(swipeStep(-80, 10)).toBe(1);
  });

  it('steps back (prev tab) on a rightward swipe', () => {
    expect(swipeStep(80, -10)).toBe(-1);
  });

  it('ignores a mostly-vertical move (scroll, not a swipe)', () => {
    expect(swipeStep(60, 60)).toBe(0);
    expect(swipeStep(-60, 80)).toBe(0);
  });
});

describe('startsOnInteractiveSticker', () => {
  // Fake EventTarget exposing only `closest`, matching how the DOM resolves the
  // touch-start target's ancestry — keeps the test in the node env (no jsdom).
  const target = (onSticker: boolean): EventTarget =>
    ({
      closest: (sel: string) => (sel === '.st-sticker' && onSticker ? ({} as Element) : null),
    }) as unknown as EventTarget;

  it('excludes a touch that begins on the sticker (the bug: it flipped the tab)', () => {
    expect(startsOnInteractiveSticker(target(true))).toBe(true);
  });

  it('allows a touch that begins elsewhere on the card', () => {
    expect(startsOnInteractiveSticker(target(false))).toBe(false);
  });

  it('treats null / non-element targets as not on the sticker', () => {
    expect(startsOnInteractiveSticker(null)).toBe(false);
    expect(startsOnInteractiveSticker({} as EventTarget)).toBe(false);
  });
});
