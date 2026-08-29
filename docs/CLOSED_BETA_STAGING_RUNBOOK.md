# Closed Beta — Staging Runbook

This runbook is for a separate staging deployment only. It does not authorize a production deploy, database migration, backup, or email campaign.

## Environment checklist

Configure values in the staging provider, never in Git:

- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `FF_CAREER_STUDIO`.
- Email (optional for staging): `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `AUTH_REDIRECT_URL` (staging URL).
- Manual payments: `INSTAPAY_NUMBER`, `INSTAPAY_ACCOUNT_NAME`, `VITE_ENABLE_BILLING_PORTAL` and any provider sandbox keys. Do not use live payment credentials in staging.
- Monitoring: `VITE_SENTRY_DSN` and server-side `SENTRY_AUTH_TOKEN` if error reporting is enabled.
- CORS: `CORS_ORIGINS` as a comma-separated exact-origin allowlist (for example the staging origin and, outside production, localhost). Wildcard `*` is not accepted.

Verify every variable is present without printing its value. Confirm sender, redirect, webhook, and public URL values point to staging.

## Before applying a migration

1. Confirm the staging project and branch, and record the current schema migration version.
2. Take a provider backup or logical dump outside the repository; record checksums.
3. Restore/duplicate into an isolated database and verify row counts, RLS policies, RPCs, triggers, and Storage checksums.
4. Apply migrations to staging only. Keep Career Studio rollout disabled until smoke tests pass.

## Staging smoke tests

- Create two synthetic accounts; verify cross-account reads, writes, deletes, publishing, payment requests, and analytics are denied through direct API requests and URLs.
- Run Home, Pricing, Login, Portfolio Studio, CV Builder, Import PDF/DOCX, PDF export, Job Fit, variants, sync review, publish/unpublish, and mobile navigation flows.
- Test failed, cancelled, duplicate, delayed, and forged payment/webhook events using sandbox fixtures only.
- Test signup/confirmation/reset mail only with owned test inboxes; verify sender, links, expiry, and absence of sensitive data.
- Check `/api/admin?action=health`; investigate every `degradedReasons` value before enabling beta access.

## Rollback

1. Disable the staging feature flag/rollout switch.
2. Revert the application deployment to the previous immutable build.
3. If a migration was applied, restore the isolated verified backup according to the provider procedure; never restore over production as part of this runbook.
4. Re-run auth, portfolio, billing-metadata, and RLS smoke tests, then preserve logs without secrets.
