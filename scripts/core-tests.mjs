import assert from 'node:assert/strict';
import { runCVParserTestSuite } from '../src/tests/CVParserFixtures.js';
import { runJobTargetingTestSuite } from '../src/tests/JobMatcherFixtures.js';
import { getThemeById } from '../src/three/ProceduralTheme.js';
import { EntitlementService, PLAN_CONFIG } from '../src/services/EntitlementService.js';
import { PRODUCT_CONFIG } from '../src/config/ProductConfig.js';
import { generatePortfolioCSS } from '../src/renderer/PortfolioRenderer.js';

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
const supabaseProEntitlements = new EntitlementService();
supabaseProEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });
assert.equal(supabaseProEntitlements.getPlanId(), 'pro', 'Supabase plan_id must activate Pro entitlements in Studio');
assert.equal(supabaseProEntitlements.getLimit('exportsPerMonth'), -1, 'Supabase Pro users must receive unlimited exports');
assert.equal(supabaseProEntitlements.getLimit('customDomains'), 3, 'Supabase Pro users must receive custom-domain capacity');
const publishedThemeCss = generatePortfolioCSS(getThemeById('aperture'));
assert.match(publishedThemeCss, /\.portfolio-navbar/, 'Published portfolio CSS must include the complete layout system');
assert.match(publishedThemeCss, /--primary:\s*#[0-9a-f]{6}/i, 'Theme numeric colors must serialize to valid CSS colors');

console.log(`Core checks passed: ${cvResults.length} CV fixture(s), ${jobResults.length} job matcher case(s), theme and plan invariants.`);
