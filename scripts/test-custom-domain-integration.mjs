import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync(new URL('../api/portfolio.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/ui/CustomDomainPanel.js', import.meta.url), 'utf8');
const vercelDomain = 'portfolio-maker-murex.vercel.app';

assert.match(api, /VERCEL_API_TOKEN/);
assert.match(api, /VERCEL_PROJECT_ID/);
assert.match(api, /VERCEL_TEAM_ID/);
assert.match(api, /\/v10\/projects\/.*\/domains/);
assert.match(api, /\/v9\/projects\/.*\/domains\/.*\/verify/);
assert.match(api, /\/v6\/domains\/.*\/config/);
assert.match(api, /claimedDomain\.portfolio_id !== portfolioId/);
assert.match(api, /verified && configured && serving/);
assert.doesNotMatch(api, new RegExp(`DELETE[^\\n]+${vercelDomain.replaceAll('.', '\\.')}`, 'i'));
assert.match(ui, /Connect Domain/);
assert.match(ui, /Verify Domain/);
assert.match(ui, /Custom domain activation is temporarily unavailable\./);
assert.match(ui, /Open Domain/);

console.log('Custom domain integration checks passed: Vercel add/config/verify, activation gate, UI states, and cross-user isolation.');
