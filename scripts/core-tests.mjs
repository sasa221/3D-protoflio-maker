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
import { calculatePortfolioQualityScore } from '../src/ui/PortfolioQualityScore.js';

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

// 3b. Portfolio readiness checklist invariants (plan-neutral)
assert.equal(calculatePortfolioQualityScore({}).score, 0);
assert.equal(calculatePortfolioQualityScore({
  name: 'Alex', profession: 'Engineer', bio: 'Builds useful products', avatar: 'avatar.webp',
  skills: ['JavaScript', 'React', 'CSS'], projects: [{ name: 'Site' }], experience: [{ role: 'Engineer' }],
  social: { email: 'alex@example.com' }, resume: { url: 'resume.pdf' }, theme: 'code', slug: 'alex'
}).score, 100);

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
assert.equal(INSTAPAY_CONFIG.isConfigured, false, 'Payment UI must fail closed without a server response');
assert.equal(INSTAPAY_CONFIG.displayName, '');
assert.equal(INSTAPAY_CONFIG.instapayAddress, '');
assert.equal(INSTAPAY_CONFIG.phoneNumber, '');

// 6. Security Invariants
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  assert.ok(!envText.includes('VITE_NETLIFY_TOKEN'), 'VITE_NETLIFY_TOKEN must not exist in .env');
}
const deployServiceText = fs.readFileSync(path.join(rootDir, 'src/services/DeployService.js'), 'utf8');
assert.ok(!deployServiceText.includes('import.meta.env.VITE_NETLIFY_TOKEN'), 'DeployService must not import VITE_NETLIFY_TOKEN');

