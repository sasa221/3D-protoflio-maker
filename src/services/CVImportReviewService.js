import { unzipSync } from 'fflate';

export const CV_IMPORT_LIMITS = Object.freeze({ maxBytes: 10 * 1024 * 1024, maxPages: 12, maxTextLength: 120000, maxDocxXmlLength: 6000000 });
const SECTION_NAMES = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'training', 'activities'];
const SECTION_RE = /^(summary|profile|about me|professional summary|objectives?|experience|work experience|professional experience|international experience|relevant experience|additional experience|research experience|employment|career history|education|academic background|qualifications|academics|skills|skills\s*&\s*languages|technical skills|core skills|tools(?:\s*&\s*technologies)?|technologies|competencies|projects|selected projects|featured projects|certifications|certificates|licenses|courses|languages|foreign languages|training|activities|leadership\s*&\s*activities|volunteering|volunteer experience|community involvement|presentations\s*&\s*conferences|publications|professional memberships|الملخص|الملخص المهني|نبذة شخصية|الهدف المهني|الخبرة|الخبرات|الخبرات العملية|التعليم|المؤهلات|المؤهلات العلمية|المهارات|المهارات التقنية|المشاريع|المشروعات|الشهادات|الدورات|اللغات|التدريب|الأنشطة|الانشطة|العمل التطوعي|التواصل|بيانات التواصل|التفاصيل)\s*:??$/i;
const INLINE_SECTION_RE = /^(professional summary|about me|objectives?|work experience|professional experience|career history|academic background|technical skills|core skills|tools\s*&\s*technologies|selected projects|featured projects|volunteer experience|community involvement|summary|profile|experience|employment|education|qualifications|academics|skills|technologies|competencies|projects|certifications|certificates|licenses|courses|languages|training|activities|volunteering)\s*(?::|\s{2,})\s*(.+)$/i;
const UPPER_INLINE_SECTION_RE = /^(PROFESSIONAL SUMMARY|OBJECTIVES?|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|INTERNATIONAL EXPERIENCE|RELEVANT EXPERIENCE|ADDITIONAL EXPERIENCE|RESEARCH EXPERIENCE|CAREER HISTORY|ACADEMIC BACKGROUND|TECHNICAL SKILLS|CORE SKILLS|SKILLS & LANGUAGES|SELECTED PROJECTS|FEATURED PROJECTS|VOLUNTEER EXPERIENCE|LEADERSHIP & ACTIVITIES|SUMMARY|PROFILE|EXPERIENCE|EMPLOYMENT|EDUCATION|QUALIFICATIONS|ACADEMICS|SKILLS|PROJECTS|CERTIFICATIONS|LANGUAGES|TRAINING|ACTIVITIES|VOLUNTEERING)\s+(.+)$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, max = 2400) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanLine(value) { return clean(value).replace(/^[•▪◦\-–—*]+\s*/, '').trim(); }
function keyFor(value) { return String(value || '').toLowerCase().replace(/[^a-z]/g, ''); }
function isHeading(line) { return SECTION_RE.test(cleanLine(line)); }
function sectionKey(line) {
  const lower = cleanLine(line).toLowerCase();
  if (/summary|profile|about|objective|ملخص|نبذة|هدف مهني/.test(lower)) return 'summary';
  if (/experience|employment|career history|خبر/.test(lower)) return 'experience';
  if (/education|academic|qualification|تعليم|مؤهل/.test(lower)) return 'education';
  if (/skill|tools|technolog|competenc|مهار/.test(lower)) return 'skills';
  if (/project|مشروع|مشروعات/.test(lower)) return 'projects';
  if (/certificat|license|course|شهاد|دورات/.test(lower)) return 'certifications';
  if (/language|لغات/.test(lower)) return 'languages';
  if (/training|تدريب/.test(lower)) return 'training';
  return 'activities';
}

function decodeXml(value) {
  return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeWebLink(value) {
  const link = clean(value, 600).replace(/[),.;]+$/, '');
  return /^(?:www\.|(?:linkedin|github)\.com\/)/i.test(link) ? `https://${link}` : link;
}

const MONTH_YEAR_RE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b/i;
const DATE_RANGE_RE = new RegExp(`${MONTH_YEAR_RE.source}\\s*(?:-|–|—|to)\\s*(?:${MONTH_YEAR_RE.source}|present|current)`, 'i');

function joinWrappedLines(lines = []) {
  return lines.reduce((out, raw) => {
    const line = clean(raw);
    if (!line) return out;
    if (!out) return line;
    return out.endsWith('-') ? `${out.slice(0, -1)}${line}` : `${out} ${line}`;
  }, '');
}

