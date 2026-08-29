import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const port = 5183;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { env: { ...process.env, VITE_FF_CAREER_STUDIO: 'false', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-perf-key' }, stdio: 'ignore' });
const browser = await chromium.launch({ headless: true });
try {
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 150)); }
  const results = [];
  for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    for (const route of ['/', '/pricing', '/cv/new', '/studio', '/u/unknown']) {
      const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
      const started = Date.now();
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
      const metrics = await page.evaluate(() => {
        const assets = performance.getEntriesByType('resource').filter(item => item.name.includes('/assets/')).map(item => item.name.split('/').pop()).filter(Boolean);
        return {
          title: document.title,
          transferKB: Math.round(performance.getEntriesByType('resource').reduce((sum, item) => sum + (item.transferSize || 0), 0) / 1024),
          assets,
          heavyRuntimeLoaded: assets.some(name => /HyperEngine-[^-]+|pdf\.worker|PDFTextExtractor-[^-]+/.test(name)),
          overflow: document.documentElement.scrollWidth > innerWidth + 1
        };
      });
      if (['/', '/pricing'].includes(route) && metrics.heavyRuntimeLoaded) {
        throw new Error(`${route} loaded a deferred 3D/PDF runtime on ${viewport.name}`);
      }
      results.push({ viewport: viewport.name, route, elapsedMs: Date.now() - started, ...metrics });
      await page.close();
    }
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (_) {} }
