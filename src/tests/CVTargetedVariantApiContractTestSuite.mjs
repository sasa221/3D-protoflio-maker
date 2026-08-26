import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../../api/portfolio.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260825043000_career_targeted_variants.sql', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../ui/CVTargetedVariantsPanel.js', import.meta.url), 'utf8');

for (const action of ['cv-variant-analyze', 'cv-variant-create', 'cv-variants', 'cv-variant-delete']) assert.match(api, new RegExp(action));
assert.doesNotMatch(api, /Targeted CV Variants are local-only/);
assert.match(api, /Targeted CV Variants require a Pro entitlement/);
assert.match(api, /isCareerStudioUserAllowed/);
assert.match(api, /career_targeted_variants/);
assert.match(api, /owner_user_id/);
assert.match(api, /jobUrl.*external Job URL fetching is disabled/s);
assert.doesNotMatch(api, /career_targeted_variants[\s\S]{0,3000}console\.(log|warn|error)/);
assert.match(migration, /ALTER TABLE public\.career_targeted_variants ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON public\.career_targeted_variants FROM anon, authenticated/);
assert.doesNotMatch(migration, /CREATE POLICY/);
assert.match(ui, /Your main CV will not change/);
assert.match(ui, /2\. Job description/);
assert.match(ui, /evidence_found/);
assert.match(ui, /Pro entitlement/);
assert.doesNotMatch(ui, /local Pro entitlement/);
assert.doesNotMatch(ui, /Fetch Posting|extract-job|jobUrl/);

console.log('CVTargetedVariantApiContractTestSuite: passed (server flag, rollout/Pro gate, private ownership API, no URL fetch/public route, RLS isolation, and truthful UI).');
