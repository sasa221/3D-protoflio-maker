/**
 * PDFTextExtractor.js - Client-Side PDF Text Extraction & Diagnostics
 * Extracts plain text from PDF files preserving line structures and diagnostics.
 * Deliberately emits no document content or extraction logs.
 */

import { normalizeCVText } from './CVTextNormalizer.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromPDF(file, { maxPages = 12, maxTextLength = 120000 } = {}) {
  if (!file) throw new Error('No PDF file provided.');

  if (file.size === 0) {
    throw new Error('The uploaded PDF file is empty (0 bytes). Please upload a valid CV document.');
  }

  const isPDF = (file.name && file.name.toLowerCase().endsWith('.pdf')) || file.type === 'application/pdf';
  if (!isPDF) {
    throw new Error('Unsupported file format. Please upload a standard PDF CV (.pdf).');
  }

  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`PDF file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB limit.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const magic = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer).slice(0, 5));
  if (magic !== '%PDF-') throw new Error('The file is not a valid PDF document.');
  let rawText = '';
  const embeddedLinks = [];

  // 1. Attempt PDF.js extraction
  try {
    if (pdfjsLib) {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (pdf.numPages < 1 || pdf.numPages > maxPages) throw new Error(`PDF page count exceeds the local ${maxPages}-page limit.`);
      let pageTexts = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const annotations = await page.getAnnotations().catch(() => []);
        annotations.forEach(annotation => {
          const url = String(annotation?.url || annotation?.unsafeUrl || '').trim();
          if (/^https:\/\//i.test(url) && !embeddedLinks.includes(url)) embeddedLinks.push(url);
        });
        const textContent = await page.getTextContent();

        // Reconstruct line breaks using item Y positions
        let lastY = null;
        let lastXEnd = null;
        let pageLines = [];
        let currentLine = '';

        textContent.items.forEach(item => {
          const y = item.transform ? item.transform[5] : null;
          const x = item.transform ? item.transform[4] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            currentLine = item.str;
            lastXEnd = x !== null ? x + (item.width || 0) : null;
          } else {
            const gap = x !== null && lastXEnd !== null ? x - lastXEnd : null;
            const separator = currentLine && (gap === null || gap > 1.5) ? ' ' : '';
            currentLine += separator + item.str;
            lastXEnd = x !== null ? x + (item.width || 0) : null;
          }
          lastY = y;
        });

        if (currentLine.trim()) pageLines.push(currentLine.trim());
        pageTexts.push(pageLines.join('\n'));
      }

      rawText = pageTexts.join('\n\n');
    }
  } catch (err) {
    if (/page count exceeds|character limit/i.test(String(err.message || ''))) throw err;
    if (err.name === 'PasswordException' || String(err.message).toLowerCase().includes('password')) {
      throw new Error('This PDF is password-protected. Please upload an unlocked PDF CV.');
    }
  }

  // 2. Fallback PDF stream decoding if PDF.js is unavailable or returned empty text
  if (!rawText || rawText.trim().length === 0) {
    const bytes = new Uint8Array(arrayBuffer);
    const rawDecoder = new TextDecoder('latin1');
    const streamStr = rawDecoder.decode(bytes);
    const pageMarkers = streamStr.match(/\/Type\s*\/Page\b/g) || [];
    if (pageMarkers.length > maxPages) throw new Error(`PDF page count exceeds the local ${maxPages}-page limit.`);

    // Extract text strings enclosed in BT ... ET blocks and handle line breaks
    const btBlocks = streamStr.match(/BT[\s\S]*?ET/g) || [];
    let lines = [];

    btBlocks.forEach(block => {
      const stringMatches = block.match(/\((.*?)\)/g);
      if (stringMatches) {
        let blockStr = stringMatches.map(m =>
          m.slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ')
            .replace(/\\([()])/g, '$1')
        ).join(' ').trim();

        if (blockStr) lines.push(blockStr);
      }
    });

    if (lines.length > 0) {
      rawText = lines.join('\n');
    } else {
      // General ASCII regex match fallback
      const asciiStrings = streamStr.match(/[A-Za-z0-9\s.,;:\-–—@\/\\()'\"]{4,}/g) || [];
      rawText = asciiStrings.filter(s => s.trim().length > 3).join('\n');
    }
  }

  // 3. Normalize text structure
  const normalized = normalizeCVText(rawText);

  if (!normalized.text || normalized.text.trim().length < 20) {
    throw new Error('Extracted text is empty or unreadable. Please upload a standard text-based PDF CV.');
  }
  if (normalized.text.length > maxTextLength) throw new Error(`Extracted text exceeds the local ${maxTextLength}-character limit.`);

  return { ...normalized, embeddedLinks };
}
