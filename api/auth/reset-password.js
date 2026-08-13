import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email parameter' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const adminClient = createClient(supabaseUrl, supabaseSecretKey);

  try {
    // Generate official Supabase password reset link
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: { redirectTo: 'https://portfolio-maker.vercel.app/reset-password' }
    });

    if (linkErr) {
      return res.status(400).json({ error: linkErr.message });
    }

    const actionUrl = linkData.properties?.action_link || 'https://portfolio-maker.vercel.app/reset-password';
    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || '3D Portfolio Maker';

    if (brevoApiKey && senderEmail) {
      const emailResult = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: email.trim() }],
          subject: 'Reset Your 3D Portfolio Password',
          htmlContent: `
          <div style="font-family: Arial, sans-serif; background-color: #050508; color: #ffffff; padding: 30px; border-radius: 12px;">
            <h2 style="color: #7c3aed;">⚡ 3D Portfolio Maker</h2>
            <p>You requested a password reset for your account (<strong>${email}</strong>).</p>
            <p>Click the secure link below to set a new password:</p>
            <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">Reset Password</a>
            <p style="color: #888888; font-size: 12px; margin-top: 20px;">If you did not request this, you can safely ignore this email.</p>
          </div>
        `
        })
      });
      const emailData = await emailResult.json().catch(() => ({}));
      if (!emailResult.ok) throw new Error(emailData.message || 'Brevo rejected the email');

      return res.status(200).json({
        success: true,
        message: 'Password reset email sent via Brevo',
        messageId: emailData.messageId
      });
    } else {
      return res.status(503).json({ success: false, error: 'Transactional email is not configured' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
