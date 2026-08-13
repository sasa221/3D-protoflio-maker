/**
 * DemoPortfolioConfig.js
 * Seeded public demo configuration for the Landing Page live interactive showcase.
 * Safe from user analytics pollution & private user profile data.
 */

export const DEMO_PORTFOLIO = {
  id: 'pf_demo_saleh',
  name: 'Saleh Mohamed Aborehab',
  profession: 'Front-End Developer',
  tagline: 'Crafting high-throughput web products & immersive 3D interfaces.',
  bio: 'Product-focused Web Architect specializing in JavaScript, Three.js, and high-performance Web APIs.',
  location: 'Cairo, Egypt',
  avatar: 'https://kupxhrfijkdlcteniqfp.supabase.co/storage/v1/object/public/avatars/demo/avatar.webp',
  theme: 'code',
  availability: { status: 'open', text: '🟢 Open to Opportunities' },
  social: {
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    email: 'saleh@example.com'
  },
  skills: [
    { id: 'sk_1', name: 'JavaScript (ES6+)', level: 96 },
    { id: 'sk_2', name: 'HTML5 & CSS3', level: 95 },
    { id: 'sk_3', name: 'Three.js & WebGL', level: 90 },
    { id: 'sk_4', name: 'REST APIs & Node.js', level: 88 },
    { id: 'sk_5', name: 'Power BI & SQL', level: 85 }
  ],
  experience: [
    {
      id: 'exp_1',
      role: 'Web Developer Trainee',
      company: 'National Telecommunication Institute (NTI)',
      location: 'Cairo, Egypt',
      startDate: 'Sept 2025',
      endDate: 'Oct 2025',
      current: false,
      achievements: [
        'Developed responsive web interfaces and optimized frontend render performance by 40%.',
        'Integrated asynchronous API data layers with robust local storage caching.'
      ],
      technologies: ['JavaScript', 'HTML5', 'CSS3', 'REST APIs']
    },
    {
      id: 'exp_2',
      role: 'Data Analysis Trainee',
      company: 'Ministry of Communications and IT (MCIT)',
      location: 'Cairo, Egypt',
      startDate: 'Sept 2023',
      endDate: 'Nov 2023',
      current: false,
      achievements: [
        'Built interactive analytical dashboards for data visualization using Power BI and SQL.',
        'Extracted actionable insights from large organizational datasets.'
      ],
      technologies: ['Power BI', 'SQL', 'Data Analytics']
    }
  ],
  education: [
    {
      id: 'edu_1',
      degree: 'Bachelor of Computer Science',
      institution: 'Helwan University',
      location: 'Cairo, Egypt',
      startDate: '2023',
      endDate: '2027',
      grade: 'GPA: 3.35',
      description: 'Faculty of Computers and Artificial Intelligence.'
    }
  ],
  projects: [
    {
      id: 'proj_1',
      name: 'Clothe E-Commerce Platform',
      description: 'High-performance interactive web application featuring dynamic filtering, smooth cart state management, and custom visual styling.',
      tech: 'JavaScript · HTML5 · CSS3',
      github: 'https://github.com',
      url: 'https://example.com',
      role: 'Lead Frontend Developer',
      duration: '2 Months',
      problem: 'Traditional e-commerce templates suffered from slow page loads and clumsy cart interactions.',
      solution: 'Engineered a lightweight custom JS architecture with client-side state caching and instant DOM updates.',
      impact: 'Achieved 98+ Lighthouse performance score and instant page transitions.',
      metrics: [
        { label: 'Lighthouse Score', value: '98/100' },
        { label: 'Cart Latency', value: '< 16ms' }
      ]
    },
    {
      id: 'proj_2',
      name: 'Array ADT Data Structures Manager',
      description: 'Robust C++ application implementing custom array data structures, sorting algorithms, and memory management routines.',
      tech: 'C++ · Data Structures',
      github: 'https://github.com',
      role: 'Software Engineer',
      duration: '1 Month',
      problem: 'Demonstrating memory efficiency and custom algorithmic implementation.',
      solution: 'Designed optimized dynamic array allocation routines in clean C++.',
      impact: 'Zero memory leaks and O(log N) binary search efficiency.',
      metrics: [
        { label: 'Algorithm Complexity', value: 'O(log N)' }
      ]
    }
  ],
  resume: {
    fileName: 'Saleh-Mohamed-CV.pdf',
    buttonText: 'Download Resume',
    mimeType: 'application/pdf',
    size: 245120
  }
};
