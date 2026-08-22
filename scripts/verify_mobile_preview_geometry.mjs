import { chromium } from 'playwright';

const target = process.env.PREVIEW_AUDIT_URL || 'https://portfolio-maker-murex.vercel.app/';
const browser = await chromium.launch({ headless: true });
let failed = false;

for (const width of [375, 430]) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await context.newPage();
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.buildHTML();
    const viewport = document.getElementById('virtual-viewport');
    viewport.innerHTML = '<div style="width:100%;height:100%;background:linear-gradient(90deg,#ef4444 0 8%,#111827 8% 46%,#22c55e 46% 54%,#111827 54% 92%,#3b82f6 92% 100%)"></div>';
    window.setStudioSurface('preview');
  });

  for (const mode of ['desktop', 'tablet', 'mobile']) {
    await page.evaluate((value) => window.setPreviewMode(value), mode);
    await page.waitForTimeout(150);
    const geometry = await page.evaluate(() => {
      const stage = document.getElementById('preview-stage').getBoundingClientRect();
      const scaler = document.getElementById('preview-scaler').getBoundingClientRect();
      const viewport = document.getElementById('virtual-viewport').getBoundingClientRect();
      return {
        stage: { left: stage.left, right: stage.right, width: stage.width },
        scaler: { left: scaler.left, right: scaler.right, width: scaler.width },
        viewport: { left: viewport.left, right: viewport.right, width: viewport.width },
        scrollLeft: document.getElementById('preview-stage').scrollLeft,
        scrollWidth: document.getElementById('preview-stage').scrollWidth,
        clippedLeft: viewport.left < stage.left - 1,
        centered: Math.abs((viewport.left + viewport.width / 2) - (stage.left + stage.width / 2)) < 3,
      };
    });
    console.log(JSON.stringify({ width, mode, ...geometry }));
    if (mode !== 'desktop' && (!geometry.centered || geometry.clippedLeft)) failed = true;
    if (mode === 'desktop' && !geometry.centered) failed = true;
  }
  await context.close();
}

await browser.close();
if (failed) process.exitCode = 1;
