import { unzipSync } from 'fflate';
import { extractQrLinksFromDocxEntries } from './QRLinkExtractor.js';

export const CV_IMPORT_LIMITS = Object.freeze({ maxBytes: 10 * 1024 * 1024, maxPages: 12, maxTextLength: 120000, maxDocxXmlLength: 6000000 });
const SECTION_NAMES = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'training', 'activities'];
const SECTION_RE = /^(summary|profile|about me|professional summary|objectives?|experience|work experience|professional experience|international experience|relevant experience|additional experience|research experience|employment|career history|education|academic background|qualifications|academics|skills|skills\s*&\s*languages|technical skills|core skills|tools(?:\s*&\s*technologies)?|technologies|competencies|projects|selected projects|featured projects|certifications|certificates|licenses|courses|languages|foreign languages|training|activities|leadership\s*&\s*activities|volunteering|volunteer experience|community involvement|presentations\s*&\s*conferences|publications|professional memberships|الملخص|الملخص المهني|نبذة شخصية|نبذة مهنية|الهدف المهني|الخبرة|الخبرات|الخبرات العملية|التعليم|المؤهلات|المؤهلات العلمية|المهارات|المهارات التقنية|المشاريع|المشروعات|الشهادات|الدورات|اللغات|التدريب|الأنشطة|الانشطة|العمل التطوعي|التواصل|بيانات التواصل|التفاصيل)\s*:??$/i;
const INLINE_SECTION_RE = /^(professional summary|about me|objectives?|work experience|professional experience|career history|academic background|technical skills|core skills|tools\s*&\s*technologies|selected projects|featured projects|volunteer experience|community involvement|summary|profile|experience|employment|education|qualifications|academics|skills|technologies|competencies|projects|certifications|certificates|licenses|courses|languages|training|activities|volunteering)\s*(?::|\s{2,})\s*(.+)$/i;
const UPPER_INLINE_SECTION_RE = /^(PROFESSIONAL SUMMARY|OBJECTIVES?|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|INTERNATIONAL EXPERIENCE|RELEVANT EXPERIENCE|ADDITIONAL EXPERIENCE|RESEARCH EXPERIENCE|CAREER HISTORY|ACADEMIC BACKGROUND|TECHNICAL SKILLS|CORE SKILLS|SKILLS & LANGUAGES|SELECTED PROJECTS|FEATURED PROJECTS|VOLUNTEER EXPERIENCE|LEADERSHIP & ACTIVITIES|SUMMARY|PROFILE|EXPERIENCE|EMPLOYMENT|EDUCATION|QUALIFICATIONS|ACADEMICS|SKILLS|PROJECTS|CERTIFICATIONS|LANGUAGES|TRAINING|ACTIVITIES|VOLUNTEERING)\s+(.+)$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, max = 2400) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    // Some PDFs expose Arabic glyphs in visual rather than logical order.
    // Repair the common visual-order spelling before the review is saved.
    .replace(/عمالء/g, 'عملاء')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
