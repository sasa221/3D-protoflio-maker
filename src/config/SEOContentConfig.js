/**
 * Public, editorial SEO pages. Keep every claim tied to a feature that exists
 * in the product; these pages are not generated from user data.
 */
export const SEO_CONTENT_PAGES = Object.freeze({
  '/cv-to-portfolio': {
    slug: '/cv-to-portfolio',
    eyebrow: 'CV TO PORTFOLIO MAKER',
    title: 'Turn Your CV into a Recruiter-Ready Portfolio',
    metaTitle: 'CV to Portfolio Maker | 3D Portfolio Maker',
    description: 'Turn an existing CV into a recruiter-ready portfolio with structured import, 3D themes, job targeting, and optional publishing.',
    intro: 'Start with the career information you already have. Review the imported details, choose how you want to present your work, and publish only when your portfolio is ready.',
    audience: 'A practical starting point for students, developers, designers, analysts, and professionals who already have a CV but need a stronger online presentation.',
    steps: [
      ['Import your CV locally', 'Bring in a text-based PDF or DOCX. The browser extracts career details for review before anything is saved.'],
      ['Review the structure', 'Check contact details, education, experience, projects, skills, certifications, and links. Unclear fields stay marked for review.'],
      ['Build and publish', 'Choose a 3D theme in Portfolio Studio, refine your story, and publish a shareable portfolio when you are satisfied.']
    ],
    features: ['PDF/DOCX import with field-by-field review', 'Recruiter-friendly portfolio presentation', '3D themes with a lightweight fallback', 'Optional CV-to-Portfolio sync with review and no silent overwrites', 'Job targeting that highlights evidence instead of inventing skills'],
    faq: [
      ['Does importing a CV publish it automatically?', 'No. Import is a review step. Your CV data stays private until you choose what to save and whether to publish a portfolio.'],
      ['Can I edit the imported information?', 'Yes. You can correct fields, review uncertain entries, and decide which information should be used in your CV or portfolio.'],
      ['Will the job targeting feature add skills for me?', 'No. It reports evidence found, weak evidence, and missing evidence without fabricating qualifications.']
    ],
    cta: 'Import your CV',
    ctaHref: '/login?next=%2Fcv%2Fnew%3Fmode%3Dimport',
    related: ['/developer-portfolio-builder', '/3d-portfolio-maker']
  },
  '/developer-portfolio-builder': {
    slug: '/developer-portfolio-builder',
    eyebrow: 'DEVELOPER PORTFOLIO BUILDER',
    title: 'Build a Developer Portfolio Recruiters Can Scan',
    metaTitle: 'Developer Portfolio Builder | 3D Portfolio Maker',
    description: 'Create a recruiter-ready developer portfolio with projects, technologies, GitHub links, recruiter view, and optional 3D presentation.',
    intro: 'A developer portfolio should make your strongest work obvious quickly. 3D Portfolio Maker combines structured project details with a focused recruiter view so visitors can move from your role to your evidence without hunting.',
    audience: 'Designed for frontend, backend, full-stack, data, and early-career developers who want to show real projects, technologies, and outcomes clearly.',
    steps: [
      ['Add your developer story', 'Enter your role, summary, skills, education, experience, and the projects you want employers to evaluate.'],
      ['Make projects scannable', 'Give each project a name, description, technologies, result, and a validated website or repository link when one exists.'],
      ['Share a focused view', 'Use the recruiter view and a published portfolio link to put the most relevant evidence near the top of the experience.']
    ],
    features: ['Project cards with technology and outcome context', 'Validated GitHub and project links', 'Recruiter view for fast scanning', 'Responsive layouts for mobile and desktop', 'Job targeting for role-specific evidence checks'],
    faq: [
      ['Do I need to know 3D design?', 'No. Select a theme and edit your content in the Studio. The portfolio presentation is generated for you.'],
      ['Can I show a project without a public link?', 'Yes. Projects can include a clear description and technologies even when there is no public URL.'],
      ['Does recruiter view replace my portfolio?', 'No. It is a focused way to surface your key information while the full portfolio remains available for deeper exploration.']
    ],
    cta: 'Build my developer portfolio',
    ctaHref: '/login?next=%2Fstart',
    related: ['/cv-to-portfolio', '/3d-portfolio-maker']
  },
  '/3d-portfolio-maker': {
    slug: '/3d-portfolio-maker',
    eyebrow: '3D PORTFOLIO MAKER',
    title: 'Create an Interactive 3D Portfolio Website',
    metaTitle: '3D Portfolio Maker | Interactive Portfolio Website Builder',
    description: 'Create and publish an interactive 3D portfolio website with themed environments, recruiter view, project links, and responsive sharing.',
    intro: 'Use 3D as a clear visual layer around your work—not as a replacement for the work itself. Build a structured portfolio, choose a theme that fits your field, and give recruiters an easy path to your projects and resume.',
    audience: 'Useful for people who want a memorable portfolio presentation while keeping content, project links, and recruiter essentials easy to find.',
    steps: [
      ['Create your profile', 'Add your headline, summary, skills, education, experience, projects, and contact links in Portfolio Studio.'],
      ['Choose a theme', 'Preview environments such as Code Matrix, Data Galaxy, or Cyber Command and select the presentation that fits your work.'],
      ['Publish and share', 'Review the public view, verify your links, and publish a shareable URL when the content is ready.']
    ],
    features: ['Cinematic 3D themes with a usable 2D fallback', 'Recruiter view and resume download support', 'Project links that open safely in a new tab', 'Responsive public portfolio layouts', 'Optional job targeting without automatic rewriting'],
    faq: [
      ['Will the 3D view work on every device?', 'The portfolio includes a responsive fallback so the content remains usable when WebGL is unavailable or a device is constrained.'],
      ['Can I keep editing after publishing?', 'Plan access controls editing and publishing features. Your content is preserved when you change plans.'],
      ['Can visitors find my projects quickly?', 'Yes. Project sections, recruiter view, and clear calls to action are designed to make important evidence easy to scan.']
    ],
    cta: 'Create my 3D portfolio',
    ctaHref: '/login?next=%2Fstart',
    related: ['/developer-portfolio-builder', '/cv-to-portfolio']
  }
});

export function getSEOContentPage(path) {
  return SEO_CONTENT_PAGES[path] || null;
}
