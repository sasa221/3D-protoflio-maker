import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_LOCAL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local CV sync API test requires local Supabase credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: CV sync API test accepts only Supabase Local.');
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.SUPABASE_ENV = 'local';
process.env.FF_CAREER_STUDIO = 'true';

const { default: handler } = await import('../api/portfolio.js');
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const credentials = id => ({ email: `cv-sync-${id}-${suffix}@example.test`, password: `LocalOnly-Sync-${id}-123!` });
const users = [];
const sql = postgres(dbUrl, { max: 1 });
let createdFixtureTable = false;

async function ensureFixtureTable() {
  const probe = await admin.from('portfolios').select('id').limit(1);
  if (!probe.error) return;
  if (probe.error.code !== 'PGRST205') throw probe.error;
  await sql.unsafe(`
    CREATE TABLE public.portfolios (id TEXT PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', master_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
    ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO service_role;
    CREATE POLICY "local sync owner access" ON public.portfolios FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
  `);
  createdFixtureTable = true;
}

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
  let payload;
  const req = { method: 'POST', query: { action: 'cv-sync' }, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { payload = value; return this; }, end() {} };
  return handler(req, res).then(() => ({ status: res.code || 200, body: payload }));
}

await ensureFixtureTable();
const a = await createUser('a');
const b = await createUser('b');
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: a.user.id, enabled: true })).error);
const profileId = `cp_sync_api_${suffix}`;
const portfolioId = `pf_sync_api_${suffix}`;
const profileResult = await a.client.from('career_profiles').insert({ id: profileId, owner_user_id: a.user.id, label: 'Synthetic Sync CV', career_stage: 'professional', content_json: { contact: { name: 'Candidate A' } } });
assert.ifError(profileResult.error);
const portfolioResult = await a.client.from('portfolios').insert({ id: portfolioId, owner_user_id: a.user.id, name: 'Existing Portfolio', slug: `sync-${suffix}`, bio: 'Existing bio', master_profile_json: { name: 'Existing Portfolio', bio: 'Existing bio', skills: [{ name: 'JavaScript' }], portfolioVariants: [{ id: 'keep-me' }] } });
assert.ifError(portfolioResult.error);

let result = await call(a.token, { portfolioId, careerProfileId: profileId, sourceOwnerId: a.user.id, selectedFields: ['name', 'bio', 'skills'], patch: { name: 'Candidate A', bio: 'New CV summary', skills: [{ name: 'SQL' }] } });
assert.equal(result.status, 200);
assert.deepEqual(result.body.changedFields, ['skills'], 'existing scalar values remain untouched by default');
let stored = await admin.from('portfolios').select('master_profile_json').eq('id', portfolioId).single();
assert.ifError(stored.error);
assert.equal(stored.data.master_profile_json.name, 'Existing Portfolio');
assert.equal(stored.data.master_profile_json.skills.length, 2);

result = await call(a.token, { portfolioId, careerProfileId: profileId, sourceOwnerId: a.user.id, selectedFields: ['social.email'], patch: { social: { email: 'new@example.test' } } });
assert.equal(result.status, 400, 'sensitive sync requires explicit confirmation');
result = await call(b.token, { portfolioId, careerProfileId: profileId, sourceOwnerId: b.user.id, selectedFields: ['name'], patch: { name: 'HACKED' } });
assert.equal(result.status, 403, 'cross-account source/target must be denied');
result = await call('', { portfolioId, careerProfileId: profileId, selectedFields: ['name'], patch: { name: 'HACKED' } });
assert.equal(result.status, 401, 'anonymous sync must be denied');

await a.client.from('portfolios').delete().eq('id', portfolioId);
await a.client.from('career_profiles').delete().eq('id', profileId);
await admin.from('career_studio_rollout_users').delete().eq('user_id', a.user.id);
await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
for (const user of users) await admin.auth.admin.deleteUser(user.id);
if (createdFixtureTable) await sql.unsafe('DROP TABLE public.portfolios CASCADE');
await sql.end({ timeout: 1 });
console.log('Local CV sync API tests passed: source/target ownership, non-overwrite merge, sensitive confirmation, anonymous denial, and legacy-safe fixture cleanup.');
