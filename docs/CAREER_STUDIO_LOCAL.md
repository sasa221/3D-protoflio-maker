# Career Studio local development

Career Studio is intentionally disabled unless `VITE_FF_CAREER_STUDIO=true` is set in a local/development environment.

## Safe setup

1. Do not use `.env` or `.env.local` from the production project for Career Studio. The repository may contain old untracked environment files; they are not a valid development configuration.
2. Copy `.env.development.example` to `.env.development.local`.
3. Use Supabase Local (`http://127.0.0.1:54321`) or a separate Development Supabase project. Use only its publishable/anon key.
4. Never add `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Brevo keys, payment keys, Vercel tokens, or webhook secrets to the browser environment.
5. Apply `supabase_phase9_career_profiles.sql` only to the local/Development database. Production execution is prohibited until release approval.
6. Run `npm run test:career-local`, `npm run check`, and the browser smoke tests against the local app.

Runtime safety rejects known Production Supabase/Vercel hosts and server-only browser credentials. The app falls back to a loopback Supabase URL when no local configuration exists; it never falls back to the Production project.

## Current environment limitation

The Supabase CLI is not installed in this workspace, so the migration has been prepared but not applied. Install/configure Supabase Local or provide a separate Development project before running it. No Production database has been contacted or changed.

