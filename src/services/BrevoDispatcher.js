/** Server-side Brevo REST API dispatcher. Secrets never enter frontend code or logs. */
const BREVO_REST_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const FREE_MAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com']);
const SMTP_ENV_NAMES = ['BREVO_SMTP_KEY', 'BREVO_SMTP_LOGIN', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_PASS'];

function htmlToText(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>|<\/div>|<\/tr>|<\/h[1-6]>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&#039;/gi, "'").replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
}
function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }

export async function sendBrevoEmail({ to, subject, htmlContent, tags = [] }) {
  if (SMTP_ENV_NAMES.some(name => process.env[name])) {
    console.warn('[Brevo] SMTP configuration detected and ignored. Configure BREVO_API_KEY for REST delivery.');
    return { success: false, error: 'SMTP configuration is unsupported; configure BREVO_API_KEY for REST delivery.' };
  }
  const brevoApiKey = String(process.env.BREVO_API_KEY || '').trim();
  const fromEmail = String(process.env.BREVO_SENDER_EMAIL || '').trim().toLowerCase();
  const fromName = String(process.env.BREVO_SENDER_NAME || '3D Portfolio Maker').trim() || '3D Portfolio Maker';
  const replyToEmail = String(process.env.BREVO_REPLY_TO_EMAIL || fromEmail).trim().toLowerCase();
  if (!brevoApiKey || !fromEmail) {
    console.warn('[Brevo] Missing required BREVO_API_KEY or BREVO_SENDER_EMAIL server configuration.');
    return { success: false, error: 'Transactional email is not configured on the server' };
  }
  if (!isValidEmail(fromEmail) || !isValidEmail(replyToEmail)) return { success: false, error: 'Transactional email sender or reply-to address is invalid' };
  if (FREE_MAIL_DOMAINS.has(fromEmail.split('@')[1])) console.warn('[Brevo] BREVO_SENDER_EMAIL uses a free mailbox domain; authenticate a custom sending domain for reliable inbox placement.');
  if (!to || (Array.isArray(to) && !to.length)) return { success: false, error: 'Recipient email is required' };
  const recipients = (Array.isArray(to) ? to : [to]).map(email => String(email || '').trim().toLowerCase()).filter(isValidEmail).map(email => ({ email }));
  if (!recipients.length) return { success: false, error: 'Recipient email is invalid' };
  const extraTags = (Array.isArray(tags) ? tags : [tags]).map(tag => String(tag || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')).filter(Boolean);
  const safeTags = [...new Set(['transactional', '3d-portfolio-maker', ...extraTags])].slice(0, 10);
  const payload = { sender: { name: fromName, email: fromEmail }, replyTo: { email: replyToEmail, name: fromName }, to: recipients, subject: String(subject || '').trim(), htmlContent: String(htmlContent || ''), textContent: htmlToText(htmlContent), tags: safeTags };
  if (!payload.subject || !payload.htmlContent || !payload.textContent) return { success: false, error: 'Email subject and content are required' };
  try {
    const res = await fetch(BREVO_REST_ENDPOINT, { method: 'POST', headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { console.error('[Brevo] REST delivery failed', { status: res.status, code: data.code || 'unknown' }); return { success: false, error: data.message || 'Brevo transactional email delivery failed' }; }
    return { success: true, messageId: data.messageId };
  } catch (err) { console.error('[Brevo] REST dispatch failed', { message: err?.message || 'network error' }); return { success: false, error: 'Unable to reach transactional email service' }; }
}

export { BREVO_REST_ENDPOINT, htmlToText };
