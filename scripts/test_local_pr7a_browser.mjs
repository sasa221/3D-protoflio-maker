import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, 'tmp', 'pr7a-browser');
const htmlPath = path.join(tmpDir, 'index.html');
const homePath = path.join(tmpDir, 'home.html');
const port = 5175;
const qualityScreenshotPath = process.env.CV_QUALITY_SMOKE_SCREENSHOT || path.join(root, 'docs', 'pr7a-quality-check.png');
const homeScreenshotPath = process.env.CV_HOME_SMOKE_SCREENSHOT || path.join(root, 'docs', 'pr7a-home.png');

await fs.mkdir(tmpDir, { recursive: true });
await fs.writeFile(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body style="margin:0"><main id="root"></main><script type="module">import { renderCVBuilderPage } from '/src/ui/CVBuilderPage.js'; renderCVBuilderPage(document.querySelector('#root'), { ownerUserId: 'pr7a-browser-user', openImport: true });</script></body></html>`);
await fs.writeFile(homePath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body style="margin:0"><main id="app"></main><script type="module">import { renderLandingPage } from '/src/ui/LandingPage.js'; renderLandingPage(document.querySelector('#app'));</script></body></html>`);
execFileSync(process.execPath, [path.join(root, 'scripts', 'assert_local_safety.mjs')], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-smoke-key' }, stdio: 'ignore' });
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'development', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, env: { ...process.env, VITE_FF_CAREER_STUDIO: 'true', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-smoke-key' }, stdio: 'ignore' });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/tmp/pr7a-browser/index.html`)).ok) break; } catch (_) { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/tmp/pr7a-browser/index.html`, { waitUntil: 'networkidle' });
  await page.locator('[data-import-file]').waitFor({ state: 'attached', timeout: 10000 });
  await page.locator('[data-import-close]').click();
  await page.locator('#cv-quality-title').waitFor({ state: 'visible' });
  if (!/CV completeness check/i.test(await page.locator('#cv-quality-title').innerText())) throw new Error('Quality checklist title is missing.');
  await page.locator('[name="careerStage"]').selectOption('student');
  if (!/Education.*Projects.*Training.*Skills/i.test(await page.locator('#cv-stage-guidance').innerText())) throw new Error('Student guidance is missing.');
  await page.locator('[data-cv-quality-fix="education"]').click();
  if (!await page.evaluate(() => document.activeElement?.closest?.('[data-collection="education"]') !== null)) throw new Error('Fix this did not focus Education.');
  await page.screenshot({ path: qualityScreenshotPath, fullPage: true });
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`Horizontal overflow at ${viewport.width}px.`);
  }
  if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
  const home = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const homeErrors = [];
  home.on('console', message => { if (message.type() === 'error') homeErrors.push(message.text()); });
  home.on('pageerror', error => homeErrors.push(error.message));
  await home.goto(`http://127.0.0.1:${port}/tmp/pr7a-browser/home.html`, { waitUntil: 'domcontentloaded' });
  const hero = home.locator('[data-career-hero]');
  await hero.waitFor({ state: 'visible', timeout: 15000 });
  const portfolioHref = await home.locator('[data-career-cta="portfolio"]').getAttribute('href');
  const buildHref = await home.locator('[data-career-cta="cv"]').getAttribute('href');
  const importHref = await home.locator('[data-career-cta="import"]').getAttribute('href');
  if (portfolioHref !== '/login?next=%2Fstart' || buildHref !== '/login?next=%2Fcv%2Fnew' || importHref !== '/login?next=%2Fcv%2Fnew%3Fmode%3Dimport') throw new Error(`Unexpected unauthenticated Home paths: ${portfolioHref} / ${buildHref} / ${importHref}`);
  if (!/Build My Portfolio/.test(await home.locator('[data-career-cta="portfolio"]').innerText()) || !/Build My CV/.test(await home.locator('[data-career-cta="cv"]').innerText()) || !/Import Existing CV/.test(await home.locator('[data-career-cta="import"]').innerText())) throw new Error('Portfolio-first Home CTA hierarchy is incomplete.');
  await home.screenshot({ path: homeScreenshotPath, fullPage: false });
  if (homeErrors.length) throw new Error(`Home browser console errors: ${homeErrors.join(' | ')}`);
  await home.close();
  console.log(`test_local_pr7a_browser: passed (Home CTA/auth paths, Import CTA, Portfolio CTA, auto-open import, checklist, Student guidance, Fix this focus, 1440/1024/390px, screenshots docs/pr7a-home.png + docs/pr7a-quality-check.png).`);
} finally {
  await browser.close();
  if (server.pid) {
    try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (_) { /* already closed */ }
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
}
