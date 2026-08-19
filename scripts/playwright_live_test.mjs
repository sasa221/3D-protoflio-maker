// scripts/playwright_live_test.mjs
import { chromium } from 'playwright';

async function runLiveTest() {
  console.log('Launching browser to test https://portfolio-maker-murex.vercel.app/...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = `[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}\n${err.stack}`);
  });

  console.log('Navigating to https://portfolio-maker-murex.vercel.app/studio...');
  await page.goto('https://portfolio-maker-murex.vercel.app/studio', { waitUntil: 'networkidle' });

  // Get current URL
  console.log('Current URL after load:', page.url());

  // Check live script bundle tag
  const scriptSrc = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    return scripts.map(s => s.src);
  });
  console.log('Live script tags loaded:', scriptSrc);

  // If on login or auth page, let's inspect what's rendered
  const pageTitle = await page.title();
  console.log('Page title:', pageTitle);

  // Let's inspect the DOM elements present
  const domInfo = await page.evaluate(() => {
    const tierChip = document.getElementById('tier-chip') || document.querySelector('.tier-chip');
    const themeGrid = document.getElementById('theme-grid');
    const themeCards = Array.from(document.querySelectorAll('.theme-card')).map(c => c.textContent?.trim());
    return {
      tierChip: tierChip ? {
        outerHTML: tierChip.outerHTML,
        id: tierChip.id,
        className: tierChip.className,
        computedCursor: window.getComputedStyle(tierChip).cursor,
        computedPointerEvents: window.getComputedStyle(tierChip).pointerEvents,
        computedZIndex: window.getComputedStyle(tierChip).zIndex,
        offsetParent: Boolean(tierChip.offsetParent)
      } : null,
      themeGridPresent: Boolean(themeGrid),
      themeCardsCount: themeCards.length,
      firstFewThemes: themeCards.slice(0, 5)
    };
  });
  console.log('DOM info on load:', JSON.stringify(domInfo, null, 2));

  // If not signed in and redirected to login, let's see if we need to sign in or test guest/studio mode
  console.log('\n--- TESTING WINDOW GLOBALS ---');
  const windowGlobals = await page.evaluate(() => {
    return {
      hasSelectTheme: typeof window.selectTheme,
      hasHandleUpgradeClick: typeof window.handleUpgradeClick,
      hasOpenBillingModal: typeof window.openBillingModal,
      hasShowToast: typeof window.showToast
    };
  });
  console.log('Window globals:', windowGlobals);

  // Let's test calling handleUpgradeClick or selectTheme directly in browser context
  console.log('\n--- TESTING handleUpgradeClick() DIRECTLY ---');
  const testUpgradeResult = await page.evaluate(async () => {
    try {
      if (typeof window.handleUpgradeClick === 'function') {
        await window.handleUpgradeClick('pro');
        const modal = document.querySelector('.cv-import-modal-overlay') || document.querySelector('.cv-modal-card');
        return {
          success: true,
          modalFound: Boolean(modal),
          modalHTML: modal ? modal.outerHTML.substring(0, 300) : null
        };
      }
      return { success: false, reason: 'window.handleUpgradeClick is not a function' };
    } catch (err) {
      return { success: false, error: err.message, stack: err.stack };
    }
  });
  console.log('testUpgradeResult:', testUpgradeResult);

  // Let's test selectTheme('hacker') directly
  console.log('\n--- TESTING selectTheme("hacker", true) DIRECTLY ---');
  const testSelectThemeResult = await page.evaluate(async () => {
    try {
      if (typeof window.selectTheme === 'function') {
        window.selectTheme('hacker', true);
        const modal = document.querySelector('.cv-import-modal-overlay') || document.querySelector('.cv-modal-card');
        return {
          success: true,
          modalFound: Boolean(modal),
          modalHTML: modal ? modal.outerHTML.substring(0, 300) : null
        };
      }
      return { success: false, reason: 'window.selectTheme is not a function' };
    } catch (err) {
      return { success: false, error: err.message, stack: err.stack };
    }
  });
  console.log('testSelectThemeResult:', testSelectThemeResult);

  console.log('\n--- CONSOLE ERRORS CAPTURED ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '0 console errors');

  console.log('\n--- RECENT CONSOLE LOGS (last 20) ---');
  console.log(consoleLogs.slice(-20).join('\n'));

  await browser.close();
}

runLiveTest().catch(console.error);
