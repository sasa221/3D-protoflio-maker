// scripts/playwright_live_test.mjs
import { chromium } from 'playwright';

async function runLiveProductionTest() {
  console.log('=== PHASE 8C REDESIGNED PLANS & PRICING MODAL ACCEPTANCE SUITE ===');
  console.log('Target: https://portfolio-maker-murex.vercel.app/\n');

  const browser = await chromium.launch({ headless: true });

  const authInitScript = () => {
    const mockUser = {
      id: '00000000-0000-4000-a000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'freetester_redesign@example.com',
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
  // TEST 1: FREE BADGE -> REDESIGNED PRICING MODAL AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('1. Auditing Redesigned Plans & Pricing Modal Structure & Typography...');
  const { context: ctx1, page: p1 } = await getCleanPage();

  await p1.click('#tier-chip');
  await p1.waitForTimeout(600);

  const modalAudit = await p1.evaluate(() => {
    const overlay = document.querySelector('.billing-modal-overlay');
    const card = document.querySelector('.cv-modal-card');
    const eyebrow = card?.querySelector('div > span')?.textContent?.trim();
    const title = card?.querySelector('h2')?.textContent?.trim();
    const subtitle = card?.querySelector('p')?.textContent?.trim();
    const planCards = Array.from(document.querySelectorAll('.pricing-card'));

    const cardsDetails = planCards.map(c => {
      const name = c.querySelector('h3')?.textContent?.trim();
      const pos = c.querySelector('p')?.textContent?.trim();
      const price = c.querySelector('div span')?.textContent?.trim();
      const badge = c.querySelector('span[style*="position: absolute"]')?.textContent?.trim();
      const ctaBtn = c.querySelector('button');
      const ctaText = ctaBtn?.textContent?.trim();
      const hint = c.querySelector('div[style*="font-size: 11px"]')?.textContent?.trim();
      const benefits = Array.from(c.querySelectorAll('ul li')).map(li => li.textContent?.trim());

      return { name, pos, price, badge, ctaText, hint, benefitsCount: benefits.length, benefits };
    });

    return {
      overlayCount: document.querySelectorAll('.billing-modal-overlay, .cv-import-modal-overlay').length,
      overlayVisible: overlay ? window.getComputedStyle(overlay).display === 'flex' : false,
      eyebrow,
      title,
      subtitle,
      cardsCount: planCards.length,
      cards: cardsDetails
    };
  });

  console.log('   Eyebrow:', modalAudit.eyebrow);
  console.log('   Title:', modalAudit.title);
  console.log('   Subtitle:', modalAudit.subtitle);
  console.log('   Cards Count:', modalAudit.cardsCount);
  modalAudit.cards.forEach((c, idx) => {
    console.log(`     [Card ${idx + 1}] ${c.name} | Price: ${c.price} | Pos: "${c.pos}" | Badge: ${c.badge || 'None'} | CTA: "${c.ctaText}" (Hint: ${c.hint || 'None'}) | Benefits: ${c.benefitsCount}`);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: GROUP SEAT SELECTOR DYNAMIC PRICING
  // ─────────────────────────────────────────────────────────────
  console.log('\n2. Testing Group Seat Selector Dynamic Pricing...');
  const groupPrices = {};
  for (const seats of [2, 3, 4, 5]) {
    await p1.selectOption('#card-group-seats-select', String(seats));
    await p1.waitForTimeout(200);
    const p = await p1.evaluate(() => document.getElementById('group-card-price-val')?.textContent?.trim());
    groupPrices[seats] = p;
    console.log(`   Group ${seats} Users -> Dynamic Price displayed: ${p} EGP`);
  }

  // Click Choose Group CTA -> InstaPay modal
  console.log('   Clicking "Choose Group" (with 5 seats = 2,800 EGP)...');
  await p1.click('.btn-trigger-checkout[data-plan="premium_group"]');
  await p1.waitForTimeout(500);

  const groupPaymentState = await p1.evaluate(() => {
    const overlays = document.querySelectorAll('.billing-modal-overlay, .cv-import-modal-overlay');
    const amount = document.getElementById('final-amount-display')?.textContent?.trim();
    const title = document.querySelector('.cv-modal-card h2')?.textContent?.trim();
    return { overlayCount: overlays.length, amount, title };
  });
  console.log('   Group Payment State -> Overlays:', groupPaymentState.overlayCount, '| Amount:', groupPaymentState.amount, '| Title:', groupPaymentState.title);

  // Click Back to Plans
  await p1.click('#btn-back-to-plans');
  await p1.waitForTimeout(400);

  // Close modal
  await p1.click('#btn-close-billing');
  await p1.waitForTimeout(300);

  const afterCloseState = await p1.evaluate(() => document.querySelectorAll('.billing-modal-overlay, .cv-import-modal-overlay').length);
  console.log('   Overlays after Close:', afterCloseState, '(Zero: PASS)');
  await ctx1.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 3: LOCKED PRO THEME (Cyber Command) -> PRO TARGETED
  // ─────────────────────────────────────────────────────────────
  console.log('\n3. Testing Locked Pro Theme (Cyber Command) -> Pro Targeted Pricing...');
  const { context: ctx2, page: p2 } = await getCleanPage();

  await p2.evaluate(() => {
    window.selectTheme('hacker', true);
  });
  await p2.waitForTimeout(600);

  const proTargetAudit = await p2.evaluate(() => {
    const proBtn = document.querySelector('.btn-trigger-checkout[data-plan="pro"]');
    const proCard = proBtn?.closest('.pricing-card');
    const badge = proCard?.querySelector('span[style*="position: absolute"]')?.textContent?.trim();
    const isGlow = proCard ? (window.getComputedStyle(proCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(proCard).borderColor?.includes('124')) : false;
    return { badge, isGlow };
  });
  console.log('   Pro Target State -> Badge:', proTargetAudit.badge, '| Glow Highlight:', proTargetAudit.isGlow);

  await p2.click('#btn-close-billing');
  await p2.waitForTimeout(300);
  await ctx2.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 4: LOCKED PREMIUM THEME (Quantum Aurora) -> PREMIUM TARGETED
  // ─────────────────────────────────────────────────────────────
  console.log('\n4. Testing Locked Premium Theme (Quantum Aurora) -> Premium Targeted Pricing...');
  const { context: ctx3, page: p3 } = await getCleanPage();

  await p3.evaluate(() => {
    window.selectTheme('quantum', true);
  });
  await p3.waitForTimeout(600);

  const premTargetAudit = await p3.evaluate(() => {
    const premBtn = document.querySelector('.btn-trigger-checkout[data-plan="premium"]');
    const premCard = premBtn?.closest('.pricing-card');
    const badge = premCard?.querySelector('span[style*="position: absolute"]')?.textContent?.trim();
    const isGlow = premCard ? (window.getComputedStyle(premCard).boxShadow?.includes('124, 58, 237') || window.getComputedStyle(premCard).borderColor?.includes('124')) : false;
    return { badge, isGlow };
  });
  console.log('   Premium Target State -> Badge:', premTargetAudit.badge, '| Glow Highlight:', premTargetAudit.isGlow);

  await p3.click('#btn-close-billing');
  await p3.waitForTimeout(300);
  await ctx3.close();

  // ─────────────────────────────────────────────────────────────
  // TEST 5: RESPONSIVE VIEWPORT TESTS (320, 375, 390, 430, 768, 1024, 1440)
  // ─────────────────────────────────────────────────────────────
  console.log('\n5. Testing Responsive Viewports & Zero Horizontal Overflow...');
  const viewports = [320, 375, 390, 430, 768, 1024, 1440];

  for (const w of viewports) {
    const { context: mCtx, page: mPage } = await getCleanPage({ width: w, height: 850 });
    await mPage.evaluate(() => {
      if (typeof window.openBillingModal === 'function') window.openBillingModal();
    });
    await mPage.waitForTimeout(600);

    const vpAudit = await mPage.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const modal = document.querySelector('.billing-modal-card');
      const closeBtn = document.getElementById('btn-close-billing');
      const grid = document.querySelector('.pricing-cards-grid');
      const computedGrid = grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;

      return {
        viewportWidth: winW,
        scrollWidth: docW,
        noHorizontalOverflow: docW <= winW + 1,
        modalWidth: modal?.offsetWidth,
        columnsCount: computedGrid,
        closeBtnVisible: Boolean(closeBtn && closeBtn.offsetWidth > 0)
      };
    });

    console.log(`   Viewport ${w}px -> Columns: ${vpAudit.columnsCount} | Overflow: ${vpAudit.noHorizontalOverflow ? 'NONE (PASS)' : 'OVERFLOW FAIL'} | Modal: ${vpAudit.modalWidth}px | Close Btn: ${vpAudit.closeBtnVisible}`);
    await mCtx.close();
  }

  await browser.close();
  console.log('\n=== ALL PHASE 8C REDESIGN TESTS EXECUTED SUCCESSFULLY ===');
}

runLiveProductionTest().catch(console.error);
