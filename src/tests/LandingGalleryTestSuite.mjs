import { readFile } from 'node:fs/promises';
import { LANDING_GALLERY_FILTERS, LANDING_GALLERY_ITEMS, getLandingGalleryItems } from '../config/LandingGalleryConfig.js';
import { getThemeTier } from '../config/ThemeTierConfig.js';

const landing = await readFile(new URL('../ui/LandingPage.js', import.meta.url), 'utf8');
const checks = [];
const assert = (name, condition) => checks.push([name, Boolean(condition)]);

assert('Landing gallery has a dedicated accessible section', /<section id="gallery" aria-labelledby="gallery-title"/.test(landing));
assert('Gallery exposes all requested profession filters', ['frontend', 'design', 'data', 'marketing', 'security'].every(id => LANDING_GALLERY_FILTERS.some(filter => filter.id === id)));
assert('Gallery has six curated examples', LANDING_GALLERY_ITEMS.length === 6 && getLandingGalleryItems('all').length === 6);
assert('Every gallery theme exists in the tier catalog', LANDING_GALLERY_ITEMS.every(item => ['free', 'pro', 'premium'].includes(getThemeTier(item.themeId))));
assert('Free example uses a Free theme', LANDING_GALLERY_ITEMS.some(item => item.themeId === 'code' && getThemeTier(item.themeId) === 'free'));
assert('Paid examples do not claim Free access', LANDING_GALLERY_ITEMS.filter(item => ['data', 'hacker', 'marketing', 'cosmic'].includes(item.themeId)).every(item => getThemeTier(item.themeId) !== 'free'));
assert('Each filter returns only matching examples', LANDING_GALLERY_FILTERS.slice(1).every(filter => getLandingGalleryItems(filter.id).every(item => item.filters.includes(filter.id))));
assert('Gallery previews use existing theme switcher and build links preserve auth gate', /data-gallery-preview/.test(landing) && /window\.switchDemoTheme\?\.\(button\.dataset\.galleryPreview\)/.test(landing) && /data-gallery-build/.test(landing) && /login\?next=%2Fstart/.test(landing));
assert('Gallery controls meet touch target requirement', /data-gallery-filter[\s\S]*?min-height: 44px/.test(landing) && /data-gallery-preview[\s\S]*?min-height: 44px/.test(landing));
assert('Gallery filtering explicitly hides non-matching cards', /card\.style\.display = matches \? '' : 'none'/.test(landing) && /aria-hidden/.test(landing));
assert('Gallery uses no external portfolio or user data source', !/fetch\(|supabase|MARKETING_DEMO_PORTFOLIO/.test((await readFile(new URL('../config/LandingGalleryConfig.js', import.meta.url), 'utf8'))));

for (const [name, passed] of checks) console.log(`${passed ? '✅' : '❌'} ${name}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\nLanding gallery: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
