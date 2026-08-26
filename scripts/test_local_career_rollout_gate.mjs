import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Career rollout test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: rollout test accepts only Supabase Local.');

process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.SUPABASE_ENV = 'local';
process.env.FF_CAREER_STUDIO = 'true';

const { default: portfolioHandler } = await import('../api/portfolio.js');
const { default: adminHandler } = await import('../api/admin.js');
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const users = {};
const createdIds = [];
const profileId = `cp_rollout_${suffix}`;
const portfolioId = `pf_rollout_${suffix}`;

async function createUser(label) {
  const credentials = { email: `rollout-${label}-${suffix}@example.test`, password: `LocalOnly-Rollout-${label}-123!` };
  const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
  assert.ifError(created.error);
  createdIds.push(created.data.user.id);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword(credentials);
  assert.ifError(session.error);
  users[label] = { user: created.data.user, token: session.data.session.access_token, client };
  return users[label];
}

function call(handler, method, action, token, body = {}, query = {}) {
  let payload;
  const req = { method, query: { action, ...query }, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { payload = value; return this; }, end() {} };
  return handler(req, res).then(() => ({ status: res.code || 200, body: payload }));
}

function assertDirectDenied(result, message) {
  assert.ok(result.error?.code === '42501' || (Array.isArray(result.data) && result.data.length === 0), message);
}

const adminUser = await createUser('admin');
const userA = await createUser('a');
const userB = await createUser('b');
process.env.ADMIN_EMAILS = adminUser.user.email;

