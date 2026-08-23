/**
 * BrevoDispatcher.js
 * Server-side transactional email sender reusing existing Brevo SMTP API transport.
 * Strictly avoids exposing BREVO_API_KEY to frontend clients.
 */

export async function sendBrevoEmail({ to, subject, htmlContent, senderName, senderEmail }) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = senderEmail || process.env.BREVO_SENDER_EMAIL;
  const fromName = senderName || process.env.BREVO_SENDER_NAME || '3D Portfolio Maker';
  const replyToEmail = process.env.BREVO_REPLY_TO_EMAIL || fromEmail;

  if (!brevoApiKey || !fromEmail) {
    console.warn('[Brevo] Transactional email credentials not configured (BREVO_API_KEY or BREVO_SENDER_EMAIL missing)');
    return { success: false, error: 'Transactional email is not configured on the server' };
  }

  if (!to || !to.length) {
    return { success: false, error: 'Recipient email is required' };
  }

  const recipients = Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }];

  try {
    const textContent = String(htmlContent || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/tr>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        replyTo: { email: replyToEmail, name: fromName },
        to: recipients,
        subject: subject,
        htmlContent: htmlContent,
        textContent,
        tags: ['transactional', '3d-portfolio-maker']
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
