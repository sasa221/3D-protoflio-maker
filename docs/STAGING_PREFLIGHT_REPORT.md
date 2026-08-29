# Staging Preflight & Dry-Run Report

Date: 2026-08-29  
Scope: local read-only preparation for a future Closed Beta staging deployment.

## Result

Preflight passed locally. No staging URL or credentials were available, so no external connection, backup, restore, migration, deploy, payment, or email was attempted.

## Required staging variables (names only)

| Area | Variables |
| --- | --- |
| Supabase | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `FF_CAREER_STUDIO` |
| Auth | `AUTH_REDIRECT_URL` |
| CORS | `CORS_ORIGINS` |
| Brevo test-only | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` |
| Payments | `VITE_ENABLE_BILLING_PORTAL`, sandbox provider variables only; or leave payments disabled |
| Monitoring | `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |

Values must be entered in the staging provider, never committed. The sender, redirects, webhook endpoints, and CORS origins must point to staging. Production payment credentials and real recipient lists are prohibited.

## Checks completed

- Local safety bundle (`npm run build:local`) contains no concrete Supabase cloud URL or server-secret value. A staging build must be rebuilt with the Staging URL before deployment; the local `.env` is never a source for Staging.
- No wildcard CORS configuration remains; the API uses an exact-origin allowlist and permits loopback only outside production.
- Health responses expose status and `degradedReasons` without credentials.
- All migrations were reviewed for destructive statements. The email-campaign migration remains untracked and excluded from this package.
- The local preflight script completed successfully: `npm run test:staging-preflight`.

## Migration and rollback dry-run

1. On Staging, record the current migration version and create a provider backup or logical dump outside the repository.
2. Restore/duplicate only into an isolated database; verify row counts, RLS, RPCs, triggers, and Storage checksums.
3. Apply the ordered migrations in `supabase/migrations/` to Staging only, leaving the Career Studio rollout switch disabled.
4. Run the smoke checklist in `docs/CLOSED_BETA_STAGING_RUNBOOK.md`.
5. Roll back by disabling the feature/rollout switch, reverting to the previous immutable build, and restoring the isolated verified backup if required. Never restore over Production.

## Decision

**Staging deployment: NO-GO until an explicit Staging URL/project, backup capability, and environment verification are supplied.** The code and local dry-run are ready for that controlled staging step.

Required approval before execution: explicit authorization to use the named Staging project and, separately, explicit authorization to deploy to Staging. Production remains out of scope.
