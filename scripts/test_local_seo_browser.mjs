import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const port = 5182;
const env = { ...process.env, VITE_FF_CAREER_STUDIO: 'false', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-seo-key' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'development', '--host', '127.0.0.1', '--port', String(port)], { env, stdio: 'ignore' });
const browser = await chromium.launch({ headless: true });
try {
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 150)); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const route of ['/', '/pricing', '/login', '/studio', '/cv/new']) {
    await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
    const head = await page.evaluate(() => ({ title: document.title, description: document.querySelector('meta[name="description"]')?.content, robots: document.querySelector('meta[name="robots"]')?.content, canonical: document.querySelector('link[rel="canonical"]')?.href, jsonld: Boolean(document.querySelector('#seo-jsonld')) }));
    if (!head.title || !head.description || !head.canonical || !head.jsonld) throw new Error(`Missing rendered SEO metadata on ${route}`);
    const shouldBePrivate = ['/login', '/studio', '/cv/new'].includes(route);
    if (shouldBePrivate && !/^noindex/i.test(head.robots || '')) throw new Error(`Private route is indexable: ${route}`);
    if (!shouldBePrivate && /^noindex/i.test(head.robots || '')) throw new Error(`Marketing route is blocked: ${route}`);
  }
  console.log('test_local_seo_browser: passed (rendered title, description, canonical, JSON-LD, and private-route robots policy).');
} finally {
  await browser.close();
  try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (_) {}
}
