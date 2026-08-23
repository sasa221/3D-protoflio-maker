/**
 * Curated, fictional examples shown on the public landing page.
 * These are intentionally static: no user portfolio data is exposed here.
 */
export const LANDING_GALLERY_FILTERS = [
  { id: 'all', label: 'All examples' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'design', label: 'UI/UX' },
  { id: 'data', label: 'Data' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'security', label: 'Cybersecurity' }
];

export const LANDING_GALLERY_ITEMS = [
  {
    id: 'frontend-launchpad',
    title: 'Frontend Launchpad',
    role: 'Frontend Engineer',
    description: 'A focused case-study layout for shipping polished web products.',
    themeId: 'code',
    filters: ['frontend']
  },
  {
    id: 'prism-product',
    title: 'Prism Product',
    role: 'Product Designer',
    description: 'A visual-first story for systems, prototypes, and thoughtful details.',
    themeId: 'creative',
    filters: ['design']
  },
  {
    id: 'signal-analytics',
    title: 'Signal Analytics',
    role: 'Data Analyst',
    description: 'A clear portfolio for dashboards, experiments, and measurable impact.',
    themeId: 'data',
    filters: ['data']
  },
  {
    id: 'sentinel-security',
    title: 'Sentinel Security',
    role: 'Cybersecurity Engineer',
    description: 'A high-contrast command-center presentation for security work.',
    themeId: 'hacker',
    filters: ['security']
  },
  {
    id: 'growth-studio',
    title: 'Growth Studio',
    role: 'Growth Marketer',
    description: 'A campaign-led portfolio that makes outcomes easy to scan.',
    themeId: 'marketing',
    filters: ['marketing']
  },
  {
    id: 'cosmic-leadership',
    title: 'Cosmic Leadership',
    role: 'Creative Director',
    description: 'A premium presentation for leadership, vision, and selected work.',
    themeId: 'cosmic',
    filters: ['design', 'marketing']
  }
];

export function getLandingGalleryItems(filter = 'all') {
  if (filter === 'all') return LANDING_GALLERY_ITEMS;
  return LANDING_GALLERY_ITEMS.filter(item => item.filters.includes(filter));
}
