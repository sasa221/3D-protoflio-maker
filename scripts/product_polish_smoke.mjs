import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.UX_BASE_URL || 'http://127.0.0.1:5190';
const out = process.env.UX_SCREENSHOT_DIR || 'docs/product-polish/before';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const consoleIssues = [];
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') consoleIssues.push(`${msg.type()}: ${msg.text()}`); });
page.on('pageerror', err => consoleIssues.push(`pageerror: ${err.message}`));
const routes = [
  ['home', '/'], ['pricing', '/pricing'], ['login', '/login'], ['cv', '/cv/new'], ['studio', '/studio']
];
for (const [name, path] of routes) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${name}-desktop.png`, fullPage: true });
  console.log(`${name}: title=${await page.title()} height=${await page.evaluate(() => document.documentElement.scrollHeight)} issues=${consoleIssues.length}`);
}
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
const demo = page.locator('[data-landing-demo-placeholder]');
console.log(`home-demo-placeholder=${await demo.count()} live-label=${await page.locator('#hero-demo').getByText('3D LIVE').count()}`);
const homeMetrics = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, viewport: window.innerHeight, sections: document.querySelectorAll('section').length }));
assert.ok(homeMetrics.scrollHeight > homeMetrics.viewport * 2, 'Landing page must expose its full document scroll');
assert.ok(homeMetrics.sections >= 8, 'Landing page sections must not be clipped');
assert.equal(await page.locator('[data-load-landing-demo]').count(), 1, 'Landing demo must expose a usable load action');
assert.equal(await page.locator('[data-load-landing-demo]').isEnabled(), true, 'Landing demo action must not be inert');
await page.locator('[data-load-landing-demo]').click();
await page.waitForTimeout(900);
assert.equal(await page.locator('#landing-demo-state').textContent(), '⚡ 3D LIVE', 'Demo should report its loaded state');
assert.equal(await page.locator('[data-landing-demo-placeholder]').count(), 0, 'Demo placeholder should be replaced after loading');
await page.setViewportSize({ width: 390, height: 844 });
for (const [name, path] of [['home', '/'], ['pricing', '/pricing'], ['login', '/login'], ['cv', '/cv/new']]) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${name}-mobile.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${name}-mobile: overflow=${overflow}`);
}
await page.goto(`${base}/login?next=%2Fcv%2Fnew`, { waitUntil: 'networkidle' });
assert.match(await page.locator('#login-btn').textContent(), /CV Builder/, 'Auth CTA should describe the requested destination');
await page.locator('#tab-signup').click();
const signupMetrics = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, viewport: window.innerHeight, overflow: getComputedStyle(document.body).overflowY }));
assert.ok(signupMetrics.scrollHeight >= signupMetrics.viewport, 'Signup form must remain reachable on short screens');
assert.notEqual(signupMetrics.overflow, 'hidden', 'Signup form must allow document scrolling');
console.log(`console-issues=${JSON.stringify(consoleIssues.slice(0, 20))}`);
await browser.close();
