import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import { generatePasswordResetEmail, generateSignupVerificationEmail } from '../src/services/EmailTemplates.js';

const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password']);

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, match => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
}

const AUTH_REDIRECT_URL = process.env.AUTH_REDIRECT_URL || 'https://portfolio-maker-murex.vercel.app/start';
const authMailThrottle = globalThis.__portfolioMakerAuthMailThrottle || (globalThis.__portfolioMakerAuthMailThrottle = new Map());

function getAdminClient({ requireSecret = false } = {}) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const key = requireSecret ? secretKey : (secretKey || publicKey);
  return key ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function getRequestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'] || '';
  return String(forwarded).split(',')[0].trim() || 'unknown';
}

function checkAuthMailThrottle(req, email, action) {
  const now = Date.now();
  const keys = [`${action}:email:${email}`, `${action}:ip:${getRequestIp(req)}`];
  for (const key of keys) {
    const last = authMailThrottle.get(key) || 0;
    if (now - last < 30_000) return false;
  }
  for (const key of keys) authMailThrottle.set(key, now);
  for (const [key, timestamp] of authMailThrottle) {
    if (now - timestamp > 10 * 60_000) authMailThrottle.delete(key);
  }
  return true;
}

function isAllowedAuthOrigin(req) {
  const origin = req.headers?.origin || req.headers?.Origin;
  if (!origin) return true;
  return origin === 'https://portfolio-maker-murex.vercel.app' || /^https?:\/\/localhost(?::\d+)?$/.test(origin);
}

async function findAuthUser(adminClient, email, userId = '') {
  if (userId) {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (!error && data?.user?.email?.toLowerCase() === email) return data.user;
  }

  // The client sends the id after signup. For an unverified login, fall back
  // to a bounded admin lookup so resend still works without exposing users.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = (data?.users || []).find(user => user.email?.toLowerCase() === email);
    if (match) return match;
    if ((data?.users || []).length < 1000) break;
  }
  return null;
}

async function sendCustomAuthVerification(req, res, action) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedAuthOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' });

  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address required.' });
  }
  if (!checkAuthMailThrottle(req, email, action)) {
    return res.status(429).json({ code: 'over_email_send_rate_limit', error: 'Please wait before requesting another verification email.' });
  }

  const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
  if (!brevoConfigured) {
    return res.status(503).json({ code: 'email_delivery', error: 'Verification email delivery is not configured.' });
  }

  const adminClient = getAdminClient({ requireSecret: true });
  if (!adminClient) return res.status(503).json({ code: 'auth_service', error: 'Authentication service is not configured.' });

  try {
    let generated;
    if (action === 'auth-signup') {
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 6) return res.status(400).json({ code: 'weak_password', error: 'Password should be at least 6 characters.' });
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : '';
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { data: { full_name: displayName }, redirectTo: AUTH_REDIRECT_URL }
      });
      if (error) {
        const lower = String(error.message || '').toLowerCase();
        if (lower.includes('already') || lower.includes('registered')) return res.status(409).json({ code: 'already_registered', error: 'An account with this email already exists. Sign in instead.' });
        return res.status(502).json({ code: 'email_delivery', error: 'We could not create the verification request.' });
      }
      generated = data;
    } else {
      const user = await findAuthUser(adminClient, email, typeof body.userId === 'string' ? body.userId : '');
      // Keep resend non-enumerating: unknown or already-confirmed addresses
      // receive the same success shape without generating a new account.
      if (!user || user.email_confirmed_at || user.confirmed_at) return res.status(200).json({ success: true, emailSent: true });
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: AUTH_REDIRECT_URL }
      });
      if (error) return res.status(200).json({ success: true, emailSent: true });
      generated = data;
    }

    const properties = generated?.properties || {};
    const otpCode = String(properties.email_otp || '').replace(/\D/g, '');
    const actionUrl = properties.action_link || AUTH_REDIRECT_URL;
    if (!otpCode && !actionUrl) return res.status(502).json({ code: 'email_delivery', error: 'No verification payload was generated.' });

    const firstName = (typeof body.displayName === 'string' && body.displayName.trim()) || email.split('@')[0];
    const emailResult = await sendBrevoEmail({
      to: email,
      subject: 'Verify your 3D Portfolio Maker account',
      htmlContent: generateSignupVerificationEmail({ firstName, otpCode, actionUrl }),
      tags: [action === 'auth-resend' ? 'auth-verification-resend' : 'auth-signup-verification']
    });
    if (!emailResult.success) return res.status(503).json({ code: 'email_delivery', error: 'Verification email could not be delivered.' });

    return res.status(200).json({
      success: true,
      emailSent: true,
      user: generated.user || null,
      otpLength: otpCode ? otpCode.length : null,
      verificationType: properties.verification_type || (action === 'auth-signup' ? 'signup' : 'magiclink')
    });
  } catch (error) {
    console.error('[Custom Auth Email]', error?.message || error);
    return res.status(502).json({ code: 'email_delivery', error: 'Verification email could not be delivered.' });
  }
}

