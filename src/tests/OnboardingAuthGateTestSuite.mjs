import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../main.js', import.meta.url), 'utf8');
const landing = await readFile(new URL('../ui/LandingPage.js', import.meta.url), 'utf8');

const checks = [
  ['Start route checks the authenticated user before rendering onboarding', /if \(path === '\/start'\)[\s\S]*?getCurrentAuthUser\(\)[\s\S]*?renderOnboardingWizard/.test(main)],
  ['Unauthenticated Start redirects to login and preserves /start', /login\?next=\$\{encodeURIComponent\('\/start'\)\}/.test(main)],
  ['Landing Build buttons send visitors to login first', (landing.match(/login\?next=%2Fstart/g) || []).length >= 6],
  ['Verified users can still reach onboarding after login', /renderAuthPage\(\(\) => \{ window\.location\.href = '\/start'; \}\)/.test(main)]
];

for (const [name, passed] of checks) console.log(`${passed ? '✅' : '❌'} ${name}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\nOnboarding auth gate: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
