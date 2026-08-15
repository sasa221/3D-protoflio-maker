import assert from 'node:assert/strict';
import { runCVParserTestSuite } from '../src/tests/CVParserFixtures.js';
import { runJobTargetingTestSuite } from '../src/tests/JobMatcherFixtures.js';
import { getThemeById } from '../src/three/ProceduralTheme.js';
import { PLAN_CONFIG } from '../src/services/EntitlementService.js';
import { PRODUCT_CONFIG } from '../src/config/ProductConfig.js';

const cvResults = await runCVParserTestSuite();
assert.ok(cvResults.length > 0, 'CV suite must include at least one fixture');
assert.ok(cvResults.every(result => result.passed), 'CV parser acceptance suite failed');

const jobResults = runJobTargetingTestSuite();
assert.ok(jobResults.every(result => result.passed), 'Job targeting acceptance suite failed');

assert.equal(getThemeById('cyber').id, 'hacker', 'Legacy cyber theme alias must resolve to Cyber Command');
assert.equal(getThemeById('hacker').name, 'Cyber Command');
assert.equal(PLAN_CONFIG.pro.priceMonthly, 12);
assert.equal(PLAN_CONFIG.pro.limits.variants, 5);
assert.equal(PLAN_CONFIG.pro.limits.customDomains, 3);
assert.match(PRODUCT_CONFIG.appDomain, /portfolio-maker-murex\.vercel\.app$/);

console.log(`Core checks passed: ${cvResults.length} CV fixture(s), ${jobResults.length} job matcher case(s), theme and plan invariants.`);
