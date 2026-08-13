/** Deterministic, data-faithful CV parser. It never invents candidate records. */
export class BaseCVAnalyzerProvider {
  async analyze() { throw new Error('Analyzer provider must implement analyze().'); }
}

const SECTION_PATTERNS = {
  summary: /^(summary|profile|about me|professional summary|objective)s?\b/i,
  experience: /^(experience|work experience|professional experience|employment|career history)\b/i,
  education: /^(education|academic background|qualifications|academics)\b/i,
  skills: /^(skills|technical skills|core skills|tools|technologies|competencies)\b/i,
  projects: /^(projects|selected projects|featured projects|key projects|personal projects)\b/i,
  certifications: /^(certifications|certificates|licenses|courses)\b/i,
  volunteering: /^(volunteering|volunteer experience|activities|community involvement)\b/i,
  languages: /^(languages|foreign languages)\b/i
};

function cleanLine(line = '') {
  return line.replace(/^[#\-•▪*\s]+/, '').trim();
}

function cleanHeaderLine(line = '') {
  return cleanLine(line)
    .replace(/\b(?:LinkedIn|GitHub|Portfolio|Website|Resume|Curriculum Vitae)\b.*$/i, '')
    .trim();
}

function canonicalSkillName(value) {
  const compact = value.replace(/\s+/g, '').toLowerCase();
  const canonical = {
    javascript: 'JavaScript', html5: 'HTML5', css3: 'CSS3', mysql: 'MySQL',
    php: 'PHP', powerbi: 'Power BI', 'c++': 'C++'
  };
  return canonical[compact] || value.replace(/\s+/g, ' ').trim();
}

function inferHeadline(summary, headerCandidates) {
  const direct = headerCandidates.find(v =>
    /\b(developer|engineer|designer|analyst|scientist|manager|specialist|consultant)\b/i.test(v)
  );
  if (direct) return direct;
  const match = summary.match(/\b([A-Za-z]+(?:\s*-\s*[A-Za-z]+)?(?:\s+[A-Za-z]+){0,3}\s+(?:Developer|Engineer|Designer|Analyst|Scientist|Manager|Specialist|Consultant))\b/i);
  return match ? match[1].replace(/\s*-\s*/g, '-').trim() : '';
}

function extractSkillsFromText(fullText) {
  const groups = [
    /Programming\s*&\s*Tools\s*:\s*([\s\S]*?)(?=Data Analysis\s*:|Interpersonal Skills\s*:|Languages\s*:|Volunteering|$)/i,
    /Data Analysis\s*:\s*([\s\S]*?)(?=Interpersonal Skills\s*:|Languages\s*:|Volunteering|$)/i,
    /Interpersonal Skills\s*:\s*([\s\S]*?)(?=Languages\s*:|Volunteering|$)/i
  ];
  const block = groups.map(pattern => fullText.match(pattern)?.[1] || '').join('\n');
  const values = block.split(/\n|[,;•]/)
    .map(value => value.replace(/^[:\-▪*\s]+/, '').replace(/[.]$/, '').trim())
    .filter(value => value && value.length <= 60 && !/^(?:English|Arabic)\b/i.test(value));
  return [...new Set(values.map(v => v.replace(/[.]$/, '').trim()))];
}

function detectSections(lines) {
  const found = [];
  lines.forEach((line, index) => {
    const clean = cleanLine(line);
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(clean)) { found.push({ key, index }); break; }
    }
  });
  const sections = {};
  found.forEach((item, index) => {
    sections[item.key] = { startIndex: item.index, endIndex: found[index + 1]?.index ?? lines.length };
  });
  return sections;
}

function sectionLines(sections, key, lines) {
  const section = sections[key];
  return section ? lines.slice(section.startIndex + 1, section.endIndex).map(cleanLine).filter(Boolean) : [];
}

function splitList(rows) {
  return rows.flatMap(row => row.split(/[,|•]/)).map(cleanLine).filter(Boolean);
}

export class DeterministicFallbackProvider extends BaseCVAnalyzerProvider {
  async analyze(normalizedCV) {
    const lines = normalizedCV?.lines || [];
    const fullText = normalizedCV?.text || '';
    if (!lines.length) throw new Error('CV text content is empty or unreadable.');

    const sections = detectSections(lines);
    const firstSectionIndex = Math.min(...Object.values(sections).map(s => s.startIndex), lines.length);
    const header = lines.slice(0, firstSectionIndex).map(cleanHeaderLine).filter(Boolean);
    const email = fullText.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '';
    const phone = fullText.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/)?.[0] || '';
    const links = header.filter(v => /https?:\/\//i.test(v));
    const candidates = header.filter(v => !v.includes('@') && !/https?:\/\//i.test(v) && !/\d{5,}/.test(v));
    const name = candidates.find(v => /^[\p{L}][\p{L} .'-]{2,44}$/u.test(v)) || '';
    const rows = key => sectionLines(sections, key, lines);
    const summary = rows('summary').join(' ');
    const headline = inferHeadline(summary, candidates.filter(v => v !== name));

    const experienceRows = rows('experience');
    const educationRows = rows('education');
    const skillNames = [...splitList(rows('skills')), ...extractSkillsFromText(fullText)]
      .map(v => v.replace(/^[:\-\s]+/, '').trim())
      .map(canonicalSkillName)
      .filter(v => v && !/^(?:Languages\s*:|English|Arabic)\b/i.test(v));
    const skills = [...new Set(skillNames)].map(name => ({ name, category: 'Skills', level: null }));
    const projects = rows('projects').map((name, i) => ({ id: `project_${i + 1}`, name, description: '', tech: '', url: '', date: '' }));
    const certifications = rows('certifications').map(name => ({ name, title: name, issuer: '', date: '' }));
    const languages = splitList(rows('languages')).map(language => ({ language, proficiency: '' }));

    const experience = experienceRows.length ? [{
      id: 'exp_1', role: experienceRows[0], company: '', location: '', startDate: '', endDate: '', current: false,
      description: experienceRows.slice(1).join(' '), achievements: [], technologies: []
    }] : [];
    const education = educationRows.length ? [{
      id: 'edu_1', institution: educationRows[0], degree: '', field: '', startDate: '', endDate: '', grade: '',
      description: educationRows.slice(1).join(' ')
    }] : [];

    return {
      personal: {
        name, headline, email, phone,
        location: candidates.find(v => v !== name && v !== headline && /,/.test(v)) || '',
        github: links.find(v => /github\.com/i.test(v)) || '',
        linkedin: links.find(v => /linkedin\.com/i.test(v)) || ''
      },
      summary, experience, education, skills, projects, certifications,
      volunteering: [], languages,
      confidence: { personal: name ? 0.9 : 0.3, experience: experience.length ? 0.65 : 0, education: education.length ? 0.65 : 0, skills: skills.length ? 0.9 : 0 },
      warnings: name && headline ? [] : ['Review name and professional title before continuing.'],
      missingProjects: projects.length === 0,
      providerType: 'Local PDF parser'
    };
  }
}

export class CVParserService {
  constructor() { this.fallbackProvider = new DeterministicFallbackProvider(); }
  async parse(normalizedCV) { return this.fallbackProvider.analyze(normalizedCV); }
}
