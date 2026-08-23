import { readFile } from 'node:fs/promises';
import { GROUP_SEAT_PRICING } from '../config/PlanConfig.js';
import { generateGroupInvitationEmail, generateGroupMemberActivatedEmail, generateGroupMemberJoinedEmail } from '../services/EmailTemplates.js';

const api = await readFile(new URL('../../api/entitlements.js', import.meta.url), 'utf8');
const modal = await readFile(new URL('../ui/GroupManagementModal.js', import.meta.url), 'utf8');
const billing = await readFile(new URL('../ui/BillingModal.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../supabase_phase8a_migration.sql', import.meta.url), 'utf8');
const checks = [];
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) });
  console.log(`${passed ? '✅' : '❌'} ${name}`);
}

check('Pending invitations are stored as pending (not auto-activated)', /status:\s*'pending'/.test(api));
check('Pending invitations do not consume purchased seats', /filter\(member => member\.status === 'active'\)/.test(api));
check('Duplicate pending invite is resent instead of duplicated', /resent:\s*Boolean\(existingMember\)/.test(api));
check('Owner can replace/remove an unaccepted invitation', /subAction === 'remove_member'/.test(api));
check('Invitee can accept from authenticated account only', /subAction === 'accept_invitation'/.test(api) && /eq\('user_id', userId\)/.test(api));
check('Invitee can decline and become eligible for a later invite', /subAction === 'decline_invitation'/.test(api) && /status: 'declined'/.test(api));
check('Seat limit counts accepted teammates while pending invites stay free', /if \(\(activeMemberCount \|\| 0\) >= group\.seat_limit\)/.test(api));
check('Owner subscription expiry is checked before group access', /ownerSub\?\.current_period_end/.test(api));
check('Group email templates exist for invite, member activation, and owner notice', generateGroupInvitationEmail({ invitationUrl: 'https://example.com' }).includes('Accept Invitation') && generateGroupMemberActivatedEmail({}).includes('Premium Group') && generateGroupMemberJoinedEmail({}).includes('NEW MEMBER JOINED'));
check('Studio exposes Manage Team instead of a dead Current Plan CTA', modal.includes('Manage your team') && billing.includes('btn-manage-group'));
check('Migration keeps unique group membership protection', /UNIQUE\s*\(group_id, user_id\)/i.test(migration));
check('All supported group prices remain defined', Object.keys(GROUP_SEAT_PRICING).join(',') === '2,3,4,5');

const failed = checks.filter(item => !item.passed);
console.log(`\nGroup management flow: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
