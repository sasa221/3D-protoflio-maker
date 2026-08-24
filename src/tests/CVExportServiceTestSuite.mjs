import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildCVExportModel, exportCareerProfilePdf, safeCVFileName } from '../services/CVExportService.js';

function profile(stage, name, content = {}) {
  return {
    id: `cp_${stage}_test`, careerStage: stage,
    content: { contact: { name, email: 'person@example.com', phone: '+20 100 000 0000', location: 'Cairo', github: 'https://github.com/example', linkedin: 'javascript:alert(1)', website: 'https://example.com' }, summary: '', experience: [], education: [], projects: [], skills: [], certifications: [], languages: [], training: [], activities: [], ...content }
  };
}

async function pdfText(bytes) {
  const doc = await getDocument({ data: bytes, disableWorker: true, useSystemFonts: true }).promise;
  const pages = [];
  for (let index = 1; index <= doc.numPages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return { pageCount: doc.numPages, text: pages.join('\n') };
}

const student = profile('student', 'Student Example', {
  summary: 'Computer science student building accessible web tools.',
  education: [{ text: 'BSc Computer Science — Cairo University — 2026' }],
  projects: [{ text: 'Portfolio Maker — React and Supabase' }],
  skills: ['JavaScript', 'SQL']
});
const studentModel = buildCVExportModel(student);
assert.deepEqual(studentModel.sections.map(section => section.id), ['summary', 'education', 'projects', 'skills'], 'student order and empty sections');
assert.equal(studentModel.contactLines.some(line => line.includes('javascript:')), false, 'unsafe links must be omitted');
assert.equal(buildCVExportModel(profile('student', 'Host Test', { contact: { github: 'https://evilgithub.com/a', linkedin: 'https://linkedin.evil.com/in/a' } })).contactLines.some(line => line.includes('evil')), false, 'lookalike social hosts must be omitted');
assert.match(studentModel.contactLines.find(line => line.startsWith('GitHub:')), /^GitHub: https:\/\/github\.com\//);
assert.equal(safeCVFileName({ content: { contact: { name: '../../<script>alert(1)</script>' } } }), 'alert-1.pdf');

const professional = profile('professional', 'Professional Example', {
  summary: 'Product engineer with experience shipping reliable systems.',
  experience: Array.from({ length: 18 }, (_, index) => ({ text: `Company ${index + 1} — Product Engineer — delivered measurable platform improvements ${'with careful documentation '.repeat(8)}` })),
  projects: [{ text: 'Internal platform modernization' }],
  education: [{ text: 'BSc Computer Science — 2019' }],
  skills: ['JavaScript', 'TypeScript', 'Supabase']
});
const professionalModel = buildCVExportModel(professional);
assert.equal(professionalModel.sections[0].id, 'summary');
assert.equal(professionalModel.sections[1].id, 'experience');

const studentPdf = await exportCareerProfilePdf(student);
const professionalPdf = await exportCareerProfilePdf(professional);
for (const output of [studentPdf, professionalPdf]) {
  const loaded = await PDFDocument.load(output.bytes);
  assert.ok(loaded.getPageCount() >= 1);
  assert.deepEqual(loaded.getPage(0).getSize(), { width: 595.28, height: 841.89 });
  assert.equal(output.pageCount, loaded.getPageCount());
}
assert.equal(studentPdf.pageCount, 1, 'student sample should fit one page');
assert.ok(professionalPdf.pageCount >= 2, 'professional sample should exercise page breaks');
const studentText = await pdfText(studentPdf.bytes);
assert.equal(studentText.pageCount, 1);
assert.match(studentText.text, /Student Example/);
assert.match(studentText.text, /BSc Computer Science/);
assert.doesNotMatch(studentText.text, /javascript:alert/);
const professionalText = await pdfText(professionalPdf.bytes);
assert.ok(professionalText.pageCount >= 2);
assert.match(professionalText.text, /Company 18/);
console.log(`CVExportServiceTestSuite: passed (student ${studentPdf.pageCount} page, professional ${professionalPdf.pageCount} pages)`);
