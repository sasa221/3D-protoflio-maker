import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
const landing = await readFile(new URL('../ui/LandingPage.js', import.meta.url), 'utf8');

const checks = [
  ['Start route checks the authenticated user before rendering onboarding', /if \(path === '\/start'\)[\s\S]*?getCurrentAuthUser\(\)[\s\S]*?renderOnboardingWizard/.test(main)],
  ['Unauthenticated Start redirects to login and preserves /start', /login\?next=\$\{encodeURIComponent\('\/start'\)\}/.test(main)],
  ['Landing Free CTA still sends visitors to login and onboarding', (landing.match(/login\?next=%2Fstart/g) || []).length >= 3],
  ['Landing paid CTAs go to the selected plan checkout after auth', /planCheckoutPath\('pro'\)/.test(landing) && /planCheckoutPath\('premium'\)/.test(landing) && /pricing\?plan=\$\{planId\}/.test(landing)],
  ['Verified users can still reach onboarding after login', /renderAuthPage\(\(\) => \{ window\.location\.href = '\/start'; \}\)/.test(main)],
  ['Existing portfolio owners are sent to Studio instead of onboarding', /const existingPortfolio = await loadUserPortfoliosFromSupabase\(startUser\)[\s\S]*?if \(existingPortfolio\?\.id\)[\s\S]*?window\.location\.href = '\/studio';/.test(main)]
];

for (const [name, passed] of checks) console.log(`${passed ? '✅' : '❌'} ${name}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\nOnboarding auth gate: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
