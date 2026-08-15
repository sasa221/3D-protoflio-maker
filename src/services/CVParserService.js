/** Deterministic, evidence-only CV parser. It never invents candidate records. */
export class BaseCVAnalyzerProvider {
  async analyze() { throw new Error('Analyzer provider must implement analyze().'); }
}

const SECTION_PATTERNS = {
  summary: /^(summary|profile|about me|professional summary|objectives?)\b/i,
  experience: /^(experience|work experience|professional experience|employment|career history)\b/i,
  education: /^(education|academic background|qualifications|academics)\b/i,
  skills: /^(skills|technical skills|core skills|tools(?:\s*&\s*technologies)?|technologies|competencies)\b/i,
  projects: /^(projects|selected projects|featured projects|key projects|personal projects)\b/i,
  certifications: /^(certifications|certificates|licenses|courses)\b/i,
  volunteering: /^(volunteering|volunteer experience|activities|community involvement)\b/i,
  languages: /^(languages|foreign languages)\b/i
};

const DATE_TOKEN = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Q[1-4])';
const DATE_LINE_RE = new RegExp(`(?:${DATE_TOKEN}\\s+)?(?:19|20)\\d{2}(?:\\s*(?:-|to)\\s*(?:(?:${DATE_TOKEN}\\s+)?(?:19|20)\\d{2}|Present|Current))?`, 'i');

