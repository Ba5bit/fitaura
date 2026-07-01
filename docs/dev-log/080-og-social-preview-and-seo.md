# 080 — Social preview (OG/Twitter cards) + baseline SEO

**Date:** 2026-07-02
**Branch:** `main` (pushed/deployed)
**Area:** `apps/web/index.html`, `apps/web/public/{og.png,robots.txt,sitemap.xml}`

## Why

Pasting `https://fitaura.studio/` on X (and Discord/iMessage/etc.) produced a bare
link with **no preview card**. Root cause: the static `index.html` shipped only
`<title>` + `<meta name="description">` — none of the Open Graph / Twitter Card tags
a crawler reads. And because the app is a **client-rendered Vite SPA**, tags injected
at runtime would never be seen: social crawlers don't run JS, they read the raw HTML.
So the fix has to live in the static `index.html`.

## What landed

**`index.html` `<head>`** — all static, so the crawler sees them without executing JS:
- **Open Graph:** `og:type/site_name/locale/url/title/description/image` (+ `image:type`,
  `image:width=1200`, `image:height=630`, `image:alt`).
- **Twitter:** `twitter:card=summary_large_image` (the tag X needs for the big image),
  `twitter:title/description/image/image:alt`.
- **SEO baseline:** descriptive `<title>`, `canonical` → `https://fitaura.studio/`,
  `robots` (`index, follow, max-image-preview:large`), `keywords`, `theme-color=#06070a`
  (the true `--bg-0` page background), and **JSON-LD** `WebApplication` structured data.

**`public/` (Vite copies these to site root):**
- `og.png` — the landing hero, exactly **1200×630** (matches the declared dimensions).
- `robots.txt` — allow all + `Sitemap:` pointer.
- `sitemap.xml` — homepage entry.

## Copy discipline (per owner feedback)

The card/search copy is deliberately **grounded in real on-site language** and avoids
anything that reads like generic SaaS or commits us to a policy that may change:
- **No "AI"** words (brand voice is "Every Aura Has a Verdict", not "AI-powered").
- **No pricing promises** — dropped "First verdict free" (was misleading in the Google
  snippet) and removed the JSON-LD `offers`/"10 free credits" block entirely.
- **No feature that may change** — dropped "glow-up"; instead points at durable modes
  ("Solo · Friend vs Friend · more modes", mirroring the site's "Explore the modes").

Final description (search + OG + Twitter):
> Scan yourself or a friend. Get a Face Card, Outfit Check and Dating Receipt built to post, then explore Friend vs Friend and more modes.

Card title: `FitAura — Every Aura Has a Verdict`. Search title:
`FitAura — Face Card, Outfit Check & Dating Receipt`.

## After deploy

X caches previews hard and killed the public Card Validator — force a refresh by
pasting the URL into a **draft/compose tweet**. Verify tags are live with
`curl -s https://fitaura.studio/ | grep -i "twitter:card\|og:image"`.
