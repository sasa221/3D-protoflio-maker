import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, 'tmp', 'pr6-import-smoke');
const htmlPath = path.join(tmpDir, 'index.html');
const pdfPath = path.join(tmpDir, 'synthetic-student.pdf');
const badPdfPath = path.join(tmpDir, 'corrupt.pdf');
const docxPath = path.join(tmpDir, 'synthetic-professional.docx');
const screenshotPath = process.env.CV_IMPORT_SMOKE_SCREENSHOT || path.join(root, 'docs', 'pr6-import-review.png');
const port = 5174;

async function makePdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = [
    'Lina Synthetic Candidate',
    'lina@example.test | +20 100 555 1212 | https://github.com/lina-test',
    'SUMMARY',
    'Computer science student building verified web projects.',
    'EDUCATION',
    'BSc Computer Science, Local University, 2026',
    'PROJECTS',
    'Built a React study planner for a university course.',
    'SKILLS',
    'JavaScript, React, Git'
  ];
  lines.forEach((line, index) => page.drawText(line, { x: 48, y: 790 - (index * 33), size: index === 0 ? 18 : 11, font }));
  await fs.writeFile(pdfPath, await pdf.save());
}

async function makeDocx() {
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Omar Synthetic Professional</w:t></w:r></w:p>
<w:p><w:r><w:t>omar@example.test | +20 100 555 3434 | https://www.linkedin.com/in/omar-test</w:t></w:r></w:p>
<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p><w:p><w:r><w:t>Built accessible dashboards for an internal team in 2025.</w:t></w:r></w:p>
<w:p><w:r><w:t>SKILLS</w:t></w:r></w:p><w:p><w:r><w:t>TypeScript, React, Testing</w:t></w:r></w:p>
</w:body></w:document>`;
  await fs.writeFile(docxPath, zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(xml) }));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/tmp/pr6-import-smoke/index.html`); if (response.ok) return; } catch (_) { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local Vite server did not start.');
}

await fs.mkdir(tmpDir, { recursive: true });
await makePdf();
await makeDocx();
await fs.writeFile(badPdfPath, Buffer.from('not-a-pdf'));
await fs.writeFile(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body style="margin:0;background:#080a12;color:#fff;font-family:Arial,sans-serif"><main style="max-width:720px;margin:20px auto;padding:16px"><h1>Local CV import smoke</h1><div id="root"></div></main><script type="module">import { renderCVImportReviewPanel } from '/src/ui/CVImportReviewPanel.js'; renderCVImportReviewPanel(document.querySelector('#root'), { ownerUserId: 'smoke-user', getBaseProfile: () => ({ id: 'smoke-cv', ownerUserId: 'smoke-user', content: { contact: {}, skills: [], experience: [], education: [], projects: [] } }) });</script></body></html>`);

execFileSync(process.execPath, [path.join(root, 'scripts', 'assert_local_safety.mjs')], {
  cwd: root,
  env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-smoke-key' },
  stdio: 'ignore'
});
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'development', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  env: { ...process.env, VITE_FF_CAREER_STUDIO: 'true', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-smoke-key' },
  stdio: 'ignore'
});
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/tmp/pr6-import-smoke/index.html`, { waitUntil: 'networkidle' });
  await page.locator('[data-open-cv-import]').click();
  await page.locator('[data-import-file]').setInputFiles(pdfPath);
  await page.locator('[data-import-save]').waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error(`Horizontal overflow at ${viewport.width}px.`);
  }
  await page.locator('[data-import-cancel]').click();
  await page.locator('[data-open-cv-import]').click();
  await page.locator('[data-import-file]').setInputFiles(badPdfPath);
  await page.waitForFunction(() => /valid|unreadable|failed|damaged/i.test(document.querySelector('[data-import-status]')?.textContent || ''), null, { timeout: 15000 });
  await page.locator('[data-import-cancel], [data-import-close]').first().click();
  await page.locator('[data-open-cv-import]').click();
  await page.locator('[data-import-file]').setInputFiles(docxPath);
  await page.locator('[data-import-save]').waitFor({ state: 'visible', timeout: 15000 });
  const reviewedText = await page.locator('[data-import-field]').evaluateAll(elements => elements.map(element => element.value || element.textContent || '').join('\n'));
  if (!/Omar Synthetic Professional|TypeScript/.test(reviewedText)) throw new Error('DOCX fields were not shown in review.');
  if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`);
  console.log(`test_local_cv_import_browser: passed (PDF + DOCX review, cancel safety, 1440/1024/390px no overflow, screenshot ${path.relative(root, screenshotPath)}).`);
} finally {
  await browser.close();
  if (server.pid) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      else server.kill('SIGTERM');
    } catch (_) { /* process may already be gone */ }
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
}
