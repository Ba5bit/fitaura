# Fitaura

> Upload your face and outfit. Get your full verdict.

Fitaura turns a face photo and an outfit photo into a three-part, shareable social
verdict: a **Face Card**, an **Outfit Check**, and a **Dating Score Receipt**.

This repository is built from the imported Claude Design phase. The imported design
files (`/uploaded`) are the **visual source of truth**; `aura_project_context_rebuilt_cards_v2.md`
is the **product / behavior source of truth**.

## Structure

```
fitaura/
  apps/
    web/              Vite + React + TypeScript frontend (this pass)
    api/              NestJS backend (planned)
  packages/
    shared/           Shared TypeScript types (result model, verdicts)
  uploaded/           Original imported design prototypes (reference only)
```

## Tech

- **Frontend:** Vite + React + TypeScript
- **Backend (planned):** NestJS + TypeScript
- **Auth + DB (planned):** Supabase Auth + Supabase Postgres

## Develop

```bash
npm install
npm run dev          # starts apps/web on http://localhost:5173
npm run typecheck
npm run build
```

## Product flow

Landing → Upload (face + outfit, crop) → Scanner → Result (Face / Outfit / Receipt
tabs, each with a shareable card + in-app analysis block).

The first complete solo generation is free; subsequent generations consume one credit
and return the entire three-part package. Source photos are never permanently stored on
the server — finished cards and history live on the user's device.

> Fitaura is a playful, subjective entertainment product. Scores and verdicts are not a
> measure of real attractiveness, health, or worth.
