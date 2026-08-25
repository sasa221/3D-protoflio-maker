import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../api/portfolio.js', import.meta.url), 'utf8');
assert.match(source, /if \(action === 'cv-sync'\)/);
assert.match(source, /sourceOwnerId !== userId/);
assert.match(source, /careerProfileId/);
assert.match(source, /owner_user_id.*userId/);
assert.match(source, /\.eq\('owner_user_id', userId\)/);
assert.match(source, /Sensitive CV fields require explicit confirmation/);
assert.match(source, /mergeSyncList/);
assert.match(source, /if \(next\[field\] && !overwriteExisting\)/);
assert.match(source, /if \(!isServerFeatureEnabled\('CAREER_STUDIO'\)\)/);
assert.doesNotMatch(source, /cv-sync[\s\S]{0,12000}portfolio_variants.*delete/i);
console.log('CVPortfolioSyncApiContractTestSuite: passed (feature gate, source/target ownership checks, sensitive opt-in, non-destructive server merge)');

