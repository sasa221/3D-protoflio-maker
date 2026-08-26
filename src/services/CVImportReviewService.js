import { unzipSync } from 'fflate';

export const CV_IMPORT_LIMITS = Object.freeze({ maxBytes: 10 * 1024 * 1024, maxPages: 12, maxTextLength: 120000, maxDocxXmlLength: 6000000 });
const SECTION_NAMES = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'training', 'activities'];
const SECTION_RE = /^(summary|profile|about me|professional summary|objectives?|experience|work experience|professional experience|employment|career history|education|academic background|qualifications|academics|skills|technical skills|core skills|tools(?:\s*&\s*technologies)?|technologies|competencies|projects|selected projects|featured projects|certifications|certificates|licenses|courses|languages|foreign languages|training|activities|volunteering|volunteer experience|community involvement)\s*:??$/i;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, max = 2400) { return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanLine(value) { return clean(value).replace(/^[•▪◦\-–—*]+\s*/, '').trim(); }
function keyFor(value) { return String(value || '').toLowerCase().replace(/[^a-z]/g, ''); }
function isHeading(line) { return SECTION_RE.test(cleanLine(line)); }
function sectionKey(line) {
  const lower = cleanLine(line).toLowerCase();
  if (/summary|profile|about|objective/.test(lower)) return 'summary';
  if (/experience|employment|career history/.test(lower)) return 'experience';
  if (/education|academic|qualification/.test(lower)) return 'education';
  if (/skill|tools|technolog|competenc/.test(lower)) return 'skills';
  if (/project/.test(lower)) return 'projects';
  if (/certificat|license|course/.test(lower)) return 'certifications';
  if (/language/.test(lower)) return 'languages';
  if (/training/.test(lower)) return 'training';
  return 'activities';
}

function decodeXml(value) {
  return String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeWebLink(value) {
  const link = clean(value, 600).replace(/[),.;]+$/, '');
  return /^www\./i.test(link) ? `https://${link}` : link;
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
  const paragraphs = xml.split(/<\/w:p\s*>/i).map(paragraph => {
    const withTabs = paragraph.replace(/<w:tab\s*\/?\s*>/gi, '\t');
    const text = [...withTabs.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t\s*>/gi)].map(match => decodeXml(match[1])).join('');
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
  let text;
  if (meta.format === 'pdf') {
    onProgress?.({ stage: 'pdf', percent: 45, label: 'Extracting PDF text locally…' });
    // Load the browser-only PDF.js worker lazily so local Node tests can
    // exercise DOCX parsing and review logic without a Vite worker URL.
    const { extractTextFromPDF } = await import('./PDFTextExtractor.js');
    text = (await extractTextFromPDF(file, { maxPages: CV_IMPORT_LIMITS.maxPages, maxTextLength: CV_IMPORT_LIMITS.maxTextLength })).text;
  } else {
    onProgress?.({ stage: 'docx', percent: 45, label: 'Extracting DOCX text locally…' });
    text = extractDocxText(await file.arrayBuffer());
  }
  const normalized = String(text || '').replace(/\r/g, '').split('\n').map(cleanLine).filter(Boolean).join('\n');
  if (normalized.length < 20) throw new Error('The file contains too little readable text.');
  if (normalized.length > CV_IMPORT_LIMITS.maxTextLength) throw new Error('Extracted text exceeds the local character limit.');
  onProgress?.({ stage: 'review', percent: 100, label: 'Ready for field-by-field review.' });
  return { ...meta, text: normalized };
}

export function buildImportReview(text, { format = 'text', fileName = '' } = {}) {
  const lines = String(text || '').split('\n').map(cleanLine).filter(Boolean);
  if (!lines.length) throw new Error('No readable text was found.');
  const headingIndexes = lines.map((line, index) => isHeading(line) ? { index, key: sectionKey(line) } : null).filter(Boolean);
  const firstSection = headingIndexes[0]?.index ?? lines.length;
  const header = lines.slice(0, firstSection);
  const headerText = header.join(' ');
  const headerParts = header.flatMap(line => line.split(/\s*\|\s*/)).map(part => clean(part)).filter(Boolean);
  const email = headerText.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '';
  const phone = headerText.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/)?.[0] || '';
  const links = headerText.match(/(?:https?:\/\/|www\.)[^\s|]+/gi) || [];
  const nameCandidate = header.find(line => !/@/.test(line) && !/\+?\d[\d\s()-]{7,}/.test(line) && !/(?:https?:\/\/|www\.)/i.test(line) && !/^(resume|cv|curriculum vitae|linkedin|portfolio|linkedin portfolio)$/i.test(line)) || '';
  const name = clean(nameCandidate.replace(/\s+(?:linkedin\s+)?portfolio\s*$/i, ''), 160);
  const location = headerParts.find(part => /^[A-Za-zÀ-ÿ.' -]+,\s*[A-Za-zÀ-ÿ.' -]+$/.test(part) && !/@/.test(part)) || '';
  // Nothing is persisted by default. The reviewer must explicitly select
  // each field, including contact details, before saving it.
  const field = (value, source = 'extracted') => ({ value: clean(value), source, needsReview: true, selected: false });
  const sections = Object.fromEntries(SECTION_NAMES.map(key => [key, []]));
  headingIndexes.forEach((heading, index) => {
    const end = headingIndexes[index + 1]?.index ?? lines.length;
    sections[heading.key].push(...lines.slice(heading.index + 1, end).map(value => clean(value)).filter(Boolean));
  });
  const review = {
    source: { format, fileName: clean(fileName, 160) },
    contact: { name: field(name), email: field(email), phone: field(phone), location: field(location), linkedin: field(normalizeWebLink(links.find(link => /linkedin\.com/i.test(link)) || '')), github: field(normalizeWebLink(links.find(link => /github\.com/i.test(link)) || '')) },
    summary: field(sections.summary.join(' ')),
    experience: sections.experience.map(value => field(value)), education: sections.education.map(value => field(value)), skills: sections.skills.flatMap(value => value.split(/[,;|•·]/).map(item => field(item))).filter(item => item.value),
    projects: sections.projects.map(value => field(value)), certifications: sections.certifications.map(value => field(value)), languages: sections.languages.map(value => field(value)), training: sections.training.map(value => field(value)), activities: sections.activities.map(value => field(value)),
    warnings: []
  };
  if (!name) review.warnings.push('Name was not clearly identified.');
  if (!review.contact.email.value) review.warnings.push('Email was not found in the file.');
  if (!review.experience.length) review.warnings.push('No experience rows were clearly extracted.');
  if (!review.education.length) review.warnings.push('No education rows were clearly extracted.');
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
    next.content[key] = mergeArray(next.content[key], values, overwriteExisting);
    if (JSON.stringify(next.content[key]) !== before) changedFields.push(key);
  }
  return { profile: next, changedFields, skippedFields };
}

export function releaseImportSession(session) {
  if (!session || typeof session !== 'object') return;
  for (const key of Object.keys(session)) session[key] = null;
}
