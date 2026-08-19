import { createClient } from '@supabase/supabase-js';

const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'studio', 'start', 'privacy', 'terms', 'reset-password']);

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, match => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
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
    const safeEscapedEmail = escapeHtml(cleanEmail);
    const genericSuccessResponse = {
      success: true,
      message: "If an account exists for this email, we've sent password reset instructions."
    };

    try {
      const brevoApiKey = process.env.BREVO_API_KEY;
      const senderEmail = process.env.BREVO_SENDER_EMAIL;
      const senderName = process.env.BREVO_SENDER_NAME || '3D Portfolio Maker';

      if (!brevoApiKey || !senderEmail) {
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
        return res.status(200).json(genericSuccessResponse);
      }

      const actionUrl = linkData.properties?.action_link || 'https://portfolio-maker-murex.vercel.app/reset-password';
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: cleanEmail }],
          subject: 'Reset Your 3D Portfolio Password',
          htmlContent: `
          <div style="font-family: Arial, sans-serif; background-color: #050508; color: #ffffff; padding: 30px; border-radius: 12px;">
            <h2 style="color: #7c3aed;">⚡ 3D Portfolio Maker</h2>
            <p>You requested a password reset for your account (<strong>${safeEscapedEmail}</strong>).</p>
            <p>Click the secure link below to set a new password:</p>
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">Reset Password</a>
            <p style="color: #888888; font-size: 12px; margin-top: 20px;">If you did not request this, you can safely ignore this email.</p>
          </div>`
        })
      });

      return res.status(200).json(genericSuccessResponse);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
