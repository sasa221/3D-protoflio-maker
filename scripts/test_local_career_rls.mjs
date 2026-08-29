import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local RLS test requires local URL, anon key, and service role key supplied in process environment.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: RLS test accepts only Supabase Local at 127.0.0.1:54321.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const clients = [];
const testSuffix = Date.now();
const users = [
  { email: `career-a-${testSuffix}@example.test`, password: 'LocalOnly-A-123!' },
  { email: `career-b-${testSuffix}@example.test`, password: 'LocalOnly-B-123!' }
];

async function createTestUser(credentials) {
  const { data, error } = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
  assert.ifError(error);
  return data.user;
}

async function clientFor(credentials) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword(credentials);
  assert.ifError(error);
  assert.ok(data.session?.access_token);
  clients.push({ client, user: data.user });
  return clients.at(-1);
}

const userA = await createTestUser(users[0]);
const userB = await createTestUser(users[1]);
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: userA.id, enabled: true })).error);
const a = await clientFor(users[0]);
const b = await clientFor(users[1]);

const profile = {
  id: `cp_rls_${testSuffix}`,
  owner_user_id: userA.id,
  label: 'Local RLS Profile A',
  career_stage: 'student',
  content_json: { contact: { name: 'Synthetic User A' } }
};
let result = await a.client.from('career_profiles').insert(profile).select().single();
assert.ifError(result.error);
assert.equal(result.data.owner_user_id, userA.id);

result = await a.client.from('career_profiles').select('*').eq('id', profile.id).single();
assert.ifError(result.error);
assert.equal(result.data.label, profile.label);

result = await a.client.from('career_profiles').update({ label: 'Updated Local Profile A' }).eq('id', profile.id).select().single();
assert.ifError(result.error);
assert.equal(result.data.label, 'Updated Local Profile A');

result = await b.client.from('career_profiles').select('*').eq('id', profile.id);
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not read User A profile');

result = await b.client.from('career_profiles').update({ label: 'Cross-account write' }).eq('id', profile.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not update User A profile');

result = await b.client.from('career_profiles').delete().eq('id', profile.id).select();
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not delete User A profile');

result = await a.client.from('career_documents').insert({ id: `cv_rls_${testSuffix}`, career_profile_id: profile.id, owner_user_id: userA.id, title: 'Synthetic CV A' }).select().single();
assert.ifError(result.error);
assert.equal(result.data.owner_user_id, userA.id);
result = await b.client.from('career_documents').select('*').eq('career_profile_id', profile.id);
assert.ifError(result.error);
assert.equal(result.data.length, 0, 'User B must not read User A CV');

const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
result = await anon.from('career_profiles').select('*').eq('id', profile.id);
// PostgREST may represent RLS denial as either SQLSTATE 42501 or an empty
// result, depending on the local gateway version. Both are safe as long as
// no profile row is returned to an anonymous caller.
assert.ok(result.error?.code === '42501' || !result.data?.length, 'Anonymous client must be denied table access');

// Service role is used only by this local fixture to create/delete test users;
// CV runtime and browser code never receives it. Owner A performs row cleanup
// through the same RLS path a real user would use.
await a.client.from('career_documents').delete().eq('id', `cv_rls_${testSuffix}`);
await a.client.from('career_profiles').delete().eq('id', profile.id);
await admin.from('career_studio_rollout_users').delete().eq('user_id', userA.id);
await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
for (const entry of clients) await entry.client.auth.signOut();
await admin.auth.admin.deleteUser(userA.id);
await admin.auth.admin.deleteUser(userB.id);
console.log('Local Career RLS tests passed: owner CRUD, cross-account isolation, anonymous denial, CV isolation, and local service-role cleanup.');
