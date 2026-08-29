import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from './SupabaseClient.js';

export const A4_PAGE = { width: 595.28, height: 841.89 };
export const CV_EXPORT_FORMAT = 'pdf';

function safeText(value = '') {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

function safeUrl(value, kind = 'web') {
  const raw = safeText(value);
  if (!raw) return '';
  if (kind === 'email' && /^mailto:[^\s<>]+$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const hostname = url.hostname.toLowerCase();
    if (kind === 'github' && !(hostname === 'github.com' || hostname.endsWith('.github.com'))) return '';
    if (kind === 'linkedin' && !(hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com'))) return '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

function itemText(item) {
  if (typeof item === 'string') return safeText(item);
  if (!item || typeof item !== 'object') return '';
  if (item.text) return safeText(item.text);
  const title = safeText(item.name || item.degree || item.title || item.role || '');
  const organization = safeText(item.institution || item.provider || item.organization || item.company || (item.role && item.role !== title ? item.role : '') || '');
  const field = safeText(item.field || '');
  const dates = [safeText(item.startDate || ''), safeText(item.endDate || '')].filter(Boolean).join(' – ');
  const details = safeText(item.details || item.description || '');
  const bullets = Array.isArray(item.bullets) ? item.bullets.map(safeText).filter(Boolean).join(' • ') : '';
  const link = safeUrl(item.websiteUrl || item.url || '', 'web');
  return [title, organization, field, dates, details, bullets, link].filter(Boolean).join(' | ');
}

function itemEntry(item) {
  if (typeof item === 'string') return { title: '', meta: '', dates: '', details: safeText(item), url: '' };
  if (!item || typeof item !== 'object') return null;
  return {
    title: safeText(item.name || item.degree || item.title || ''),
    meta: [safeText(item.institution || item.provider || item.organization || item.company || ''), safeText(item.field || ''), safeText(item.role && item.role !== item.title && item.role !== item.name ? item.role : '')].filter(Boolean).join(' · '),
    dates: [safeText(item.startDate || ''), safeText(item.endDate || '')].filter(Boolean).join(' – '),
    details: safeText(item.details || item.description || item.text || ''),
    bullets: Array.isArray(item.bullets) ? item.bullets.map(safeText).filter(Boolean) : [],
    url: safeUrl(item.websiteUrl || item.url || '', 'web')
  };
}

function itemsToLines(items = []) {
  return Array.isArray(items) ? items.map(itemText).filter(Boolean) : [];
}

function normalizedContent(profile = {}) {
  const content = profile.content || {};
  const contact = content.contact || {};
  const links = [];
  const github = safeUrl(contact.github, 'github');
  const linkedin = safeUrl(contact.linkedin, 'linkedin');
  const website = safeUrl(contact.website, 'web');
  if (github) links.push(`GitHub: ${github}`);
  if (linkedin) links.push(`LinkedIn: ${linkedin}`);
  if (website) links.push(`Website: ${website}`);
  const contactLines = [
    safeText(contact.email),
    safeText(contact.phone),
    safeText(contact.location),
    ...links
  ].filter(Boolean);
  const structured = key => Array.isArray(content[key]) ? content[key] : [];
  const sections = {
    summary: [safeText(content.summary)].filter(Boolean),
    experience: itemsToLines(content.experience),
    education: itemsToLines(content.education),
    projects: itemsToLines(content.projects),
    skills: itemsToLines(content.skills),
    certifications: itemsToLines(content.certifications),
    languages: itemsToLines(content.languages),
    training: itemsToLines(content.training),
    activities: itemsToLines(content.activities)
  };
  const entries = Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key,
    ['experience', 'education', 'projects', 'training', 'certifications', 'activities'].includes(key)
      ? structured(key).map(itemEntry).filter(Boolean)
      : key === 'skills'
        ? structured(key).map(item => ({ title: safeText(item?.category || ''), meta: '', dates: '', details: safeText(item?.text || item?.name || item), bullets: [], url: '' })).filter(item => item.details)
        : lines.map(line => ({ title: '', meta: '', dates: '', details: line, bullets: [], url: '' }))
  ]));
  const student = profile.careerStage === 'student';
  const order = student
    ? ['summary', 'education', 'projects', 'training', 'experience', 'skills', 'certifications', 'languages', 'activities']
    : ['summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'languages', 'training', 'activities'];
  return { name: safeText(contact.name) || 'My CV', contactLines, contact: { email: safeText(contact.email), phone: safeText(contact.phone), location: safeText(contact.location), github, linkedin, website }, sections, entries, order };
}

function splitLongWord(word, font, size, width) {
  const pieces = [];
  let current = '';
  for (const char of word) {
    const next = current + char;
    if (current && font.widthOfTextAtSize(next, size) > width) {
      pieces.push(current);
      current = char;
    } else current = next;
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapLine(value, font, size, width) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const chunks = font.widthOfTextAtSize(word, size) > width ? splitLongWord(word, font, size, width) : [word];
    for (const chunk of chunks) {
      const next = current ? `${current} ${chunk}` : chunk;
      if (current && font.widthOfTextAtSize(next, size) > width) {
        lines.push(current);
        current = chunk;
      } else current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function buildCVExportModel(profile) {
  const data = normalizedContent(profile);
  return {
    ...data,
    sections: data.order
      .filter(section => data.sections[section]?.length)
      .map(section => ({ id: section, title: section === 'summary' ? 'Professional Summary' : section[0].toUpperCase() + section.slice(1), lines: data.sections[section], entries: data.entries[section] || [] }))
  };
}

export async function exportCareerProfilePdf(profile) {
  const model = buildCVExportModel(profile);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = [];
  const margin = 48;
  const width = A4_PAGE.width - margin * 2;
  const bodySize = 10.5;
  const bodyLineHeight = 14;
  const sectionGap = 14;
  let page;
  let y;

  const newPage = () => {
    page = pdf.addPage([A4_PAGE.width, A4_PAGE.height]);
    pages.push(page);
    y = A4_PAGE.height - margin;
  };
  const ensure = height => { if (!page || y - height < margin) newPage(); };
  const drawLines = (lines, font = regular, size = bodySize, lineHeight = bodyLineHeight) => {
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x: margin, y, size, font, color: rgb(0.08, 0.1, 0.14), maxWidth: width });
      y -= lineHeight;
    }
  };

  newPage();
  page.drawText(model.name, { x: margin, y, size: 20, font: bold, color: rgb(0.04, 0.05, 0.08), maxWidth: width });
  y -= 26;
  drawLines(model.contactLines.flatMap(line => wrapLine(line, regular, 9.5, width)), regular, 9.5, 12);
  y -= 8;

  for (const section of model.sections) {
    ensure(30 + bodyLineHeight);
    page.drawText(section.title, { x: margin, y, size: 11.5, font: bold, color: rgb(0.08, 0.1, 0.14), maxWidth: width });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.7, color: rgb(0.12, 0.14, 0.18) });
    y -= 12;
    for (const entry of section.entries) {
      const estimated = bodyLineHeight * (1 + (entry.meta ? 1 : 0) + (entry.details ? Math.min(4, wrapLine(entry.details, regular, bodySize, width).length) : 0) + (entry.bullets?.length || 0));
      ensure(Math.min(estimated + 8, A4_PAGE.height - margin * 2));
      if (entry.title || entry.dates) {
        ensure(bodyLineHeight * 2);
        if (entry.title) {
          page.drawText(entry.title, { x: margin, y, size: bodySize, font: bold, color: rgb(0.08, 0.1, 0.14), maxWidth: entry.url ? width * 0.52 : width * 0.72 });
          if (entry.url) page.drawText(' · View website ↗', { x: margin + bold.widthOfTextAtSize(entry.title, bodySize), y, size: 9.5, font: regular, color: rgb(0.02, 0.45, 0.62), maxWidth: width * 0.4 });
        }
        if (entry.dates) {
          const dateWidth = regular.widthOfTextAtSize(entry.dates, 9.5);
          page.drawText(entry.dates, { x: Math.max(margin, margin + width - dateWidth), y, size: 9.5, font: regular, color: rgb(0.25, 0.29, 0.36) });
        }
        y -= bodyLineHeight;
      }
      if (entry.meta) drawLines(wrapLine(entry.meta, bold, 9.5, width), bold, 9.5, 12);
      if (entry.details) drawLines(wrapLine(entry.details, regular, bodySize, width));
      if (entry.bullets?.length) {
        for (const bullet of entry.bullets) {
          const bulletLines = wrapLine(bullet, regular, bodySize, width - 14);
          bulletLines.forEach((line, index) => drawLines([`${index === 0 ? '• ' : '  '}${line}`], regular, bodySize, bodyLineHeight));
        }
      }
      if (entry.url) drawLines(wrapLine(entry.url, regular, 9, width), regular, 9, 11);
      y -= 4;
    }
    y -= sectionGap;
  }

  const bytes = await pdf.save({ useObjectStreams: false });
  return { bytes, pageCount: pages.length, model };
}

export function safeCVFileName(profile) {
  const name = safeText(profile?.content?.contact?.name || 'my-cv')
    .normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `${name || 'my-cv'}.pdf`;
}

export function downloadPdfBytes(bytes, fileName) {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('PDF download requires a browser.');
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeCVFileName({ content: { contact: { name: String(fileName || '').replace(/\.pdf$/i, '') } } });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function recordCareerPdfExport({ careerProfileId, pageCount, idempotencyKey }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { success: false, error: 'Sign in with the local development account before exporting.' };
  const response = await fetch('/api/portfolio?action=cv-export', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ careerProfileId, pageCount, idempotencyKey, format: CV_EXPORT_FORMAT })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) return { success: false, error: payload.error || 'CV export limit reached.' };
  return payload;
}
