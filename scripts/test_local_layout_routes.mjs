import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const localUrl = process.env.SUPABASE_LOCAL_URL;
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!localUrl || !anonKey || !serviceKey) throw new Error('Layout route test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(localUrl)) throw new Error('Safety stop: layout route test accepts Supabase Local only.');

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 5185;
const suffix = Date.now();
const credentials = { email: `layout-${suffix}@example.test`, password: 'LocalOnly-Layout-123!' };
const admin = createClient(localUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
assert.ifError(created.error);
const previousConfig = await admin.from('career_studio_rollout_config').select('enabled,access_mode,updated_by').eq('id', true).single();
assert.ifError(previousConfig.error);
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true, access_mode: 'all', updated_by: null }).eq('id', true)).error);

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'development', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  env: { ...process.env, VITE_FF_CAREER_STUDIO: 'true', VITE_SUPABASE_URL: localUrl, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey, VITE_SUPABASE_ENV: 'local' },
  stdio: 'ignore'
});
const browser = await chromium.launch({ headless: true });

try {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/login?next=%2Fstudio`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(credentials.email);
  await page.locator('#login-password').fill(credentials.password);
  await page.getByRole('button', { name: /Sign In to Studio/i }).click();
  await page.waitForURL('**/studio', { timeout: 15000 });
  await page.waitForSelector('#sidebar', { timeout: 15000 });

  const studio = await page.evaluate(() => {
    const box = selector => document.querySelector(selector)?.getBoundingClientRect();
    return { app: box('#app'), nav: box('.studio-product-nav'), sidebar: box('#sidebar'), preview: box('#preview-panel'), navPosition: getComputedStyle(document.querySelector('.studio-product-nav')).position };
  });
  assert.ok(studio.app.width >= 1435 && studio.app.left <= 2, 'Studio must span the viewport');
  assert.equal(studio.navPosition, 'fixed', 'Studio navigation must not become a third editor column');
  assert.ok(studio.sidebar.left <= 2, 'Studio sidebar must start at the left edge');
  assert.ok(studio.preview.right >= 1435, 'Studio preview must reach the right edge');

  await page.goto(`http://127.0.0.1:${port}/cv/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.career-studio-grid');
  const cv = await page.evaluate(() => ({
    appWidth: document.querySelector('#app').getBoundingClientRect().width,
    pageWidth: document.querySelector('.career-studio-page').getBoundingClientRect().width,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
    overflowY: getComputedStyle(document.body).overflowY,
    nameAlign: getComputedStyle(document.querySelector('.ats-paper h2')).textAlign
  }));
  assert.ok(cv.appWidth >= 1435 && cv.pageWidth >= 1435, 'CV Builder must span the viewport');
  assert.ok(cv.scrollHeight > cv.viewportHeight, 'CV Builder must have real document scroll');
  assert.equal(cv.overflowY, 'auto');
  assert.equal(cv.nameAlign, 'center');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  assert.ok((await page.evaluate(() => scrollY)) > 0, 'CV Builder must scroll to lower sections');

  await page.goto(`http://127.0.0.1:${port}/studio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sidebar');
  const returned = await page.evaluate(() => ({ overflow: getComputedStyle(document.body).overflow, sidebarLeft: document.querySelector('#sidebar').getBoundingClientRect().left, previewRight: document.querySelector('#preview-panel').getBoundingClientRect().right }));
  assert.equal(returned.overflow, 'hidden', 'returning to Studio must restore viewport lock');
  assert.ok(returned.sidebarLeft <= 2 && returned.previewRight >= 1435, 'CV to Studio transition must restore the two-panel layout');

  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`http://127.0.0.1:${port}/cv/new`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.career-studio-grid');
    const responsiveCv = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      columns: getComputedStyle(document.querySelector('.career-studio-grid')).gridTemplateColumns,
      scrollable: document.documentElement.scrollHeight > innerHeight
    }));
    assert.ok(responsiveCv.bodyWidth <= responsiveCv.viewportWidth + 1, `CV must not overflow horizontally at ${viewport.width}px`);
    assert.ok(responsiveCv.scrollable, `CV must remain vertically scrollable at ${viewport.width}px`);
    if (viewport.width === 390) assert.ok(!responsiveCv.columns.includes(' '), 'mobile CV must use one column');

    await page.goto(`http://127.0.0.1:${port}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#sidebar');
    const responsiveStudio = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth, sidebarWidth: document.querySelector('#sidebar').getBoundingClientRect().width }));
    assert.ok(responsiveStudio.bodyWidth <= responsiveStudio.viewportWidth + 1, `Studio must not overflow horizontally at ${viewport.width}px`);
    if (viewport.width === 390) assert.ok(responsiveStudio.sidebarWidth >= 389, 'mobile Studio editor must fill the viewport');
  }
  assert.deepEqual(errors, []);
  console.log('Local route layout passed: full-width Studio, fixed top navigation, scrollable CV, centered ATS header, CV → Studio reset, and 1024/390px responsive checks.');
} finally {
  await browser.close();
  server.kill('SIGTERM');
  await admin.from('career_studio_rollout_config').update(previousConfig.data).eq('id', true);
  await admin.auth.admin.deleteUser(created.data.user.id);
}
