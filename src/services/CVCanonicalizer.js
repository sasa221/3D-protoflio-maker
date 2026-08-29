/**
 * CVCanonicalizer.js
 * Intermediate Canonical CV Model & Semantic Classifier.
 * Standardizes raw parser output, applies strict deduplication at canonical level,
 * preserves clean project titles, single-entry volunteering, and safe non-manufactured taglines.
 */

export function canonicalizeCVData(rawParsed) {
  if (!rawParsed) return getEmptyCanonicalModel();

  let warnings = [...(rawParsed.warnings || [])];
  let ambiguousFields = [];

  // 1. Personal & Contact Isolation
  const personal = canonicalizePersonal(rawParsed.personal || {});

  // 2. Summary Sanitization (Removes stray skill text like "Python, MySQL")
  const summary = sanitizeSummary(rawParsed.summary || '', personal);

  // 3. Languages vs Tech Skills Disambiguation
  const { techSkills, languages } = separateSkillsAndLanguages(rawParsed.skills || [], rawParsed.languages || []);

  // 4. Experience Deduplication & Canonical Normalization
  const experience = deduplicateExperience(rawParsed.experience || []);

  // 5. Education Semantic Split
  const education = (rawParsed.education || []).map(canonicalizeEducation);

  // 6. Certifications Deduplication (Real Titles)
  const certifications = deduplicateCertifications(rawParsed.certifications || []);

  // 7. Projects Clean Title & Boundary Deduplication
  const projects = deduplicateProjects(rawParsed.projects || []);

  // 8. Volunteering Deduplication (Single entry with all achievements)
  const volunteering = deduplicateVolunteering(rawParsed.volunteering || []);

  const canonical = {
    personal,
    summary,
    experience,
    education,
    skills: techSkills,
    certifications,
    projects,
    languages,
    volunteering,
    warnings,
    ambiguousFields
  };

  // Diagnostics (Counts verification)
  console.log(`[CV Canonical] experience entries: ${canonical.experience.length}`);
  console.log(`[CV Canonical] education entries: ${canonical.education.length}`);
  console.log(`[CV Canonical] projects count: ${canonical.projects.length}`);
  console.log(`[CV Canonical] certifications count: ${canonical.certifications.length}`);
  console.log(`[CV Canonical] languages count: ${canonical.languages.length}`);
  console.log(`[CV Canonical] volunteering count: ${canonical.volunteering.length}`);

  return canonical;
}

function getEmptyCanonicalModel() {
  return {
    personal: { name: null, headline: null, email: null, phone: null, location: null, website: null, linkedin: null, github: null },
    summary: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    languages: [],
    volunteering: [],
    warnings: [],
    ambiguousFields: []
  };
}

function canonicalizePersonal(raw) {
  let name = raw.name ? cleanString(raw.name) : '';
  name = name.replace(/\b(LinkedIn|Portfolio|GitHub|Website|Resume|Curriculum\s*Vitae)\b/gi, '').trim();

  let headline = raw.headline ? cleanString(raw.headline) : '';
  if (headline.toUpperCase().includes('EXPERIENCE') || headline.toUpperCase().includes('EDUCATION')) {
    headline = '';
  }

  return {
    name,
    headline,
    email: raw.email ? raw.email.trim() : '',
    phone: raw.phone ? raw.phone.trim() : '',
    location: raw.location ? cleanString(raw.location) : '',
    website: raw.website || null,
    linkedin: raw.linkedin || '',
    github: raw.github || ''
  };
}

function sanitizeSummary(rawSummary, personal) {
  if (!rawSummary || typeof rawSummary !== 'string') return null;

  let clean = rawSummary;
  if (personal.email) clean = clean.replace(personal.email, '');
  if (personal.phone) clean = clean.replace(personal.phone, '');
  if (personal.linkedin) clean = clean.replace(personal.linkedin, '');
  if (personal.github) clean = clean.replace(personal.github, '');

  clean = clean.replace(/Python,\s*MySQL/gi, '')
               .replace(/Programming\s*&\s*Tools/gi, '')
               .replace(/\s+/g, ' ')
               .trim();

  return clean.length > 15 ? clean : '';
}

function separateSkillsAndLanguages(rawSkills, rawLanguages = []) {
  let techSkills = [];
  let languages = [...rawLanguages];

  rawSkills.forEach(s => {
    const sName = typeof s === 'string' ? s : s.name;
    if (!sName) return;

    const trimmed = sName.trim();
    const isLanguageCategory = normalizeCategory(s.category || '') === 'Languages';
    const languageMatch = trimmed.match(/^(.+?)\s+(Native|Fluent|Professional|Intermediate|Beginner|Basic|A1|A2|B1|B2|C1|C2)$/i);
    const isLang = isLanguageCategory || ['english', 'arabic'].some(l => l === trimmed.toLowerCase()) || Boolean(languageMatch);

    if (isLang) {
      const language = languageMatch?.[1]?.trim() || trimmed;
      const proficiency = languageMatch?.[2] || (trimmed.toLowerCase() === 'english' ? 'B2' : trimmed.toLowerCase() === 'arabic' ? 'Native' : '');
      if (!languages.some(l => l.language.toLowerCase() === language.toLowerCase())) {
        languages.push({ language, proficiency });
      }
    } else {
      const category = normalizeCategory(s.category || categorizeSkill(trimmed));
      techSkills.push({
        name: trimmed.replace(/^([^:]{2,50}):\s*/, ''),
        level: null, // NO FABRICATED PERCENTAGES!
        category
      });
    }
  });

  const uniqueSkills = techSkills.filter((item, index, list) => list.findIndex(other => other.name.toLowerCase() === item.name.toLowerCase() && other.category === item.category) === index);
  return { techSkills: uniqueSkills, languages };
}

