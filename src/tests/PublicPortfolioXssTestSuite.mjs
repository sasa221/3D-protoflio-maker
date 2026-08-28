import assert from 'node:assert/strict';
import { generatePortfolioHTMLBody } from '../renderer/PortfolioRenderer.js';

const html = generatePortfolioHTMLBody({
  name: 'Safe <img src=x onerror=alert(1)>',
  profession: 'Developer',
  social: { website: 'javascript:alert(1)', github: 'https://github.com/example', email: 'safe@example.test' },
  avatar: 'javascript:alert(1)',
  projects: [{
    name: 'Project <script>alert(1)</script>',
    image: 'javascript:alert(1)',
    github: 'javascript:alert(1)',
    url: 'https://example.test/demo'
  }],
  experience: [{ role: 'Engineer', company: 'Example', companyUrl: 'javascript:alert(1)' }],
  skills: [], education: [], certs: [], resume: { url: 'javascript:alert(1)' }
}, { id: 'code', name: 'Code', primaryColor: 0x7c3aed, secondaryColor: 0x06b6d4 });

assert.doesNotMatch(html, /href="javascript:/i, 'Public portfolio never emits javascript: links');
assert.doesNotMatch(html, /src="javascript:/i, 'Public portfolio never emits javascript: image sources');
assert.match(html, /Safe &lt;img src=x onerror=alert\(1\)&gt;/, 'User text remains text, not markup');
assert.match(html, /Project &lt;script&gt;alert\(1\)&lt;\/script&gt;/, 'Project text is escaped');
assert.match(html, /href="https:\/\/github\.com\/example"[^>]*rel="noopener noreferrer"/i, 'External links isolate the opener');
assert.match(html, /href="https:\/\/example\.test\/demo"[^>]*rel="noopener noreferrer"/i, 'Safe project link is retained');

console.log('Public portfolio XSS and unsafe-link guard: PASS');
