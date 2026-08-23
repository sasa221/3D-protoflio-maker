import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateGroupInvitationEmail, generateGroupMemberActivatedEmail, generateGroupMemberJoinedEmail, generatePasswordResetEmail, generateAdminNewPaymentEmail, generatePaymentApprovedEmail, generatePaymentRejectedEmail } from '../services/EmailTemplates.js';

const files = await Promise.all(['../../api/public.js', '../../api/entitlements.js', '../../api/billing.js', '../../api/admin.js'].map(file => readFile(new URL(file, import.meta.url), 'utf8')));
const [publicApi, groupsApi, billingApi, adminApi] = files;
assert(publicApi.includes('auth-signup-verification') && publicApi.includes('auth-verification-resend') && publicApi.includes('auth-password-reset'));
assert(groupsApi.includes('group-invitation') && groupsApi.includes('group-membership-activated') && groupsApi.includes('group-member-joined'));
assert(billingApi.includes('billing-payment-submitted'));
assert(adminApi.includes('billing-payment-approved') && adminApi.includes('billing-payment-rejected'));
for (const html of [
  generateGroupInvitationEmail({ ownerName: '<owner>', invitationUrl: 'https://portfolio-maker-murex.vercel.app/studio' }),
  generateGroupMemberActivatedEmail({ memberName: '<member>', ownerName: '<owner>' }),
  generateGroupMemberJoinedEmail({ memberEmail: '<member@example.com>' }),
  generatePasswordResetEmail({ firstName: '<user>', actionUrl: 'https://portfolio-maker-murex.vercel.app/reset-password' }),
  generateAdminNewPaymentEmail({ userName: '<user>', userEmail: 'user@example.com', planName: 'pro', amountEGP: 600, requestId: '<id>', submittedAt: Date.now() }),
  generatePaymentApprovedEmail({ firstName: '<user>', planName: 'pro' }),
  generatePaymentRejectedEmail({ firstName: '<user>', planName: 'pro', reason: '<reason>' })
]) {
  assert(!html.includes('<owner>') && !html.includes('<member>') && !html.includes('<reason>'));
  assert(html.includes('3D Portfolio Maker'));
}
console.log('Brevo flow coverage: signup/resend/reset/group/payment templates and tags passed');
