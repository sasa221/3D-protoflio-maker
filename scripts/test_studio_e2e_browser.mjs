// scripts/test_studio_e2e_browser.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

async function runStudioE2ETest() {
  console.log('=== STARTING LOCAL VITE SERVER FOR PRECISE E2E BROWSER TEST ===');
  const server = await createServer({
    server: { port: 5174 }
  });
  await server.listen();
  console.log('Local dev server running on http://localhost:5174');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const txt = `[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
    logs.push(txt);
    if (msg.type() === 'error') errors.push(txt);
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}`);
  });

  // Inject valid Supabase session structure
  await page.addInitScript(() => {
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
  });

  console.log('\n1. Navigating to http://localhost:5174/studio...');
  await page.goto('http://localhost:5174/studio', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to customize workspace
  await page.evaluate(() => {
    if (typeof window.switchWorkspaceNav === 'function') {
      window.switchWorkspaceNav('customize');
    }
  });
  await page.waitForTimeout(500);

  // Check DOM for tier chip and theme grid
  const domInfo = await page.evaluate(() => {
    const tierChip = document.getElementById('tier-chip');
    const themeGrid = document.getElementById('theme-grid');
    const themeCards = Array.from(document.querySelectorAll('.theme-card'));
    return {
      url: window.location.href,
      tierChipPresent: Boolean(tierChip),
      tierChipText: tierChip?.textContent?.trim(),
      themeCardsCount: themeCards.length,
      themes: themeCards.map(c => c.querySelector('.theme-name')?.textContent?.trim())
    };
  });
  console.log('DOM Info in Studio:', JSON.stringify(domInfo, null, 2));

  // TEST 1: Click FREE Badge
  console.log('\n2. Testing Click on FREE Badge...');
  await page.click('#tier-chip');
  await page.waitForTimeout(500);

  const modalAfterFreeBadge = await page.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const card = document.querySelector('.cv-modal-card');
    const title = card?.querySelector('h2')?.textContent;
    const plans = Array.from(document.querySelectorAll('.btn-trigger-checkout')).map(b => b.getAttribute('data-plan'));
    return {
      overlayPresent: Boolean(overlay),
      overlayVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      cardPresent: Boolean(card),
      modalTitle: title,
      plansAvailable: plans
    };
  });
  console.log('Modal state after clicking FREE badge:', modalAfterFreeBadge);

  // Close modal
  await page.click('#btn-close-billing');
  await page.waitForTimeout(300);

  // TEST 2: Click Locked Theme "Cyber Command" (Pro)
  console.log('\n3. Testing Click on Locked Pro Theme (hacker / Cyber Command)...');
  await page.evaluate(() => {
    window.selectTheme('hacker', true);
  });
  await page.waitForTimeout(500);

  const modalAfterCyberCommand = await page.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const proButton = document.querySelector('.btn-trigger-checkout[data-plan="pro"]');
    const proCard = proButton?.closest('div');
    const isProHighlighted = proCard ? window.getComputedStyle(proCard).boxShadow.includes('124, 58, 237') || window.getComputedStyle(proCard).borderColor.includes('124') : false;
    const recommendedBadge = proCard?.querySelector('span')?.textContent;
    return {
      overlayPresent: Boolean(overlay),
      overlayVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      isProHighlighted,
      recommendedBadge
    };
  });
  console.log('Modal state after clicking Cyber Command:', modalAfterCyberCommand);

  // Close modal
  await page.click('#btn-close-billing');
  await page.waitForTimeout(300);

  // TEST 3: Click Locked Theme "Quantum Aurora" (Premium)
  console.log('\n4. Testing Click on Locked Premium Theme (quantum / Quantum Aurora)...');
  await page.evaluate(() => {
    window.selectTheme('quantum', true);
  });
  await page.waitForTimeout(500);

  const modalAfterQuantum = await page.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const premButton = document.querySelector('.btn-trigger-checkout[data-plan="premium"]');
    const premCard = premButton?.closest('div');
    const isPremHighlighted = premCard ? window.getComputedStyle(premCard).boxShadow.includes('124, 58, 237') || window.getComputedStyle(premCard).borderColor.includes('124') : false;
    const recommendedBadge = premCard?.querySelector('span')?.textContent;
    return {
      overlayPresent: Boolean(overlay),
      overlayVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      isPremHighlighted,
      recommendedBadge
    };
  });
  console.log('Modal state after clicking Quantum Aurora:', modalAfterQuantum);

  // Close modal
  await page.click('#btn-close-billing');
  await page.waitForTimeout(300);

  // TEST 4: Click Free Theme "Code Matrix"
  console.log('\n5. Testing Click on Free Theme (code / Code Matrix)...');
  const codeThemeResult = await page.evaluate(() => {
    window.selectTheme('code', false);
    const overlay = document.querySelector('.billing-modal-overlay');
    return {
      activeTheme: window.portfolioData?.theme,
      modalOpened: Boolean(overlay)
    };
  });
  console.log('Result of clicking Code Matrix:', codeThemeResult);

  console.log('\n=== CONSOLE ERRORS CAPTURED DURING ENTIRE RUN ===');
  console.log(errors.length ? errors.join('\n') : '0 CONSOLE ERRORS (CLEAN)');

  await browser.close();
  await server.close();
  console.log('\n=== TEST COMPLETE ===');
}

runStudioE2ETest().catch(console.error);
