import https from 'https';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

// 1. Fetch raw HTML from live Vercel deployment
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function auditThemesAndLiveDOM() {
  console.log('============================================================');
  console.log('  LIVE THEME REGRESSION & PRODUCTION DOM AUDIT');
  console.log('  Target: https://portfolio-maker-murex.vercel.app/');
  console.log('============================================================\n');

  // STEP 1: Fetch Live Production HTML
  console.log('1. Fetching Live Production HTML from Vercel...');
  const { statusCode, data: html } = await fetchText('https://portfolio-maker-murex.vercel.app/');
  console.log(`   HTTP Status: ${statusCode}`);

  // Extract JS bundle asset paths
  const scriptRegex = /<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  const scriptSources = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptSources.push(match[1]);
  }
  console.log('   Script sources in production HTML:', scriptSources);

  const mainBundlePath = scriptSources.find(src => src.includes('/assets/index-') || src.includes('index'));
  console.log(`   Live Main Bundle Path: ${mainBundlePath}`);

  let liveBundleText = '';
  if (mainBundlePath) {
    const fullBundleUrl = mainBundlePath.startsWith('http') 
      ? mainBundlePath 
      : `https://portfolio-maker-murex.vercel.app${mainBundlePath.startsWith('/') ? '' : '/'}${mainBundlePath}`;
    console.log(`\n2. Fetching Live Bundle from: ${fullBundleUrl}...`);
    const bundleRes = await fetchText(fullBundleUrl);
    liveBundleText = bundleRes.data;
    console.log(`   Bundle Size: ${(liveBundleText.length / 1024).toFixed(2)} KB`);
  }

  // Check unapproved names in live bundle
  const unapprovedNames = [
    'Knowledge Matrix',
    'Quantum Void',
    'Neon Syndicate',
    'HyperDrive',
    'Chrono Trigger',
    'Obsidian Mirror'
  ];

  console.log('\n3. Verifying Unapproved Theme Names in Live Bundle:');
  unapprovedNames.forEach(name => {
    const count = (liveBundleText.match(new RegExp(name, 'g')) || []).length;
    console.log(`   - "${name}": ${count} occurrences (${count === 0 ? 'CLEAN' : 'REGRESSION'})`);
  });

  // Check approved 15 theme names in live bundle
  const approvedThemes = [
    { id: 'code', name: 'Code Matrix', tier: 'free' },
    { id: 'creative', name: 'Liquid Prism', tier: 'free' },
    { id: 'minimal', name: 'Minimal Orbit', tier: 'free' },
    { id: 'hacker', name: 'Cyber Command', tier: 'pro' },
    { id: 'data', name: 'Data Galaxy', tier: 'pro' },
    { id: 'blueprint', name: 'Blueprint CAD', tier: 'pro' },
    { id: 'media', name: 'Aperture Cinema', tier: 'pro' },
    { id: 'health', name: 'BioSphere DNA', tier: 'pro' },
    { id: 'marketing', name: 'Growth Reactor', tier: 'pro' },
    { id: 'education', name: 'Knowledge Nebula', tier: 'pro' },
    { id: 'cosmic', name: 'Cosmic Elite', tier: 'premium' },
    { id: 'finance', name: 'Golden Markets', tier: 'premium' },
    { id: 'legal', name: 'Justice Grid', tier: 'premium' },
    { id: 'obsidian', name: 'Obsidian Luxe', tier: 'premium' },
    { id: 'quantum', name: 'Quantum Aurora', tier: 'premium' }
  ];

  console.log('\n4. Verifying Approved Theme Names in Live Bundle:');
  approvedThemes.forEach(t => {
    const found = liveBundleText.includes(t.name);
    console.log(`   - [${t.tier.toUpperCase()}] ${t.id} -> "${t.name}": ${found ? 'PRESENT (PASS)' : 'MISSING (FAIL)'}`);
  });

  // STEP 2: Live Browser DOM Inspection as Free User
  console.log('\n5. Launching Playwright to inspect Live Free User DOM in Studio -> Customize...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('https://portfolio-maker-murex.vercel.app/', { waitUntil: 'networkidle' });

  // Initialize Free Studio state and build theme grid
  const domThemeCards = await page.evaluate(() => {
    if (typeof window.buildHTML === 'function') {
      window.buildHTML();
    }
    if (window.globalEntitlements) {
      window.globalEntitlements.setSubscription({ plan_id: 'free', status: 'active' });
    }
    if (typeof window.switchWorkspace === 'function') {
      window.switchWorkspace('customize');
    }
    if (typeof window.buildThemeGrid === 'function') {
      window.buildThemeGrid();
    }

    const cards = Array.from(document.querySelectorAll('.theme-card'));
    return cards.map(card => {
      const id = card.getAttribute('data-theme-id');
      const nameEl = card.querySelector('.theme-name span:first-child');
      const tagEl = card.querySelector('.theme-name span:last-child');
      const badgeEl = card.querySelector('.pro-badge, span[style*="FREE"]');
      const emojiEl = card.querySelector('.theme-emoji');
      return {
        id,
        name: nameEl ? nameEl.innerText.trim() : '',
        tag: tagEl ? tagEl.innerText.trim() : '',
        badge: badgeEl ? badgeEl.innerText.trim() : '',
        emoji: emojiEl ? emojiEl.innerText.trim() : ''
      };
    });
  });

  console.log(`   Rendered Theme Cards Count in DOM: ${domThemeCards.length}`);
  console.log('\n   DOM Theme Cards Details:');
  domThemeCards.forEach((c, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. [${c.id}] "${c.name}" ${c.emoji} | Tag: "${c.tag}" | Badge: "${c.badge}"`);
  });

  await browser.close();

  // STEP 3: Verify Live Database Portfolios
  console.log('\n6. Checking existing portfolios in Supabase...');
  const supabaseUrl = 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: portfolios, error: pfErr } = await supabase
    .from('portfolios')
    .select('id, owner_user_id, name, theme, slug, published_at, created_at, updated_at');

  if (pfErr) {
    console.log('   Note: Anon select on portfolios returned:', pfErr.message);
  } else {
    console.log(`   Total Portfolios Found: ${portfolios.length}`);
    portfolios.forEach(p => {
      console.log(`   - Portfolio [${p.id}] "${p.name || 'Untitled'}" (owner: ${p.owner_user_id}) -> Theme: "${p.theme}", Published: ${p.published_at ? 'YES' : 'NO'}`);
    });
  }

  console.log('\n============================================================');
  console.log('  AUDIT COMPLETE');
  console.log('============================================================');
}

auditThemesAndLiveDOM().catch(console.error);
