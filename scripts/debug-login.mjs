import { chromium } from 'playwright';

async function testLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  
  await page.goto('https://portfolio-maker-murex.vercel.app/login', { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'saleh2005mohamed@gmail.com');
  await page.fill('#login-password', 'Saleh@2025');
  await page.click('#login-btn');
  await page.waitForTimeout(4000);
  
  const errText = await page.evaluate(() => document.getElementById('login-error')?.textContent || '');
  console.log('Login error text:', errText);
  console.log('App exists in DOM:', await page.evaluate(() => !!document.getElementById('app')));
  console.log('Preview canvas in DOM:', await page.evaluate(() => !!document.getElementById('preview-canvas')));

  await browser.close();
}

testLogin();
