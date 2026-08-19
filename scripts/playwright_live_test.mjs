// scripts/playwright_live_test.mjs
import { chromium } from 'playwright';

async function runLiveProductionTest() {
  console.log('=== FINAL THEME UX & REAL INSTAPAY PRODUCTION ACCEPTANCE SUITE ===');
  console.log('Target: https://portfolio-maker-murex.vercel.app/\n');

  const browser = await chromium.launch({ headless: true });

  const authInitScript = () => {
    const mockUser = {
      id: '00000000-0000-4000-a000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'freetester_themes@example.com',
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

  async function getCleanPage(viewport = { width: 1440, height: 900 }) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.addInitScript(authInitScript);
    await page.goto('https://portfolio-maker-murex.vercel.app/studio', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      if (typeof window.switchWorkspaceNav === 'function') window.switchWorkspaceNav('customize');
    });
    await page.waitForTimeout(500);
    return { context, page };
  }

  // ─────────────────────────────────────────────────────────────
  // PART A: 15 THEME CATALOG DOM AUDIT BEFORE ANY CLICK
  // ─────────────────────────────────────────────────────────────
  console.log('PART A: Auditing 15-Theme Catalog in Customize Workspace...');
  const { context: ctx1, page: p1 } = await getCleanPage();

  const themeAudit = await p1.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.theme-card'));
    const cyberCard = cards.find(c => c.textContent.includes('Cyber Command'));
    const quantumCard = cards.find(c => c.textContent.includes('Quantum Aurora'));

    const details = cards.map(c => {
      const name = c.querySelector('.theme-name span')?.textContent?.trim();
      const badge = c.querySelector('.pro-badge')?.textContent?.trim() || 'FREE';
      const isLocked = c.classList.contains('theme-card--locked');
      const hasPreviewBtn = Boolean(c.querySelector('.btn-preview-theme'));
      const hasUnlockBtn = Boolean(c.querySelector('.btn-unlock-theme'));
      const hasApplyBtn = Boolean(c.querySelector('.btn-apply-theme'));

      return { name, badge, isLocked, hasPreviewBtn, hasUnlockBtn, hasApplyBtn };
    });

    const cyberBadge = cyberCard?.querySelector('.pro-badge')?.textContent?.trim();
    const quantumBadge = quantumCard?.querySelector('.pro-badge')?.textContent?.trim();

    return {
      totalCards: cards.length,
      freeUnlocked: details.filter(d => !d.isLocked),
      proLocked: details.filter(d => d.isLocked && d.badge.includes('PRO')),
      premiumLocked: details.filter(d => d.isLocked && d.badge.includes('PREMIUM')),
      cyberShowsPro: cyberBadge === '🔒 PRO',
      quantumShowsPremium: quantumBadge === '💎 PREMIUM',
      cards: details
    };
  });

  console.log('  Total Actual Cards in DOM:', themeAudit.totalCards);
  console.log('  Free Unlocked (Available):', themeAudit.freeUnlocked.length, '->', themeAudit.freeUnlocked.map(c => c.name).join(', '));
  console.log('  Pro Locked Visible:', themeAudit.proLocked.length, '->', themeAudit.proLocked.map(c => c.name).join(', '));
  console.log('  Premium Locked Visible:', themeAudit.premiumLocked.length, '->', themeAudit.premiumLocked.map(c => c.name).join(', '));
  console.log('  Cyber Command shows 🔒 PRO before click:', themeAudit.cyberShowsPro ? 'YES' : 'NO');
  console.log('  Quantum Aurora shows 💎 PREMIUM before click:', themeAudit.quantumShowsPremium ? 'YES' : 'NO');

  // ─────────────────────────────────────────────────────────────
  // PART A2: THEME PREVIEW WITHOUT SAVED MUTATION & NO AUTO-PRICING
  // ─────────────────────────────────────────────────────────────
  console.log('\nPART A2: Testing Theme Preview (No Modal Auto-Launch & No Saved Theme Mutation)...');
  
  const initialTheme = await p1.evaluate(() => window.portfolioData?.theme || 'minimal');
  console.log('  Initial Active Saved Theme:', initialTheme);

  // Click Preview on Cyber Command
  console.log('  Clicking "👁️ Preview" on Cyber Command...');
  await p1.evaluate(() => {
    const cyberCard = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Cyber Command'));
    const previewBtn = cyberCard?.querySelector('.btn-preview-theme') || cyberCard;
    previewBtn?.click();
  });
  await p1.waitForTimeout(500);

  const previewAudit = await p1.evaluate((init) => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const modalVisible = Boolean(overlay && window.getComputedStyle(overlay).display === 'flex');
    const currentSavedTheme = window.portfolioData?.theme;
    return {
      modalAutoOpened: modalVisible,
      currentSavedTheme,
      themeUnchanged: currentSavedTheme === init
    };
  }, initialTheme);

  console.log('  Pricing Modal Auto-Opened after Preview:', previewAudit.modalAutoOpened ? 'FAIL (Opened)' : 'PASS (Did NOT open)');
  console.log('  Active Theme unchanged after Preview:', previewAudit.themeUnchanged ? 'PASS' : 'FAIL', `(${previewAudit.currentSavedTheme})`);

  // ─────────────────────────────────────────────────────────────
  // PART A3: EXPLICIT UPGRADE BUTTON CLICKS
  // ─────────────────────────────────────────────────────────────
  console.log('\nPART A3: Testing Explicit Unlock CTA on Cyber Command ("Unlock with Pro")...');
  await p1.evaluate(() => {
    const cyberCard = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Cyber Command'));
    const unlockBtn = cyberCard?.querySelector('.btn-unlock-theme');
    unlockBtn?.click();
  });
  await p1.waitForSelector('.pricing-card', { timeout: 10000 });

  const proTargetState = await p1.evaluate(() => {
    const proBtn = document.querySelector('.btn-trigger-checkout[data-plan="pro"]');
    const proCard = proBtn?.closest('.pricing-card');
    const badge = proCard?.querySelector('span[style*="position: absolute"]')?.textContent?.trim();
    return { proTargeted: Boolean(badge === 'RECOMMENDED') };
  });
  console.log('  Pro Upgrade Modal Opened & Targeted:', proTargetState.proTargeted ? 'PASS' : 'FAIL');

  await p1.click('#btn-close-billing');
  await p1.waitForTimeout(300);

  console.log('  Testing Explicit Unlock CTA on Quantum Aurora ("Unlock Premium")...');
  await p1.evaluate(() => {
    const quantumCard = Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Quantum Aurora'));
    const unlockBtn = quantumCard?.querySelector('.btn-unlock-theme');
    unlockBtn?.click();
  });
  await p1.waitForSelector('.pricing-card', { timeout: 10000 });

  const premTargetState = await p1.evaluate(() => {
    const premBtn = document.querySelector('.btn-trigger-checkout[data-plan="premium"]');
    const premCard = premBtn?.closest('.pricing-card');
    const badge = premCard?.querySelector('span[style*="position: absolute"]')?.textContent?.trim();
    return { premTargeted: Boolean(badge === 'RECOMMENDED') };
  });
  console.log('  Premium Upgrade Modal Opened & Targeted:', premTargetState.premTargeted ? 'PASS' : 'FAIL');

  await p1.click('#btn-close-billing');
  await p1.waitForTimeout(300);

  // ─────────────────────────────────────────────────────────────
  // PART A4: SCROLLING TO REACH LAST CARD (QUANTUM AURORA)
  // ─────────────────────────────────────────────────────────────
  console.log('\nPART A4: Testing Full Scrolling to 15th Card (Quantum Aurora)...');
  const scrollTest = await p1.evaluate(() => {
    const sidebar = document.getElementById('sidebar-content');
    const lastCard = document.querySelector('.theme-card[data-theme-id="quantum"]') || Array.from(document.querySelectorAll('.theme-card')).find(c => c.textContent.includes('Quantum Aurora'));
    if (!sidebar || !lastCard) return { success: false };

    sidebar.scrollTop = sidebar.scrollHeight;
    const rect = lastCard.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const isReachable = rect.top >= sidebarRect.top && rect.bottom <= (sidebarRect.bottom + 60);

    return {
      success: true,
      lastCardName: lastCard.querySelector('.theme-name span')?.textContent?.trim(),
      isReachable,
      scrollTop: sidebar.scrollTop
    };
  });
  console.log('  All 15 Themes Reachable & Visible via Scroll:', scrollTest.isReachable ? 'YES' : 'NO', `(Reached: ${scrollTest.lastCardName})`);
  await ctx1.close();

  // ─────────────────────────────────────────────────────────────
  // PART B: REAL INSTAPAY ENDPOINT & SCREEN AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('\nPART B: Auditing Real Production InstaPay Destination & Screen...');
  const { context: ctx2, page: p2 } = await getCleanPage();

  // Fetch API endpoint
  const apiConfig = await p2.evaluate(async () => {
    const res = await fetch('/api/billing?action=payment-config');
    return res.json();
  });
  console.log('  Payment Config API Response:', apiConfig);

  // Open InstaPay Screen via Pro checkout
  await p2.evaluate(() => {
    if (typeof window.openBillingModal === 'function') window.openBillingModal();
  });
  await p2.waitForSelector('.pricing-card', { timeout: 10000 });
  await p2.click('.btn-trigger-checkout[data-plan="pro"]');
  await p2.waitForSelector('#btn-back-to-plans', { timeout: 10000 });

  const screenAudit = await p2.evaluate(() => {
    const card = document.querySelector('.billing-modal-overlay');
    const text = card?.textContent || '';
    const hasIPA = text.includes('saleh2005mohamed@instapay');
    const hasPhone = text.includes('01270024222');
    const hasName = text.includes('SALEH MOHAMED SALEH');
    const hasOr = text.includes('OR');
    const mentionsWallet = /vodafone cash|mobile wallet|wallet transfer|send to wallet/i.test(text.replace('not a mobile wallet transfer', ''));
    const hasExplicitNote = text.includes('This is an InstaPay transfer, not a mobile wallet transfer.');

    return { hasIPA, hasPhone, hasName, hasOr, mentionsWallet, hasExplicitNote };
  });

  console.log('  Screen displays Account Name (SALEH MOHAMED SALEH):', screenAudit.hasName ? 'YES' : 'NO');
  console.log('  Screen displays IPA (saleh2005mohamed@instapay):', screenAudit.hasIPA ? 'YES' : 'NO');
  console.log('  Screen displays Phone Number (01270024222):', screenAudit.hasPhone ? 'YES' : 'NO');
  console.log('  Screen displays Phone & IPA as alternatives (OR):', screenAudit.hasOr ? 'YES' : 'NO');
  console.log('  Screen does not mention unauthorized mobile wallet transfers:', !screenAudit.mentionsWallet ? 'PASS' : 'FAIL');
  console.log('  Screen has approved InstaPay-only disclaimer:', screenAudit.hasExplicitNote ? 'PASS' : 'FAIL');

  await ctx2.close();
  await browser.close();
  console.log('\n=== ACCEPTANCE SUITE COMPLETE ===');
}

runLiveProductionTest().catch(console.error);
