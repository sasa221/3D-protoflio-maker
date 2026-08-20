import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCVParserTestSuite } from '../src/tests/CVParserFixtures.js';
import { runJobTargetingTestSuite } from '../src/tests/JobMatcherFixtures.js';
import { runThemeCatalogIntegrityTestSuite } from '../src/tests/ThemeCatalogIntegrityTestSuite.mjs';
import { getThemeById } from '../src/three/ProceduralTheme.js';
import { EntitlementService, PLAN_CONFIG } from '../src/services/EntitlementService.js';
import { PLANS, GROUP_SEAT_PRICING, KEEP_IT_LIVE, INSTAPAY_CONFIG } from '../src/config/PlanConfig.js';
import { PRODUCT_CONFIG } from '../src/config/ProductConfig.js';
import { generatePortfolioCSS } from '../src/renderer/PortfolioRenderer.js';
import { JobAnalyzerService } from '../src/services/JobAnalyzerService.js';
import { matchPortfolioToJob } from '../src/services/PortfolioMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. CV Parser acceptance
const cvResults = await runCVParserTestSuite();
assert.ok(cvResults.length > 0, 'CV suite must include at least one fixture');
assert.ok(cvResults.every(result => result.passed), 'CV parser acceptance suite failed');

// 2. Job targeting acceptance
const jobResults = runJobTargetingTestSuite();
assert.ok(jobResults.every(result => result.passed), 'Job targeting acceptance suite failed');

// 3. 15-Theme catalog integrity
runThemeCatalogIntegrityTestSuite();

// 4. Invariants
assert.equal(getThemeById('cyber').id, 'hacker', 'Legacy cyber theme alias must resolve to Cyber Command');
assert.equal(getThemeById('hacker').name, 'Cyber Command');
assert.equal(PLAN_CONFIG.pro.priceMonthlyEGP, 600);
assert.equal(PLAN_CONFIG.pro.limits.variants, 5);
assert.match(PRODUCT_CONFIG.appDomain, /portfolio-maker-murex\.vercel\.app$/);

// 5. Commercial Pricing Invariants
assert.equal(PLANS.free.priceMonthlyEGP, 0);
assert.equal(PLANS.pro.priceMonthlyEGP, 600);
assert.equal(PLANS.premium.priceMonthlyEGP, 1000);
assert.equal(GROUP_SEAT_PRICING[2], 1800);
assert.equal(GROUP_SEAT_PRICING[3], 2550);
assert.equal(GROUP_SEAT_PRICING[4], 3200);
assert.equal(GROUP_SEAT_PRICING[5], 3750);
assert.equal(KEEP_IT_LIVE.priceAnnualPerPortfolioEGP, 500);
assert.equal(INSTAPAY_CONFIG.displayName, 'SALEH MOHAMED SALEH');
assert.equal(INSTAPAY_CONFIG.instapayAddress, 'saleh2005mohamed@instapay');
assert.equal(INSTAPAY_CONFIG.phoneNumber, '01270024222');

// 6. Security Invariants
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  assert.ok(!envText.includes('VITE_NETLIFY_TOKEN'), 'VITE_NETLIFY_TOKEN must not exist in .env');
}
const deployServiceText = fs.readFileSync(path.join(rootDir, 'src/services/DeployService.js'), 'utf8');
assert.ok(!deployServiceText.includes('import.meta.env.VITE_NETLIFY_TOKEN'), 'DeployService must not import VITE_NETLIFY_TOKEN');

// 7. Exactly 6 Serverless Functions
const apiFiles = fs.readdirSync(path.join(rootDir, 'api')).filter(f => f.endsWith('.js'));
assert.equal(apiFiles.length, 6, `Expected exactly 6 api functions, found ${apiFiles.length}`);

// 8. SEO Structured Data
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert.ok(!indexHtml.includes('"priceCurrency":"USD"'), 'index.html structured data must not have USD');
assert.ok(indexHtml.includes('"priceCurrency":"EGP"'), 'index.html structured data must have EGP');

// 9. Job Fit Title-Alone No Score Rule
const jobAnalyzer = new JobAnalyzerService();
const titleOnlyJob = jobAnalyzer.analyzeJobTarget({ role: 'Software Engineer', jobDescription: '' });
assert.equal(titleOnlyJob.hasRequirements, false, 'Title alone must not produce requirements');
const titleOnlyMatch = matchPortfolioToJob({}, titleOnlyJob);
assert.equal(titleOnlyMatch.hasRequirements, false);
assert.equal(titleOnlyMatch.matchScore, 0);

const supabaseProEntitlements = new EntitlementService();
supabaseProEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });
assert.equal(supabaseProEntitlements.getPlanId(), 'pro', 'Supabase plan_id must activate Pro entitlements in Studio');
assert.equal(supabaseProEntitlements.getLimit('exportsPerMonth'), -1, 'Supabase Pro users must receive unlimited exports');
const publishedThemeCss = generatePortfolioCSS(getThemeById('aperture'));
assert.match(publishedThemeCss, /\.portfolio-navbar/, 'Published portfolio CSS must include the complete layout system');
assert.match(publishedThemeCss, /--primary:\s*#[0-9a-f]{6}/i, 'Theme numeric colors must serialize to valid CSS colors');

console.log(`Core checks passed: ${cvResults.length} CV fixture(s), ${jobResults.length} job matcher case(s), theme, pricing, security, and launch invariants.`);
