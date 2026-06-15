# 040 — Vercel SPA fallback (fix reload 404 on client routes)

## Problem

Navigating in-app to `/vault` (or `/scan`, `/result`, `/credits`, …) worked, but
**reloading** that URL showed Vercel's 404. The app is a client-side-routed SPA
(React Router), so on a hard reload Vercel looks for a real `/vault` file in the
build output, finds none, and 404s.

## Fix

Added a `vercel.json` SPA rewrite so any path that isn't a real static file
falls back to `index.html`, letting React Router take over:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Vercel checks the filesystem first, so hashed assets (`/assets/*`, the example
jpgs) are still served directly; only unmatched routes hit the fallback.

Placed in **both** the repo root and `apps/web/` because the rewrite must live
in whichever directory is set as the Vercel project's *Root Directory*, and that
setting isn't visible from the codebase. Vercel reads only the one in its root
dir; the other is ignored (harmless).

## Files

- `vercel.json` (repo root)
- `apps/web/vercel.json`
