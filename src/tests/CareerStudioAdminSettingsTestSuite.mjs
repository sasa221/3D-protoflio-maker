import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../../api/admin.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../ui/CareerStudioAdminSettings.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260825032000_career_studio_admin_settings.sql', import.meta.url), 'utf8');

assert.match(api, /career-settings-update/);
assert.match(api, /admin_update_cv_template_setting/);
assert.match(api, /SUPABASE_ENV === 'local'/);
assert.match(api, /FF_CAREER_STUDIO/);
assert.doesNotMatch(api, /career-settings[^\n]*career_profiles/);
assert.doesNotMatch(api, /career-settings[^\n]*content_json/);
assert.match(ui, /free_export_limit/);
assert.match(ui, /Settings audit/);
assert.match(ui, /escapeHtml/);
assert.doesNotMatch(ui, /career_profiles|content_json|master_profile_json|phone|email/);
assert.match(migration, /REVOKE ALL ON public\.cv_template_settings FROM anon, authenticated/);
assert.match(migration, /REVOKE ALL ON public\.career_studio_admin_audit_log FROM anon, authenticated/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_update_cv_template_setting.*service_role/s);
assert.match(migration, /template_id <> 'ats-basic'/);

console.log('Career Studio admin settings contract tests passed: local gate, metadata-only API/UI, allow-listed template, and RLS grants.');
