import { createClient } from '@supabase/supabase-js';

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, match => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const safeEscapedEmail = escapeHtml(cleanEmail);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const adminClient = createClient(supabaseUrl, supabaseSecretKey);

  // Generic security response for Account Enumeration Protection
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

    // Generate official Supabase password reset link
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: { redirectTo: 'https://portfolio-maker-murex.vercel.app/reset-password' }
    });

    if (linkErr) {
      // Return generic success response to prevent account enumeration
      console.log(`[Auth Reset] Non-existing or unconfirmed email requested reset: ${cleanEmail}`);
      return res.status(200).json(genericSuccessResponse);
    }

    const actionUrl = linkData.properties?.action_link || 'https://portfolio-maker-murex.vercel.app/reset-password';

    const emailResult = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
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
        </div>
      `
      })
    });

    const emailData = await emailResult.json().catch(() => ({}));
    if (!emailResult.ok) {
      console.warn('[Brevo Error]', emailData);
      throw new Error(emailData.message || 'Brevo transactional email delivery failed');
    }

    return res.status(200).json(genericSuccessResponse);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
