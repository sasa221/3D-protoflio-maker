// scripts/playwright_live_test.mjs
import { chromium } from 'playwright';

async function runLiveProductionTest() {
  console.log('=== RUNNING ISOLATED PLAYWRIGHT TESTS AGAINST PRODUCTION https://portfolio-maker-murex.vercel.app/ ===\n');
  const browser = await chromium.launch({ headless: true });

  const authInitScript = () => {
    const mockUser = {
      id: '00000000-0000-4000-a000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'freetester@example.com',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: 'Free Tester' },
      app_metadata: { provider: 'email' }
    };
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      token_type: 'bearer',
      user: mockUser
    };
    localStorage.setItem('sb-kupxhrfijkdlcteniqfp-auth-token', JSON.stringify(mockSession));
  };

  // Helper to get a clean page
  async function getCleanPage() {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(authInitScript);
    await page.goto('https://portfolio-maker-murex.vercel.app/studio', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      if (typeof window.switchWorkspaceNav === 'function') window.switchWorkspaceNav('customize');
    });
    await page.waitForTimeout(500);
    return page;
  }

  // TEST 1: FREE BADGE
  console.log('1. Testing FREE Badge Click...');
  const page1 = await getCleanPage();
  const badgeInfo = await page1.evaluate(() => {
    const b = document.getElementById('tier-chip');
    return {
      tag: b?.tagName.toLowerCase(),
      id: b?.id,
      className: b?.className,
      role: b?.getAttribute('role'),
      tabIndex: b?.tabIndex,
      cursor: window.getComputedStyle(b).cursor,
      pointerEvents: window.getComputedStyle(b).pointerEvents,
      text: b?.textContent?.trim()
    };
  });
  console.log('   Badge DOM:', badgeInfo);

  await page1.click('#tier-chip');
  await page1.waitForTimeout(600);

  const modal1 = await page1.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay') || document.querySelector('.cv-import-modal-overlay');
    const card = document.querySelector('.cv-modal-card');
    const title = card?.querySelector('h2')?.textContent?.trim();
    const plans = Array.from(document.querySelectorAll('.btn-trigger-checkout')).map(b => b.getAttribute('data-plan'));
    return {
      modalCreated: Boolean(card),
      modalVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      modalTitle: title,
      plans
    };
  });
  console.log('   FREE Badge Click Result:', modal1);
  await page1.close();

  // TEST 2: CYBER COMMAND (PRO)
  console.log('\n2. Testing Cyber Command (Locked Pro Theme) Click...');
  const page2 = await getCleanPage();
  await page2.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Cyber Command'));
    if (card) card.click();
    else window.selectTheme('hacker', true);
  });
  await page2.waitForTimeout(600);

  const modal2 = await page2.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay') || document.querySelector('.cv-import-modal-overlay');
    const card = document.querySelector('.cv-modal-card');
    const proButton = document.querySelector('.btn-trigger-checkout[data-plan="pro"]');
    const proCard = proButton?.closest('div');
    const isProHighlighted = proCard ? (window.getComputedStyle(proCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(proCard).borderColor?.includes('124')) : false;
    const badgeText = proCard?.querySelector('span')?.textContent?.trim();
    return {
      modalCreated: Boolean(card),
      modalVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      isProHighlighted,
      badgeText
    };
  });
  console.log('   Cyber Command Click Result:', modal2);
  await page2.close();

  // TEST 3: QUANTUM AURORA (PREMIUM)
  console.log('\n3. Testing Quantum Aurora (Locked Premium Theme) Click...');
  const page3 = await getCleanPage();
  await page3.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Quantum Aurora'));
    if (card) card.click();
    else window.selectTheme('quantum', true);
  });
  await page3.waitForTimeout(600);

  const modal3 = await page3.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay') || document.querySelector('.cv-import-modal-overlay');
    const card = document.querySelector('.cv-modal-card');
    const premButton = document.querySelector('.btn-trigger-checkout[data-plan="premium"]');
    const premCard = premButton?.closest('div');
    const isPremHighlighted = premCard ? (window.getComputedStyle(premCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(premCard).borderColor?.includes('124')) : false;
    const badgeText = premCard?.querySelector('span')?.textContent?.trim();
    return {
      modalCreated: Boolean(card),
      modalVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      isPremHighlighted,
      badgeText
    };
  });
  console.log('   Quantum Aurora Click Result:', modal3);
  await page3.close();

  // TEST 4: CODE MATRIX (FREE)
  console.log('\n4. Testing Code Matrix (Free Theme) Click...');
  const page4 = await getCleanPage();
  const themeResult = await page4.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Code Matrix'));
    if (card) card.click();
    else window.selectTheme('code', false);
    const overlay = document.querySelector('.billing-modal-overlay');
    return {
      appliedTheme: window.portfolioData?.theme,
      modalOpened: Boolean(overlay && window.getComputedStyle(overlay).display === 'flex')
    };
  });
  console.log('   Code Matrix Click Result:', themeResult);
  await page4.close();

  await browser.close();
  console.log('\n=== ALL LIVE PRODUCTION TESTS EXECUTED SUCCESSFULLY ===');
}

runLiveProductionTest().catch(console.error);
