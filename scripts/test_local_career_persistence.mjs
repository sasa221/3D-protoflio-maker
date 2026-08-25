import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local Career persistence test requires local Supabase credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: persistence test accepts only Supabase Local.');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const email = `career-persistence-${suffix}@example.test`;
const password = `LocalOnly-Persistence-${suffix}!`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Synthetic Persistence User' } });
assert.ifError(created.error);
const userId = created.data.user.id;
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: userId, enabled: true })).error);
const profileId = `cp_persist_${suffix}`;
const content = { contact: { name: 'Synthetic Persistence User' }, summary: 'Local server-backed CV', skills: ['JavaScript'] };
const owner = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
try {
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  const tokenClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const inserted = await tokenClient.from('career_profiles').upsert({ id: profileId, owner_user_id: userId, label: 'Synthetic Persistent CV', career_stage: 'professional', content_json: content }, { onConflict: 'id' }).select().single();
  assert.ifError(inserted.error);
  const document = await tokenClient.from('career_documents').upsert({ id: `cv_${profileId}`, career_profile_id: profileId, owner_user_id: userId, document_type: 'base_cv', title: 'Synthetic Persistent CV', template_id: 'ats-basic', content_override_json: content, status: 'draft' }, { onConflict: 'id' }).select().single();
  assert.ifError(document.error);
  await owner.auth.signOut();
  const secondSession = await owner.auth.signInWithPassword({ email, password });
  assert.ifError(secondSession.error);
  const secondClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${secondSession.data.session.access_token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const restored = await secondClient.from('career_profiles').select('id,owner_user_id,label,content_json').eq('id', profileId).single();
  assert.ifError(restored.error);
  assert.equal(restored.data.owner_user_id, userId);
  assert.equal(restored.data.content_json.summary, content.summary);
  const restoredDoc = await secondClient.from('career_documents').select('id,career_profile_id,content_override_json').eq('id', `cv_${profileId}`).single();
  assert.ifError(restoredDoc.error);
  assert.equal(restoredDoc.data.career_profile_id, profileId);
  assert.equal(restoredDoc.data.content_override_json.summary, content.summary);
  console.log('Local Career persistence test passed: logout/login reload restored profile and document from Supabase Local.');
} finally {
  await admin.from('career_documents').delete().eq('career_profile_id', profileId);
  await admin.from('career_profiles').delete().eq('id', profileId);
  await admin.from('career_studio_rollout_users').delete().eq('user_id', userId);
  await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
  await admin.auth.admin.deleteUser(userId);
}
