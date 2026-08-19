/**
 * BrevoDispatcher.js
 * Server-side transactional email sender reusing existing Brevo SMTP API transport.
 * Strictly avoids exposing BREVO_API_KEY to frontend clients.
 */

export async function sendBrevoEmail({ to, subject, htmlContent, senderName, senderEmail }) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = senderEmail || process.env.BREVO_SENDER_EMAIL;
  const fromName = senderName || process.env.BREVO_SENDER_NAME || '3D Portfolio Maker';

  if (!brevoApiKey || !fromEmail) {
    console.warn('[Brevo] Transactional email credentials not configured (BREVO_API_KEY or BREVO_SENDER_EMAIL missing)');
    return { success: false, error: 'Transactional email is not configured on the server' };
  }

  if (!to || !to.length) {
    return { success: false, error: 'Recipient email is required' };
  }

  const recipients = Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }];

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: recipients,
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[Brevo Error]', data);
      return { success: false, error: data.message || 'Brevo transactional email delivery failed' };
    }

    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error('[Brevo Dispatch Error]', err.message);
    return { success: false, error: err.message };
  }
}
