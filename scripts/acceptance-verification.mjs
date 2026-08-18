import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

const BASE_URL = 'https://portfolio-maker-murex.vercel.app';
const TEST_SLUG = 'saleh-mohamed';

async function runAcceptanceVerification() {
  console.log('==============================================');
  console.log('STARTING REAL PRODUCTION ACCEPTANCE VERIFICATION');
  console.log('==============================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const results = {
    liveVsExport: { passed: false, details: {} },
    mobile: { passed: false, viewports: {} },
    optimizeUx: { passed: false, details: {} },
    customDomain: { functional: 'NOT FUNCTIONAL', details: {} }
  };

  // ──────────────────────────────────────────
  // 1. LIVE VS EXPORT TEST
  // ──────────────────────────────────────────
  console.log('--- TEST 1: LIVE VS EXPORT ---');
  try {
    // 1A. Open Live Production Portfolio
    console.log(`Navigating to Production: ${BASE_URL}/u/${TEST_SLUG}`);
    await page.goto(`${BASE_URL}/u/${TEST_SLUG}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const liveCanvasExists = await page.evaluate(() => !!document.getElementById('bg-canvas'));
    const liveHeroName = await page.evaluate(() => document.querySelector('.hero-name')?.textContent?.trim() || '');
    const liveHeroProf = await page.evaluate(() => document.querySelector('.hero-profession')?.textContent?.trim() || '');
    const liveAvatar = await page.evaluate(() => document.querySelector('.hero-avatar-wrap img')?.src || '');
    const liveSectionsCount = await page.evaluate(() => document.querySelectorAll('.portfolio-section').length);

    console.log('Live Canvas Found:', liveCanvasExists);
    console.log('Live Hero Name:', liveHeroName);
    console.log('Live Profession:', liveHeroProf);
    console.log('Live Sections Count:', liveSectionsCount);

    // 1B. Log in to access Studio
    console.log(`Navigating to Login: ${BASE_URL}/login`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Fill login form
    await page.fill('#login-email', 'saleh2005mohamed@gmail.com');
    await page.fill('#login-password', 'Saleh@2025');
    await page.click('#login-btn');
    await page.waitForTimeout(3000);

    // Check if on studio now
    console.log('Studio URL after login:', page.url());
    const studioCanvasExists = await page.evaluate(() => !!document.getElementById('preview-canvas'));
    console.log('Studio Canvas Found:', studioCanvasExists);

    // 1C. Export standalone HTML and test offline file
    const exportedHtml = await page.evaluate(async () => {
      if (typeof window.buildPortfolioHTMLContent === 'function') {
        return window.buildPortfolioHTMLContent(window.portfolioData, window.currentTheme);
      }
      return null;
    });

    let exportVerified = false;
    if (exportedHtml) {
      const exportPath = path.resolve('./dist/test_exported_portfolio.html');
      fs.writeFileSync(exportPath, exportedHtml);
      const exportPage = await context.newPage();
      await exportPage.goto(`file://${exportPath}`, { waitUntil: 'load' });
      await exportPage.waitForTimeout(1500);

      const expCanvas = await exportPage.evaluate(() => !!document.getElementById('bg-canvas'));
      const expHeroName = await exportPage.evaluate(() => document.querySelector('.hero-name')?.textContent?.trim() || '');
      const expSections = await exportPage.evaluate(() => document.querySelectorAll('.portfolio-section').length);

      console.log('Exported Canvas:', expCanvas);
      console.log('Exported Hero Name:', expHeroName);
      console.log('Exported Sections:', expSections);

      exportVerified = expCanvas && expSections > 0;
      await exportPage.close();
    }

    results.liveVsExport = {
      passed: liveCanvasExists && liveSectionsCount > 0 && exportVerified,
      details: {
        liveCanvas: liveCanvasExists,
        liveHeroName,
        liveHeroProf,
        liveSectionsCount,
        studioCanvas: studioCanvasExists,
        exportVerified
      }
    };
    console.log('TEST 1 RESULT:', results.liveVsExport.passed ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('TEST 1 ERROR:', err.message);
    results.liveVsExport.passed = false;
    results.liveVsExport.error = err.message;
  }

  // ──────────────────────────────────────────
  // 2. MOBILE VIEWPORTS TEST
  // ──────────────────────────────────────────
  console.log('\n--- TEST 2: MOBILE VIEWPORTS ---');
  const viewportsToTest = [
    { name: '320px', width: 320, height: 600 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  let allMobilePassed = true;

  for (const vp of viewportsToTest) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Switch to Optimize Workspace
    await page.evaluate(() => {
      if (typeof window.switchWorkspaceNav === 'function') {
        window.switchWorkspaceNav('optimize');
      } else if (typeof window.switchWorkspace === 'function') {
        window.switchWorkspace('optimize');
      }
    });
    await page.waitForTimeout(600);

    const optimizeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const optimizeClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const optimizeHasOverflow = optimizeScrollWidth > optimizeClientWidth;

    // Switch to Publish Workspace
    await page.evaluate(() => {
      if (typeof window.switchWorkspaceNav === 'function') {
        window.switchWorkspaceNav('publish');
      } else if (typeof window.switchWorkspace === 'function') {
        window.switchWorkspace('publish');
      }
    });
    await page.waitForTimeout(600);

    const publishScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const publishClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const publishHasOverflow = publishScrollWidth > publishClientWidth;

    const navButtonsCount = await page.evaluate(() => {
      return document.querySelectorAll('.ws-btn').length || document.querySelectorAll('.ws-nav-btn').length;
    });

    const passed = !optimizeHasOverflow && !publishHasOverflow && navButtonsCount === 5;
    if (!passed) allMobilePassed = false;

    results.mobile.viewports[vp.name] = {
      passed,
      optimizeScrollWidth,
      optimizeClientWidth,
      publishScrollWidth,
      publishClientWidth,
      hasOverflow: optimizeHasOverflow || publishHasOverflow,
      navButtonsCount
    };

    console.log(`Viewport ${vp.name}: ${passed ? 'PASS' : 'FAIL'} (Optimize: ${optimizeClientWidth}px/${optimizeScrollWidth}px, Publish: ${publishClientWidth}px/${publishScrollWidth}px, Buttons: ${navButtonsCount})`);
  }

  results.mobile.passed = allMobilePassed;
  console.log('TEST 2 RESULT:', results.mobile.passed ? 'PASS' : 'FAIL');

  // ──────────────────────────────────────────
  // 3. OPTIMIZE UX TEST
  // ──────────────────────────────────────────
  console.log('\n--- TEST 3: OPTIMIZE UX ---');
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Switch to Optimize Workspace
    await page.evaluate(() => {
      if (typeof window.switchWorkspaceNav === 'function') {
        window.switchWorkspaceNav('optimize');
      } else if (typeof window.switchWorkspace === 'function') {
        window.switchWorkspace('optimize');
      }
    });
    await page.waitForTimeout(600);

    // Set input and trigger analysis
    const analysisDone = await page.evaluate(() => {
      const roleInput = document.getElementById('jt-role');
      const jdInput = document.getElementById('jt-jd');
      if (roleInput) roleInput.value = 'Front-End React Developer';
      if (jdInput) jdInput.value = 'Seeking a Front-End Developer with strong experience in JavaScript, HTML, CSS, React, and responsive design.';
      const btn = document.getElementById('btn-run-job-analysis');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Analysis button clicked via evaluate:', analysisDone);
    await page.waitForTimeout(800);

    const scoreVisible = await page.evaluate(() => {
      const el = document.querySelector('.job-target-panel');
      return el && el.textContent.includes('Match');
    });

    const hasWhatMatchesWell = await page.evaluate(() => {
      return document.querySelector('.job-target-panel')?.textContent.includes('What Matches Well');
    });

    const hasSuggestionsToImprove = await page.evaluate(() => {
      return document.querySelector('.job-target-panel')?.textContent.includes('Suggestions to Improve');
    });

    const detailsCollapsedByDefault = await page.evaluate(() => {
      const details = document.querySelector('.job-target-panel details');
      return details ? !details.open : true;
    });

    const noWarRoomLanguage = await page.evaluate(() => {
      const text = document.querySelector('.job-target-panel')?.textContent || '';
      return !text.includes('Gap Analysis') && !text.includes('Evidence Required') && !text.includes('Weighted Score');
    });

    const optimizePassed = scoreVisible && hasWhatMatchesWell && hasSuggestionsToImprove && detailsCollapsedByDefault && noWarRoomLanguage;

    results.optimizeUx = {
      passed: optimizePassed,
      details: {
        scoreVisible,
        hasWhatMatchesWell,
        hasSuggestionsToImprove,
        detailsCollapsedByDefault,
        noWarRoomLanguage
      }
    };

    console.log('Score visible:', scoreVisible);
    console.log('What Matches Well visible:', hasWhatMatchesWell);
    console.log('Suggestions to Improve visible:', hasSuggestionsToImprove);
    console.log('Details collapsed by default:', detailsCollapsedByDefault);
    console.log('No war-room language:', noWarRoomLanguage);
    console.log('TEST 3 RESULT:', results.optimizeUx.passed ? 'PASS' : 'FAIL');
  } catch (err) {
    console.error('TEST 3 ERROR:', err.message);
    results.optimizeUx.passed = false;
    results.optimizeUx.error = err.message;
  }

  // ──────────────────────────────────────────
  // 4. CUSTOM DOMAIN ARCHITECTURE AUDIT
  // ──────────────────────────────────────────
  console.log('\n--- TEST 4: CUSTOM DOMAIN ARCHITECTURE AUDIT ---');
  let cnameResolves = false;
  let cnameError = null;
  try {
    const addresses = await resolve4('cname.3dportfolio.app');
    cnameResolves = addresses && addresses.length > 0;
  } catch (e) {
    cnameResolves = false;
    cnameError = e.message;
  }

  console.log('cname.3dportfolio.app resolves publicly:', cnameResolves ? 'YES' : 'NO', `(${cnameError || 'OK'})`);

  results.customDomain = {
    functional: 'NOT FUNCTIONAL',
    cnameResolves,
    details: {
      hostname: 'cname.3dportfolio.app',
      resolves: cnameResolves,
      error: cnameError,
      vercelApiIntegrated: false,
      incomingHostRouting: false,
      sslAutoProvisioning: false,
      uiStatus: 'Custom Domain — Coming Soon'
    }
  };

  await browser.close();

  console.log('\n==============================================');
  console.log('ACCEPTANCE VERIFICATION COMPLETE');
  console.log('==============================================');
}

runAcceptanceVerification().catch(err => {
  console.error('FATAL VERIFICATION ERROR:', err);
  process.exit(1);
});