async function checkRegisteredAuthEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedAuthOrigin(req)) return res.status(403).json({ error: 'Origin not allowed' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address required.' });
  }
  // Account discovery must not be exposed as a public oracle. The sign-in UI
  // uses the same neutral response for an unknown address and a bad password.
  return res.status(200).json({ success: true });
}

async function sendPortfolio(req, res, adminClient, slug) {
  if (RESERVED_SLUGS.has(slug)) return res.status(400).json({ error: 'Invalid portfolio path' });
  const variantSlug = String(req.query.variant || '').trim().toLowerCase();
  if (variantSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variantSlug)) {
    return res.status(400).json({ error: 'Invalid portfolio path' });
  }

  const { data: portfolio, error } = await adminClient
    .from('portfolios')
    .select('id,slug,theme,master_profile_json,published_at,updated_at')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to load portfolio' });
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

  let variant = null;
  if (variantSlug) {
    const { data, error: variantError } = await adminClient
      .from('portfolio_variants')
      .select('slug,overrides_json')
      .eq('portfolio_id', portfolio.id)
      .eq('slug', variantSlug)
      .maybeSingle();
    if (variantError) return res.status(500).json({ error: 'Unable to load portfolio variant' });
    if (!data) return res.status(404).json({ error: 'Portfolio variant not found' });
    variant = data;
  }

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({ portfolio, variant });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.method === 'POST' ? 'reset-password' : 'resume');

  // Auth confirmation is generated by Supabase Admin and delivered through
  // Brevo's HTTP API. Supabase never sends this message itself.
  if (action === 'auth-signup' || action === 'auth-resend') {
    return sendCustomAuthVerification(req, res, action);
  }
  if (action === 'auth-check-email') {
    return checkRegisteredAuthEmail(req, res);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: RESUME & PUBLIC PORTFOLIO
  // ─────────────────────────────────────────────────────────────
  if (action === 'resume' || (action !== 'reset-password' && req.method === 'GET')) {
    const slug = String(req.query.slug || req.query.username || '').trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({ error: 'Invalid portfolio slug' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseSecretKey) return res.status(503).json({ error: 'Public service is not configured' });
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);

    try {
      if (req.query.resource === 'portfolio') {
        return await sendPortfolio(req, res, adminClient, slug);
      }

      const { data: pf, error: pfErr } = await adminClient
        .from('portfolios')
        .select('master_profile_json, published_at')
        .eq('slug', slug)
        .not('published_at', 'is', null)
        .maybeSingle();

      if (pfErr || !pf) return res.status(404).json({ error: 'Portfolio not found' });

      const masterProfile = pf.master_profile_json || {};
      const resume = masterProfile.resume;
      if (!resume || resume.hidden === true || !resume.storagePath) {
        return res.status(403).json({ error: 'Private resume — Download is disabled by owner' });
      }

      const { data: signedData, error: signErr } = await adminClient.storage
        .from('resumes')
        .createSignedUrl(resume.storagePath, 3600);

      if (signErr || !signedData?.signedUrl) {
        return res.status(500).json({ error: 'Failed to generate secure resume URL' });
      }

      return res.redirect(302, signedData.signedUrl);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: RESET-PASSWORD
  // ─────────────────────────────────────────────────────────────
  if (action === 'reset-password' || req.method === 'POST') {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    try {
      const adminClient = getAdminClient({ requireSecret: true });
      if (!adminClient) return res.status(503).json({ success: false, error: 'Authentication service is not configured.' });
      const user = await findAuthUser(adminClient, cleanEmail);
      if (!user) {
        // Do not reveal whether an account exists.
        return res.status(200).json({ success: true, emailSent: true });
      }
      if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
        return res.status(503).json({
          success: false,
          error: 'Transactional email is not configured (BREVO_API_KEY or BREVO_SENDER_EMAIL missing)'
        });
      }

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: { redirectTo: 'https://portfolio-maker-murex.vercel.app/reset-password' }
      });

      if (linkErr) {
        return res.status(502).json({ success: false, code: 'email_delivery', error: 'We could not create the password reset email.' });
      }

      const actionUrl = linkData.properties?.action_link || 'https://portfolio-maker-murex.vercel.app/reset-password';
      const html = generatePasswordResetEmail({ firstName: cleanEmail.split('@')[0], actionUrl });

      const emailResult = await sendBrevoEmail({
        to: cleanEmail,
        subject: 'Reset your 3D Portfolio Maker password',
        htmlContent: html,
        tags: ['auth-password-reset']
      });
      if (!emailResult?.success) {
        return res.status(503).json({ success: false, code: 'email_delivery', error: 'We could not deliver the password reset email.' });
      }

      return res.status(200).json({ success: true, emailSent: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
