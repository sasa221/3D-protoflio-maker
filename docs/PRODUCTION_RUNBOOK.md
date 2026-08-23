# Production Runbook

## Canonical production URL

`https://portfolio-maker-murex.vercel.app`

Keep `PRODUCT_CONFIG`, Stripe return URLs, email links, sitemap, OAuth callbacks, and Vercel aliases aligned with this URL.

## Required launch checks

1. Run `npm run check` and require a zero exit code.
2. Check `/api/health`; launch requires `launchReady: true` and `status: HEALTHY`.
3. Complete a real Stripe test-mode checkout and billing-portal cancellation.
4. Verify the Stripe webhook updates `subscriptions` for checkout, update, and deletion events.
5. Send a real password-reset and confirmation email to a controlled test inbox.
6. Confirm Sentry receives a controlled frontend error and a serverless API error.
7. Test CV upload, review, save, publish, public portfolio, resume download, and analytics.

## Required environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `VITE_SENTRY_DSN`

Never commit secret values. Rotate a credential immediately if it appears in source control or logs.

## Authentication email delivery

Signup confirmation and resend use `/api/auth/signup` and `/api/auth/resend`. The server generates the Supabase verification payload with the Admin API and sends the message through Brevo's HTTP API. Supabase SMTP is intentionally not used. Keep `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SUPABASE_SECRET_KEY`, and the verified Brevo sender configured in Vercel.

## Monitoring

- Poll `/api/health` every five minutes.
- Alert when HTTP is not 200, `status` is not `HEALTHY`, or `launchReady` is false.
- Alert on Stripe webhook failures, authentication error spikes, CV parsing failures, and publish failures.
- Track conversion from landing CTA → onboarding completion → account creation → publish → paid checkout.

## Backups and recovery

- Enable Supabase point-in-time recovery before paid launch.
- Take a scheduled logical backup of profiles, portfolios, variants, subscriptions, domains, and analytics.
- Test restoration into a separate Supabase project at least quarterly.
- Keep storage buckets versioned or mirrored for resumes, avatars, project media, and certificates.

## Incident priorities

- P0: authentication bypass, cross-user data access, payment entitlement error, data loss.
- P1: publishing unavailable, CV import unusable, checkout unavailable, public portfolios down.
- P2: individual theme/rendering issue, analytics delay, non-blocking UI regression.

For P0: disable the affected feature, preserve logs, rotate exposed credentials, restore integrity, and document the incident before re-enabling it.
