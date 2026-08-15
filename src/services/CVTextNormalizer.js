/**
 * Normalize extracted CV text without destroying semantic line boundaries.
 * Section parsers rely on titles, dates, bullets, languages and certificates
 * remaining separate records.
 */
export function normalizeCVText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { text: '', lines: [], pages: [{ pageNumber: 1, lines: [] }] };
  }

  const clean = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t\f]/g, ' ')
    .replace(/[▪■●✦★▶➢➣]|&bull;/g, '•')
    .replace(/[\u2010-\u2015\u2212]/g, ' - ');

  const lines = clean
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return {
    text: lines.join('\n'),
    lines,
    pages: [{ pageNumber: 1, lines }]
  };
}
