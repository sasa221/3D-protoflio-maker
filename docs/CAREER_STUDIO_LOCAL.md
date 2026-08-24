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

## Supabase Local verification

The local Supabase CLI is run with `npx supabase@latest` and Docker Desktop. No Cloud project is linked.

```powershell
npx --yes supabase@latest start
npx --yes supabase@latest db reset --local
```

The migration is tracked at `supabase/migrations/20260825021000_career_profiles.sql`. The approved root migration can also be replayed against the local Postgres container only:

```powershell
Get-Content -Raw supabase_phase9_career_profiles.sql | docker exec -i supabase_db_protofolio_maker psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Run the real authenticated RLS fixture with local keys held only in the current process:

```powershell
$status = npx --yes supabase@latest status -o env 2>$null
foreach ($line in $status) {
  if ($line -match '^ANON_KEY="(.*)"$') { $env:SUPABASE_LOCAL_ANON_KEY = $matches[1] }
  if ($line -match '^SERVICE_ROLE_KEY="(.*)"$') { $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $matches[1] }
  if ($line -match '^API_URL="(.*)"$') { $env:SUPABASE_LOCAL_URL = $matches[1] }
}
node scripts/test_local_career_rls.mjs
```

The fixture creates synthetic users only, verifies owner CRUD, cross-account denial, anonymous denial, CV isolation, then deletes the fixtures. Passing a Production URL fails before any network request. No Production database has been contacted or changed.