// Word/PDF exports often use a pipe as a visual column separator. Treat it as
// structure during import so it never leaks into the saved CV or rendered PDF.
function splitSourceLine(value) {
  const text = String(value || '').replace(/\s*\|\s*/g, '\n');
  return text.split(/\n+/).map(part => part.trim()).filter(Boolean);
}
function normalizedSourceLines(value) {
  return splitSourceLine(value).map(cleanLine).filter(Boolean);
}
// Keep bullet markers during import; the structured parser turns them into
// actual bullet arrays later instead of losing list semantics.
function cleanLine(value) { return clean(value).trim(); }
function repairPdfArtifacts(value) {
  return String(value || '')
    .replace(/\b(\d{3})\s+(\d)\b/g, '$1$2')
    // PDF.js already repairs same-line glyph splits. Keep this pass narrow so
    // natural text such as "I also" is never rewritten into "Ialso".
    .replace(/\b([A-Za-z]+)\s+-\s+([A-Za-z]+)\b/g, '$1 - $2');
}
function keyFor(value) { return String(value || '').toLowerCase().replace(/[^a-z]/g, ''); }
function isHeading(line) { return SECTION_RE.test(cleanLine(line)); }
function sectionKey(line) {
  const lower = cleanLine(line).toLowerCase();
  if (/summary|profile|about|objective|ملخص|نبذة/.test(lower)) return 'summary';
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

function parseDateRange(value) {
  const text = clean(value, 180);
  const match = text.match(new RegExp(`(${DATE_TOKEN_RE.source})\\s*(?:-|–|—|to|until)\\s*(${DATE_TOKEN_RE.source}|present|current|now)`, 'i'));
  if (!match) return { startDate: '', endDate: '' };
  return { startDate: clean(match[1]), endDate: clean(match[2]) };
}
function bulletLines(lines = []) {
  return lines.map(line => clean(line)).filter(Boolean).reduce((out, line) => {
    const bullet = line.match(/^[•▪◦\-*]\s*(.+)$/);
    if (bullet) out.push(clean(bullet[1]));
    else if (out.length) {
      const previous = out[out.length - 1];
      out[out.length - 1] = clean(previous.endsWith('-') && /^[a-z]/.test(line) ? `${previous.slice(0, -1)}${line}` : `${previous} ${line}`);
    }
    else out.push(clean(line));
    return out;
  }, []);
}
function extractGrade(lines = []) {
  const index = lines.findIndex(line => /(?:^|[\s•▪◦\-*])(?:gpa|grade)\s*(?::|[-–—])?\s*\d(?:[\d.,/ -]*\d)?\s*$/i.test(String(line || '').trim()));
  if (index < 0) return { index: -1, value: '' };
  const match = String(lines[index]).match(/(?:^|[\s•▪◦\-*])(?:gpa|grade)\s*(?::|[-–—])?\s*(\d(?:[\d.,/ -]*\d)?)/i);
  return { index, value: clean(match?.[1] || '') };
}
function normalizeSkillCategory(value = '') {
  const lower = clean(value).toLowerCase();
  if (/programming|tools|technical skills|technologies/.test(lower)) return 'Programming & Tools';
  if (/data analysis|analytics/.test(lower)) return 'Data Analysis';
  if (/interpersonal|soft skills/.test(lower)) return 'Interpersonal Skills';
  if (/language/.test(lower)) return 'Languages';
  return clean(value) || 'Programming & Tools';
}
function repairPdfSkill(value = '') {
  let text = clean(value).replace(/^[.·]+\s*/, '');
  // PDF glyph order in mixed RTL/LTR documents can split common technical
  // tokens. Repair only unambiguous, well-known forms; never invent a skill.
  text = text.replace(/^B\s+B\s+Sales$/i, 'B2B Sales')
    .replace(/^Next\s+js$/i, 'Next.js')
    .replace(/^Node\s+js$/i, 'Node.js')
    .replace(/^Primavera\s+P$/i, 'Primavera P6');
  if (/^2CRM$/i.test(text)) return 'CRM';
  if (/^2000SAP$/i.test(text)) return 'SAP2000';
  if (/^4GA$/i.test(text)) return 'GA4';
  if (/^6EVM$/i.test(text)) return 'EVM';
  return text;
}
function parseExperienceEntry(lines = []) {
  const source = lines.flatMap(normalizedSourceLines).map(value => clean(value)).filter(Boolean);
  const normalizedSource = source.map(value => value.replace(/^[•▪◦\-*]+\s*/, '').trim());
  const dateIndex = normalizedSource.findIndex(line => parseDateRange(line).startDate);
  const dateLine = dateIndex >= 0 ? normalizedSource[dateIndex] : '';
  const dates = parseDateRange(dateLine);
  const before = normalizedSource.slice(0, dateIndex >= 0 ? dateIndex : normalizedSource.length);
  const roleLine = before.find(line => /(?:developer|engineer|designer|analyst|trainee|intern|manager|specialist|consultant|coordinator|member|lead|مهندس|محاسب|مدير|محلل|منسق|أخصائي)/i.test(line)) || before[0] || '';
  const dateStart = dateLine.search(new RegExp(DATE_TOKEN_RE.source, 'i'));
  const rawHeaderPrefix = clean(dateStart >= 0 ? dateLine.slice(0, dateStart) : roleLine).replace(/[,:|\-]+$/, '').trim();
  // Dates are sometimes on their own line (or arrive as "21/2021" after
  // extraction). Do not turn that numeric fragment into a job title.
  const headerPrefix = /[\p{L}]/u.test(rawHeaderPrefix) ? rawHeaderPrefix : roleLine;
  const headerParts = headerPrefix.split(/\s*\|\s*|\s+[–—]\s+|\s+-\s+/).map(value => clean(value)).filter(Boolean);
  const roleAppearsOnDateLine = before.length > 0 && /[\p{L}]/u.test(rawHeaderPrefix);
  const organizationLine = roleAppearsOnDateLine ? before.at(-1) : '';
  const organizationParts = organizationLine.split(/\s*\|\s*|\s+[–—]\s+|\s+-\s+/).map(value => clean(value)).filter(Boolean);
  const role = roleAppearsOnDateLine ? headerPrefix : (headerParts[0] || headerPrefix || roleLine);
  const organization = roleAppearsOnDateLine
    ? (organizationParts[0] || organizationLine)
    : (headerParts.slice(1).join(' - ') || before.find(line => line !== role && !parseDateRange(line).startDate) || '');
  const organizationShort = roleAppearsOnDateLine ? organizationParts.slice(1).join(' - ') : organization;
  const detailStart = dateIndex >= 0 ? dateIndex + 1 : 1;
  const details = source.slice(detailStart);
  const bullets = bulletLines(details);
  const prose = bullets.length ? '' : details.filter(line => !/^[•▪◦\-*]/.test(line)).join(' ');
  return { role: role || organizationSource, title: role || organizationSource, organization, organizationShort, company: organizationShort || organization, startDate: dates.startDate, endDate: dates.endDate, description: prose, details: prose, bullets };
}
function structuredEntry(kind, raw, links = []) {
  const rawValues = Array.isArray(raw) ? raw.flat(Infinity) : String(raw || '').split(/\n+/);
  const lines = rawValues.flatMap(normalizedSourceLines).map(value => clean(value)).filter(Boolean);
  const text = lines.join(' ');
  const dates = parseDateRange(text);
  const dateLine = lines.find(line => parseDateRange(line).startDate) || '';
  const withoutDate = lines.filter(line => line !== dateLine);
  if (kind === 'experience') return parseExperienceEntry(lines);
  const first = clean(withoutDate[0] || lines[0] || '');
  const second = clean(withoutDate[1] || '');
  const detailsLines = withoutDate.slice(second && !/^[•▪◦\-*]/.test(second) ? 2 : 1);
  const bullets = bulletLines(detailsLines);
  const details = detailsLines.filter(line => !/^[•▪◦\-*]/.test(line)).join(' ');
  if (kind === 'projects') {
    const rawUrl = text.match(/(?:https?:\/\/|www\.)[^\s|)]+/i)?.[0] || (/(?:view\s+(?:my\s+)?(?:website|project)|عرض\s+(?:المشروع|الموقع))/i.test(text) ? (links.find(link => /(?:[?&](?:src=)?project=|[?&]src=project)/i.test(link)) || links.find(link => /^https?:\/\//i.test(link))) : '') || '';
    const url = /^https?:\/\//i.test(normalizeWebLink(rawUrl)) ? normalizeWebLink(rawUrl) : '';
    const datedSource = dateLine || first;
    const dateMatch = datedSource.match(new RegExp(`(${MONTH_YEAR_RE.source}|\\b\\d{4}\\b)`, 'i'));
    const titlePrefix = dateMatch ? datedSource.slice(0, dateMatch.index) : first;
    const name = clean(titlePrefix.replace(/^[•▪◦\-*]+\s*/, '').replace(/\(?\s*view\s+(?:my\s+)?(?:website|project)\s*\)?/ig, '').trim().replace(/[,:|\-]+$/, ''));
    const projectHeaderLine = dateLine || first;
    const projectBody = lines.filter(line => line !== projectHeaderLine && line !== url);
    const projectBullets = bulletLines(projectBody);
    const projectDetails = projectBullets.length ? '' : projectBody.filter(line => !/^[•▪◦\-*]/.test(line)).join(' ');
    const inlineDescription = dateMatch ? clean(datedSource.slice(dateMatch.index + dateMatch[0].length).replace(new RegExp(`(?:-|–|—|to)\\s*(?:${MONTH_YEAR_RE.source}|\\b\\d{4}\\b)`, 'i'), '').replace(url, '').replace(/\(?\s*view\s+(?:my\s+)?(?:website|project)\s*\)?/ig, '')) : '';
    const mergedDetails = [inlineDescription, projectDetails].filter(Boolean).join(' ');
    return { name: name || clean(text, 160), title: name, role: '', startDate: dateMatch?.[0] || dates.startDate, endDate: dates.endDate || dateMatch?.[0] || '', bullets: projectBullets, description: mergedDetails, details: mergedDetails, websiteUrl: url, url };
  }
  if (kind === 'education') {
    const institution = clean((lines.find(line => !parseDateRange(line).startDate && !/^[•▪◦\-*]/.test(line)) || first).replace(/^[•▪◦\-*]+\s*/, ''));
    const degreeLine = dateLine || lines.find(line => line !== institution && !/^[•▪◦\-*]/.test(line)) || '';
    const range = parseDateRange(degreeLine);
    const degree = clean(degreeLine.replace(range.startDate ? new RegExp(`${MONTH_YEAR_RE.source}\\s*(?:-|–|—|to)\\s*(?:${MONTH_YEAR_RE.source}|present|current)`, 'i') : /$^/, '').replace(/^[,\s-]+|[,\s-]+$/g, ''));
    const grade = extractGrade(lines);
    const remaining = lines.filter((line, index) => line !== institution && line !== degreeLine && index !== grade.index);
    const educationBullets = bulletLines(remaining);
    return { institution, degree, field: '', startDate: range.startDate, endDate: range.endDate, grade: grade.value, details: educationBullets.length ? '' : remaining.join(' '), bullets: educationBullets };
  }
  if (kind === 'training') return { name: first, provider: second, startDate: dates.startDate, endDate: dates.endDate, details, bullets };
  if (kind === 'certifications') return { name: first.replace(/^[•▪◦\-*]+\s*/, ''), title: first.replace(/^[•▪◦\-*]+\s*/, ''), issuer: second, date: dateLine, details: bullets.length ? '' : details, bullets };
  if (kind === 'activities' || kind === 'volunteering') {
    const cleanFirst = first.replace(/^[•▪◦\-*]+\s*/, '');
    const roleLine = lines.find(line => parseDateRange(line).startDate) || '';
    const roleDate = roleLine.match(new RegExp(`^(.*?)\\s+(?:${MONTH_YEAR_RE.source}|\\b\\d{4}\\b)`, 'i'));
    const activityRole = clean(roleDate?.[1] || second || '');
    const roleIndex = roleLine ? lines.indexOf(roleLine) : 1;
    const activityDetails = lines.slice(Math.max(0, roleIndex + 1));
    const activityBullets = bulletLines(activityDetails);
    return { title: activityRole || cleanFirst, role: activityRole, organization: cleanFirst, startDate: dates.startDate, endDate: dates.endDate, details: activityBullets.length ? '' : details, description: activityBullets.length ? '' : details, bullets: activityBullets };
  }
  return { role: first, title: first, organization: second, company: second, startDate: dates.startDate, endDate: dates.endDate, description: details, details, bullets };
}

const MONTH_YEAR_RE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b/i;
const DATE_TOKEN_RE = /(?:\b(?:19|20)\d{2}(?:[./-](?:0?[1-9]|1[0-2]))?\b|\b(?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})/i;
const DATE_RANGE_RE = new RegExp(`${DATE_TOKEN_RE.source}\\s*(?:-|–|—|to|until)\\s*(?:${DATE_TOKEN_RE.source}|present|current|now)`, 'i');

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

// Same grouping as the legacy display helper, but keeps each source line so
// bullets, headings and date rows can be parsed without flattening them.
function groupResumeEntryLines(lines = [], kind) {
  const source = lines.flatMap(normalizedSourceLines).map(value => String(value || '').trim()).filter(Boolean);
  if (!source.length) return [];
  if (kind === 'certifications') return source.filter(line => /^[•▪◦\-*]/.test(line)).length ? source.map(line => [line]) : [source];
  if (kind === 'education' || kind === 'activities' || kind === 'training') return [source];
  if (kind === 'projects') {
    const groups = []; let current = [];
    for (const line of source) {
      const candidate = line.replace(/^[•▪◦\-*]+\s*/, '');
      const startsProject = (MONTH_YEAR_RE.test(candidate) || /\b\d{4}\b/.test(candidate)) && candidate.length < 180;
      if (startsProject && current.length) { groups.push(current); current = []; }
      current.push(line);
    }
    if (current.length) groups.push(current);
    return groups;
  }
  if (kind === 'experience') {
    const groups = []; let current = [];
    source.forEach((line, index) => {
      const nextLooksLikeDatedRole = DATE_RANGE_RE.test(source[index + 1] || '') || /\b(?:19|20)\d{2}\b/.test(source[index + 1] || '');
      const currentAlreadyHasRole = current.some(value => DATE_RANGE_RE.test(value) || /\b(?:19|20)\d{2}\b/.test(value));
      if (nextLooksLikeDatedRole && currentAlreadyHasRole && current.length) { groups.push(current); current = []; }
      current.push(line);
    });
    if (current.length) groups.push(current);
    return groups;
  }
  return source.map(line => [line]);
}

async function extractDocxText(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('The DOCX file is not a valid ZIP document.');
  let entries;
  try { entries = unzipSync(bytes); } catch (_) { throw new Error('The DOCX file is damaged or cannot be read locally.'); }
  const names = Object.keys(entries);
  if (names.some(name => /vbaProject|macros|\.bin$/i.test(name))) throw new Error('Macro-enabled Office content is not supported.');
  const documentName = names.find(name => name.toLowerCase() === 'word/document.xml');
  if (!documentName) throw new Error('The DOCX document body is missing.');
  const contentNames = [
    ...names.filter(name => /^word\/header\d+\.xml$/i.test(name)),
    documentName,
    ...names.filter(name => /^word\/footer\d+\.xml$/i.test(name))
  ];
  const relationshipTargets = new Map();
  names.filter(name => name.endsWith('.rels')).forEach(name => {
    const relationships = new TextDecoder().decode(entries[name]);
    for (const match of relationships.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\bTargetMode="External"[^>]*\/?\s*>/gi)) {
      relationshipTargets.set(match[1], decodeXml(match[2]));
    }
  });
  const embeddedLinkDetails = [];
  const extractPart = name => {
    const xml = new TextDecoder().decode(entries[name]);
    if (xml.length > CV_IMPORT_LIMITS.maxDocxXmlLength) throw new Error('The DOCX document body exceeds the local size limit.');
    for (const match of xml.matchAll(/<w:hyperlink\b[^>]*\br:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/gi)) {
      const target = relationshipTargets.get(match[1]);
      const text = [...match[2].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t\s*>/gi)].map(value => decodeXml(value[1])).join('');
      if (target && /^(?:https?:\/\/|mailto:|tel:)/i.test(target) && !embeddedLinkDetails.some(link => link.target === target && link.text === text)) embeddedLinkDetails.push({ text: clean(text, 240), target });
    }
    const textOnlyXml = xml.replace(/<w:tab\s*\/?\s*>/gi, '\t').replace(/<\/w:p\s*>/gi, '\n');
    return textOnlyXml.split('\n').map(paragraph => [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t\s*>/gi)].map(match => decodeXml(match[1])).join('')).map(cleanLine).filter(Boolean).join('\n');
  };
  const text = contentNames.map(extractPart).filter(Boolean).join('\n');
  const qrLinks = await extractQrLinksFromDocxEntries(entries, names);
  qrLinks.forEach(target => embeddedLinkDetails.push({ text: 'QR code', target, source: 'qr' }));
  const embeddedLinks = [...relationshipTargets.values(), ...qrLinks].filter((link, index, links) => /^(?:https?:\/\/|mailto:|tel:)/i.test(link) && links.indexOf(link) === index);
  return { text, embeddedLinks, embeddedLinkDetails };
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
  let text; let embeddedLinks = []; let embeddedLinkDetails = [];
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
    const extractedDocx = await extractDocxText(await file.arrayBuffer());
    text = extractedDocx.text;
    embeddedLinks = extractedDocx.embeddedLinks;
    embeddedLinkDetails = extractedDocx.embeddedLinkDetails;
  }
  const normalized = String(text || '').replace(/\r/g, '').split('\n').map(cleanLine).filter(Boolean).join('\n');
  if (normalized.length < 20) throw new Error('The file contains too little readable text.');
  if (normalized.length > CV_IMPORT_LIMITS.maxTextLength) throw new Error('Extracted text exceeds the local character limit.');
  onProgress?.({ stage: 'review', percent: 100, label: 'Ready for field-by-field review.' });
  return { ...meta, text: normalized, embeddedLinks, embeddedLinkDetails };
}

