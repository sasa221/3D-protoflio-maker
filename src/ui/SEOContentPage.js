import { PRODUCT_CONFIG } from '../config/ProductConfig.js';
import { getSEOContentPage } from '../config/SEOContentConfig.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const relatedLabels = {
  '/cv-to-portfolio': 'CV to portfolio guide',
  '/developer-portfolio-builder': 'Developer portfolio guide',
  '/3d-portfolio-maker': '3D portfolio guide'
};

export function renderSEOContentPage(container, path) {
  const page = getSEOContentPage(path);
  if (!container || !page) return;

  // index.html includes a small no-JS fallback for crawlers. Once the routed
  // page mounts, remove it so users do not see two competing H1s or duplicate
  // page content above the real guide.
  document.querySelector('.seo-fallback')?.remove();

  document.documentElement.style.height = 'auto';
  document.documentElement.style.minHeight = '100%';
  document.documentElement.style.overflowY = 'auto';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '100vh';
  document.body.style.overflowX = 'hidden';
  document.body.style.overflowY = 'auto';
  container.style.display = 'block';
  container.style.width = '100%';
  container.style.minHeight = '100vh';
  container.style.overflow = 'visible';

  const stepMarkup = page.steps.map(([title, body], index) => `
    <li class="seo-guide-step">
      <span class="seo-guide-step-number">0${index + 1}</span>
      <div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>
    </li>
  `).join('');
  const featureMarkup = page.features.map((feature) => `<li><span aria-hidden="true">✓</span>${esc(feature)}</li>`).join('');
  const faqMarkup = page.faq.map(([question, answer]) => `
    <details class="seo-guide-faq"><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>
  `).join('');
  const relatedMarkup = page.related.map((href) => `<a href="${href}" class="seo-guide-related">${esc(relatedLabels[href] || href)}</a>`).join('');

  container.innerHTML = `
    <div class="seo-guide-page">
      <header class="seo-guide-header">
        <a class="seo-guide-brand" href="/" aria-label="${esc(PRODUCT_CONFIG.productName)} home">
          <span class="seo-guide-brand-mark" aria-hidden="true">⚡</span>
          <span>${esc(PRODUCT_CONFIG.productName)}</span>
        </a>
        <nav class="seo-guide-nav" aria-label="Product navigation">
          <a href="/">Home</a><a href="/#features">Features</a><a href="/pricing">Pricing</a>
        </nav>
        <a class="seo-guide-nav-cta" href="${page.ctaHref}">${esc(page.cta)}</a>
      </header>

      <main>
        <section class="seo-guide-hero" aria-labelledby="seo-guide-title">
          <div class="seo-guide-breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(page.eyebrow)}</span></div>
          <div class="seo-guide-hero-grid">
            <div>
              <p class="seo-guide-eyebrow">${esc(page.eyebrow)}</p>
              <h1 id="seo-guide-title">${esc(page.title)}</h1>
              <p class="seo-guide-intro">${esc(page.intro)}</p>
              <div class="seo-guide-actions"><a class="seo-guide-primary" href="${page.ctaHref}">${esc(page.cta)} <span aria-hidden="true">→</span></a><a class="seo-guide-secondary" href="/pricing">See plans</a></div>
            </div>
            <aside class="seo-guide-proof" aria-label="What the product supports">
              <span class="seo-guide-proof-icon" aria-hidden="true">✦</span>
              <strong>Built for real career evidence</strong>
              <p>${esc(page.audience)}</p>
              <div class="seo-guide-proof-tags"><span>CV import</span><span>3D themes</span><span>Recruiter view</span></div>
            </aside>
          </div>
        </section>

        <section class="seo-guide-section seo-guide-steps" aria-labelledby="seo-guide-steps-title">
          <div class="seo-guide-section-heading"><p class="seo-guide-eyebrow">A clear path to publish</p><h2 id="seo-guide-steps-title">From your information to a portfolio people can use</h2></div>
          <ol>${stepMarkup}</ol>
        </section>

        <section class="seo-guide-section seo-guide-features" aria-labelledby="seo-guide-features-title">
          <div class="seo-guide-section-heading"><p class="seo-guide-eyebrow">What is included</p><h2 id="seo-guide-features-title">Useful tools, without inventing your story</h2></div>
          <ul>${featureMarkup}</ul>
        </section>

        <section class="seo-guide-section seo-guide-faq-section" aria-labelledby="seo-guide-faq-title">
          <div class="seo-guide-section-heading"><p class="seo-guide-eyebrow">Questions, answered</p><h2 id="seo-guide-faq-title">${esc(page.title)} FAQ</h2></div>
          <div>${faqMarkup}</div>
        </section>

        <section class="seo-guide-related-section" aria-labelledby="seo-guide-related-title">
          <div><p class="seo-guide-eyebrow">Keep exploring</p><h2 id="seo-guide-related-title">More from ${esc(PRODUCT_CONFIG.productName)}</h2></div>
          <div class="seo-guide-related-links">${relatedMarkup}<a href="/pricing" class="seo-guide-related">Compare plans</a></div>
        </section>

        <section class="seo-guide-final-cta" aria-label="Get started">
          <p class="seo-guide-eyebrow">Ready when you are</p><h2>Make your next application easier to understand.</h2>
          <p>Start with the information you already have, review every important detail, and publish only when it reflects your work.</p>
          <a class="seo-guide-primary" href="${page.ctaHref}">${esc(page.cta)} <span aria-hidden="true">→</span></a>
        </section>
      </main>

      <footer class="seo-guide-footer"><span>© ${new Date().getFullYear()} ${esc(PRODUCT_CONFIG.productName)}</span><span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span></footer>
    </div>
  `;
}
