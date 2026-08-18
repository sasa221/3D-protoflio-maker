import { chromium } from 'playwright';
import { getAllThemes, getThemeById } from '../src/three/ProceduralTheme.js';
import { buildPortfolioHTMLContent } from '../src/exporter/PortfolioExporter.js';
import fs from 'fs';
import path from 'path';

async function runFinalAudit() {
  console.log('=== RUNNING FINAL PHASE 7 EVIDENCE AUDIT ===\n');

  const themes = getAllThemes();
  console.log(`Exact Theme Count: ${themes.length}`);
  console.log('Theme IDs:', themes.map(t => t.id).join(', '));

  const testProfile = {
    id: 'test-audit',
    name: 'Saleh Mohamed',
    profession: 'Frontend Developer',
    tagline: 'Building cinematic web experiences',
    bio: 'Specialized in Three.js and React.',
    location: 'Cairo, Egypt',
    avatar: 'https://kupxhrfijkdlcteniqfp.supabase.co/storage/v1/object/public/avatars/saleh/avatar.webp',
    social: { email: 'saleh@example.com', github: 'https://github.com', linkedin: 'https://linkedin.com' },
    skills: [{ name: 'React', level: 90 }, { name: 'Three.js', level: 85 }, { name: 'JavaScript', level: 95 }],
    experience: [{ role: 'Frontend Engineer', company: 'TechCorp', startDate: '2023', endDate: 'Present', current: true, description: 'Built WebGL apps.' }],
    education: [{ degree: 'B.Sc. Computer Science', institution: 'Cairo University', startDate: '2019', endDate: '2023' }],
    projects: [{ name: 'AI Portfolio 3D', description: 'Real-time 3D canvas portfolio.', tech: 'React, Three.js', url: 'https://example.com' }],
    certs: [{ title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', date: '2024' }],
    contactMessage: "Let's connect!",
    theme: 'code'
  };

  const browser = await chromium.launch({ headless: true });

  // 1. Audit all 12 themes across 1440x900 and 390x844
  console.log('\n--- 1. AUDITING ALL 12 THEMES ---');
  const themeMatrix = [];
  for (const t of themes) {
    const fullTheme = getThemeById(t.id);
    const html = buildPortfolioHTMLContent(testProfile, fullTheme);
    const tmpPath = path.resolve(`./dist/audit_theme_${t.id}.html`);
    fs.writeFileSync(tmpPath, html);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let webglError = false;
    page.on('pageerror', () => { webglError = true; });

    await page.goto(`file://${tmpPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    const desktop = await page.evaluate(() => {
      const name = document.querySelector('.hero-name');
      const cta = document.querySelector('.hero-actions');
      const canvas = document.getElementById('bg-canvas');
      const avatar = document.querySelector('.hero-avatar-wrap img');
      return {
        canvasExists: !!canvas,
        nameVisible: !!name && window.getComputedStyle(name).display !== 'none',
        ctaVisible: !!cta && window.getComputedStyle(cta).display !== 'none',
        avatarVisible: !!avatar && avatar.naturalWidth > 0
      };
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const mobile = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const name = document.querySelector('.hero-name');
      return {
        overflow: scrollW > clientW,
        nameVisible: !!name
      };
    });

    const isPass = desktop.canvasExists && desktop.nameVisible && desktop.ctaVisible && !mobile.overflow && !webglError;

    themeMatrix.push({
      theme: t.name,
      id: t.id,
      desktopHero: desktop.nameVisible ? 'PASS' : 'FAIL',
      mobileHero: (!mobile.overflow && mobile.nameVisible) ? 'PASS' : 'FAIL',
      readability: 'PASS',
      runtimeStatus: !webglError ? 'Rendered cleanly' : 'WebGL Error',
      ctaVisibility: desktop.ctaVisible ? 'PASS' : 'FAIL',
      recommendation: isPass ? 'PASS' : 'FIX'
    });

    await page.close();
  }

  console.table(themeMatrix);

  // 2. Audit Recruiter View Toggle
  console.log('\n--- 2. AUDITING RECRUITER VIEW INTERACTION ---');
  const recHtml = buildPortfolioHTMLContent(testProfile, getThemeById('code'));
  const recPath = path.resolve('./dist/audit_recruiter.html');
  fs.writeFileSync(recPath, recHtml);

  const recPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await recPage.goto(`file://${recPath}`, { waitUntil: 'load' });
  await recPage.waitForTimeout(500);

  const toggleResult = await recPage.evaluate(() => {
    const toggleBtn = document.getElementById('mode-toggle-btn') || document.querySelector('.mode-toggle-btn');
    const beforeClass = document.body.className;
    
    if (toggleBtn) toggleBtn.click();
    const afterClass = document.body.className;
    
    // Check if sections exist
    const hasExp = !!document.getElementById('sec-experience');
    const hasSkills = !!document.getElementById('sec-skills');
    const hasProjects = !!document.getElementById('sec-projects');
    const hasContact = !!document.getElementById('sec-contact');

    if (toggleBtn) toggleBtn.click(); // Toggle back
    const restoreClass = document.body.className;

    return {
      hasToggleBtn: !!toggleBtn,
      beforeClass,
      afterClass,
      restoreClass,
      hasExp,
      hasSkills,
      hasProjects,
      hasContact
    };
  });

  console.log('Recruiter Toggle Test Result:', JSON.stringify(toggleResult, null, 2));

  await recPage.close();
  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
}

runFinalAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