try {
  let result = await call(adminHandler, 'GET', 'career-rollout', userA.token);
  assert.equal(result.status, 403, 'non-admin must not read rollout state');
  result = await call(adminHandler, 'POST', 'career-rollout-master-switch', userA.token, { enabled: true });
  assert.equal(result.status, 403, 'non-admin must not change rollout switch');

  // The database starts closed. Even an allowlisted user must be denied.
  result = await call(adminHandler, 'POST', 'career-rollout-master-switch', adminUser.token, { enabled: false });
  assert.equal(result.status, 200);
  result = await call(adminHandler, 'POST', 'career-rollout-update', adminUser.token, { userId: userA.user.id, enabled: true });
  assert.equal(result.status, 200);

  let direct = await userA.client.from('career_profiles').select('*');
  assertDirectDenied(direct, 'master switch closed must deny allowlisted User A');
  result = await call(portfolioHandler, 'POST', 'cv-variant-analyze', userA.token, { careerProfileId: profileId, role: 'Engineer', jobDescription: 'Engineer role requiring JavaScript and React.' });
  assert.equal(result.status, 403, 'API must honor database rollout switch while closed');
  process.env.FF_CAREER_STUDIO = 'false';
  result = await call(portfolioHandler, 'POST', 'cv-variant-analyze', userA.token, { careerProfileId: profileId, role: 'Engineer', jobDescription: 'Engineer role requiring JavaScript and React.' });
  assert.equal(result.status, 404, 'API must honor FF_CAREER_STUDIO master kill switch');
  process.env.FF_CAREER_STUDIO = 'true';

  // Open the DB gate and verify User A can use Career Studio while B cannot.
  result = await call(adminHandler, 'POST', 'career-rollout-master-switch', adminUser.token, { enabled: true });
  assert.equal(result.status, 200);
  direct = await userA.client.from('career_profiles').insert({
    id: profileId, owner_user_id: userA.user.id, label: 'Rollout CV A', career_stage: 'professional', content_json: { contact: { name: 'Synthetic A' }, summary: 'Private rollout fixture' }
  }).select().single();
  assert.ifError(direct.error);
  assert.equal(direct.data.owner_user_id, userA.user.id);

  direct = await userA.client.from('career_profiles').select('id,content_json').eq('id', profileId).single();
  assert.ifError(direct.error);
  assert.equal(direct.data.content_json.summary, 'Private rollout fixture');

  direct = await userB.client.from('career_profiles').select('*').eq('id', profileId);
  assertDirectDenied(direct, 'User B outside cohort must be denied by direct SELECT');
  direct = await userB.client.from('career_profiles').insert({ id: `cp_b_${suffix}`, owner_user_id: userB.user.id, label: 'Denied B', career_stage: 'student', content_json: {} });
  assert.equal(direct.error?.code, '42501', 'User B outside cohort must be denied by direct INSERT');
  direct = await userB.client.from('career_profiles').update({ label: 'Cross-account write' }).eq('id', profileId).select();
  assertDirectDenied(direct, 'User B outside cohort must be denied by direct UPDATE');
  direct = await userB.client.from('career_profiles').delete().eq('id', profileId).select();
  assertDirectDenied(direct, 'User B outside cohort must be denied by direct DELETE');

  result = await call(portfolioHandler, 'POST', 'cv-variant-analyze', userB.token, { careerProfileId: profileId, role: 'Engineer', jobDescription: 'Engineer role requiring JavaScript and React.' });
  assert.equal(result.status, 403, 'User B outside cohort must be denied by API');

  // Public mode admits every authenticated owner while preserving owner RLS.
  result = await call(adminHandler, 'POST', 'career-rollout-access-mode', adminUser.token, { accessMode: 'all' });
  assert.equal(result.status, 200);
  assert.equal(result.body.accessMode, 'all');
  direct = await userB.client.from('career_profiles').insert({ id: `cp_b_${suffix}`, owner_user_id: userB.user.id, label: 'Public B', career_stage: 'student', content_json: {} }).select().single();
  assert.ifError(direct.error);
  direct = await userA.client.from('career_profiles').select('*').eq('id', `cp_b_${suffix}`);
  assert.equal(direct.data?.length, 0, 'public mode must not weaken cross-account owner isolation');
  await admin.from('career_profiles').delete().eq('id', `cp_b_${suffix}`);
  result = await call(adminHandler, 'POST', 'career-rollout-access-mode', adminUser.token, { accessMode: 'allowlist' });
  assert.equal(result.status, 200);
  result = await call(portfolioHandler, 'POST', 'cv-variant-analyze', '', { careerProfileId: profileId, role: 'Engineer', jobDescription: 'Engineer role requiring JavaScript and React.' });
  assert.equal(result.status, 401, 'Anonymous must be denied by API');

  // Legacy Portfolio access remains available while Career Studio is closed.
  const legacy = await admin.from('portfolios').insert({ id: portfolioId, owner_user_id: userB.user.id, name: 'Legacy Rollout Portfolio', slug: `legacy-rollout-${suffix}`, master_profile_json: { name: 'Legacy' }, is_finalized: false }).select().single();
  assert.ifError(legacy.error);
  result = await call(adminHandler, 'POST', 'career-rollout-master-switch', adminUser.token, { enabled: false });
  assert.equal(result.status, 200);
  direct = await userB.client.from('portfolios').select('id,name').eq('id', portfolioId).single();
  assert.ifError(direct.error);
  assert.equal(direct.data.name, 'Legacy Rollout Portfolio');

  // Re-enable the gate, remove A from the cohort, then re-add it. Data must
  // survive both transitions and access must follow the allowlist state.
  await call(adminHandler, 'POST', 'career-rollout-master-switch', adminUser.token, { enabled: true });
  result = await call(adminHandler, 'POST', 'career-rollout-update', adminUser.token, { userId: userA.user.id, enabled: false });
  assert.equal(result.status, 200);
  direct = await userA.client.from('career_profiles').select('*').eq('id', profileId);
  assertDirectDenied(direct, 'Removing User A from cohort must revoke direct access');
  const retained = await admin.from('career_profiles').select('id,content_json').eq('id', profileId).single();
  assert.ifError(retained.error);
  assert.equal(retained.data.content_json.summary, 'Private rollout fixture');

  result = await call(adminHandler, 'POST', 'career-rollout-update', adminUser.token, { userId: userA.user.id, enabled: true });
  assert.equal(result.status, 200);
  direct = await userA.client.from('career_profiles').select('id,content_json').eq('id', profileId).single();
  assert.ifError(direct.error);
  assert.equal(direct.data.content_json.summary, 'Private rollout fixture');

  const audit = await call(adminHandler, 'GET', 'career-rollout-audit', adminUser.token);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.logs.length >= 3);
  for (const row of audit.body.logs) {
    assert.equal('content_json' in row, false);
    assert.equal('email' in row, false);
    assert.equal('phone' in row, false);
  }

  direct = await createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }).from('career_studio_rollout_users').select('*');
  assert.equal(direct.error?.code, '42501', 'Anonymous must not read rollout allowlist');
  console.log('Local Career rollout gate passed: DB master switch, owner allowlist, direct RLS denial, API denial, revocation/reinstatement, metadata-only audit, and legacy Portfolio continuity.');
} finally {
  await admin.from('career_studio_rollout_audit_log').delete().gte('id', 0);
  await admin.from('career_studio_rollout_users').delete().in('user_id', createdIds);
  await admin.from('career_profiles').delete().eq('id', profileId);
  await admin.from('portfolios').delete().eq('id', portfolioId);
  await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
}
