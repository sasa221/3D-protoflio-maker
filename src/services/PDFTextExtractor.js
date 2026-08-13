/**
 * PDFTextExtractor.js - Client-Side PDF Text Extraction & Diagnostics
 * Extracts plain text from PDF files preserving line structures and diagnostics.
 * Logs ONLY non-sensitive statistics: text length and line count.
 */

import { normalizeCVText } from './CVTextNormalizer.js';

let pdfjsLoadingPromise = null;

function ensurePdfjsLoaded() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return pdfjsLoadingPromise;
}

export async function extractTextFromPDF(file) {
  if (!file) throw new Error('No PDF file provided.');

  const MAX_SIZE_MB = 10;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`PDF file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  let rawText = '';

  // 1. Attempt PDF.js via CDN auto-injection or global instance
  try {
    const pdfjs = await ensurePdfjsLoaded();
    if (pdfjs) {
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let pageTexts = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Reconstruct line breaks using item Y positions
        let lastY = null;
        let pageLines = [];
        let currentLine = '';

        textContent.items.forEach(item => {
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            currentLine = item.str;
          } else {
            currentLine += (currentLine ? ' ' : '') + item.str;
          }
          lastY = y;
        });

        if (currentLine.trim()) pageLines.push(currentLine.trim());
        pageTexts.push(pageLines.join('\n'));
      }

      rawText = pageTexts.join('\n\n');
    }
  } catch (err) {
    console.warn('[PDFTextExtractor] PDF.js extraction notice:', err.message);
  }

  // 2. Fallback PDF stream decoding if PDF.js is unavailable or returned empty text
  if (!rawText || rawText.trim().length === 0) {
    const bytes = new Uint8Array(arrayBuffer);
    const rawDecoder = new TextDecoder('latin1');
    const streamStr = rawDecoder.decode(bytes);

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

  // 4. Non-sensitive Development Diagnostics Log
  console.log(`[CV] extracted text length: ${normalized.text.length}`);
  console.log(`[CV] line count: ${normalized.lines.length}`);

  if (!normalized.text || normalized.text.trim().length < 20) {
    throw new Error('Extracted text is empty or unreadable. Please upload a standard text-based PDF CV.');
  }

  return normalized;
}
