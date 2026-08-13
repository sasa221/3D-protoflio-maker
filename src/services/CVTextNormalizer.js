/**
 * CVTextNormalizer.js
 * Normalizes raw extracted CV text preserving strict line boundaries, section headers,
 * bullet symbols, and full date ranges (e.g. Sept 2025 – Oct 2025).
 * Strips header link labels (LinkedIn, Portfolio, GitHub, Website) from candidate names.
 */

export function normalizeCVText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { text: '', lines: [], pages: [{ pageNumber: 1, lines: [] }] };
  }

  // 1. Clean unicode & carriage returns
  let clean = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t\f]/g, ' ');

  // 2. Standardize bullet points
  clean = clean.replace(/[•▪■●✦★▶➢➣]|&bull;/g, '•');

  // 3. Standardize date dashes
  clean = clean.replace(/[\u2010-\u2015\u2212]/g, ' - ');

  // 4. Split into lines & trim
  let rawLines = clean.split('\n').map(l => l.trim());

  // 5. Join wrapped lines within paragraphs, preserving strict section headers & date anchors
  let lines = [];
  let currentLine = '';

  const isSectionHeader = (line) => {
    if (!line) return false;
    const cleanLine = line.replace(/^[0-9.#\-\s•]+/, '').trim().toUpperCase();
    const headers = [
      'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT', 'EMPLOYMENT HISTORY', 'CAREER HISTORY',
      'EDUCATION', 'ACADEMIC BACKGROUND', 'QUALIFICATIONS', 'ACADEMICS',
      'SKILLS', 'TECHNICAL SKILLS', 'CORE SKILLS', 'TOOLS & TECHNOLOGIES', 'PROGRAMMING & TOOLS', 'DATA ANALYSIS', 'INTERPERSONAL', 'COMPETENCIES',
      'PROJECTS', 'SELECTED PROJECTS', 'FEATURED PROJECTS', 'KEY PROJECTS', 'PERSONAL PROJECTS',
      'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES', 'COURSES',
      'VOLUNTEERING', 'VOLUNTEER EXPERIENCE', 'ACTIVITIES', 'EXTRACURRICULAR ACTIVITIES', 'LEADERSHIP & ACTIVITIES', 'COMMUNITY INVOLVEMENT',
      'LANGUAGES', 'FOREIGN LANGUAGES',
      'SUMMARY', 'PROFILE', 'ABOUT ME', 'OBJECTIVES', 'PROFESSIONAL SUMMARY', 'EXECUTIVE SUMMARY'
    ];
    return headers.some(h => cleanLine === h || cleanLine.startsWith(h + ':') || cleanLine.startsWith(h + ' -'));
  };

  const isBulletOrDateOrTitle = (line) => {
    if (!line) return false;
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) return true;
    if (line.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*(?:19|20)\d{2}/i)) return true;
    if (line.match(/(?:19|20)\d{2}\s*[-–—]/) || line.match(/^(?:19|20)\d{2}$/)) return true;
    return false;
  };

  rawLines.forEach(line => {
    if (!line) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      return;
    }

    if (isSectionHeader(line) || isBulletOrDateOrTitle(line)) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(line);
    } else {
      if (!currentLine) {
        currentLine = line;
      } else {
        if (line.match(/^[a-z,;:.]/) || currentLine.length < 40) {
          currentLine += ' ' + line;
        } else {
          lines.push(currentLine);
          currentLine = line;
        }
      }
    }
  });

  if (currentLine) lines.push(currentLine);

  lines = lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const finalText = lines.join('\n');

  return {
    text: finalText,
    lines,
    pages: [{ pageNumber: 1, lines }]
  };
}
