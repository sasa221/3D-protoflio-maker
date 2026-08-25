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

## PR-4 local Admin settings

PR-4 adds `cv_template_settings` and `career_studio_admin_audit_log` to the local
schema. They contain only template/limit metadata and settings actions; they do
not contain CV content, profile content, email, phone, or portfolio data. RLS
denies direct `anon`/`authenticated` access. The server-only Admin route accepts
only the existing allow-listed `ats-basic` template, requires the
`CAREER_STUDIO` flag, and rejects every non-loopback Supabase URL.

The update is performed by one local-only Postgres function so the setting and
its audit row commit atomically. The local Free limit is a test control, not a
published pricing decision. When the feature flag is off, the Admin tab and
settings requests are absent and the legacy product remains unchanged.

Run the PR-4 contract and authenticated local checks:

```powershell
npm run test:career-admin-contract
$status = npx --yes supabase@latest status -o env 2>$null
foreach ($line in $status) {
  if ($line -match '^ANON_KEY="(.*)"$') { $env:SUPABASE_LOCAL_ANON_KEY = $matches[1] }
  if ($line -match '^SERVICE_ROLE_KEY="(.*)"$') { $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $matches[1] }
  if ($line -match '^API_URL="(.*)"$') { $env:SUPABASE_LOCAL_URL = $matches[1] }
}
npm run test:career-admin-settings
```

The fixture creates two synthetic accounts, verifies server authorization,
direct RLS denial, the atomic allow-listed update, feature-flag hiding, and a
metadata-only audit sample. It removes the synthetic accounts and audit rows.

## PR-5 local targeted CV variants

PR-5 adds `career_targeted_variants` as a private server-side draft ledger.
It is separate from the existing public Portfolio Variants table and has no
public route or Admin endpoint. Direct browser table access is revoked; the
existing `api/portfolio.js` router performs ownership checks and the local-only
Pro entitlement check. Job descriptions are pasted text only; no Job URL fetch,
scraping, AI, Brevo, or external service is used.

The Base CV is read-only during analysis and draft creation. A draft starts with
the Base CV content, and only an explicitly confirmed summary or highlights of
skills already present in the Base CV can be applied. The Job Fit result is a
small, explainable private object containing evidence-found, keyword-without-
evidence, or missing-evidence states; the raw job description is not returned
by analysis responses or written to logs.

Run the PR-5 local checks with synthetic accounts only:

```powershell
npm run test:cv-variants
npm run test:cv-variants-api
$status = npx --yes supabase@latest status -o env 2>$null
foreach ($line in $status) {
  if ($line -match '^ANON_KEY="(.*)"$') { $env:SUPABASE_LOCAL_ANON_KEY = $matches[1] }
  if ($line -match '^SERVICE_ROLE_KEY="(.*)"$') { $env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $matches[1] }
  if ($line -match '^API_URL="(.*)"$') { $env:SUPABASE_LOCAL_URL = $matches[1] }
}
npm run test:cv-variants-local
```

The local API fixture verifies Base CV immutability, cross-account and
anonymous denial, server-side Free denial, local Pro creation, idempotent
retries, URL rejection, and owner-only deletion. It removes all synthetic
rows/accounts after completion.

## PR-6 local CV Import and Review

PR-6 adds a private, review-first importer to the CV Builder. PDF extraction
uses the existing local `pdfjs-dist` worker in the browser; DOCX extraction uses
the local `fflate` ZIP reader and reads only `word/document.xml`. Neither
parser uploads files, calls an API, invokes AI, or imports the legacy portfolio
mapper. The original file and full extracted text are held only for the active
review session, then nulled on cancel or save. Only fields explicitly selected
by the user are written through the existing owner-scoped Career Profile
service; no public import/CV route is created.

Local safety limits are 10 MB per file, 12 PDF pages, 120,000 extracted
characters, and a 6 MB DOCX document XML part. DOCX macro content (`vbaProject`,
`.bin`, or macro entries), corrupt ZIPs, unsupported extensions, empty text, and
oversized inputs are rejected. Missing sections remain missing/marked for
review; no default copy, guessed dates, skills, links, or numbers are added.

Run the deterministic local parser/security checks with synthetic data only:

```powershell
npm run test:cv-import
```

The browser smoke test (when run) should use only locally generated PDF/DOCX
fixtures and a loopback Vite server. It should verify parsing progress, the
field-by-field review, cancel-without-save, mobile/tablet layout, and no
console errors. Temporary fixtures must be removed after the run. PR-6 does
not alter production schemas, billing, Portfolio routes, or the legacy import
modal; disabling `CAREER_STUDIO` hides the new panel with the old product
unchanged.

## PR-7A local Career entry and CV checklist

When `CAREER_STUDIO` is enabled locally, Home exposes separate `Build My CV`,
`Import Existing CV`, and `Create 3D Portfolio` actions. Authenticated users go
to `/cv/new` or `/cv/new?mode=import`; unauthenticated users are sent through
Login with the encoded return path. When the flag is off, the original Studio
CTA remains the only Career entry.

The CV Builder now gives stage-specific factual guidance. Student profiles lead
with Education, Projects, Training, and Skills; Professional profiles lead with
Summary and Experience. The guidance does not create data or treat coursework
as full-time employment.

`CVQualityScoreService` provides a deterministic “CV completeness check” with a
breakdown and `Fix this` focus actions. It is not an ATS promise, hiring score,
AI feature, or network call. It does not persist new data and does not modify
the existing Portfolio Quality Score.

Local checks:

```powershell
npm run test:cv-quality
npm run test:pr7a-browser
```

## Portfolio-first Home hierarchy

The Portfolio remains the primary product. Home uses `Build My Portfolio` as
the main Hero CTA and preserves the existing `/start` onboarding path. `Build
My CV` and `Import Existing CV` are secondary independent services; neither is
required before creating a Portfolio, and the CV Builder does not require a
Portfolio. Import remains private and review-first, while `Create Portfolio
From My CV` remains an explicit Review/Diff action.
