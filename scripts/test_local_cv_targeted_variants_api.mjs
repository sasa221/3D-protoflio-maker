import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local CV targeted variant API test requires local Supabase credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: targeted variant tests accept only Supabase Local.');
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.SUPABASE_ENV = 'local';
process.env.FF_CAREER_STUDIO = 'true';
process.env.CV_LOCAL_PLAN_OVERRIDE = 'pro';
process.env.CV_LOCAL_VARIANT_LIMIT = '1';

const { default: handler } = await import('../api/portfolio.js');
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const credentials = id => ({ email: `cv-variant-${id}-${suffix}@example.test`, password: `LocalOnly-Variant-${id}-123!` });
const createdUsers = [];
const clients = {};
const profileIds = [];

async function createUser(id) {
  const { data, error } = await admin.auth.admin.createUser({ ...credentials(id), email_confirm: true });
  assert.ifError(error); createdUsers.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword(credentials(id));
  assert.ifError(session.error);
  clients[id] = { user: data.user, token: session.data.session.access_token };
  return clients[id];
}

function call(action, token, method = 'POST', body = {}, query = {}) {
  let payload;
  const req = { method, query: { action, ...query }, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { payload = value; return this; }, end() {} };
  return handler(req, res).then(() => ({ status: res.code || 200, body: payload }));
}

const a = await createUser('a');
const b = await createUser('b');
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: a.user.id, enabled: true })).error);
const profileId = `cp_variant_api_${suffix}`;
profileIds.push(profileId);
const content = { contact: { name: 'Candidate A' }, summary: 'Frontend engineer.', skills: ['JavaScript', 'React'], experience: [{ text: 'Built React interfaces.' }], education: [{ text: "Bachelor's Degree" }], projects: [], certifications: [], languages: [] };
const userAClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${a.token}` } } });
const inserted = await userAClient.from('career_profiles').insert({ id: profileId, owner_user_id: a.user.id, label: 'Synthetic Base CV', career_stage: 'professional', content_json: content });
assert.ifError(inserted.error);
const jd = 'Frontend Developer. Required: JavaScript, React and Git. At least 2 years experience. Bachelor degree preferred.';

let result = await call('cv-variant-analyze', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd });
assert.equal(result.status, 200); assert.equal(result.body.analysis.hasRequirements, true); assert.equal('jobDescription' in result.body.analysis, false);
result = await call('cv-variant-analyze', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend', jobDescription: jd, jobUrl: 'https://example.com/job' });
assert.equal(result.status, 400, 'targeted flow rejects Job URL fetching');
result = await call('cv-variant-create', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd, idempotencyKey: `variant_create_${suffix}` });
assert.equal(result.status, 200); assert.equal(result.body.variant.status, 'draft');
const variantId = result.body.variant.id;
const directVariantRead = await userAClient.from('career_targeted_variants').select('*');
assert.ok(directVariantRead.error || directVariantRead.data?.length === 0, 'authenticated clients cannot bypass the variant API/RLS gate');
result = await call('cv-variant-create', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd, idempotencyKey: `variant_limit_${suffix}` });
assert.equal(result.status, 429, 'server enforces the local Pro variant limit');
const storedProfile = await admin.from('career_profiles').select('content_json').eq('id', profileId).single();
assert.deepEqual(storedProfile.data.content_json, content, 'Base CV remains unchanged');
result = await call('cv-variant-create', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd, idempotencyKey: `variant_create_${suffix}` });
assert.equal(result.status, 200); assert.equal(result.body.duplicate, true, 'retry does not create a duplicate');
result = await call('cv-variants', a.token, 'GET', {}, { profileId });
assert.equal(result.status, 200); assert.equal(result.body.variants.length, 1);
result = await call('cv-variants', b.token, 'GET', {}, { profileId });
assert.equal(result.status, 403, 'cross-account list is denied');
result = await call('cv-variant-delete', b.token, 'POST', { variantId });
assert.equal(result.status, 403, 'cross-account/out-of-cohort delete is denied');
result = await call('cv-variant-delete', a.token, 'POST', { variantId });
assert.equal(result.status, 200);
result = await call('cv-variant-create', '', 'POST', { careerProfileId: profileId, role: 'Frontend Developer', jobDescription: jd, idempotencyKey: `variant_anon_${suffix}` });
assert.equal(result.status, 401);
process.env.CV_LOCAL_PLAN_OVERRIDE = 'free';
result = await call('cv-variant-create', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', jobDescription: jd, idempotencyKey: `variant_free_${suffix}` });
assert.equal(result.status, 403, 'Free is denied by the server-side Pro gate');
process.env.CV_LOCAL_PLAN_OVERRIDE = 'pro';
process.env.SUPABASE_ENV = 'production';
result = await call('cv-variant-analyze', a.token, 'POST', { careerProfileId: profileId, role: 'Frontend Developer', jobDescription: jd });
assert.equal(result.status, 403, 'Production environment is rejected by the local-only variant gate');
process.env.SUPABASE_ENV = 'local';

await admin.from('career_targeted_variants').delete().eq('owner_user_id', a.user.id);
for (const id of profileIds) await userAClient.from('career_profiles').delete().eq('id', id);
await admin.from('career_studio_rollout_users').delete().eq('user_id', a.user.id);
await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
console.log('Local CV targeted variant API tests passed: ownership, private analysis, Pro gate, no URL fetch, immutable Base CV, idempotency, and delete isolation.');