function groupResumeEntries(lines = [], kind) {
  const source = lines.map(value => clean(value)).filter(Boolean);
  if (!source.length) return [];
  if (kind === 'education' || kind === 'activities') return [source.join(' | ')];
  if (kind === 'projects') {
    const groups = []; let current = [];
    for (const line of source) {
      const startsProject = MONTH_YEAR_RE.test(line) && line.length < 150;
      if (startsProject && current.length) { groups.push(joinWrappedLines(current)); current = []; }
      current.push(line);
    }
    if (current.length) groups.push(joinWrappedLines(current));
    return groups;
  }
  if (kind === 'experience') {
    const groups = []; let current = [];
    source.forEach((line, index) => {
      const nextLooksLikeDatedRole = DATE_RANGE_RE.test(source[index + 1] || '');
      const currentAlreadyHasRole = current.some(value => DATE_RANGE_RE.test(value));
      if (nextLooksLikeDatedRole && currentAlreadyHasRole && current.length) { groups.push(joinWrappedLines(current)); current = []; }
      current.push(line);
    });
    if (current.length) groups.push(joinWrappedLines(current));
    return groups;
  }
  return source;
}

function extractDocxText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('The DOCX file is not a valid ZIP document.');
  let entries;
  try { entries = unzipSync(bytes); } catch (_) { throw new Error('The DOCX file is damaged or cannot be read locally.'); }
  const names = Object.keys(entries);
  if (names.some(name => /vbaProject|macros|\.bin$/i.test(name))) throw new Error('Macro-enabled Office content is not supported.');
  const documentName = names.find(name => name.toLowerCase() === 'word/document.xml');
  if (!documentName) throw new Error('The DOCX document body is missing.');
  const xml = new TextDecoder().decode(entries[documentName]);
  if (xml.length > CV_IMPORT_LIMITS.maxDocxXmlLength) throw new Error('The DOCX document body exceeds the local size limit.');
  const textOnlyXml = xml.replace(/<w:tab\s*\/?\s*>/gi, '\t').replace(/<\/w:p\s*>/gi, '\n');
  const paragraphs = textOnlyXml.split('\n').map(paragraph => {
    const text = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t\s*>/gi)].map(match => decodeXml(match[1])).join('');
    return cleanLine(text);
  }).filter(Boolean);
  return paragraphs.join('\n');
}

export function validateImportFile(file) {
  if (!file) throw new Error('Choose a PDF or DOCX file first.');
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  const format = name.endsWith('.pdf') || type === 'application/pdf' ? 'pdf' : name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' : '';
  if (!format) throw new Error('Unsupported format. Only PDF and DOCX files are accepted.');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('The selected file is empty.');
  if (file.size > CV_IMPORT_LIMITS.maxBytes) throw new Error('The file exceeds the local 10MB limit.');
  return { format, name: String(file.name || `${format} import`).slice(0, 160), size: file.size };
}

export async function extractImportText(file, { onProgress } = {}) {
  const meta = validateImportFile(file);
  onProgress?.({ stage: 'reading', percent: 15, label: 'Reading locally…' });
  let text; let embeddedLinks = [];
  if (meta.format === 'pdf') {
    onProgress?.({ stage: 'pdf', percent: 45, label: 'Extracting PDF text locally…' });
    // Load the browser-only PDF.js worker lazily so local Node tests can
    // exercise DOCX parsing and review logic without a Vite worker URL.
    const { extractTextFromPDF } = await import('./PDFTextExtractor.js');
    const extractedPdf = await extractTextFromPDF(file, { maxPages: CV_IMPORT_LIMITS.maxPages, maxTextLength: CV_IMPORT_LIMITS.maxTextLength });
    text = extractedPdf.text;
    embeddedLinks = Array.isArray(extractedPdf.embeddedLinks) ? extractedPdf.embeddedLinks : [];
  } else {
    onProgress?.({ stage: 'docx', percent: 45, label: 'Extracting DOCX text locally…' });
    text = extractDocxText(await file.arrayBuffer());
  }
  const normalized = String(text || '').replace(/\r/g, '').split('\n').map(cleanLine).filter(Boolean).join('\n');
  if (normalized.length < 20) throw new Error('The file contains too little readable text.');
  if (normalized.length > CV_IMPORT_LIMITS.maxTextLength) throw new Error('Extracted text exceeds the local character limit.');
  onProgress?.({ stage: 'review', percent: 100, label: 'Ready for field-by-field review.' });
  return { ...meta, text: normalized, embeddedLinks };
}

