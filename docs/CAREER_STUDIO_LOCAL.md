# Career Studio local development

Career Studio is intentionally disabled unless `VITE_FF_CAREER_STUDIO=true` is set in a local/development environment.

## Safe setup

1. Do not use `.env` or `.env.local` from the production project for Career Studio. The repository may contain old untracked environment files; they are not a valid development configuration.
2. Copy `.env.development.example` to `.env.development.local`.
3. Use Supabase Local (`http://127.0.0.1:54321`) or a separate Development Supabase project. Use only its publishable/anon key.
4. Never add `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Brevo keys, payment keys, Vercel tokens, or webhook secrets to the browser environment.
5. Apply `supabase_phase9_career_profiles.sql` and `supabase_phase9b_cv_exports.sql` only to the local/Development database. Production execution is prohibited until release approval.
6. Run `npm run test:career-local`, `npm run test:cv-export`, `npm run check`, and the browser smoke tests against the local app.

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

PR-2 adds `supabase/migrations/20260825021500_cv_export_events.sql` (and the matching
`supabase_phase9b_cv_exports.sql` review copy). A clean local reset applies both
migrations and is safe to repeat:

```powershell
npx --yes supabase@latest db reset --local --yes
```

PDF export is generated in the browser with `pdf-lib`; it is A4, single-column,
text-based, private, and never uploaded. The server-side `cv-export` action in
the existing `api/portfolio.js` checks ownership, local entitlement, monthly
quota, and an idempotency key before recording an event. `CV_FREE_EXPORT_LIMIT`
is deliberately configurable; the local acceptance fixture sets it to `1` and
uses `CV_LOCAL_PLAN_OVERRIDE=pro` to test the unlimited path. These are test
overrides, not pricing changes.

Run the authenticated local export fixture (synthetic users only):

```powershell
$status = npx --yes supabase@latest status -o env 2>$null
foreach ($line in $status) {
  if ($line -match '^ANON_KEY="(.*)"$') { $env:SUPABASE_LOCAL_ANON_KEY = $matches[1] }
  if ($line -match '^SERVICE_ROLE_KEY="(.*)"$') { $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $matches[1] }
  if ($line -match '^API_URL="(.*)"$') { $env:SUPABASE_LOCAL_URL = $matches[1] }
}
node scripts/test_local_cv_export.mjs
```

The sync API fixture (`npm run test:cv-sync-local`) creates a synthetic local
`portfolios` table only when the local stack does not include the legacy schema,
tests source/target ownership and non-overwrite behavior, then removes the
fixture table and all synthetic users. It never contacts Production.

Synthetic visual samples can be regenerated outside the repository:

```powershell
node scripts/generate_local_cv_samples.mjs
```

PR-3 CV-to-Portfolio transfer is opt-in. Saving a CV never syncs anything.
The `Create Portfolio From My CV` link opens a review dialog where all fields
start unchecked; contact details and location require a separate confirmation,
existing scalar values stay in place unless replacement is explicitly enabled,
and list fields (including projects and experience) are merged without deletion.
The target Portfolio is checked against the signed-in owner by Supabase RLS;
there is no public CV route and no automatic publish.

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
