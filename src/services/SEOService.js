import { getSEOContentPage } from '../config/SEOContentConfig.js';

const SITE_URL = 'https://portfolio-maker-murex.vercel.app';
const DEFAULT_TITLE = '3D Portfolio Maker | Turn Your CV into a Recruiter-Ready Portfolio';
const DEFAULT_DESCRIPTION = 'Import your CV, build a recruiter-ready portfolio with cinematic 3D themes, then publish and share your work in minutes.';
const SOCIAL_IMAGE = `${SITE_URL}/social-card.png`;

function upsertMeta(attribute, key, content) {
  let node = [...document.head.querySelectorAll('meta')].find(item => item.getAttribute(attribute) === key);
  if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.appendChild(node); }
  node.setAttribute('content', content || '');
}
function upsertLink(rel, href) {
  let node = document.head.querySelector(`link[rel="${rel}"]`);
  if (!node) { node = document.createElement('link'); node.rel = rel; document.head.appendChild(node); }
  node.href = href;
}
function absolutePath(path) { return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`; }
function clean(value, max = 180) { return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function isPrivate(path) { return /^\/(?:login|reset-password|account|admin|dashboard|studio|cv(?:\/|$)|start(?:\/|$))/.test(path); }
function publicProfileSchema(path, profile) {
  const name = clean(profile?.content?.contact?.name || profile?.name || 'Public portfolio', 120);
  const description = clean(profile?.content?.summary || `${name}'s recruiter-ready portfolio`, 220);
  return { '@type': 'ProfilePage', '@id': `${SITE_URL}${path}#profile`, url: absolutePath(path), name: `${name} | 3D Portfolio Maker`, description, mainEntity: { '@type': 'Person', name, url: absolutePath(path) } };
}
const baseGraph = [
  { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: '3D Portfolio Maker', url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand-icon-512.png`, width: 512, height: 512 } },
  { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: '3D Portfolio Maker', publisher: { '@id': `${SITE_URL}/#organization` }, inLanguage: 'en' },
  { '@type': 'SoftwareApplication', '@id': `${SITE_URL}/#software`, name: '3D Portfolio Maker', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${SITE_URL}/`, image: SOCIAL_IMAGE, description: DEFAULT_DESCRIPTION, publisher: { '@id': `${SITE_URL}/#organization` } }
];
const faq = [
  ['Can I change plans later?', 'Yes. You can upgrade or downgrade at any time. Your portfolio data is always preserved.'],
  ['What happens if I cancel?', 'Your data is not deleted. You can download your portfolio or keep it available according to your current plan.'],
  ['Is the Free portfolio interactive?', 'Yes. The Free plan includes an interactive 3D portfolio with basic themes.'],
  ['How does Premium Group work?', 'Each member has a separate account and portfolio while the group owner manages billing.']
];

export function applyRouteSEO(path = window.location.pathname, { publicProfile } = {}) {
  if (typeof document === 'undefined') return;
  const normalized = path || '/';
  const publicPortfolio = /^\/u\/[^/]+(?:\/[^/]+)?$/.test(normalized);
  const privateRoute = isPrivate(normalized);
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let robots = 'index,follow,max-image-preview:large';
  let type = 'website';
  let graph = [...baseGraph];
  if (normalized === '/pricing') {
    title = 'Pricing | 3D Portfolio Maker';
    description = 'Choose a Free, Pro, Premium, or Premium Group plan to build, publish, and share your 3D portfolio.';
    graph.push({ '@type': 'FAQPage', '@id': `${SITE_URL}/pricing#faq`, mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) });
  } else if (getSEOContentPage(normalized)) {
    const contentPage = getSEOContentPage(normalized);
    title = contentPage.metaTitle;
    description = contentPage.description;
    graph.push({
      '@type': 'FAQPage',
      '@id': `${SITE_URL}${normalized}#faq`,
      mainEntity: contentPage.faq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }))
    });
  } else if (publicPortfolio) {
    const slug = normalized.split('/').filter(Boolean).pop();
    title = `${clean(publicProfile?.content?.contact?.name || slug?.replace(/[-_]+/g, ' '), 100)} | 3D Portfolio Maker`;
    description = clean(publicProfile?.content?.summary || 'Explore this interactive 3D portfolio built with 3D Portfolio Maker.', 220);
    type = 'profile';
    graph = [publicProfileSchema(normalized, publicProfile)];
  } else if (privateRoute || ['/privacy', '/terms'].includes(normalized)) {
    title = normalized === '/login' ? 'Sign in | 3D Portfolio Maker' : normalized === '/privacy' ? 'Privacy Policy | 3D Portfolio Maker' : normalized === '/terms' ? 'Terms of Service | 3D Portfolio Maker' : `${normalized.slice(1).replace(/-/g, ' ') || 'Private page'} | 3D Portfolio Maker`;
    robots = 'noindex,nofollow,noarchive';
    graph = [];
  }
  document.title = title;
  document.documentElement.dataset.seoManaged = 'true';
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('name', 'application-name', '3D Portfolio Maker');
  upsertMeta('name', 'theme-color', '#050508');
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:site_name', '3D Portfolio Maker');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', absolutePath(normalized));
  upsertMeta('property', 'og:image', SOCIAL_IMAGE);
  upsertMeta('property', 'og:image:alt', '3D Portfolio Maker — recruiter-ready portfolio builder');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', SOCIAL_IMAGE);
  upsertLink('canonical', absolutePath(normalized));
  let json = document.head.querySelector('#seo-jsonld');
  if (!json) { json = document.createElement('script'); json.id = 'seo-jsonld'; json.type = 'application/ld+json'; document.head.appendChild(json); }
  json.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

export const SEO_DEFAULTS = Object.freeze({ SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION, SOCIAL_IMAGE });