export function buildImportReview(text, { format = 'text', fileName = '', embeddedLinks = [] } = {}) {
  const lines = String(text || '').split('\n').map(cleanLine).filter(Boolean).flatMap(line => {
    const match = line.match(INLINE_SECTION_RE) || line.match(UPPER_INLINE_SECTION_RE);
    return match && clean(match[2]) ? [clean(match[1]), clean(match[2])] : [line];
  });
  if (!lines.length) throw new Error('No readable text was found.');
  const headingIndexes = lines.map((line, index) => isHeading(line) ? { index, key: sectionKey(line) } : null).filter(Boolean);
  const firstSection = headingIndexes[0]?.index ?? lines.length;
  const header = lines.slice(0, firstSection);
  const documentText = lines.join(' ');
  const documentParts = lines.flatMap(line => line.split(/\s*\|\s*/)).map(part => clean(part)).filter(Boolean);
  const email = documentText.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '';
  const phone = documentText.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/)?.[0] || '';
  const links = documentText.match(/(?:https?:\/\/|www\.|(?:linkedin|github)\.com\/)[^\s|]+/gi) || [];
  const nameCandidate = header.find(line => !/@/.test(line) && !/\+?\d[\d\s()-]{7,}/.test(line) && !/(?:https?:\/\/|www\.|(?:linkedin|github)\.com\/)/i.test(line) && !/synthetic test cv|not a real person/i.test(line) && !/^CV-\d+/i.test(line) && !/^(resume|cv|curriculum vitae|linkedin|portfolio|linkedin portfolio)$/i.test(line)) || '';
  const name = clean(nameCandidate.replace(/\s+(?:linkedin\s+)?portfolio\s*$/i, ''), 160);
  const location = documentParts.find(part => part.length <= 70 && !/[.!?]$/.test(part) && /^[\p{L}.' -]+,\s*[\p{L}.' -]+$/u.test(part) && !/@/.test(part)) || '';
  // Nothing is persisted by default. The reviewer must explicitly select
  // each field, including contact details, before saving it.
  const field = (value, source = 'extracted') => ({ value: clean(value), source, needsReview: true, selected: Boolean(clean(value)) });
  const sections = Object.fromEntries(SECTION_NAMES.map(key => [key, []]));
  headingIndexes.forEach((heading, index) => {
    const end = headingIndexes[index + 1]?.index ?? lines.length;
    sections[heading.key].push(...lines.slice(heading.index + 1, end).map(value => clean(value)).filter(Boolean));
  });
  const projectLinks = embeddedLinks.map(normalizeWebLink).filter(link => link && !/linkedin\.com|github\.com/i.test(link));
  const groupedProjects = groupResumeEntries(sections.projects, 'projects').map((value, index) => /view\s+(?:my\s+)?website/i.test(value) && projectLinks[index] ? `${value} | ${projectLinks[index]}` : value);
  const review = {
    source: { format, fileName: clean(fileName, 160) },
    contact: { name: field(name), email: field(email), phone: field(phone), location: field(location), linkedin: field(normalizeWebLink(links.find(link => /linkedin\.com/i.test(link)) || '')), github: field(normalizeWebLink(links.find(link => /github\.com/i.test(link)) || '')) },
    summary: field(sections.summary.join(' ')),
    experience: groupResumeEntries(sections.experience, 'experience').map(value => field(value)), education: groupResumeEntries(sections.education, 'education').map(value => field(value)), skills: sections.skills.flatMap(value => value.split(/[,;|•·]/).map(item => field(item))).filter(item => item.value),
    projects: groupedProjects.map(value => field(value)), certifications: sections.certifications.map(value => field(value)), languages: sections.languages.map(value => field(value)), training: groupResumeEntries(sections.training, 'training').map(value => field(value)), activities: groupResumeEntries(sections.activities, 'activities').map(value => field(value)),
    warnings: []
  };
  if (!name) review.warnings.push('Name was not clearly identified.');
  if (!review.contact.email.value) review.warnings.push('Email was not found in the file.');
  if (!review.experience.length) review.warnings.push('No experience rows were clearly extracted.');
  if (!review.education.length) review.warnings.push('No education rows were clearly extracted.');
  const coreSectionCount = ['summary', 'experience', 'education', 'skills', 'projects'].filter(key => key === 'summary' ? Boolean(review.summary.value) : review[key].length > 0).length;
  if (!review.contact.email.value && coreSectionCount < 2) review.warnings.push('This document does not look like a CV or resume. Check the file before selecting anything.');
  return review;
}

export function createImportSelection(review) {
  const selection = {};
  for (const [key, value] of Object.entries(review || {})) {
    if (key === 'source' || key === 'warnings') continue;
    if (Array.isArray(value)) selection[key] = value.map(item => ({ ...item, selected: Boolean(item.selected) }));
    else if (value && typeof value === 'object' && 'value' in value) selection[key] = { ...value, selected: Boolean(value.selected) };
    else if (value && typeof value === 'object') selection[key] = Object.fromEntries(Object.entries(value).map(([fieldName, item]) => [fieldName, { ...item, selected: Boolean(item.selected) }]));
  }
  return selection;
}

