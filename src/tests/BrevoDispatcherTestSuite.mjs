import assert from 'node:assert/strict';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
process.env.BREVO_API_KEY = 'unit-test-key';
process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
process.env.BREVO_REPLY_TO_EMAIL = 'reply@example.com';
process.env.BREVO_SENDER_NAME = '3D Portfolio Maker';
for (const name of ['BREVO_SMTP_KEY', 'BREVO_SMTP_LOGIN', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_PASS']) delete process.env[name];

let request;
globalThis.fetch = async (url, options) => {
  request = { url, options, payload: JSON.parse(options.body) };
  return { ok: true, status: 201, json: async () => ({ messageId: '<unit-test-message>' }) };
};

const { sendBrevoEmail } = await import(`../services/BrevoDispatcher.js?test=${Date.now()}`);
const result = await sendBrevoEmail({
  to: 'recipient@example.com',
  subject: 'Verify your account',
  htmlContent: '<p>Hello <strong>there</strong>.</p><p>Use the secure link.</p>',
  tags: ['auth-signup-verification']
});
assert.equal(result.success, true);
assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
assert.equal(request.options.method, 'POST');
assert.equal(request.options.headers['api-key'], 'unit-test-key');
assert.equal(request.payload.sender.name, '3D Portfolio Maker');
assert.equal(request.payload.sender.email, 'sender@example.com');
assert.deepEqual(request.payload.replyTo, { name: '3D Portfolio Maker', email: 'reply@example.com' });
assert.equal(request.payload.textContent, 'Hello there.\nUse the secure link.');
assert(request.payload.tags.includes('auth-signup-verification'));
assert(request.payload.tags.includes('transactional'));
assert(!JSON.stringify(request.payload).includes('unit-test-key'));

process.env.BREVO_SMTP_KEY = 'must-not-be-used';
let called = false;
globalThis.fetch = async () => { called = true; throw new Error('SMTP must never be called'); };
const rejected = await sendBrevoEmail({ to: 'recipient@example.com', subject: 'x', htmlContent: '<p>x</p>', tags: ['test'] });
assert.equal(rejected.success, false);
assert.match(rejected.error, /SMTP configuration is unsupported/);
assert.equal(called, false);

process.env.BREVO_SENDER_EMAIL = '';
delete process.env.BREVO_SMTP_KEY;
const missingSender = await sendBrevoEmail({ to: 'recipient@example.com', subject: 'x', htmlContent: '<p>x</p>' });
assert.equal(missingSender.success, false);
assert.match(missingSender.error, /not configured/);

Object.assign(process.env, originalEnv);
globalThis.fetch = originalFetch;
console.log('Brevo dispatcher payload/REST tests: 10/10 passed');
