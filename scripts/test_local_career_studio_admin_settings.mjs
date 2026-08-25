import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local Career Studio admin test requires local Supabase credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: admin settings tests accept only Supabase Local.');
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SECRET_KEY = serviceRoleKey;
process.env.SUPABASE_ENV = 'local';
process.env.FF_CAREER_STUDIO = 'true';

const { default: handler } = await import('../api/admin.js');
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const credentials = (name) => ({ email: `career-admin-${name}-${suffix}@example.test`, password: `LocalOnly-Admin-${name}-123!` });
const created = [];
// Keep the fixture deterministic when a previous local run was interrupted.
const staleAudit = await admin.from('career_studio_admin_audit_log').delete().gte('id', 0);
assert.ifError(staleAudit.error);

async function createUser(name) {
  const { data, error } = await admin.auth.admin.createUser({ ...credentials(name), email_confirm: true });
  assert.ifError(error);
  created.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await client.auth.signInWithPassword(credentials(name));
  assert.ifError(session.error);
  return { user: data.user, token: session.data.session.access_token };
}

function call(method, action, token, body = {}, query = {}) {
  let payload;
  const req = { method, query: { action, ...query }, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { payload = value; return this; }, end() {} };
  return handler(req, res).then(() => ({ status: res.code || 200, body: payload }));
}

const adminEmail = credentials('allowed').email;
process.env.ADMIN_EMAILS = adminEmail;
const allowed = await createUser('allowed');
const regular = await createUser('regular');

let result = await call('GET', 'career-settings', regular.token);
assert.equal(result.status, 403, 'regular users cannot read settings');
result = await call('GET', 'career-settings-audit', regular.token);
assert.equal(result.status, 403, 'regular users cannot read settings audit');

result = await call('GET', 'career-settings', allowed.token);
assert.equal(result.status, 200);
assert.deepEqual(result.body.settings.map(({ template_id }) => template_id), ['ats-basic']);
assert.equal('content_json' in result.body, false);
assert.equal('email' in result.body, false);
assert.equal('phone' in result.body, false);

const before = await admin.from('cv_template_settings').select('enabled,free_export_limit').eq('template_id', 'ats-basic').single();
assert.ifError(before.error);
result = await call('POST', 'career-settings-update', allowed.token, { templateId: 'not-allowed', enabled: true, freeExportLimit: 4 });
assert.equal(result.status, 400);
result = await call('POST', 'career-settings-update', allowed.token, { templateId: 'ats-basic', enabled: true, freeExportLimit: 4 });
assert.equal(result.status, 200);
assert.equal(result.body.setting.free_export_limit, 4);

const after = await admin.from('cv_template_settings').select('enabled,free_export_limit').eq('template_id', 'ats-basic').single();
assert.ifError(after.error);
assert.equal(after.data.free_export_limit, 4);
const audit = await call('GET', 'career-settings-audit', allowed.token);
assert.equal(audit.status, 200);
assert.ok(audit.body.logs.length >= 1);
for (const row of audit.body.logs) {
  assert.deepEqual(Object.keys(row).sort(), ['action', 'admin_user_id', 'created_at', 'limit_value', 'result', 'template_id'].sort());
  assert.equal(row.admin_user_id, allowed.user.id);
  assert.equal('email' in row, false);
  assert.equal('phone' in row, false);
  assert.equal('content_json' in row, false);
}

result = await call('POST', 'career-settings-update', allowed.token, { templateId: 'ats-basic', enabled: true, freeExportLimit: -1 });
assert.equal(result.status, 400);
const unchanged = await admin.from('cv_template_settings').select('free_export_limit').eq('template_id', 'ats-basic').single();
assert.equal(unchanged.data.free_export_limit, 4, 'invalid update leaves setting unchanged');

const directRegular = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${regular.token}` } } });
const directRead = await directRegular.from('cv_template_settings').select('*');
assert.ok(directRead.error || directRead.data?.length === 0, 'regular direct table read is denied');
const directAudit = await directRegular.from('career_studio_admin_audit_log').select('*');
assert.ok(directAudit.error || directAudit.data?.length === 0, 'regular direct audit read is denied');

process.env.FF_CAREER_STUDIO = 'false';
result = await call('GET', 'career-settings', allowed.token);
assert.equal(result.status, 404, 'feature flag hides Career Studio settings');
process.env.FF_CAREER_STUDIO = 'true';
process.env.SUPABASE_ENV = 'production';
result = await call('GET', 'career-settings', allowed.token);
assert.equal(result.status, 403, 'production environment is rejected by the local-only settings gate');
process.env.SUPABASE_ENV = 'local';

await admin.from('career_studio_admin_audit_log').delete().eq('admin_user_id', allowed.user.id);
for (const id of created) await admin.auth.admin.deleteUser(id);
console.log('Local Career Studio admin settings tests passed: server authorization, local feature gate, atomic RPC update, metadata-only audit, and direct RLS denial.');