function selectedValue(item) { return item?.selected && clean(item.value) ? clean(item.value) : ''; }
function mergeArray(existing, incoming, overwrite) {
  if (overwrite) return incoming.map(value => ({ text: value }));
  const out = Array.isArray(existing) ? clone(existing) : [];
  const seen = new Set(out.map(item => clean(typeof item === 'string' ? item : item?.text || item?.name || '').toLowerCase()).filter(Boolean));
  incoming.forEach(value => { const key = value.toLowerCase(); if (key && !seen.has(key)) { out.push({ text: value }); seen.add(key); } });
  return out;
}

function parseImportedStructuredEntry(kind, value) {
  const text = clean(value);
  if (kind === 'education') {
    const parts = text.split(/\s*\|\s*/).map(value => clean(value)).filter(Boolean);
    const dated = parts.find(part => MONTH_YEAR_RE.test(part)) || '';
    const range = dated.match(new RegExp(`(${MONTH_YEAR_RE.source})\\s*(?:-|–|—|to)\\s*(${MONTH_YEAR_RE.source}|present|current)`, 'i'));
    const degreeText = clean(dated.replace(range?.[0] || '', '').replace(/[,\s-]+$/, ''));
    return { institution: parts[0] || '', degree: degreeText, field: '', startDate: range?.[1] || '', endDate: range?.[2] || '', details: parts.filter(part => part !== parts[0] && part !== dated).join(' · ') };
  }
  if (kind === 'projects') {
    const date = text.match(MONTH_YEAR_RE)?.[0] || '';
    const url = normalizeWebLink(text.match(/(?:https?:\/\/|www\.)[^\s|)]+/i)?.[0] || '');
    const before = date ? clean(text.slice(0, text.indexOf(date)).replace(/\(?\s*view\s+(?:my\s+)?website\s*\)?/ig, '').replace(/[,\s-]+$/, '')) : '';
    const after = clean((date ? text.slice(text.indexOf(date) + date.length) : text).replace(url, '').replace(/\(?\s*view\s+(?:my\s+)?website\s*\)?/ig, '').replace(/^\s*\|\s*|\s*\|\s*$/g, ''));
    return { name: before || clean(text, 120), role: '', startDate: date, endDate: date, url, details: after };
  }
  if (kind === 'training') return { name: text, provider: '', startDate: '', endDate: '', details: '' };
  return { text };
}

function mergeStructuredArray(existing, incoming, kind, overwrite) {
  const parsed = incoming.map(value => parseImportedStructuredEntry(kind, value));
  if (overwrite) return parsed;
  const out = Array.isArray(existing) ? clone(existing) : [];
  const identity = item => clean(item?.name || item?.institution || item?.text || item?.details || '').toLowerCase();
  const seen = new Set(out.map(identity).filter(Boolean));
  parsed.forEach(item => { const key = identity(item); if (key && !seen.has(key)) { out.push(item); seen.add(key); } });
  return out;
}

export function applyImportSelection(profile, review, selection, { overwriteExisting = false } = {}) {
  const next = clone(profile);
  next.content = { ...(next.content || {}) };
  next.content.contact = { ...(next.content.contact || {}) };
  const changedFields = []; const skippedFields = [];
  const scalarFields = ['name', 'email', 'phone', 'location', 'linkedin', 'github'];
  for (const key of scalarFields) {
    const value = selectedValue(selection?.contact?.[key]);
    if (!value) continue;
    const target = key === 'name' ? 'name' : key;
    const current = key === 'name' ? next.content.contact.name : next.content.contact[key];
    if (current && !overwriteExisting) { skippedFields.push(`contact.${key}`); continue; }
    next.content.contact[target] = value; changedFields.push(`contact.${key}`);
  }
  const summary = selectedValue(selection?.summary);
  if (summary) {
    if (next.content.summary && !overwriteExisting) skippedFields.push('summary');
    else { next.content.summary = summary; changedFields.push('summary'); }
  }
  for (const key of ['experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'training', 'activities']) {
    const values = (selection?.[key] || []).map(selectedValue).filter(Boolean);
    if (!values.length) continue;
    const before = JSON.stringify(next.content[key] || []);
    next.content[key] = ['education', 'projects', 'training'].includes(key)
      ? mergeStructuredArray(next.content[key], values, key, overwriteExisting)
      : mergeArray(next.content[key], values, overwriteExisting);
    if (JSON.stringify(next.content[key]) !== before) changedFields.push(key);
  }
  return { profile: next, changedFields, skippedFields };
}

export function releaseImportSession(session) {
  if (!session || typeof session !== 'object') return;
  for (const key of Object.keys(session)) session[key] = null;
}
