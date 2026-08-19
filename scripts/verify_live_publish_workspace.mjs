import { chromium } from 'playwright';

async function runPublishWorkspaceLiveAudit() {
  console.log('============================================================');
  console.log('  LIVE PRODUCTION AUDIT — REDESIGNED PUBLISH WORKSPACE');
  console.log('  Target: https://portfolio-maker-murex.vercel.app/');
  console.log('============================================================\n');

  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'Mobile 320px (iPhone SE narrow)', width: 320, height: 568 },
    { name: 'Mobile 375px (iPhone SE)', width: 375, height: 667 },
    { name: 'Mobile 390px (iPhone 14)', width: 390, height: 844 },
    { name: 'Mobile 430px (iPhone 14 Pro Max)', width: 430, height: 932 },
    { name: 'Desktop 1440px', width: 1440, height: 900 }
  ];

  let totalErrors = 0;

  for (const vp of viewports) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`------------------------------------------------------------`);

    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  [Console Error]:`, msg.text());
      }
    });

    try {
      await page.goto('https://portfolio-maker-murex.vercel.app/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Build Studio App and render Publish tab
      await page.evaluate(() => {
        if (typeof window.buildHTML === 'function') {
          window.buildHTML();
        }
        if (window.globalEntitlements) {
          window.globalEntitlements.setSubscription({ plan_id: 'free', status: 'active' });
        }
        if (window.portfolioData) {
          window.portfolioData.isLegacy = false;
          window.portfolioData.is_legacy = false;
          window.portfolioData.publishedAt = null;
          window.portfolioData.published_at = null;
        }
        if (typeof window.renderPublishTab === 'function') {
          window.renderPublishTab();
        }
        if (typeof window.switchWorkspace === 'function') {
          window.switchWorkspace('publish');
        } else if (typeof window.switchTab === 'function') {
          window.switchTab('publish');
        }
      });
      await page.waitForTimeout(600);

      const publishPanel = await page.$('#panel-publish');
      const publishContent = await page.$('#publish-panel-content');
      if (!publishPanel || !publishContent) {
        console.error('  ❌ FAIL: Publish panel or content not found in DOM');
        totalErrors++;
        await context.close();
        continue;
      }

      const panelText = await publishContent.innerText();

      // Free user invariants
      const hasFreeHeader = panelText.includes('Publish & Export');
      const hasFreeSub = panelText.includes('Your portfolio is ready. Export it for free');
      const hasCardA = panelText.includes('Export Your Portfolio');
      const hasCardB = panelText.includes('Publish Your Portfolio Online');
      const hasUsageMeter = panelText.includes('0 of 1 exports used this month') || panelText.includes('1 of 1 exports used this month');
      const hasNoInfinity = !panelText.includes('Infinity');
      const hasUpgradeProBtn = panelText.includes('Upgrade to Pro — 600 EGP/month');

      // Verify forbidden controls are NOT present for Free
      const hasPublicUrlField = await page.$('#public-url-text');
      const hasCopyLinkBtn = await page.$('#btn-copy-public-url');
      const hasOpenPortfolioLink = await page.$('#link-open-public-portfolio');
      const hasChangeUrlInput = await page.$('#f-publish-slug');
      const hasPublishLiveBtn = await page.$('#btn-publish-portfolio');

      console.log('  1. Free Workspace Header (Publish & Export):', hasFreeHeader ? 'PASS' : 'FAIL');
      console.log('  2. Free Subtitle:', hasFreeSub ? 'PASS' : 'FAIL');
      console.log('  3. Card A (Free Export):', hasCardA ? 'PASS' : 'FAIL');
      console.log('  4. Card B (Online Publishing / Pro):', hasCardB ? 'PASS' : 'FAIL');
      console.log('  5. Usage Meter (0/1 or 1/1):', hasUsageMeter ? 'PASS' : 'FAIL');
      console.log('  6. Zero Infinity Glitches:', hasNoInfinity ? 'PASS' : 'FAIL');
      console.log('  7. Pro CTA Button (600 EGP/mo):', hasUpgradeProBtn ? 'PASS' : 'FAIL');
      console.log('  8. Public URL Field Hidden for Free:', !hasPublicUrlField ? 'PASS' : 'FAIL');
      console.log('  9. Copy Link Button Hidden for Free:', !hasCopyLinkBtn ? 'PASS' : 'FAIL');
      console.log('  10. Open Portfolio Link Hidden for Free:', !hasOpenPortfolioLink ? 'PASS' : 'FAIL');
      console.log('  11. Change URL Input Hidden for Free:', !hasChangeUrlInput ? 'PASS' : 'FAIL');
      console.log('  12. Publish Live Button Hidden for Free:', !hasPublishLiveBtn ? 'PASS' : 'FAIL');

      // Check for mixed Arabic
      const hasArabic = /[\u0600-\u06FF]/.test(panelText);
      console.log('  13. Zero Arabic/English Mixing in Publish:', !hasArabic ? 'PASS' : 'FAIL');

      // Check footer visibility in Publish
      const footerVisible = await page.evaluate(() => {
        const f = document.querySelector('.sidebar-footer');
        return f ? window.getComputedStyle(f).display !== 'none' : false;
      });
      console.log('  14. Global Sidebar Footer Hidden on Publish Tab:', !footerVisible ? 'PASS' : 'FAIL');

      // Check CTA interaction (opens Billing Modal)
      const upgradeBtn = await page.$('#btn-upgrade-pro-publish');
      if (upgradeBtn) {
        await upgradeBtn.click();
        await page.waitForTimeout(600);
        const billingOverlay = await page.$('.billing-modal-overlay, #billing-modal-container');
        console.log('  15. Upgrade CTA Opens Billing Modal:', billingOverlay ? 'PASS' : 'FAIL');

        // Close billing modal
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.billing-modal-overlay button, .modal-close');
          if (closeBtn) closeBtn.click();
        });
        await page.waitForTimeout(400);
      }

      // Check Customize workspace theme catalog (15 themes)
      await page.evaluate(() => {
        if (typeof window.switchWorkspace === 'function') {
          window.switchWorkspace('customize');
        } else if (typeof window.switchTab === 'function') {
          window.switchTab('design');
        }
        if (typeof window.buildThemeGrid === 'function') {
          window.buildThemeGrid();
        }
      });
      await page.waitForTimeout(600);

      const themeCardsCount = await page.evaluate(() => {
        return document.querySelectorAll('.theme-card, [data-theme-id]').length;
      });
      console.log(`  16. Free User Sees All 15 Themes in Customize: ${themeCardsCount} found ->`, themeCardsCount >= 15 ? 'PASS' : 'FAIL');

      // Check Horizontal Overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
      });
      console.log('  17. No Horizontal Scroll Overflow:', !hasHorizontalScroll ? 'PASS' : 'FAIL');

    } catch (err) {
      console.error(`  ❌ Error during viewport audit:`, err.message);
      totalErrors++;
    } finally {
      await context.close();
    }
  }

  // Next: Test Pro & Premium & Keep It Live rendering via client-side evaluation
  console.log(`\n------------------------------------------------------------`);
  console.log(`Testing Pro & Premium & Keep It Live Workspace Renderings`);
  console.log(`------------------------------------------------------------`);

  const proContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const proPage = await proContext.newPage();

  try {
    await proPage.goto('https://portfolio-maker-murex.vercel.app/', { waitUntil: 'networkidle' });
    await proPage.waitForTimeout(1000);

    await proPage.evaluate(() => {
      if (typeof window.buildHTML === 'function') window.buildHTML();
      if (typeof window.switchWorkspace === 'function') window.switchWorkspace('publish');
    });

    // Test PRO state
    const proResults = await proPage.evaluate(() => {
      window.globalEntitlements.setSubscription({ plan_id: 'pro', status: 'active' });
      window.portfolioData.publishedAt = '2026-08-20T01:30:00.000Z';
      window.portfolioData.slug = 'johndoe';
      window.renderPublishTab();

      const el = document.getElementById('publish-panel-content');
      const text = el ? el.innerText : '';
      return {
        hasProHeader: text.includes('Publish & Share'),
        hasLiveBadge: text.includes('LIVE'),
        hasProPlanBadge: text.includes('PRO'),
        hasUrl: text.includes('/u/johndoe'),
        hasCopyBtn: Boolean(document.getElementById('btn-copy-public-url')),
        hasOpenLink: Boolean(document.getElementById('link-open-public-portfolio')),
        hasUpdateBtn: text.includes('Update Live Portfolio'),
        hasExportCard: text.includes('Standalone Export & Backup'),
        hasUnlimitedText: text.includes('Unlimited exports are included')
      };
    });

    console.log('  1. Pro Workspace Header (Publish & Share):', proResults.hasProHeader ? 'PASS' : 'FAIL');
    console.log('  2. Pro Status Badge (LIVE):', proResults.hasLiveBadge ? 'PASS' : 'FAIL');
    console.log('  3. Pro Public URL Display (/u/johndoe):', proResults.hasUrl ? 'PASS' : 'FAIL');
    console.log('  4. Pro Copy Link Button:', proResults.hasCopyBtn ? 'PASS' : 'FAIL');
    console.log('  5. Pro Open Portfolio Link:', proResults.hasOpenLink ? 'PASS' : 'FAIL');
    console.log('  6. Pro Update Live Portfolio Button:', proResults.hasUpdateBtn ? 'PASS' : 'FAIL');
    console.log('  7. Pro Standalone Export & Backup (Unlimited):', proResults.hasUnlimitedText ? 'PASS' : 'FAIL');

    // Test PREMIUM state
    const premiumResults = await proPage.evaluate(() => {
      window.globalEntitlements.setSubscription({ plan_id: 'premium', status: 'active' });
      window.renderPublishTab();

      const el = document.getElementById('publish-panel-content');
      const text = el ? el.innerText : '';
      return {
        hasPremiumBadge: text.includes('PREMIUM'),
        hasCustomDomainCard: text.includes('Custom Domain'),
        hasComingSoon: text.includes('COMING SOON')
      };
    });

    console.log('  8. Premium Plan Badge:', premiumResults.hasPremiumBadge ? 'PASS' : 'FAIL');
    console.log('  9. Premium Custom Domain Card:', premiumResults.hasCustomDomainCard ? 'PASS' : 'FAIL');
    console.log('  10. Custom Domain Coming Soon Status:', premiumResults.hasComingSoon ? 'PASS' : 'FAIL');

    // Test KEEP IT LIVE state
    const kilResults = await proPage.evaluate(() => {
      window.globalEntitlements.setSubscription({ plan_id: 'free', status: 'keep_it_live' });
      window.renderPublishTab();

      const el = document.getElementById('publish-panel-content');
      const text = el ? el.innerText : '';
      return {
        hasKilHeader: text.includes('Publish & Retention'),
        hasKilBadge: text.includes('Keep It Live'),
        hasUrl: text.includes('/u/johndoe'),
        hasNotice: text.includes('retained online via Keep It Live')
      };
    });

    console.log('  11. Keep It Live Header & Notice:', (kilResults.hasKilHeader && kilResults.hasNotice) ? 'PASS' : 'FAIL');

  } catch (err) {
    console.error('  ❌ Error in simulated tier tests:', err.message);
    totalErrors++;
  } finally {
    await proContext.close();
  }

  await browser.close();

  console.log('\n============================================================');
  console.log(`  LIVE AUDIT FINISHED — Total Errors: ${totalErrors}`);
  console.log('============================================================');
}

runPublishWorkspaceLiveAudit();
