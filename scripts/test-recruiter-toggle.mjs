import { chromium } from 'playwright';
import { getThemeById } from '../src/three/ProceduralTheme.js';
import { buildPortfolioHTMLContent } from '../src/exporter/PortfolioExporter.js';
import fs from 'fs';
import path from 'path';

async function testRecruiterToggle() {
  const testProfile = {
    id: 'test-rec',
    name: 'Saleh Mohamed',
    profession: 'Frontend Developer',
    tagline: 'Building cinematic web experiences',
    bio: 'Specialized in Three.js and React.',
    location: 'Cairo, Egypt',
    avatar: 'https://kupxhrfijkdlcteniqfp.supabase.co/storage/v1/object/public/avatars/saleh/avatar.webp',
    social: { email: 'saleh@example.com', github: 'https://github.com' },
    skills: [{ name: 'React', level: 90 }, { name: 'JavaScript', level: 95 }],
    experience: [{ role: 'Frontend Engineer', company: 'TechCorp', startDate: '2023', endDate: 'Present', current: true, description: 'Built WebGL apps.' }],
    education: [{ degree: 'B.Sc. Computer Science', institution: 'Cairo University' }],
    projects: [{ name: 'AI Portfolio 3D', description: 'Real-time 3D canvas portfolio.', tech: 'React, Three.js' }],
    certs: [],
    theme: 'code'
  };

  const html = buildPortfolioHTMLContent(testProfile, getThemeById('code'));
  const tmpPath = path.resolve('./dist/test_recruiter_btn.html');
  fs.writeFileSync(tmpPath, html);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`file://${tmpPath}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const btn = document.querySelector('.view-mode-btn');
    const initialMode = document.body.getAttribute('data-view-mode');
    
    if (btn) btn.click();
    const toggledMode = document.body.getAttribute('data-view-mode');

    if (btn) btn.click();
    const restoredMode = document.body.getAttribute('data-view-mode');

    return {
      hasButton: !!btn,
      initialMode,
      toggledMode,
      restoredMode,
      experienceVisible: !!document.getElementById('sec-experience'),
      skillsVisible: !!document.getElementById('sec-skills')
    };
  });

  console.log('Recruiter Toggle Test Result:', result);
  await browser.close();
}

testRecruiterToggle().catch(console.error);
