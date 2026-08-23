/**
 * MarketingDemoPortfolio.js
 * Dedicated, 100% fictional static public demo fixture for the Landing Page hero showcase.
 * Strictly isolated from real user accounts, personal profile data, and Supabase DB queries.
 */

export const MARKETING_DEMO_PORTFOLIO = {
  id: 'pf_demo_alex_morgan',
  name: 'Alex Morgan',
  profession: 'Frontend Developer',
  tagline: 'Crafting high-throughput web products & immersive 3D interfaces.',
  bio: 'Building fast, accessible web experiences with modern JavaScript and WebGL.',
  location: 'San Francisco, CA',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&fm=webp&w=220&q=65',
  theme: 'code',
  availability: { status: 'open', text: '🟢 Open to Opportunities' },
  social: {
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    email: 'alex.morgan@example.com'
  },
  skills: [
    { id: 'sk_1', name: 'JavaScript (ES6+)' },
    { id: 'sk_2', name: 'HTML5 & CSS3' },
    { id: 'sk_3', name: 'Three.js & WebGL' },
    { id: 'sk_4', name: 'TypeScript' }
  ],
  experience: [
    {
      id: 'exp_1',
      role: 'Senior Frontend Engineer',
      company: 'Nexus Tech Systems',
      location: 'San Francisco, CA',
      startDate: '2023',
      endDate: 'Present',
      current: true,
      achievements: [
        'Architected high-throughput web components reducing render latency by 45%.',
        'Built interactive 3D visualization tools for cloud analytics platform.'
      ],
      technologies: ['JavaScript', 'Three.js', 'CSS3', 'WebGL']
    }
  ],
  projects: [
    {
      id: 'proj_1',
      name: 'Commerce UI Platform',
      description: 'Ultra-fast responsive storefront interface with real-time inventory sync.',
      tech: 'JavaScript · CSS3 · WebGL',
      problem: 'Storefront teams needed instant inventory feedback without slowing down browsing.',
      solution: 'A component-driven frontend with real-time inventory synchronization and GPU-assisted visuals.',
      impact: 'Reduced render latency by 45% in the fictional demo scenario.'
    },
    {
      id: 'proj_2',
      name: 'Analytics Dashboard',
      description: 'Interactive data dashboard with high-fps WebGL rendering.',
      tech: 'JavaScript · Three.js',
      problem: 'Dense operational data was difficult to scan and explore.',
      solution: 'An interactive dashboard combining accessible summaries with high-fps WebGL exploration.',
      impact: 'Made the most important trends visible in a single recruiter-friendly case study.'
    }
  ],
  education: [
    {
      id: 'edu_1',
      degree: 'B.S. Computer Science',
      institution: 'State University',
      year: '2022'
    }
  ],
  showBranding: true
};
