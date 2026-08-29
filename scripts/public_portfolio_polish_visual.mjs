import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { generatePortfolioCSS, generatePortfolioHTMLBody } from '../src/renderer/PortfolioRenderer.js';

const outDir = path.resolve('docs/product-polish-public');
await fs.mkdir(outDir, { recursive: true });
const theme = { id: 'code', name: 'Code', primaryColor: 0x7c3aed, secondaryColor: 0x06b6d4 };
const data = {
  name: 'Mariam Hassan', profession: 'Product Engineer', tagline: 'Building simple tools that make complex work feel effortless.',
  bio: 'Product engineer focused on accessible web applications and measurable customer outcomes.', location: 'Cairo, Egypt',
  projects: [
    { name: 'Hiring Dashboard', role: 'Lead Developer', startDate: '2024', endDate: '2025', tech: 'React · TypeScript', description: 'A recruiter workspace that turns a long shortlist into a clear next step.', result: 'Reduced review time by 40%.', url: 'https://example.test/hiring', github: 'https://github.com/example/hiring' },
    { name: 'Climate Signals', role: 'Frontend Engineer', startDate: '2023', endDate: '2024', tech: 'React · D3', description: 'An accessible data story for exploring local climate trends.' }
  ],
  skills: [{ name: 'React', category: 'Programming & Tools' }, { name: 'TypeScript', category: 'Programming & Tools' }, { name: 'Data storytelling', category: 'Interpersonal Skills' }, { name: 'English', category: 'Languages' }],
  experience: [{ role: 'Product Engineer', company: 'Northstar Labs', startDate: '2022', endDate: 'Present', description: 'Built customer-facing workflows used by 20k monthly visitors.', achievements: ['Shipped an accessible design system.', 'Improved activation by 18%.'], technologies: ['React', 'TypeScript'] }],
  education: [{ degree: 'BSc Computer Science', institution: 'Helwan University', startDate: '2018', endDate: '2022', field: 'Software Engineering' }],
  certs: [{ name: 'Google UX Design', issuer: 'Google', date: '2023' }], social: { email: 'mariam@example.test', github: 'https://github.com/example', linkedin: 'https://linkedin.com/in/example' }
};

const before = `<!doctype html><html><head><style>${generatePortfolioCSS(theme)}</style></head><body><div id="portfolio-scroll-container"><main class="portfolio-main"><section class="portfolio-section hero-section"><div class="hero-content"><h1 class="hero-name">${data.name}</h1><p class="hero-profession">${data.profession}</p><div class="hero-actions"><a class="btn btn-primary">Explore Projects ↓</a><a class="btn btn-secondary">Get In Touch</a></div></div></section><section class="portfolio-section"><div class="section-container"><h2 class="section-title">Projects</h2><div class="projects-grid"><div class="glass-card project-card"><div class="project-img-wrap" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:0.4">🚀</div><div class="project-name">Hiring Dashboard</div><div class="project-desc">${data.projects[0].description}</div><div class="project-links"><a class="btn btn-primary">Live Demo</a></div></div></div></div></section><section class="portfolio-section"><div class="section-container"><h2 class="section-title">Skills</h2><div class="skills-grid">${data.skills.map(s => `<div class="glass-card skill-card">${s.name}<span>${s.category}</span></div>`).join('')}</div></div></section></main></div></body></html>`;
const after = `<!doctype html><html><head><style>${generatePortfolioCSS(theme)}</style></head><body>${generatePortfolioHTMLBody(data, theme, { viewMode: 'recruiter' })}</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(before, { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'before-desktop.png'), fullPage: true }).catch(() => {});
await page.setContent(after, { waitUntil: 'load' });
await page.screenshot({ path: path.join(outDir, 'after-desktop.png'), fullPage: true }).catch(() => {});
const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
if (desktopOverflow) throw new Error('Desktop public portfolio overflows horizontally');
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.setContent(after, { waitUntil: 'load' });
await mobile.screenshot({ path: path.join(outDir, 'after-mobile.png'), fullPage: true }).catch(() => {});
const mobileOverflow = await mobile.evaluate(() => {
  const offenders = [...document.querySelectorAll('*')].filter(el => el.scrollWidth > el.clientWidth + 1).slice(0, 8).map(el => ({ tag: el.tagName, cls: el.className, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, offenders };
});
if (mobileOverflow.overflow) throw new Error(`Mobile public portfolio overflows horizontally: ${JSON.stringify(mobileOverflow.offenders)}`);
console.log('Public portfolio visual polish smoke: PASS');
await browser.close();
