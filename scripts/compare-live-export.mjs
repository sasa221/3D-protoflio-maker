import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { buildPortfolioHTMLContent } from '../src/exporter/PortfolioExporter.js';
import { getThemeById } from '../src/three/ProceduralTheme.js';

const PROD_URL = 'https://portfolio-maker-murex.vercel.app/u/saleh-mohamed';
const API_URL = 'https://portfolio-maker-murex.vercel.app/api/public/portfolio?slug=saleh-mohamed';

async function runComparison() {
  console.log('Fetching live portfolio data for saleh-mohamed...');
  const res = await fetch(API_URL);
  const json = await res.json();
  const pf = json.portfolio;
  if (!pf) throw new Error('Portfolio not found on live API');

  const masterProfile = pf.master_profile_json?.publishedProfile || pf.master_profile_json;
  masterProfile.id = pf.id;
  const theme = getThemeById(masterProfile.theme || 'code');

  console.log('Generating standalone export HTML with theme:', theme.id);
  const exportHTML = buildPortfolioHTMLContent(masterProfile, theme);
  const exportFilePath = path.resolve('./dist/saleh_exported_compare.html');
  fs.writeFileSync(exportFilePath, exportHTML);

  const screenshotDir = path.resolve('./dist/screenshots_compare');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const viewports = [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '390x844', width: 390, height: 844 }
  ];

  const browser = await chromium.launch({ headless: true });
  const report = {};
  const capturedScreenshots = [];

  for (const vp of viewports) {
    console.log(`\n================ Testing Viewport: ${vp.name} ================`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

    // 1. Render Live Production
    const livePage = await context.newPage();
    await livePage.goto(PROD_URL, { waitUntil: 'networkidle' });
    await livePage.waitForTimeout(3000); // Allow intro animation to finish

    // 2. Render Export Local HTML
    const expPage = await context.newPage();
    await expPage.goto(`file://${exportFilePath}`, { waitUntil: 'networkidle' });
    await expPage.waitForTimeout(3000);

    const sections = ['hero', 'about', 'projects', 'skills'];
    const vpReport = { live: {}, export: {}, diffs: [] };

    for (const sec of sections) {
      // Scroll both pages to section
      const liveSecSel = sec === 'hero' ? '.hero-section' : `#sec-${sec}`;
      const expSecSel = sec === 'hero' ? '.hero-section' : `#sec-${sec}`;

      await livePage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant' });
      }, liveSecSel);
      await expPage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant' });
      }, expSecSel);

      await livePage.waitForTimeout(600);
      await expPage.waitForTimeout(600);

      const liveShotName = `live_${vp.name}_${sec}.png`;
      const expShotName = `export_${vp.name}_${sec}.png`;
      const liveShotPath = path.join(screenshotDir, liveShotName);
      const expShotPath = path.join(screenshotDir, expShotName);

      await livePage.screenshot({ path: liveShotPath });
      await expPage.screenshot({ path: expShotPath });
      capturedScreenshots.push(liveShotName, expShotName);
      console.log(`Captured screenshots for ${sec} at ${vp.name}`);
    }

    // Inspect Metrics
    const getMetrics = async (page) => {
      return await page.evaluate(() => {
        const heroName = document.querySelector('.hero-name');
        const heroProf = document.querySelector('.hero-profession');
        const heroAvatar = document.querySelector('.hero-avatar-wrap img');
        const heroActions = document.querySelector('.hero-actions');
        const canvas = document.getElementById('bg-canvas');
        const navbar = document.querySelector('.portfolio-navbar');
        const body = document.body;

        return {
          heroNameText: heroName?.textContent?.trim(),
          heroNameRect: heroName?.getBoundingClientRect(),
          heroProfRect: heroProf?.getBoundingClientRect(),
          heroAvatarSrc: heroAvatar?.src?.slice(0, 50),
          heroAvatarRect: heroAvatar?.getBoundingClientRect(),
          heroActionsRect: heroActions?.getBoundingClientRect(),
          canvasRect: canvas?.getBoundingClientRect(),
          canvasDisplay: canvas ? window.getComputedStyle(canvas).position : null,
          navbarRect: navbar?.getBoundingClientRect(),
          deviceAttr: body.dataset.device || document.documentElement.dataset.device,
          bodyOverflowX: window.getComputedStyle(body).overflowX,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });
    };

    const liveMetrics = await getMetrics(livePage);
    const expMetrics = await getMetrics(expPage);

    vpReport.live = liveMetrics;
    vpReport.export = expMetrics;

    // Check specific comparison points
    if (liveMetrics.heroNameText !== expMetrics.heroNameText) {
      vpReport.diffs.push(`Hero Name Mismatch: Live="${liveMetrics.heroNameText}" vs Exp="${expMetrics.heroNameText}"`);
    }
    if (Math.abs(liveMetrics.canvasRect.width - expMetrics.canvasRect.width) > 2) {
      vpReport.diffs.push(`Canvas Width Mismatch: Live=${liveMetrics.canvasRect.width} vs Exp=${expMetrics.canvasRect.width}`);
    }
    if (Math.abs(liveMetrics.heroNameRect.width - expMetrics.heroNameRect.width) > 8) {
      vpReport.diffs.push(`Hero Name Width Mismatch: Live=${liveMetrics.heroNameRect.width} vs Exp=${expMetrics.heroNameRect.width}`);
    }
    if (liveMetrics.deviceAttr !== expMetrics.deviceAttr) {
      vpReport.diffs.push(`Device Attr Mismatch: Live=${liveMetrics.deviceAttr} vs Exp=${expMetrics.deviceAttr}`);
    }

    report[vp.name] = vpReport;
    await context.close();
  }

  await browser.close();
  console.log('\n================ COMPARISON SUMMARY ================');
  console.log(JSON.stringify(report, null, 2));
  console.log('\nCaptured Screenshots Count:', capturedScreenshots.length);
  console.log(capturedScreenshots.join('\n'));
}

runComparison().catch(err => {
  console.error('Comparison error:', err);
  process.exit(1);
});
