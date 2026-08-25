import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRoleKey) throw new Error('Local contact persistence test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url)) throw new Error('Safety stop: contact persistence accepts only Supabase Local.');

process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.VITE_SUPABASE_ENV = 'local';
const { supabase } = await import('../src/services/SupabaseClient.js');
const { createInitialSupabasePortfolio, createPortfolio, loadUserPortfoliosFromSupabase } = await import('../src/services/DBService.js');
const { normalizeCareerProfile } = await import('../src/services/CareerProfileService.js');

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const email = `contact-regression-${suffix}@example.test`;
const password = `LocalOnly-Contact-${suffix}!`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Synthetic Contact User' } });
assert.ifError(created.error);
const user = created.data.user;
const profileId = `cp_contact_${suffix}`;
const portfolioIds = [];

try {
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);

  // Real local initial creation followed by the first Save Draft for the same
  // id. The second call must be an ownership-safe update/upsert, not a duplicate insert.
  const initial = await createInitialSupabasePortfolio(user);
  portfolioIds.push(initial.id);
  const saved = await createPortfolio({
    id: initial.id,
    name: 'Synthetic Contact Portfolio',
    profession: 'Frontend Developer',
    bio: 'Local contact persistence fixture',
    social: { email: 'portfolio@example.test', phone: '+20 100 000 0000', github: 'https://github.com/example' }
  });
  assert.equal(saved.id, initial.id);

  const row = await admin.from('portfolios').select('id,owner_user_id,master_profile_json').eq('id', initial.id).single();
  assert.ifError(row.error);
  assert.equal(row.data.owner_user_id, user.id);
  assert.equal(row.data.master_profile_json.social.email, 'portfolio@example.test');
  assert.equal(row.data.master_profile_json.social.phone, '+20 100 000 0000');

  const loaded = await loadUserPortfoliosFromSupabase(user);
  assert.equal(loaded.social.email, 'portfolio@example.test');
  assert.equal(loaded.social.phone, '+20 100 000 0000');

  const cvContent = {
    contact: { name: 'Synthetic Contact User', email: 'cv@example.test', phone: '+20 111 111 1111', location: 'Cairo' },
    summary: 'Original CV summary', skills: ['JavaScript'], experience: [], education: [], projects: []
  };
  const cv = await supabase.from('career_profiles').upsert({
    id: profileId, owner_user_id: user.id, label: 'Synthetic Contact CV', career_stage: 'professional', content_json: cvContent
  }, { onConflict: 'id' }).select().single();
  assert.ifError(cv.error);
  const serverCv = await supabase.from('career_profiles').select('id,owner_user_id,content_json').eq('id', profileId).single();
  assert.ifError(serverCv.error);
  const hydrated = normalizeCareerProfile({ id: serverCv.data.id, ownerUserId: serverCv.data.owner_user_id, content: serverCv.data.content_json, careerStage: 'professional' }, user.id);
  assert.equal(hydrated.content.contact.email, 'cv@example.test');
  assert.equal(hydrated.content.contact.phone, '+20 111 111 1111');
  const edited = normalizeCareerProfile({ ...hydrated, content: { ...hydrated.content, summary: 'Edited CV summary' } }, user.id);
  assert.equal(edited.content.summary, 'Edited CV summary');
  assert.equal(edited.content.contact.email, 'cv@example.test');
  assert.equal(edited.content.contact.phone, '+20 111 111 1111');

  console.log('Local contact persistence test passed: CV contacts hydrate after reload/edit, Portfolio social contact persists, and duplicate Save Draft is idempotent.');
} finally {
  await supabase.auth.signOut();
  await admin.from('career_documents').delete().eq('career_profile_id', profileId);
  await admin.from('career_profiles').delete().eq('id', profileId);
  for (const id of portfolioIds) {
    await admin.from('portfolio_variants').delete().eq('portfolio_id', id);
    await admin.from('portfolio_creation_history').delete().eq('portfolio_id', id);
    await admin.from('portfolios').delete().eq('id', id);
  }
  await admin.auth.admin.deleteUser(user.id);
}
