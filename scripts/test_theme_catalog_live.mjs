// scripts/test_theme_catalog_live.mjs
import { chromium } from 'playwright';

async function runThemeCatalogAudit() {
  console.log('=== AUDITING THEME CATALOG ON LIVE PRODUCTION https://portfolio-maker-murex.vercel.app/ ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject Free User session
  await page.addInitScript(() => {
    const mockUser = {
      id: '00000000-0000-4000-a000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'free_catalog_tester@example.com',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: 'Free Catalog Tester' },
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

  console.log('1. Navigating to /studio...');
  await page.goto('https://portfolio-maker-murex.vercel.app/studio', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to Customize workspace
  console.log('2. Switching to Customize workspace...');
  await page.evaluate(() => {
    if (typeof window.switchWorkspaceNav === 'function') {
      window.switchWorkspaceNav('customize');
    }
  });
  await page.waitForTimeout(600);

  // Audit theme grid cards in DOM
  const auditResult = await page.evaluate(() => {
    const themeGrid = document.getElementById('theme-grid');
    const sidebarContent = document.getElementById('sidebar-content');
    const cards = Array.from(document.querySelectorAll('#theme-grid .theme-card'));

    const cardDetails = cards.map((card, index) => {
      const nameEl = card.querySelector('.theme-name span') || card.querySelector('.theme-name');
      const badgeEl = card.querySelector('.pro-badge');
      const emojiEl = card.querySelector('.theme-emoji');
      const rect = card.getBoundingClientRect();
      const isLocked = card.classList.contains('theme-card--locked') || card.getAttribute('onclick')?.includes('true');
      
      return {
        index: index + 1,
        name: nameEl?.textContent?.trim(),
        emoji: emojiEl?.textContent?.trim(),
        badge: badgeEl?.textContent?.trim() || null,
        isLocked,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height)
      };
    });

    return {
      gridExists: Boolean(themeGrid),
      sidebarScrollHeight: sidebarContent?.scrollHeight,
      sidebarClientHeight: sidebarContent?.clientHeight,
      canScroll: sidebarContent ? sidebarContent.scrollHeight > sidebarContent.clientHeight : false,
      totalCards: cards.length,
      unlockedCards: cardDetails.filter(c => !c.isLocked),
      lockedProCards: cardDetails.filter(c => c.isLocked && c.badge?.includes('PRO')),
      lockedPremiumCards: cardDetails.filter(c => c.isLocked && c.badge?.includes('PREMIUM')),
      cards: cardDetails
    };
  });

  console.log('\nAudit Result Summary:');
  console.log('- Total Cards in DOM:', auditResult.totalCards);
  console.log('- Selectable / Unlocked:', auditResult.unlockedCards.length, '->', auditResult.unlockedCards.map(c => c.name).join(', '));
  console.log('- Locked Pro:', auditResult.lockedProCards.length, '->', auditResult.lockedProCards.map(c => c.name).join(', '));
  console.log('- Locked Premium:', auditResult.lockedPremiumCards.length, '->', auditResult.lockedPremiumCards.map(c => c.name).join(', '));
  console.log('- Sidebar Scrollable:', auditResult.canScroll, `(${auditResult.sidebarScrollHeight}px scrollHeight vs ${auditResult.sidebarClientHeight}px clientHeight)`);

  console.log('\nAll 15 Cards in DOM:');
  auditResult.cards.forEach(c => {
    console.log(`  ${c.index}. ${c.emoji || ''} ${c.name} [${c.badge || 'FREE'}] (Locked: ${c.isLocked})`);
  });

  // Test scrolling down to the 15th card (Quantum Aurora)
  console.log('\n3. Testing Scroll to bottom (Quantum Aurora)...');
  const scrollTest = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar-content');
    const lastCard = document.querySelector('#theme-grid .theme-card:last-child');
    if (!sidebar || !lastCard) return { success: false };

    // Scroll sidebar to bottom
    sidebar.scrollTop = sidebar.scrollHeight;
    const rect = lastCard.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();

    const isVisibleInViewport = rect.top >= sidebarRect.top && rect.bottom <= (sidebarRect.bottom + 50);
    return {
      success: true,
      lastCardName: lastCard.querySelector('.theme-name')?.textContent?.trim(),
      scrollTop: sidebar.scrollTop,
      maxScroll: sidebar.scrollHeight - sidebar.clientHeight,
      cardTop: Math.round(rect.top),
      sidebarBottom: Math.round(sidebarRect.bottom),
      isVisibleInViewport
    };
  });
  console.log('Scroll to Bottom Test:', scrollTest);

  // Test clicking locked Pro theme (Cyber Command)
  console.log('\n4. Testing Click on Cyber Command (Pro)...');
  const cyberClick = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('#theme-grid .theme-card')).find(c => c.textContent.includes('Cyber Command'));
    if (card) card.click();
  });
  await page.waitForTimeout(600);

  const modalPro = await page.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const proButton = document.querySelector('.btn-trigger-checkout[data-plan="pro"]');
    const proCard = proButton?.closest('div');
    return {
      modalVisible: Boolean(overlay && window.getComputedStyle(overlay).display === 'flex'),
      isProHighlighted: proCard ? (window.getComputedStyle(proCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(proCard).borderColor?.includes('124')) : false
    };
  });
  console.log('Modal state after Cyber Command click:', modalPro);

  // Close modal
  await page.click('#btn-close-billing');
  await page.waitForTimeout(300);

  // Test clicking locked Premium theme (Quantum Aurora)
  console.log('\n5. Testing Click on Quantum Aurora (Premium)...');
  await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('#theme-grid .theme-card')).find(c => c.textContent.includes('Quantum Aurora'));
    if (card) card.click();
  });
  await page.waitForTimeout(600);

  const modalPrem = await page.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const premButton = document.querySelector('.btn-trigger-checkout[data-plan="premium"]');
    const premCard = premButton?.closest('div');
    return {
      modalVisible: Boolean(overlay && window.getComputedStyle(overlay).display === 'flex'),
      isPremHighlighted: premCard ? (window.getComputedStyle(premCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(premCard).borderColor?.includes('124')) : false
    };
  });
  console.log('Modal state after Quantum Aurora click:', modalPrem);

  await browser.close();
}

runThemeCatalogAudit().catch(console.error);
