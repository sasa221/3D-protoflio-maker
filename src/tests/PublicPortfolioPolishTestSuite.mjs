import assert from 'node:assert/strict';
import { generatePortfolioHTMLBody } from '../renderer/PortfolioRenderer.js';

const theme = { id: 'code', name: 'Code', primaryColor: 0x7c3aed, secondaryColor: 0x06b6d4 };

const emptyProjects = generatePortfolioHTMLBody({
  name: 'Ada Lovelace', profession: 'Frontend Engineer',
  projects: [], skills: [], experience: [], education: [], certs: []
}, theme);
assert.equal((emptyProjects.match(/Get In Touch/g) || []).length, 1, 'No-project portfolios have one clear contact CTA');

const html = generatePortfolioHTMLBody({
  name: 'Ada Lovelace', profession: 'Frontend Engineer',
  projects: [{
    name: 'Climate Dashboard', role: 'Lead Developer', startDate: '2024', endDate: '2025',
    description: 'A fast dashboard for public climate data.',
    result: 'Cut report preparation time by 40%.',
    tech: 'React · TypeScript', url: 'https://example.test/dashboard', github: 'https://github.com/example/dashboard'
  }],
  skills: [
    { name: 'React', category: 'Programming & Tools' },
    { name: 'TypeScript', category: 'Programming & Tools' },
    { name: 'Clear writing', category: 'Interpersonal Skills' }
  ],
  experience: [], education: [], certs: []
}, theme);

assert.match(html, /project-role[^>]*>Lead Developer/, 'Project role is visible');
assert.match(html, /2024 — 2025/, 'Project dates are visible');
assert.match(html, /<strong>Impact:<\/strong> Cut report preparation time by 40%\./, 'Project impact is visible');
assert.match(html, /View website ↗/, 'Project website CTA is explicit');
assert.match(html, /skill-group-title[^>]*>Programming &amp; Tools/, 'Skills are grouped by category');
assert.match(html, /skill-chip[^>]*>React<\/span>/, 'Skill names render as compact chips');
assert.doesNotMatch(html, /href="javascript:/i, 'Unsafe project URLs remain blocked');

console.log('Public portfolio product polish: PASS');
