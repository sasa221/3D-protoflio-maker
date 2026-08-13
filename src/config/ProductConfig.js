/**
 * ProductConfig.js
 * Single canonical source of truth for public product metadata,
 * branding, support channels, and legal entity configuration.
 */

export const PRODUCT_CONFIG = {
  productName: '3D Portfolio Maker',
  productTagline: 'Turn your CV into a cinematic 3D portfolio recruiters remember.',
  companyName: '3D Portfolio Technologies Inc.',
  supportEmail: 'support@3dportfolio.app',
  appDomain: 'https://portfolio-maker.vercel.app',
  marketingDomain: 'https://portfolio-maker.vercel.app',
  cnameTarget: 'cname.3dportfolio.app',
  version: '3.0.4',
  legal: {
    governingLaw: 'Delaware, USA',
    lastUpdated: 'August 13, 2026'
  },
  social: {
    twitter: 'https://twitter.com/3dportfoliomaker',
    github: 'https://github.com/3dportfoliomaker',
    linkedin: 'https://linkedin.com/company/3dportfoliomaker'
  }
};

export function setPageTitle(pageName) {
  if (typeof document !== 'undefined') {
    if (pageName) {
      document.title = `${pageName} — ${PRODUCT_CONFIG.productName}`;
    } else {
      document.title = `${PRODUCT_CONFIG.productName} — ${PRODUCT_CONFIG.productTagline}`;
    }
  }
}
