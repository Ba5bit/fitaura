# 027 — Remove "Looks good"; crop applies live

## Why

The per-zone **"Looks good"** confirm button was poor UX — an extra click that
only collapsed the crop into a "saved framing" view. The photo was already
registered on upload, so the button wasn't a real gate.

The user's suggestion (correct): apply drag/zoom tweaks automatically, no button.

## Change (`UploadZone.tsx`)

- Removed the **"Looks good"** button, the `confirmCrop`/`adjustCrop` functions,
  the `editing` state, the `savedView` ref, and the collapsed "Saved framing"
  branch. The crop UI (preview + zoom + Reset/Replace/Remove) is now always shown
  and always editable.
- **Live re-bake:** a debounced effect re-bakes the committed image whenever the
  framing settles:
  ```ts
  useEffect(() => {
    if (status !== 'ready' || !imgElRef.current) return;
    const im = imgElRef.current;
    const id = setTimeout(() => bakeAndConfirm(im, view), 200);
    return () => clearTimeout(id);
  }, [view, status]);
  ```
  200ms debounce → a drag/pinch/zoom bakes once on release, not every frame.
  `bakeCrop` returns a `toDataURL` string (no object-URL leak from repeated bakes).
- `onPointerDown` guard simplified (`status !== 'ready'`; the `editing` flag is
  gone). Photo still registers immediately on upload at its default crop, so the
  scan unlocks as soon as both photos are in.
- Crop note updated: "… Your framing applies automatically."

## Files

- `apps/web/src/features/upload/UploadZone.tsx`

## Verification

- `tsc --noEmit` on `@fitaura/web` passes.
- Dev server, `/scan` with both samples: no "Looks good" button; crop stays
  editable with Reset/Replace/Remove.
- **Live bake proven:** drove the face zoom slider to 1.6 (no button press); the
  stored committed image (`fitaura.state` → `face.url`) changed
  (14887 → 10527 chars, different tail) after the debounce — the tweak applied
  automatically. Drag uses the same `setView` → effect path.
