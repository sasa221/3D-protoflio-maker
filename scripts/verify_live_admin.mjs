import { chromium } from 'playwright';

async function verifyLive() {
  console.log('Launching browser to test live production...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to https://portfolio-maker-murex.vercel.app/admin ...');
  const response = await page.goto('https://portfolio-maker-murex.vercel.app/admin', { waitUntil: 'networkidle' });

  const url = page.url();
  console.log('Final URL after navigation:', url);

  const title = await page.title();
  console.log('Page Title:', title);

  const content = await page.content();
  console.log('Page has "Set Pro":', content.includes('Set Pro'));
  console.log('Page has "Set Free":', content.includes('Set Free'));
  console.log('Page has "Admin Control Center":', content.includes('Admin Control Center'));
  console.log('Page has "Admin access required":', content.includes('Admin access required'));
  console.log('Page has "Sign in":', content.includes('Sign in') || content.includes('Login'));

  // Also check public route
  console.log('\nNavigating to public route https://portfolio-maker-murex.vercel.app/u/saleh-mohamed ...');
  await page.goto('https://portfolio-maker-murex.vercel.app/u/saleh-mohamed', { waitUntil: 'networkidle' });
  const publicContent = await page.content();
  console.log('Public route loaded:', page.url());
  console.log('Public route has #sec-hero:', publicContent.includes('sec-hero'));

  await browser.close();
}

verifyLive().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
