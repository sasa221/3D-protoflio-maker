// scripts/test_admin_page_playwright.mjs
import { chromium } from 'playwright';

async function testAdminPage() {
  console.log('Testing Admin Page in Browser with admin mock session...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  page.on('response', res => {
    if (res.url().includes('/api/admin')) {
      console.log(`API [${res.status()}] ${res.url()}`);
    }
  });

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
  console.log('Admin status container text:', statusText);

  const stats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.admin-stat-card, div[style*="border-radius"]'));
    return cards.map(c => c.textContent.trim()).filter(t => t.includes('Users') || t.includes('Portfolios'));
  });
  console.log('Stats found on page:', stats);

  await browser.close();
}

testAdminPage().catch(console.error);
