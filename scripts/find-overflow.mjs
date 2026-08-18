import { chromium } from 'playwright';

async function findOverflow() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 600 } });
  await page.goto('https://portfolio-maker-murex.vercel.app/u/saleh-mohamed', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const overflowingElements = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const all = document.querySelectorAll('*');
    const culprits = [];
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth || rect.width > docWidth) {
        culprits.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          width: rect.width,
          right: rect.right,
          text: el.textContent?.slice(0, 30)
        });
      }
    }
    return culprits.slice(0, 10);
  });

  console.log('Overflowing elements at 320px:', JSON.stringify(overflowingElements, null, 2));
  await browser.close();
}

findOverflow();
