import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pdfPath = path.resolve('D:/New folder/New folder/Me/SalehResume (1).pdf');
const origin = `http://127.0.0.1:${process.env.LOCAL_BROWSER_PORT || 5174}`;
const screenshotDir = path.join(root, 'output', 'local-real-import');
const desktopScreenshot = path.join(screenshotDir, 'cv-preview-after-real-import-desktop.png');
const mobileScreenshot = path.join(screenshotDir, 'cv-preview-after-real-import-mobile.png');
const educationScreenshot = path.join(screenshotDir, 'cv-education-after-real-import-desktop.png');

const localUrl = process.env.SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!anonKey || !serviceRoleKey) throw new Error('Real CV browser test requires Supabase Local credentials.');
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(localUrl)) throw new Error('Safety stop: this test only accepts Supabase Local.');
await fs.access(pdfPath);
await fs.mkdir(screenshotDir, { recursive: true });

let localServer = null;
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) return; } catch (_) { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Local Vite server did not start at ${origin}.`);
}
try { await waitForServer(); } catch (_) {
  localServer = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'development', '--host', '127.0.0.1', '--port', String(process.env.LOCAL_BROWSER_PORT || 5174)], {
    cwd: root,
    env: { ...process.env, VITE_FF_CAREER_STUDIO: 'true', VITE_SUPABASE_URL: localUrl, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey, VITE_SUPABASE_ENV: 'local', VITE_LOCAL_DEV_MODE: 'true', VITE_LOCAL_AUTH_MOCK: 'false' },
    stdio: 'ignore'
  });
  await waitForServer();
}

const admin = createClient(localUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = Date.now();
const email = `real-cv-browser-${suffix}@example.test`;
const password = `LocalOnly-RealCv-${suffix}!`;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Real CV Browser Regression' } });
assert.ifError(created.error);
const userId = created.data.user.id;
assert.ifError((await admin.from('career_studio_rollout_config').upsert({ id: true, enabled: true })).error);
assert.ifError((await admin.from('career_studio_rollout_users').upsert({ user_id: userId, enabled: true })).error);
assert.ifError((await admin.from('subscriptions').update({ plan_id: 'pro', status: 'active', provider: 'local_test' }).eq('user_id', userId)).error);

const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
const errors = [];
const attach = page => {
  page.on('console', message => {
    // PDF.js may emit this parser warning for an unsupported glyph operator;
    // it does not affect extracted text or the generated PDF.
    if (['error', 'warning'].includes(message.type()) && !/GL Driver Message|TT: undefined function/i.test(message.text())) errors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
};

const assertRendered = async page => {
  const result = await page.evaluate(() => {
    const preview = document.querySelector('[data-preview-sections]');
    const previewText = preview?.innerText || '';
    const skillHeading = [...(preview?.querySelectorAll('h3') || [])].find(node => node.textContent?.trim() === 'Skills');
    const skillBody = skillHeading?.nextElementSibling;
    const skillArticles = [...(skillBody?.querySelectorAll('article') || [])];
    const skillTitles = skillArticles.map(article => article.querySelector('strong')?.textContent?.trim()).filter(Boolean);
    const dataAnalysis = skillArticles.find(article => article.querySelector('strong')?.textContent?.trim() === 'Data Analysis')?.innerText || '';
    const educationHeading = [...(preview?.querySelectorAll('h3') || [])].find(node => node.textContent?.trim() === 'Education');
    const educationText = educationHeading?.nextElementSibling?.innerText || '';
    const projectLink = [...(preview?.querySelectorAll('a') || [])].find(link => /View website/i.test(link.textContent || ''));
    const editorValues = [...document.querySelectorAll('[data-entry-field]')].map(field => field.value || '');
    return {
      previewText,
      skillTitles,
      dataAnalysis,
      educationText,
      projectHref: projectLink?.href || '',
      projectLinkText: projectLink?.textContent || '',
      pipes: [previewText, ...editorValues].some(value => value.includes('|')),
      experienceCards: document.querySelectorAll('[data-collection="experience"] [data-entry]').length,
      projectsCards: document.querySelectorAll('[data-collection="projects"] [data-entry]').length,
      bulletValues: [...document.querySelectorAll('[data-collection="experience"] [data-entry-field="bullets"], [data-collection="projects"] [data-entry-field="bullets"], [data-collection="activities"] [data-entry-field="bullets"]')].map(field => field.value || '')
    };
  });
  assert.deepEqual(result.skillTitles, ['Programming & Tools', 'Data Analysis', 'Interpersonal Skills', 'Languages']);
  assert.match(result.dataAnalysis, /Power BI/);
  assert.equal(result.skillTitles.filter(title => title === 'Data Analysis').length, 1);
  assert.equal(result.pipes, false, 'Rendered editor/preview contains an imported pipe delimiter.');
  assert.equal(result.experienceCards, 2);
  assert.equal(result.projectsCards, 3);
  assert.equal(result.projectHref, 'https://sasa221.github.io/american-wommen/');
  assert.match(result.projectLinkText, /View website/);
  assert.ok(result.bulletValues.some(value => value.includes('\n')), 'Structured bullets were flattened after save.');
  return result;
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  attach(page);
  await page.route('**/api/entitlements*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ effectivePlan: 'pro', status: 'active' }) }));
  await page.route('**/api/portfolio?action=cv-export*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, pageCount: 2 }) }));
  await page.goto(`${origin}/login?next=%2Fcv%2Fnew%3Fmode%3Dimport`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /Sign In to CV Builder/i }).click();
  await page.waitForURL(/\/cv\/new/, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.locator('[data-import-file]').setInputFiles(pdfPath);
  await page.locator('[data-import-save]').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('checkbox', { name: 'Replace my existing CV fields with the selected imported fields', exact: true }).check();
  await page.locator('[data-import-save]').click();
  await page.waitForURL(/\/cv\?profile=/, { timeout: 15000 });
  await page.locator('[data-preview-sections]').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);
  const desktopResult = await assertRendered(page);
  assert.match(desktopResult.educationText, /GPA:\s*3\.35/, 'Desktop Preview is missing the imported GPA.');
  await page.screenshot({ path: desktopScreenshot, fullPage: true });
  const educationHeading = page.locator('[data-preview-sections] h3', { hasText: 'Education' });
  await educationHeading.scrollIntoViewIfNeeded();
  const educationBox = await educationHeading.evaluate(node => {
    const body = node.nextElementSibling;
    const headingRect = node.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    return { x: Math.max(0, Math.min(headingRect.x, bodyRect?.x || headingRect.x) - 12), y: Math.max(0, headingRect.y - 12), width: Math.max(headingRect.width, bodyRect?.width || 0) + 24, height: (bodyRect ? bodyRect.bottom : headingRect.bottom) - headingRect.y + 24 };
  });
  await page.screenshot({ path: educationScreenshot, clip: educationBox });

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise;
  const exportedPdf = path.join(screenshotDir, 'cv-export-after-real-import.pdf');
  await download.saveAs(exportedPdf);
  const pdfBytes = await fs.readFile(exportedPdf);
  assert.ok(pdfBytes.slice(0, 5).toString() === '%PDF-', 'Export did not produce a PDF file.');
  const parsedPdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useWorkerFetch: false, disableWorker: true }).promise;
  let pdfText = '';
  for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
    const pdfPage = await parsedPdf.getPage(pageNumber);
    pdfText += (await pdfPage.getTextContent()).items.map(item => item.str).join(' ') + '\n';
  }
  assert.equal(pdfText.includes('|'), false, 'Exported PDF contains a pipe delimiter.');
  for (const category of ['Programming & Tools', 'Data Analysis', 'Interpersonal Skills', 'Languages']) assert.ok(pdfText.includes(category), `Exported PDF is missing ${category}.`);
  assert.ok(pdfText.includes('Power BI'), 'Exported PDF is missing Power BI.');
  assert.ok(/GPA:\s*3\.35/.test(pdfText), 'Exported PDF is missing the imported GPA.');
  assert.ok(pdfText.includes('Completed one-month intensive training'), 'Exported PDF is missing imported experience bullets.');
  assert.ok(pdfText.includes('Built a fully Front-End website'), 'Exported PDF is missing imported project bullets.');
  assert.ok(pdfText.includes('View website'), 'Exported PDF is missing the project URL CTA.');
  await page.waitForFunction(() => /PDF downloaded/i.test(document.body.innerText), null, { timeout: 15000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(mobileOverflow, false, 'Mobile CV preview has horizontal overflow.');
  const mobileResult = await assertRendered(page);
  assert.match(mobileResult.educationText, /GPA:\s*3\.35/, 'Mobile Preview is missing the imported GPA.');
  await page.screenshot({ path: mobileScreenshot, fullPage: true });

  await context.close();
  const freshContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const freshPage = await freshContext.newPage();
  attach(freshPage);
  await freshPage.route('**/api/entitlements*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ effectivePlan: 'pro', status: 'active' }) }));
  await freshPage.goto(`${origin}/login?next=%2Fcv`, { waitUntil: 'networkidle' });
  await freshPage.locator('#login-email').fill(email);
  await freshPage.locator('#login-password').fill(password);
  await freshPage.getByRole('button', { name: /Sign In to CV Builder/i }).click();
  await freshPage.waitForURL(/\/cv$/, { timeout: 15000 });
  await freshPage.waitForTimeout(1400);
  const freshResult = await assertRendered(freshPage);
  assert.match(freshResult.educationText, /GPA:\s*3\.35/, 'Fresh browser context after Login/Reload is missing the imported GPA.');
  await freshPage.reload({ waitUntil: 'networkidle' });
  await freshPage.waitForTimeout(1200);
  const freshReloadResult = await assertRendered(freshPage);
  assert.match(freshReloadResult.educationText, /GPA:\s*3\.35/, 'Fresh browser context after an explicit Reload is missing the imported GPA.');
  assert.deepEqual(freshResult.skillTitles, desktopResult.skillTitles);
  assert.equal(freshResult.projectHref, desktopResult.projectHref);
  assert.equal(freshResult.pipes, false);
  await freshContext.close();
  if (errors.length) throw new Error(`Browser console issues: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ pass: true, desktop: desktopResult, mobile: mobileResult, freshContext: freshResult, freshReload: freshReloadResult, screenshots: [desktopScreenshot, mobileScreenshot, educationScreenshot], pdf: exportedPdf }));
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  if (localServer?.pid) {
    try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(localServer.pid), '/T', '/F'], { stdio: 'ignore' }); else localServer.kill('SIGTERM'); } catch (_) { /* already exited */ }
  }
}
