import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local CV export test requires local Supabase credentials supplied in process environment.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: CV export test accepts only Supabase Local at 127.0.0.1:54321.');
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.SUPABASE_ENV = 'local';
process.env.FF_CAREER_STUDIO = 'true';
process.env.CV_FREE_EXPORT_LIMIT = '1';
process.env.CV_LOCAL_PLAN_OVERRIDE = 'free';

const { default: handler } = await import('../api/portfolio.js');
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const credentials = id => ({ email: `cv-export-${id}-${suffix}@example.test`, password: `LocalOnly-CV-${id}-123!` });
const users = [];

async function createUser(id) {
  const { data, error } = await admin.auth.admin.createUser({ ...credentials(id), email_confirm: true });
  assert.ifError(error);
  users.push(data.user);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword(credentials(id));
  assert.ifError(signedIn.error);
  return { client, user: data.user, token: signedIn.data.session.access_token };
}

function call(token, body) {
  let result;
  const req = { method: 'POST', query: { action: 'cv-export' }, headers: { authorization: `Bearer ${token}` }, body };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(payload) { result = payload; return this; }, end() { return this; } };
  return handler(req, res).then(() => ({ status: res.code || 200, body: result }));
}

const a = await createUser('a');
const b = await createUser('b');
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: a.user.id, enabled: true })).error);
const profileA = `cp_export_a_${suffix}`;
const profileB = `cp_export_b_${suffix}`;
const inserted = await a.client.from('career_profiles').insert({ id: profileA, owner_user_id: a.user.id, label: 'Synthetic A', career_stage: 'student', content_json: { contact: { name: 'Synthetic A' } } });
assert.ifError(inserted.error);

process.env.FF_CAREER_STUDIO = 'false';
let disabled = await call(a.token, { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_disabled_${suffix}` });
assert.equal(disabled.status, 404, 'disabled Career Studio must leave the legacy API path untouched');
process.env.FF_CAREER_STUDIO = 'true';

let result = await call(a.token, { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_a_${suffix}_one` });
assert.equal(result.status, 200);
assert.equal(result.body.success, true);
assert.equal(result.body.duplicate, undefined);

result = await call(a.token, { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_a_${suffix}_one` });
assert.equal(result.status, 200);
assert.equal(result.body.duplicate, true, 'retry must be idempotent');

result = await call(a.token, { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_a_${suffix}_two` });
assert.equal(result.status, 429, 'free quota must be enforced server-side');

result = await call(b.token, { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_b_${suffix}_one` });
assert.equal(result.status, 403, 'cross-account export must be denied');

result = await call('', { careerProfileId: profileA, pageCount: 1, format: 'pdf', idempotencyKey: `cvexp_anon_${suffix}` });
assert.equal(result.status, 401, 'anonymous export must be denied');

result = await call(a.token, { careerProfileId: profileA, pageCount: 1, format: 'html', idempotencyKey: `cvexp_a_${suffix}_bad` });
assert.equal(result.status, 400, 'non-PDF export must be rejected');

const eventCount = await admin.from('cv_export_events').select('id', { count: 'exact', head: true }).eq('owner_user_id', a.user.id);
assert.ifError(eventCount.error);
assert.equal(eventCount.count, 1, 'failed/duplicate requests must not create extra events');

process.env.CV_LOCAL_PLAN_OVERRIDE = 'pro';
for (const key of ['two', 'three']) {
  result = await call(a.token, { careerProfileId: profileA, pageCount: 2, format: 'pdf', idempotencyKey: `cvexp_a_${suffix}_${key}` });
  assert.equal(result.status, 200, 'local Pro override must allow unlimited exports');
}

await admin.from('cv_export_events').delete().eq('owner_user_id', a.user.id);
await admin.from('career_profiles').delete().in('id', [profileA, profileB]);
await admin.from('career_studio_rollout_users').delete().eq('user_id', a.user.id);
await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
for (const user of users) await admin.auth.admin.deleteUser(user.id);
console.log('Local CV export tests passed: owner auth, cross-account denial, anonymous denial, server quota, idempotency, failed-request accounting, and local Pro override.');
