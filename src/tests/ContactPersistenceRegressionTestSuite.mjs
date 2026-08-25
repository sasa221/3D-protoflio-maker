import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeCareerProfile } from '../services/CareerProfileService.js';
import { normalizePortfolioMasterProfile } from '../services/DBService.js';

const owner = 'synthetic-contact-owner';
const profile = normalizeCareerProfile({
  id: 'cp_contact_regression',
  ownerUserId: owner,
  label: 'Synthetic Contact CV',
  careerStage: 'professional',
  content: {
    contact: { name: 'Synthetic Candidate', email: 'candidate@example.test', phone: '+20 100 000 0000' },
    summary: 'Original summary'
  }
}, owner);

assert.equal(profile.content.contact.email, 'candidate@example.test');
assert.equal(profile.content.contact.phone, '+20 100 000 0000');
const edited = normalizeCareerProfile({ ...profile, content: { ...profile.content, summary: 'Edited summary' } }, owner);
assert.equal(edited.content.summary, 'Edited summary');
assert.equal(edited.content.contact.email, profile.content.contact.email, 'summary edits must preserve email');
assert.equal(edited.content.contact.phone, profile.content.contact.phone, 'summary edits must preserve phone');

const legacy = normalizePortfolioMasterProfile({ name: 'Synthetic Portfolio', email: 'legacy@example.test', phone: '+20 111 111 1111', social: { github: 'https://github.com/example' } });
assert.equal(legacy.social.email, 'legacy@example.test');
assert.equal(legacy.social.phone, '+20 111 111 1111');
assert.equal(legacy.social.github, 'https://github.com/example');

const dbService = await fs.readFile(new URL('../services/DBService.js', import.meta.url), 'utf8');
assert.match(dbService, /\.upsert\(row, \{ onConflict: 'id' \}\)/, 'portfolio autosave must use an idempotent upsert');
assert.match(dbService, /select\('id,owner_user_id'\)/, 'portfolio saves must preflight ownership');
assert.match(dbService, /portfolioInitializationInFlight/, 'initial portfolio creation must be single-flight per owner');
assert.doesNotMatch(dbService, /console\.warn\('Supabase createPortfolio insert error:/, 'duplicate insert warning path must be removed');
assert.match(dbService, /var_\$\{portfolioId\}_default/, 'new default variants must be portfolio-scoped');

console.log('ContactPersistenceRegressionTestSuite: passed (nested CV contacts, legacy portfolio contact normalization, ownership-safe idempotent saves).');
