import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const localUrl = process.env.SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Browser contact test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(localUrl)) throw new Error('Safety stop: browser contact test accepts only Supabase Local.');

const port = Number(process.env.LOCAL_BROWSER_PORT || 5173);
const browserHost = process.env.LOCAL_BROWSER_HOST || '127.0.0.1';
if (!/^(127\.0\.0\.1|localhost)$/.test(browserHost)) throw new Error('Safety stop: browser test accepts only loopback hosts.');
const origin = `http://${browserHost}:${port}`;
const admin = createClient(localUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = Date.now();
const email = `browser-contact-${suffix}@example.test`;
const password = `LocalOnly-Browser-${suffix}!`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Browser Contact Synthetic' } });
assert.ifError(created.error);
const user = created.data.user;
assert.ifError((await admin.from('career_studio_rollout_config').update({ enabled: true }).eq('id', true)).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: user.id, enabled: true })).error);
let vite = null;
let ownsServer = false;

async function serverReady() {
  try { return (await fetch(origin)).ok; } catch (_) { return false; }
}

try {
  if (!(await serverReady())) {
    ownsServer = true;
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    vite = spawn(process.execPath, [viteBin, '--mode', 'development', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: process.cwd(),
      env: { ...process.env, VITE_FF_CAREER_STUDIO: 'true', VITE_SUPABASE_URL: localUrl, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey, VITE_SUPABASE_ENV: 'local' },
      stdio: 'ignore'
    });
    for (let i = 0; i < 30 && !(await serverReady()); i++) await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(await serverReady(), 'local Vite server did not start');
  }

  const consoleIssues = [];
  const responseIssues = [];
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const attachLocalHarness = async page => {
    page.on('console', message => {
      const text = message.text();
      if (['error', 'warning'].includes(message.type()) && !text.includes('GL Driver Message')) consoleIssues.push(`${message.type()}: ${text}`);
    });
    page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));
    page.on('response', response => { if (response.status() >= 400) responseIssues.push(`${response.status()} ${response.url()}`); });
    // Auth, career_profiles, career_documents, and portfolios remain real
    // Supabase Local requests. These local adapter responses only prevent
    // unrelated legacy routes from producing schema noise in this focused test.
    await page.route('**/rest/v1/profiles*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/subscriptions*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/group_members*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/keep_live_entitlements*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/entitlements*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ effectivePlan: 'free', status: 'active' }) }));
    await page.route('**/api/portfolio*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ variants: [] }) }));
  };
  const login = async page => {
    await page.goto(`${origin}/login`, { waitUntil: 'networkidle' });
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: /Sign In to Studio/ }).click();
    await page.waitForTimeout(700);
  };
  const waitFor = async (check, message) => {
    for (let i = 0; i < 20; i++) {
      if (await check()) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(message);
  };

  // Context A creates the records, then is closed. Context B has no cookies,
  // no localStorage, and no in-memory application state from the save session.
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageA = await contextA.newPage();
  await attachLocalHarness(pageA);
  await login(pageA);
  await pageA.goto(`${origin}/cv/new`, { waitUntil: 'networkidle' });
  await pageA.locator('[name=name]').fill('Browser Contact Synthetic');
  await pageA.locator('[name=email]').fill('browser.cv@example.test');
  await pageA.locator('[name=phone]').fill('+20 100 000 0000');
  await pageA.locator('[name=location]').fill('Cairo');
  await pageA.locator('textarea[name=summary]').fill('Browser persistence summary');
  await pageA.getByRole('button', { name: 'Save draft' }).click();
  await waitFor(async () => {
    const result = await admin.from('career_profiles').select('content_json').eq('owner_user_id', user.id).limit(1);
    return result.data?.[0]?.content_json?.contact?.email === 'browser.cv@example.test' && result.data?.[0]?.content_json?.contact?.phone === '+20 100 000 0000';
  }, 'CV server write did not complete before closing context A');
  await pageA.goto(`${origin}/studio`, { waitUntil: 'networkidle' });
  await pageA.waitForTimeout(1400);
  await pageA.locator('#f-email').fill('browser.portfolio@example.test');
  await pageA.getByRole('button', { name: /Save Draft/ }).click();
  await waitFor(async () => {
    const result = await admin.from('portfolios').select('master_profile_json').eq('owner_user_id', user.id).limit(1);
    return result.data?.[0]?.master_profile_json?.social?.email === 'browser.portfolio@example.test';
  }, 'Portfolio server write did not complete before closing context A');
  await contextA.close();

  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const pageB = await contextB.newPage();
  await attachLocalHarness(pageB);
  await pageB.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  assert.equal(await pageB.evaluate(() => localStorage.length), 0, 'fresh context unexpectedly contains localStorage');
  await login(pageB);
  await pageB.goto(`${origin}/cv/new`, { waitUntil: 'networkidle' });
  assert.equal(await pageB.locator('[name=email]').inputValue(), 'browser.cv@example.test');
  assert.equal(await pageB.locator('[name=phone]').inputValue(), '+20 100 000 0000');
  await pageB.locator('textarea[name=summary]').fill('Browser persistence summary edited');
  await pageB.getByRole('button', { name: 'Save draft' }).click();
  await waitFor(async () => {
    const result = await admin.from('career_profiles').select('content_json').eq('owner_user_id', user.id).limit(1);
    return result.data?.[0]?.content_json?.summary === 'Browser persistence summary edited';
  }, 'Summary server write did not complete in fresh context');
  await contextB.close();

  // Context C is another clean browser context after the edit; this proves
  // contact fields survive a second login and never depend on a cache snapshot.
  const contextC = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await contextC.newPage();
  await attachLocalHarness(page);
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.evaluate(() => localStorage.length), 0, 'second fresh context unexpectedly contains localStorage');
  await login(page);
  await page.goto(`${origin}/cv/new`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[name=email]').inputValue(), 'browser.cv@example.test');
  assert.equal(await page.locator('[name=phone]').inputValue(), '+20 100 000 0000');
  assert.equal(await page.locator('textarea[name=summary]').inputValue(), 'Browser persistence summary edited');
  await page.goto(`${origin}/studio`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  assert.equal(await page.locator('#f-email').inputValue(), 'browser.portfolio@example.test');
  assert.equal(consoleIssues.length, 0, `browser console issues: ${consoleIssues.join(' | ')}\nresponses: ${responseIssues.join(' | ')}`);

  await fs.mkdir('docs/local-acceptance', { recursive: true });
  await page.screenshot({ path: 'docs/local-acceptance/09-contact-hydration-browser.png', fullPage: true });
  await contextC.close();
  await browser.close();
  console.log('Local fresh-context contact browser test passed: Supabase Local Auth, server-backed CV/Portfolio hydration after new contexts, summary preservation, and clean console.');
} finally {
  await admin.from('career_documents').delete().eq('owner_user_id', user.id);
  await admin.from('career_profiles').delete().eq('owner_user_id', user.id);
  await admin.from('career_studio_rollout_users').delete().eq('user_id', user.id);
  await admin.from('career_studio_rollout_config').update({ enabled: false, updated_by: null }).eq('id', true);
  const portfolios = await admin.from('portfolios').select('id').eq('owner_user_id', user.id);
  for (const portfolio of portfolios.data || []) {
    await admin.from('portfolio_variants').delete().eq('portfolio_id', portfolio.id);
    await admin.from('portfolio_creation_history').delete().eq('portfolio_id', portfolio.id);
    await admin.from('portfolios').delete().eq('id', portfolio.id);
  }
  await admin.auth.admin.deleteUser(user.id);
  if (ownsServer && vite) vite.kill('SIGTERM');
}