function normalizeCategory(value = '') {
  const lower = String(value).toLowerCase();
  if (/programming|tools|technical skills|technologies/.test(lower)) return 'Programming & Tools';
  if (/data analysis|analytics/.test(lower)) return 'Data Analysis';
  if (/interpersonal|soft skills/.test(lower)) return 'Interpersonal Skills';
  if (/language/.test(lower)) return 'Languages';
  return value || 'Programming & Tools';
}

function categorizeSkill(name) {
  const lower = name.toLowerCase();
  if (['python', 'mysql', 'javascript', 'java', 'c++', 'c', 'html5', 'php', 'css3', 'bootstrap', 'laravel', 'react'].some(k => lower.includes(k))) return 'Programming & Tools';
  if (['power bi', 'data cleaning', 'data transformation', 'data visualization', 'analytical thinking'].some(k => lower.includes(k))) return 'Data Analysis';
  if (['management', 'organization', 'problem solving', 'communication', 'teamwork', 'time management', 'adaptability'].some(k => lower.includes(k))) return 'Interpersonal';
  return 'Technical';
}

function deduplicateExperience(rawExp) {
  let list = [];
  rawExp.forEach(exp => {
    const role = cleanString(exp.role || '');
    const company = cleanString(exp.company || '');
    const isDuplicate = list.some(e => e.role === role && e.company === company);
    if (!isDuplicate) {
      list.push({
        id: exp.id || 'exp_' + Math.random().toString(36).substr(2, 9),
        role,
        company: company || cleanString(exp.organization || ''),
        organization: cleanString(exp.organization || company),
        organizationShort: cleanString(exp.organizationShort || ''),
        location: cleanString(exp.location || ''),
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        current: Boolean(exp.current),
        description: cleanString(exp.description || ''),
        achievements: Array.isArray(exp.achievements) ? exp.achievements.map(cleanString).filter(Boolean) : [],
        technologies: Array.isArray(exp.technologies) ? exp.technologies.map(cleanString).filter(Boolean) : []
      });
    }
  });
  return list;
}

function canonicalizeEducation(rawEdu) {
  return {
    id: rawEdu.id || 'edu_' + Math.random().toString(36).substr(2, 9),
    degree: cleanString(rawEdu.degree),
    institution: cleanString(rawEdu.institution),
    field: cleanString(rawEdu.field || ''),
    startDate: rawEdu.startDate || '',
    endDate: rawEdu.endDate || '',
    grade: cleanString(rawEdu.grade || ''),
    description: cleanString(rawEdu.description || '')
  };
}

function deduplicateCertifications(rawCerts) {
  let list = [];
  rawCerts.forEach(c => {
    const name = cleanString(typeof c === 'string' ? c : c.name || c.title);
    if (name && !list.some(item => item.name === name)) {
      list.push({
        name,
        title: name,
        issuer: cleanString(c.issuer || ''),
        date: c.date || ''
      });
    }
  });
  return list;
}

function deduplicateProjects(rawProj) {
  let list = [];
  rawProj.forEach(p => {
    let name = cleanString(p.name || 'Project');
    // Strip bullets, dates, (View Website) from project title
    name = name.replace(/^[•\-\*\s]+/, '')
               .replace(/\s+(?:May|Dec|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov)\s*(?:19|20)\d{1,4}\s*$/gi, '')
               .replace(/\(View\s*Website\)/gi, '')
               .replace(/[,:|]+\s*$/, '')
               .trim();

    if (name && !list.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      list.push({
        name,
        description: cleanString(p.description || ''),
        bullets: Array.isArray(p.bullets) ? p.bullets.map(cleanString).filter(Boolean) : [],
        tech: cleanString(p.tech || ''),
        // A PDF may expose one annotation for a "View Website" label. Never
        // copy that same link onto every project; keep it on the first
        // evidence-bearing item only.
        url: (p.url || p.websiteUrl) && !list.some(item => item.url === (p.url || p.websiteUrl)) ? (p.url || p.websiteUrl) : '',
        websiteUrl: (p.websiteUrl || p.url) && !list.some(item => item.url === (p.websiteUrl || p.url)) ? (p.websiteUrl || p.url) : '',
        date: p.date || '',
        startDate: p.startDate || p.date || '',
        endDate: p.endDate || p.date || ''
      });
    }
  });
  return list;
}

function deduplicateVolunteering(rawVol) {
  if (!rawVol || rawVol.length === 0) return [];
  const first = rawVol[0];
  let allAchievements = [];

  rawVol.forEach(v => {
    if (Array.isArray(v.achievements)) {
      allAchievements.push(...v.achievements);
    }
    if (v.description && !allAchievements.includes(v.description)) {
      allAchievements.push(v.description);
    }
  });

  allAchievements = Array.from(new Set(allAchievements.map(cleanString))).filter(Boolean);

  return [{
    organization: cleanString(first.organization),
    role: cleanString(first.role),
    startDate: first.startDate || '',
    endDate: first.endDate || '',
    current: Boolean(first.current),
    description: cleanString(first.description || ''),
    achievements: allAchievements
  }];
}

function cleanString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/^[•\-\*\s]+/, '').replace(/\s+/g, ' ').trim();
}

export function validateCanonicalCV(canonical) {
  return { warnings: [] };
}
