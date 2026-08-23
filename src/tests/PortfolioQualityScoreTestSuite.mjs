import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculatePortfolioQualityScore, renderPortfolioQualityScore, getPortfolioQualityScoreStyles } from '../ui/PortfolioQualityScore.js';

const empty = calculatePortfolioQualityScore({});
assert.equal(empty.score, 0, 'An empty portfolio must not look publish-ready');
assert.equal(empty.completeCount, 0);
assert.equal(empty.missing.length, 10);

const complete = calculatePortfolioQualityScore({
  name: 'Alex Morgan', profession: 'Frontend Engineer', bio: 'Product engineer building useful web experiences.',
  avatar: 'https://example.com/avatar.webp', skills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'CSS' }],
  projects: [{ name: 'Portfolio', description: 'A polished portfolio project.' }],
  experience: [{ role: 'Engineer', company: 'Example' }], education: [],
  social: { email: 'alex@example.com' }, resume: { url: 'https://example.com/resume.pdf' }, theme: 'code', slug: 'alex-morgan'
});
assert.equal(complete.score, 100, 'A complete portfolio must score 100');
assert.equal(complete.level, 'ready');
assert.equal(complete.missing.length, 0);

const contentOnly = calculatePortfolioQualityScore({
  name: 'A', profession: 'Designer', bio: 'Bio', skills: ['a', 'b', 'c'], projects: [{ title: 'Work' }], theme: 'code'
});
assert.ok(contentOnly.score >= 50 && contentOnly.score < 100, 'Score should improve with content without requiring paid features');
assert.equal(contentOnly.checks.find(check => check.id === 'theme').complete, true);

const markup = renderPortfolioQualityScore({ name: 'A', profession: 'Designer' });
assert.match(markup, /id="portfolio-quality-score"/);
assert.match(markup, /data-score="12"/);
assert.match(markup, /window\.handlePortfolioQualityAction/);
assert.doesNotMatch(markup, /<script/i, 'Quality score markup must not create executable user-controlled HTML');

const styles = getPortfolioQualityScoreStyles();
assert.match(styles, /@media \(max-width:560px\)/);
assert.match(styles, /min-height:36px/);

const [main, onboarding] = await Promise.all([
  readFile(new URL('../main.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/OnboardingWizard.js', import.meta.url), 'utf8')
]);
assert.match(main, /renderPortfolioQualityScore\(portfolioData\)/);
assert.ok((main.match(/\$\{qualityScoreMarkup\}/g) || []).length >= 3, 'Score must appear in free, retention, and active publish states');
assert.match(main, /handlePortfolioQualityAction/);
assert.match(onboarding, /Start from an Example/);
assert.match(onboarding, /Nothing is copied to your profile/);
assert.match(onboarding, /globalEntitlements\.canUseTheme/);
assert.match(onboarding, /getThemeTier\(themeId\) === 'premium'/);

console.log('✅ Portfolio Quality Score and onboarding UX: all assertions passed');
