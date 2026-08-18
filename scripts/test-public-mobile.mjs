import { chromium } from 'playwright';

async function testPublicMobileViewports() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: '320px', width: 320, height: 600 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  console.log('--- TESTING PRODUCTION PUBLIC /u/saleh-mohamed MOBILE VIEWPORTS ---');
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('https://portfolio-maker-murex.vercel.app/u/saleh-mohamed', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const canvasExists = await page.evaluate(() => !!document.getElementById('bg-canvas'));
    const heroName = await page.evaluate(() => document.querySelector('.hero-name')?.textContent?.trim() || '');
    const hasOverflow = scrollWidth > clientWidth;

    console.log(`Viewport ${vp.name}: clientWidth=${clientWidth}px, scrollWidth=${scrollWidth}px, overflow=${hasOverflow}, canvas=${canvasExists}, name="${heroName}"`);
    await page.close();
  }

  await browser.close();
}

testPublicMobileViewports();