// 7. Exactly 6 Serverless Functions
const apiFiles = fs.readdirSync(path.join(rootDir, 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
assert.equal(apiFiles.length, 6, `Expected exactly 6 api functions, found ${apiFiles.length}`);

// 8. SEO Structured Data
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert.ok(!indexHtml.includes('"priceCurrency":"USD"'), 'index.html structured data must not have USD');
assert.ok(indexHtml.includes('"priceCurrency":"EGP"'), 'index.html structured data must have EGP');

// 9. Job Fit Title-Alone No Score Rule & 10 Adversarial Truthfulness Tests (§18)
const jobAnalyzer = new JobAnalyzerService();

for (const [phrase, expectedYears] of [
  ['Minimum 2 years', 2],
  ['2+ years', 2],
  ['at least 3 years', 3],
  ['3 years of frontend development experience', 3]
]) {
  assert.equal(
    jobAnalyzer._extractExperienceYears(phrase),
    expectedYears,
    `Job Fit experience parser must extract ${expectedYears} from "${phrase}"`
  );
}

// TEST 1: Nonsense Arabic input ("بحبك")
const t1Job = jobAnalyzer.analyzeJobTarget({ role: '', jobDescription: 'بحبك' });
assert.equal(t1Job.hasRequirements, false, 'TEST 1: "بحبك" must not produce requirements');
assert.equal(t1Job.confidence, 'INSUFFICIENT');
const t1Match = matchPortfolioToJob({ skills: [{ name: 'JavaScript' }] }, t1Job);
assert.equal(t1Match.hasRequirements, false);
assert.equal(t1Match.matchScore, 0);
assert.equal(t1Match.verdict, 'NO REQUIREMENTS');

// TEST 2: Nonsense phrase ("I love you")
const t2Job = jobAnalyzer.analyzeJobTarget({ role: '', jobDescription: 'I love you' });
assert.equal(t2Job.hasRequirements, false, 'TEST 2: "I love you" must produce no score');
assert.equal(matchPortfolioToJob({}, t2Job).matchScore, 0);

// TEST 3: Generic title alone ("sales")
const t3Job = jobAnalyzer.analyzeJobTarget({ role: 'sales', jobDescription: '' });
assert.equal(t3Job.hasRequirements, false, 'TEST 3: "sales" title alone must produce no score');
assert.equal(matchPortfolioToJob({}, t3Job).matchScore, 0);

// TEST 4: Vague sentence without qualifications
const t4Job = jobAnalyzer.analyzeJobTarget({
  role: 'Web Builder',
  jobDescription: 'Need someone to create a simple landing page for my business.'
});
assert.equal(t4Job.hasRequirements, false, 'TEST 4: Vague sentence without qualifications must produce no score');
assert.equal(matchPortfolioToJob({}, t4Job).matchScore, 0);

// TEST 5: Missing stack & experience (NOT High Fit)
const t5Job = jobAnalyzer.analyzeJobTarget({
  role: 'Frontend Developer',
  jobDescription: 'Required: React, TypeScript, Git. Minimum 3 years frontend development.'
});
assert.equal(t5Job.hasRequirements, true);
const t5Candidate = {
  skills: [{ name: 'JavaScript' }, { name: 'HTML' }, { name: 'CSS' }],
  experience: [{ role: 'Junior Web Dev', duration: '2022 - 2024' }],
  projects: [{ name: 'Site', tech: 'HTML, CSS', description: 'Simple site' }]
};
const t5Fit = matchPortfolioToJob(t5Candidate, t5Job);
assert.ok(t5Fit.hasRequirements);
assert.ok(t5Fit.matchScore <= 50, `TEST 5: Expected matchScore <= 50, got ${t5Fit.matchScore}`);
assert.notEqual(t5Fit.verdict, 'STRONG FIT');
assert.ok(t5Fit.criticalGaps.some(g => g.skill === 'React'));
assert.ok(t5Fit.criticalGaps.some(g => g.skill === 'TypeScript'));

// TEST 6: Genuine Matching Portfolio
const t6Job = jobAnalyzer.analyzeJobTarget({
  role: 'Frontend Developer',
  jobDescription: 'Required: JavaScript, HTML5, CSS3. Minimum 2 years experience.'
});
assert.equal(t6Job.hasRequirements, true);
const t6Candidate = {
  skills: [{ name: 'JavaScript' }, { name: 'HTML5' }, { name: 'CSS3' }],
  experience: [{ role: 'Frontend Dev', duration: '2021 - 2024' }],
  projects: [{ name: 'Web App', tech: 'JavaScript, HTML5, CSS3', description: 'Interactive app' }]
};
const t6Fit = matchPortfolioToJob(t6Candidate, t6Job);
assert.ok(t6Fit.hasRequirements);
assert.ok(t6Fit.matchScore >= 85, `TEST 6: Expected matchScore >= 85, got ${t6Fit.matchScore}`);
assert.equal(t6Fit.verdict, 'STRONG FIT');
assert.equal(t6Fit.criticalGaps.length, 0);
assert.ok(t6Fit.matchedEvidence.length >= 3);

// TEST 7: No education specified -> Education is N/A
const t7Job = jobAnalyzer.analyzeJobTarget({
  role: 'Frontend Engineer',
  jobDescription: 'Required: JavaScript, React. Minimum 2 years experience.'
});
assert.equal(t7Job.requiredEducation, null);
const t7Fit = matchPortfolioToJob({ skills: [{ name: 'JavaScript' }, { name: 'React' }] }, t7Job);
const t7Edu = t7Fit.breakdown.find(c => c.category === 'Education');
assert.ok(t7Edu);
assert.equal(t7Edu.score, null, 'TEST 7: Education score must be null (N/A)');
assert.equal(t7Edu.scoreDisplay, 'N/A');
assert.equal(t7Edu.detail, 'Not specified by employer');

// TEST 8: No preferred skills specified -> N/A
const t8Job = jobAnalyzer.analyzeJobTarget({
  role: 'Frontend Engineer',
  jobDescription: 'Required: JavaScript, HTML5, CSS3. Minimum 2 years experience.'
});
assert.equal(t8Job.preferredSkills.length, 0);
const t8Fit = matchPortfolioToJob({ skills: [{ name: 'JavaScript' }] }, t8Job);
const t8Pref = t8Fit.breakdown.find(c => c.category === 'Preferred Skills');
assert.ok(t8Pref);
assert.equal(t8Pref.score, null);
assert.equal(t8Pref.scoreDisplay, 'N/A');

// TEST 9: 0 of 2 projects relevant -> Projects score = 0%
const t9Job = jobAnalyzer.analyzeJobTarget({
  role: 'Frontend Engineer',
  jobDescription: 'Required: React, TypeScript. Minimum 2 years experience.'
});
const t9Candidate = {
  skills: [{ name: 'JavaScript' }],
  experience: [{ role: 'Dev', duration: '2021 - 2023' }],
  projects: [
    { name: 'CLI Tool', tech: 'Python', description: 'Terminal script' },
    { name: 'Data Pipeline', tech: 'SQL', description: 'Database pipeline' }
  ]
};
const t9Fit = matchPortfolioToJob(t9Candidate, t9Job);
const t9Proj = t9Fit.breakdown.find(c => c.category === 'Projects & Evidence');
assert.ok(t9Proj);
assert.equal(t9Proj.score, 0, `TEST 9: Expected 0% for projects, got ${t9Proj.score}`);
assert.equal(t9Proj.scoreDisplay, '0%');

// TEST 10: No direct matches -> STRONG FIT is IMPOSSIBLE
const t10Job = jobAnalyzer.analyzeJobTarget({
  role: 'DevOps Engineer',
  jobDescription: 'Required: Kubernetes, Docker, AWS. Minimum 5 years cloud infrastructure experience.'
});
const t10Candidate = {
  skills: [{ name: 'Graphic Design' }, { name: 'Copywriting' }],
  experience: [{ role: 'Content Writer', duration: '2022 - 2023' }],
  projects: [{ name: 'Blog', tech: 'WordPress', description: 'Travel blog' }]
};
const t10Fit = matchPortfolioToJob(t10Candidate, t10Job);
assert.equal(t10Fit.matchedEvidence.length, 0);
assert.ok(t10Fit.matchScore <= 25, `TEST 10: Expected matchScore <= 25, got ${t10Fit.matchScore}`);
assert.equal(t10Fit.verdict, 'WEAK FIT');
assert.notEqual(t10Fit.verdict, 'STRONG FIT');

// 10. Manual Payment & Billing Invariants (§2, §6)
const billingApiContent = fs.readFileSync(path.join(rootDir, 'api/billing.js'), 'utf8');
assert.ok(billingApiContent.includes('final_expected_amount_egp'), 'api/billing.js must populate final_expected_amount_egp in insert');
assert.ok(billingApiContent.includes('expected_amount_egp'), 'api/billing.js must populate expected_amount_egp in insert');
assert.ok(billingApiContent.includes('discount_amount_egp'), 'api/billing.js must populate discount_amount_egp in insert');
assert.ok(billingApiContent.includes("We couldn't submit your payment request. Please try again."), 'api/billing.js must provide friendly customer error fallback');
assert.ok(!billingApiContent.includes('insertErr.message'), 'api/billing.js must not leak raw database insert errors to customer');

// 11. Admin Legacy Exemption UI Removal (§1)
const adminPageContent = fs.readFileSync(path.join(rootDir, 'src/AdminPage.js'), 'utf8');
assert.ok(!adminPageContent.includes('modal-btn-toggle-legacy'), 'AdminPage.js must not include modal-btn-toggle-legacy control');
assert.ok(!adminPageContent.includes('modal-legacy-reason'), 'AdminPage.js must not include modal-legacy-reason input');

console.log(`Core checks passed: ${cvResults.length} CV fixture(s), ${jobResults.length} job matcher case(s), 10 adversarial Job Fit tests, theme, pricing, payment server calculation, security, and launch invariants.`);
