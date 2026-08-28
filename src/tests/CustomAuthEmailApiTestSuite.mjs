import { readFile } from 'node:fs/promises';
import { generateSignupVerificationEmail } from '../services/EmailTemplates.js';
import publicHandler from '../../api/public.js';

const source = await readFile(new URL('../../api/public.js', import.meta.url), 'utf8');
const vercel = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8');
const checks = [];
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
}

check('Custom auth signup action uses Supabase Admin generateLink', source.includes("type: 'signup'") && source.includes('generateLink'));
check('Custom auth resend action uses magiclink generateLink', source.includes("type: 'magiclink'"));
check('Auth confirmation is dispatched through Brevo API', source.includes('sendBrevoEmail') && source.includes('generateSignupVerificationEmail'));
check('Custom auth routes are mapped without adding a serverless function', vercel.includes('/api/auth/signup') && vercel.includes('/api/auth/resend'));
check('Auth email lookup route is mapped without exposing account existence', vercel.includes('/api/auth/check-email') && source.includes('auth-check-email') && !source.includes('exists: Boolean(user)'));
check('Reset endpoint does not reveal account existence', source.includes('Do not reveal whether an account exists') && source.includes('emailSent: true') && !source.includes("code: 'email_not_registered'"));
check('Auth flows carry distinct Brevo tags', source.includes('auth-signup-verification') && source.includes('auth-password-reset'));
check('Verification email contains both OTP and secure link', (() => {
  const html = generateSignupVerificationEmail({ firstName: 'Test', otpCode: '12345678', actionUrl: 'https://portfolio-maker-murex.vercel.app/start' });
  return html.includes('12345678') && html.includes('https://portfolio-maker-murex.vercel.app/start') && html.includes('Verify My Email');
})());

const req = {
  method: 'POST',
  query: { action: 'auth-signup' },
  headers: { origin: 'https://portfolio-maker-murex.vercel.app' },
  body: {}
};
const res = {
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
  setHeader() { return this; },
  end() { return this; }
};
await publicHandler(req, res);
check('Signup endpoint rejects malformed input before any provider call', res.statusCode === 400 && res.body?.error === 'Valid email address required.');

const failed = checks.filter(item => !item.passed);
console.log(`\nCustom auth email flow: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
