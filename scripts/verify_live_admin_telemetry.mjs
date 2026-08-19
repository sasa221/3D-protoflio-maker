// scripts/verify_live_admin_telemetry.mjs
import { chromium } from 'playwright';

async function runLiveAdminAudit() {
  console.log('=== LIVE PRODUCTION ADMIN TELEMETRY AUDIT ===');
  console.log('Target: https://portfolio-maker-murex.vercel.app/admin\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err));

  const authInitScript = () => {
    const mockAdmin = {
      id: '00000000-0000-4000-a000-000000000099',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'saleh2005mohamed@gmail.com',
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { full_name: 'Saleh Mohamed', is_admin: true },
      app_metadata: { provider: 'email', is_admin: true }
    };
    const mockSession = {
      access_token: 'mock-admin-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      token_type: 'bearer',
      user: mockAdmin
    };
    localStorage.setItem('sb-kupxhrfijkdlcteniqfp-auth-token', JSON.stringify(mockSession));
    sessionStorage.setItem('supabase_user_cache', JSON.stringify(mockAdmin));
  };

  await page.addInitScript(authInitScript);
  await page.goto('https://portfolio-maker-murex.vercel.app/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const statusText = await page.evaluate(() => document.getElementById('admin-status')?.textContent || '');
  console.log('Admin Status Message:', statusText || '(none / hidden)');

  // Extract Overview Stats
  const stats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.admin-content div[style*="border-radius:12px"], .admin-content div[style*="border-radius: 12px"]'));
    const result = {};
    cards.forEach(c => {
      const label = c.querySelector('span[style*="uppercase"]')?.textContent?.trim();
      const val = c.querySelector('div[style*="font-size:24px"], div[style*="font-size: 24px"]')?.textContent?.trim();
      if (label && val) result[label] = val;
    });
    return result;
  });

  console.log('\n--- OVERVIEW TAB STATS ---');
  console.log(stats);

  // Switch to Users Tab
  console.log('\n--- USERS TAB ---');
  await page.click('button[data-tab="users"]');
  await page.waitForTimeout(500);

  const usersAudit = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#users-table-body tr'));
    const isNoMatching = rows.length === 1 && rows[0].textContent.includes('No matching user accounts found');
    const userList = isNoMatching ? [] : rows.map(r => {
      const name = r.querySelector('strong')?.textContent?.trim();
      const email = r.querySelector('small')?.textContent?.trim();
      const plan = r.querySelector('.plan')?.textContent?.trim();
      const status = r.querySelector('td:nth-child(3)')?.textContent?.trim();
      const pfs = r.querySelector('td:nth-child(4)')?.textContent?.trim();
      return { name, email, plan, status, pfs };
    });
    return { count: userList.length, isNoMatching, rows: userList };
  });

  console.log('Users Count in Table:', usersAudit.count);
  console.log('Users Found:', usersAudit.rows);

  // Switch to Portfolios Tab
  console.log('\n--- PORTFOLIOS TAB ---');
  await page.click('button[data-tab="portfolios"]');
  await page.waitForTimeout(500);

  const portfoliosAudit = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.admin-content table tbody tr'));
    const isNoMatching = rows.length === 1 && rows[0].textContent.includes('No portfolios found');
    const pfList = isNoMatching ? [] : rows.map(r => {
      const name = r.querySelector('strong')?.textContent?.trim();
      const slug = r.querySelector('small')?.textContent?.trim();
      const theme = r.querySelector('td:nth-child(3)')?.textContent?.trim();
      const hosting = r.querySelector('td:nth-child(4)')?.textContent?.trim();
      return { name, slug, theme, hosting };
    });
    return { count: pfList.length, isNoMatching, rows: pfList };
  });

  console.log('Portfolios Count in Table:', portfoliosAudit.count);
  console.log('Portfolios Found:', portfoliosAudit.rows);

  await browser.close();
}

runLiveAdminAudit().catch(console.error);
