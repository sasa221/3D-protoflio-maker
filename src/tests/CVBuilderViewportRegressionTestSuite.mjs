import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../ui/CVBuilderPage.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

assert.match(ui, /document\.body\.style\.overflowY = 'auto'/, 'CV route must restore document scrolling');
assert.match(ui, /container\.style\.overflow = 'visible'/, 'CV route must undo Studio viewport clipping');
assert.match(css, /\.career-studio-page \{[^}]*width: 100%/s, 'CV page must use the full viewport width');
assert.match(css, /\.career-studio-grid \{[^}]*max-width: 1680px/s, 'wide CV layout must not be trapped at the old 1180px width');
assert.match(css, /\.ats-paper > h2, \.ats-paper > \.ats-contact \{ text-align: center; \}/, 'ATS identity header must be centered');
assert.ok(css.includes('@media (max-width: 900px) { .career-studio-header { grid-template-columns: 1fr; } .career-studio-grid { grid-template-columns: 1fr; }'), 'CV editor must stack on smaller screens');
assert.match(main, /async function initStudio\(\)[\s\S]*document\.body\.style\.overflow = 'hidden'/, 'Studio must restore its viewport lock after leaving CV');
assert.match(css, /#app:has\(\.studio-product-nav\) \{ padding-top: 54px; \}/, 'desktop Studio navigation must not consume a third flex column');
assert.match(css, /\.studio-product-nav \{[\s\S]*position: fixed;/, 'Studio navigation must be removed from the editor flex flow');

console.log('CV Builder viewport regression passed: document scroll restored, full-width layout, centered ATS header, and responsive stacking.');