export function buildImportReview(text, { format = 'text', fileName = '', embeddedLinks = [], embeddedLinkDetails = [] } = {}) {
  const repairedText = format === 'pdf' ? repairPdfArtifacts(text) : String(text || '');
  const lines = repairedText.split('\n').flatMap(normalizedSourceLines).filter(Boolean).flatMap(line => {
    const match = line.match(INLINE_SECTION_RE) || line.match(UPPER_INLINE_SECTION_RE);
    return match && clean(match[2]) ? [clean(match[1]), clean(match[2])] : [line];
  });
  if (!lines.length) throw new Error('No readable text was found.');
  const headingIndexes = lines.map((line, index) => isHeading(line) ? { index, key: sectionKey(line) } : null).filter(Boolean);
  const firstSection = headingIndexes[0]?.index ?? lines.length;
  const header = lines.slice(0, firstSection);
  const documentText = `${lines.join(' ')} ${embeddedLinks.join(' ')}`;
  const documentParts = lines.flatMap(line => line.split(/\s*\|\s*/)).map(part => clean(part)).filter(Boolean);
  const preferredEmailLink = embeddedLinkDetails.find(link => /preferred\s+contact|contact\s+preferred|التواصل\s+المفضل/i.test(link.text || '') && /^mailto:/i.test(link.target))?.target
    || (/preferred\s+contact|contact\s+preferred|التواصل\s+المفضل/i.test(lines.join(' ')) ? embeddedLinks.find(link => /^mailto:/i.test(link)) : '');
  const email = preferredEmailLink?.replace(/^mailto:/i, '').split('?')[0] || lines.join(' ').match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || embeddedLinks.find(link => /^mailto:/i.test(link))?.replace(/^mailto:/i, '').split('?')[0] || '';
  const phone = lines.join(' ').match(/\+\d{1,3}[\s-]?(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/)?.[0] || embeddedLinks.find(link => /^tel:/i.test(link))?.replace(/^tel:/i, '') || lines.join(' ').match(/(?:\(?\d{2,4}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}/)?.[0] || '';
  const links = [...(documentText.match(/(?:https?:\/\/|www\.|(?:linkedin|github)\.com\/)[^\s|]+/gi) || []), ...embeddedLinks];
  const nameCandidate = header.map(line => clean(line.replace(/\s+(?:linkedin\s+)?portfolio\s*$/i, ''))).find(line => !/@/.test(line) && !/\+?\d[\d\s()-]{7,}/.test(line) && !/(?:https?:\/\/|www\.|(?:linkedin|github)\.com\/)/i.test(line) && !/synthetic test cv|not a real person/i.test(line) && !/^CVX?-\d+/i.test(line) && !/^page\s+\d+$/i.test(line) && !/^(?:view|open|visit|email|call|schedule|download)\b/i.test(line) && !/^(?:website|linkedin|github|portfolio|certificate|project link)(?:\s*[|·-]\s*(?:website|linkedin|github|portfolio|certificate|project link))*$/i.test(line) && !/^(resume|cv|curriculum vitae)$/i.test(line)) || '';
  const name = clean(nameCandidate, 160);
  const location = documentParts.find(part => part.length <= 70 && !/[.!?]$/.test(part) && /^[\p{L}.' -]+,\s*[\p{L}.' -]+$/u.test(part) && !/@/.test(part)) || '';
  // Nothing is persisted by default. The reviewer must explicitly select
  // each field, including contact details, before saving it.
  const field = (value, source = 'extracted') => {
    const raw = Array.isArray(value) ? value.flat(Infinity).join('\n') : String(value || '');
    const normalized = raw.split(/\n+/).map(line => clean(line)).filter(Boolean).join('\n');
    return { value: normalized, source, needsReview: true, selected: Boolean(normalized) };
  };
  const sections = Object.fromEntries(SECTION_NAMES.map(key => [key, []]));
  headingIndexes.forEach((heading, index) => {
    const end = headingIndexes[index + 1]?.index ?? lines.length;
    sections[heading.key].push(...lines.slice(heading.index + 1, end).map(value => clean(value)).filter(Boolean));
  });
  const projectLinks = embeddedLinks.map(normalizeWebLink).filter(link => /^https?:\/\//i.test(link) && !/linkedin\.com|github\.com/i.test(link));
  const websiteLink = normalizeWebLink(
    embeddedLinkDetails.find(link => /(?:website|portfolio|site|موقع|بورتفوليو)/i.test(link.text || '') && /^https?:\/\//i.test(link.target))?.target
    || ''
  );
  const groupedProjectLines = groupResumeEntryLines(sections.projects, 'projects');
  const groupedProjects = groupedProjectLines.map((value, index) => {
    const group = [...value];
    const groupText = group.join(' ');
    const linkedTarget = embeddedLinkDetails.find(link => link.text && groupText.includes(link.text) && /^https?:\/\//i.test(link.target))?.target;
    const projectTarget = projectLinks.find(link => /(?:[?&](?:src=)?project=|[?&]src=project)/i.test(link));
    if (linkedTarget) group.push(linkedTarget);
    else if (group.some(line => /(?:view\s+(?:my\s+)?website|view\s+project|عرض\s+(?:المشروع|الموقع))/i.test(line)) && (projectTarget || projectLinks[index])) group.push(projectTarget || projectLinks[index]);
    return group;
  });
  const reviewItem = (value, kind, links = []) => ({ ...field(Array.isArray(value) ? value.join('\n') : value), parsed: structuredEntry(kind, value, links), confidence: Array.isArray(value) && value.length > 1 ? 'medium' : 'high' });
  const skillGroups = []; let currentSkillGroup = null;
  sections.skills.forEach(value => {
    const match = value.match(/^[•▪◦\-*]?\s*([^:|]{2,60}):\s*(.+)$/);
    if (match) { currentSkillGroup = { category: normalizeSkillCategory(match[1]), text: match[2] }; skillGroups.push(currentSkillGroup); }
    else if (currentSkillGroup) currentSkillGroup.text += ` ${clean(value)}`;
    else { currentSkillGroup = { category: 'Programming & Tools', text: value }; skillGroups.push(currentSkillGroup); }
  });
  const skillItems = skillGroups.flatMap(group => group.text.split(/[,;|•·]/).map(item => ({ value: repairPdfSkill(clean(item).replace(/[.,;]+$/, '')), category: group.category })).filter(item => item.value)).map(item => ({ ...field(item.value), parsed: { text: item.value, name: item.value, category: item.category } }));
  const review = {
    source: { format, fileName: clean(fileName, 160) },
    contact: { name: field(name), email: field(email), phone: field(phone), location: field(location), linkedin: field(normalizeWebLink(links.find(link => /linkedin\.com/i.test(link)) || '')), github: field(normalizeWebLink(links.find(link => /github\.com/i.test(link)) || '')), website: field(websiteLink) },
    summary: field(sections.summary.join(' ')),
    experience: groupResumeEntryLines(sections.experience, 'experience').map(value => reviewItem(value, 'experience')), education: groupResumeEntryLines(sections.education, 'education').map(value => reviewItem(value, 'education')), skills: skillItems,
    projects: groupedProjects.map(value => reviewItem(value, 'projects', projectLinks)), certifications: groupResumeEntryLines(sections.certifications, 'certifications').map(value => reviewItem(value, 'certifications')), languages: sections.languages.map(value => ({ ...field(value), parsed: { name: value } })), training: groupResumeEntryLines(sections.training, 'training').map(value => reviewItem(value, 'training')), activities: groupResumeEntryLines(sections.activities, 'activities').map(value => {
      const item = reviewItem(value, 'activities');
      const rawLines = value.flat(Infinity).flatMap(normalizedSourceLines);
      const dateLineIndex = rawLines.findIndex(line => parseDateRange(line).startDate);
      const firstBullet = rawLines.findIndex((line, index) => index > dateLineIndex && /^[•\-◦*]\s*/.test(line));
      const recovered = rawLines.join('\n').replace(/(present|current)\s+-\s+(?=[A-Z])/gi, '$1\n- ');
      const recoveredLines = recovered.split(/\n+/).map(line => line.trim()).filter(Boolean);
      const recoveredStart = recoveredLines.findIndex(line => /^-\s+/.test(line));
      if (recoveredStart >= 0) item.parsed.bullets = bulletLines(recoveredLines.slice(recoveredStart));
      return item;
    }),
    links: [...new Map([...embeddedLinkDetails, ...embeddedLinks.map(target => ({ text: '', target }))].filter(link => /^https?:\/\//i.test(link.target)).map(link => [normalizeWebLink(link.target), { ...field(link.text || normalizeWebLink(link.target)), parsed: { name: clean(link.text || 'Website', 120), url: normalizeWebLink(link.target) } }])).values()],
    warnings: []
  };
  if (!name) review.warnings.push('Name was not clearly identified.');
  if (!review.contact.email.value) review.warnings.push('Email was not found in the file.');
  if (!review.experience.length) review.warnings.push('No experience rows were clearly extracted.');
  if (!review.education.length) review.warnings.push('No education rows were clearly extracted.');
  const coreSectionCount = ['summary', 'experience', 'education', 'skills', 'projects'].filter(key => key === 'summary' ? Boolean(review.summary.value) : review[key].length > 0).length;
  if (!review.contact.email.value && coreSectionCount < 2) review.warnings.push('This document does not look like a CV or resume. Check the file before selecting anything.');
  const uncertainCount = ['experience', 'education', 'projects', 'certifications', 'training', 'activities'].reduce((count, key) => count + (review[key] || []).filter(item => item.confidence === 'medium' || !item.parsed?.title && !item.parsed?.name && !item.parsed?.role && !item.parsed?.institution).length, 0);
  if (uncertainCount) review.warnings.push(`${uncertainCount} imported row${uncertainCount === 1 ? '' : 's'} need a quick structure check before saving.`);
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
function selectedItem(item) { return item?.selected && clean(item?.value) ? (item.parsed ? clone(item.parsed) : clean(item.value)) : null; }
function mergeArray(existing, incoming, overwrite) {
  if (overwrite) return incoming.map(value => typeof value === 'object' ? value : ({ text: value }));
  const out = Array.isArray(existing) ? clone(existing) : [];
  const seen = new Set(out.map(item => clean(typeof item === 'string' ? item : item?.text || item?.name || '').toLowerCase()).filter(Boolean));
  incoming.forEach(value => { const label = typeof value === 'object' ? clean(value.name || value.text || '') : clean(value); const key = label.toLowerCase(); if (key && !seen.has(key)) { out.push(typeof value === 'object' ? value : { text: value }); seen.add(key); } });
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
  const parsed = incoming.map(value => typeof value === 'object' ? value : parseImportedStructuredEntry(kind, value));
  if (overwrite) return parsed;
  const out = Array.isArray(existing) ? clone(existing) : [];
  const identity = item => clean(item?.name || item?.institution || item?.role || item?.title || item?.text || item?.details || '').toLowerCase();
  const seen = new Set(out.map(identity).filter(Boolean));
  parsed.forEach(item => { const key = identity(item); if (key && !seen.has(key)) { out.push(item); seen.add(key); } });
  return out;
}

export function applyImportSelection(profile, review, selection, { overwriteExisting = false } = {}) {
  const next = clone(profile);
  next.content = { ...(next.content || {}) };
  next.content.contact = { ...(next.content.contact || {}) };
  const changedFields = []; const skippedFields = [];
  const scalarFields = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'website'];
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
  for (const key of ['experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'training', 'activities', 'links']) {
    const selected = (selection?.[key] || []).map(selectedItem).filter(Boolean);
    const values = selected.map(value => typeof value === 'object' ? value : clean(value)).filter(Boolean);
    if (!values.length) continue;
    const before = JSON.stringify(next.content[key] || []);
    next.content[key] = ['experience', 'education', 'projects', 'certifications', 'training', 'activities'].includes(key)
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