function cleanLine(line = '') {
  return String(line).replace(/^[#\-•▪*\s]+/, '').replace(/\s+/g, ' ').trim();
}

function cleanHeaderLine(line = '') {
  return cleanLine(line).replace(/\b(?:LinkedIn|GitHub|Portfolio|Website|Resume|Curriculum Vitae)\b.*$/i, '').trim();
}

function detectSections(lines) {
  const found = [];
  lines.forEach((line, index) => {
    const value = cleanLine(line);
    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(value)) { found.push({ key, index }); break; }
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

function splitTitleOrganization(value = '') {
  const parts = value.split(/\s+-\s+/).map(cleanLine).filter(Boolean);
  return { title: parts.shift() || '', organization: parts.join(' - ') };
}

function parseDateRange(value = '') {
  const parts = value.split(/\s+(?:-|to)\s+/i).map(cleanLine);
  return { startDate: parts[0] || '', endDate: parts[1] || '', current: /present|current/i.test(parts[1] || '') };
}

function parseExperience(rows) {
  const entries = [];
  for (let index = 0; index < rows.length;) {
    if (!DATE_LINE_RE.test(rows[index + 1] || '')) { index += 1; continue; }
    const { title: role, organization: company } = splitTitleOrganization(rows[index]);
    const dates = parseDateRange(rows[index + 1]);
    index += 2;
    const details = [];
    while (index < rows.length && !DATE_LINE_RE.test(rows[index + 1] || '')) details.push(cleanLine(rows[index++]));
    entries.push({
      id: `exp_${entries.length + 1}`, role, company, location: '', ...dates,
      description: details.join(' '), achievements: details, technologies: []
    });
  }
  return entries;
}

function parseEducation(rows) {
  if (!rows.length) return [];
  const dateIndex = rows.findIndex(row => DATE_LINE_RE.test(row));
  const beforeDates = dateIndex >= 0 ? rows.slice(0, dateIndex) : rows;
  const degreeParts = splitTitleOrganization(beforeDates[0] || '');
  const dates = dateIndex >= 0 ? parseDateRange(rows[dateIndex]) : { startDate: '', endDate: '', current: false };
  const grade = rows.find(row => /^(?:gpa|grade)\s*:/i.test(row))?.split(':').slice(1).join(':').trim() || '';
  return [{
    id: 'edu_1', degree: degreeParts.title, field: degreeParts.organization,
    institution: beforeDates[1] || '', startDate: dates.startDate, endDate: dates.endDate,
    grade, description: rows.slice(Math.max(dateIndex + 1, 2)).filter(row => !/^(?:gpa|grade)\s*:/i.test(row)).join(' ')
  }];
}

function parseProjects(rows) {
  const projects = [];
  for (let index = 0; index < rows.length;) {
    if (!DATE_LINE_RE.test(rows[index + 1] || '')) { index += 1; continue; }
    const name = rows[index];
    const date = rows[index + 1];
    index += 2;
    const details = [];
    while (index < rows.length && !DATE_LINE_RE.test(rows[index + 1] || '')) details.push(rows[index++]);
    const techRows = details.filter(row => /(?:·|\||,)/.test(row) && row.length < 100);
    projects.push({
      id: `project_${projects.length + 1}`, name, date,
      description: details.filter(row => !techRows.includes(row)).join(' '),
      tech: techRows.join(' · '), url: ''
    });
  }
  return projects;
}

function parseCertifications(rows) {
  return rows.map(row => {
    const { title, organization } = splitTitleOrganization(row);
    return { name: title, title, issuer: organization, date: '' };
  }).filter(item => item.name);
}

function parseLanguages(rows) {
  const text = rows.join(' ');
  const matches = [...text.matchAll(/([\p{L}][\p{L} -]{1,30}?)\s+(Native|Fluent|Professional|Intermediate|Beginner|Basic|A1|A2|B1|B2|C1|C2)\b/giu)];
  if (matches.length) return matches.map(match => ({ language: cleanLine(match[1]), proficiency: match[2] }));
  return rows.flatMap(row => row.split(/[,|•]/)).map(cleanLine).filter(Boolean).map(language => ({ language, proficiency: '' }));
}

function parseVolunteering(rows) {
  if (!rows.length) return [];
  const { title: role, organization } = splitTitleOrganization(rows[0]);
  const hasDates = DATE_LINE_RE.test(rows[1] || '');
  const dates = hasDates ? parseDateRange(rows[1]) : { startDate: '', endDate: '', current: false };
  const details = rows.slice(hasDates ? 2 : 1);
  return [{ organization, role, ...dates, description: details.join(' '), achievements: details }];
}

function inferSkills(fullText, explicitRows) {
  const evidenceSkills = [
    'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'HTML', 'CSS', 'Bootstrap',
    'PHP', 'Laravel', 'Python', 'Java', 'C++', 'C#', 'SQL', 'MySQL', 'PostgreSQL',
    'Power BI', 'Tableau', 'Excel', 'Git', 'Node.js', 'Three.js', 'WebGL'
  ];
  const explicit = explicitRows.flatMap(row => row.split(/[,;|•·]/)).map(cleanLine).filter(Boolean);
  const inferred = evidenceSkills.filter(skill => new RegExp(`(^|[^\\p{L}\\p{N}])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu').test(fullText));
  return [...new Set([...explicit, ...inferred])].map(name => ({ name, category: 'Skills', level: null }));
}

function inferHeadline(summary, candidates) {
  return candidates.find(value => /\b(developer|engineer|designer|analyst|scientist|manager|specialist|consultant)\b/i.test(value)) ||
    summary.match(/\b[\p{L}-]+(?:\s+[\p{L}-]+){0,3}\s+(?:Developer|Engineer|Designer|Analyst|Scientist|Manager|Specialist|Consultant)\b/iu)?.[0] || '';
}

export class DeterministicFallbackProvider extends BaseCVAnalyzerProvider {
  async analyze(normalizedCV) {
    const lines = normalizedCV?.lines || [];
    const fullText = normalizedCV?.text || '';
    if (!lines.length) throw new Error('CV text content is empty or unreadable.');

    const sections = detectSections(lines);
    const firstSectionIndex = Math.min(...Object.values(sections).map(section => section.startIndex), lines.length);
    const header = lines.slice(0, firstSectionIndex).map(cleanHeaderLine).filter(Boolean);
    const email = fullText.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '';
    const phone = fullText.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/)?.[0] || '';
    const links = fullText.match(/(?:https?:\/\/|www\.)[^\s|]+/gi) || [];
    const candidates = header.filter(value => !value.includes('@') && !/(?:https?:\/\/|www\.)/i.test(value) && !/\d{5,}/.test(value));
    const name = candidates.find(value => /^[\p{L}][\p{L} .'-]{2,44}$/u.test(value)) || '';
    const rows = key => sectionLines(sections, key, lines);
    const summary = rows('summary').join(' ');
    const headline = inferHeadline(summary, candidates.filter(value => value !== name));
    const skills = inferSkills(fullText, rows('skills'));

    const experience = parseExperience(rows('experience'));
    const education = parseEducation(rows('education'));
    const projects = parseProjects(rows('projects'));
    const certifications = parseCertifications(rows('certifications'));
    const volunteering = parseVolunteering(rows('volunteering'));
    const languages = parseLanguages(rows('languages'));

    return {
      personal: {
        name, headline, email, phone,
        location: header.find(value => value !== name && value !== headline && value.includes(','))?.split('|')[0].trim() || '',
        github: links.find(value => /github\.com/i.test(value)) || '',
        linkedin: links.find(value => /linkedin\.com/i.test(value)) || ''
      },
      summary, experience, education, skills, projects, certifications, volunteering, languages,
      confidence: { personal: name ? 0.9 : 0.3, experience: experience.length ? 0.85 : 0, education: education.length ? 0.85 : 0, skills: skills.length ? 0.8 : 0 },
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
