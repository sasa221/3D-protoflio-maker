import assert from 'node:assert/strict';
import { applySelectedPortfolioSync, buildPortfolioSyncReview } from '../services/CVPortfolioSyncService.js';

const owner = 'user-sync-a';
const profile = {
  id: 'cp_sync_a', ownerUserId: owner, careerStage: 'professional',
  content: {
    contact: { name: 'Candidate A', email: 'a@example.test', phone: '+20 100', location: 'Cairo', github: 'https://github.com/a', linkedin: 'https://linkedin.com/in/a' },
    summary: 'Only the user-written summary.',
    skills: ['JavaScript', 'SQL'],
    education: [{ text: 'BSc Computer Science — University A' }],
    experience: [{ text: 'Internship at Company A' }],
    projects: [{ text: 'Project A' }]
  }
};
const portfolio = {
  id: 'pf_sync_a', owner_user_id: owner, name: 'Existing Portfolio', bio: 'Existing bio', location: 'Existing location',
  social: { email: 'existing@example.test' }, skills: [{ name: 'JavaScript' }],
  education: [{ degree: 'Existing degree' }], experience: [{ role: 'Existing role' }], projects: [{ name: 'Existing project' }],
  portfolioVariants: [{ id: 'var_keep', themeId: 'code' }]
};
const before = JSON.stringify(portfolio);
const review = buildPortfolioSyncReview({ careerProfile: profile, portfolio });
assert.equal(review.find(item => item.id === 'name').status, 'change');
assert.equal(review.find(item => item.id === 'social.email').sensitive, true);
assert.equal(review.every(item => item.defaultSelected === false), true, 'no field is selected by default');

assert.throws(() => applySelectedPortfolioSync({ careerProfile: profile, portfolio, selectedFields: ['social.email'], ownerUserId: owner }), /Sensitive/);
const noOverwrite = applySelectedPortfolioSync({ careerProfile: profile, portfolio, selectedFields: ['name', 'bio', 'social.email', 'skills', 'projects'], confirmSensitive: true, ownerUserId: owner });
assert.equal(noOverwrite.portfolio.name, 'Existing Portfolio', 'existing scalar remains unchanged by default');
assert.equal(noOverwrite.portfolio.bio, 'Existing bio', 'existing bio remains unchanged by default');
assert.equal(noOverwrite.portfolio.social.email, 'existing@example.test');
assert.equal(noOverwrite.portfolio.skills.length, 2, 'new skill is merged without deleting existing skills');
assert.equal(noOverwrite.portfolio.projects.length, 2, 'projects are appended, never replaced');
assert.equal(noOverwrite.portfolio.portfolioVariants[0].id, 'var_keep', 'variants remain untouched');
assert.equal(JSON.stringify(portfolio), before, 'review/apply never mutates the source Portfolio object');

const overwrite = applySelectedPortfolioSync({ careerProfile: profile, portfolio, selectedFields: ['name', 'bio'], overwriteExisting: true, ownerUserId: owner });
assert.equal(overwrite.portfolio.name, 'Candidate A');
assert.equal(overwrite.portfolio.bio, 'Only the user-written summary.');
assert.throws(() => applySelectedPortfolioSync({ careerProfile: profile, portfolio, selectedFields: ['name'], ownerUserId: 'user-sync-b' }), /belong/);
console.log('CVPortfolioSyncServiceTestSuite: passed (review defaults, sensitive opt-in, non-destructive merge, variants preserved, ownership isolation)');

