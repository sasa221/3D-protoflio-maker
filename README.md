# 3D Portfolio Maker — Build a Cinematic 3D Portfolio

Turn your CV into a recruiter-ready interactive 3D portfolio — no coding required.

Live app: **https://portfolio-maker-murex.vercel.app**

## What it does

- Import your CV (PDF/resume) and auto-fill your portfolio data
- Create a cinematic 3D portfolio view with customizable themes and colors
- Manage multiple portfolio variants tailored to specific job targets
- Publish and share via a unique URL — embedded analytics track visitor engagement
- Pro/Premium tiers with advanced themes, custom domains, and quality scoring
- Built-in admin panel, billing, group invitations, and production readiness checks

## Stack

- **Frontend:** Vanilla JavaScript + Vite, custom 3D renderer (HyperEngine, Three.js-based), GSAP animations
- **Backend:** Supabase (Auth, Database, Storage, Realtime, Edge Functions)
- **PDF:** pdfjs-dist for CV parsing
- **QR:** qrcode for shareable portfolio codes
- **Sentry:** Error tracking (`@sentry/browser`)
- **Confetti:** canvas-confetti for share moments

## Project Structure

```
src/
  AuthPage.js          — auth (login, signup, reset password)
  AdminPage.js         — admin dashboard
  main.js              — app entry, state, directors
  three/               — 3D engine, procedural themes, scene/scroll/intro directors
  renderer/            — portfolio HTML/CSS renderer, project cinema, mobile nav
  services/            — Supabase client, auth, DB, asset storage, CV mapper, analytics
  ui/                   — CV import modal, job target panel, variant manager, analytics, billing, group management
  exporter/            — standalone HTML export + shareable URL generation
  backend/             — server-side helpers
  counter.js           — visitor counter
  demo/                — demo portfolio presets
  tests/                — core tests
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. You'll need a Supabase project with the schema from `supabase_schema.sql` applied. Set your Supabase URL and anon key in `.env` (Vite env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Supabase Schema

The full schema is in `supabase_schema.sql`. Migrations are in `supabase_phase8a_migration.sql` and `supabase_phase8b_migration.sql`. Apply them in order from the Supabase SQL Editor.

## License

MIT
