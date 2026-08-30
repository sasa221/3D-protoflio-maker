import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildImportReview, createImportSelection, applyImportSelection } from '../services/CVImportReviewService.js';
import { buildCVExportModel, exportCareerProfilePdf } from '../services/CVExportService.js';

const fixturePath = 'D:/New folder/New folder/Me/SalehResume (1).pdf';

async function extractFixtureText(filePath) {
  const data = new Uint8Array(await fs.readFile(filePath));
  const pdf = await pdfjs.getDocument({ data, useWorkerFetch: false, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    let lastY = null; let lastXEnd = null; let current = ''; const lines = [];
    for (const item of content.items) {
      const y = item.transform?.[5] ?? null; const x = item.transform?.[4] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
        if (current.trim()) lines.push(current.trim());
        current = item.str; lastXEnd = x === null ? null : x + (item.width || 0);
      } else {
        const gap = x !== null && lastXEnd !== null ? x - lastXEnd : null;
        const previous = current.trim().split(/\s+/).at(-1) || '';
        const splitWord = /^[A-Z]$/.test(previous) && /^[a-z]/.test(String(item.str || ''));
        current += current && !splitWord && (gap === null || gap > 1.5) ? ` ${item.str}` : item.str;
        lastXEnd = x === null ? null : x + (item.width || 0);
      }
      lastY = y;
    }
    if (current.trim()) lines.push(current.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}

const rawText = await extractFixtureText(fixturePath);
const review = buildImportReview(rawText, {
  format: 'pdf',
  fileName: 'SalehResume (1).pdf',
  embeddedLinks: ['mailto:eng.salehmohammedd@gmail.com', 'http://www.linkedin.com/in/saleh-mohammedd/', 'https://github.com/sasa221', 'https://sasa221.github.io/american-wommen/']
});
const selection = createImportSelection(review);
const base = { id: 'real-saleh-fixture', careerStage: 'student', content: { contact: {}, summary: '', experience: [], education: [], projects: [], skills: [], certifications: [], languages: [], training: [], activities: [] } };
const profile = applyImportSelection(base, review, selection, { overwriteExisting: true }).profile;
const model = buildCVExportModel(profile);

assert.equal(review.education[0]?.parsed?.grade, '3.35', 'real PDF GPA is extracted as a structured education field');
assert.equal(profile.content.education[0]?.grade, '3.35', 'GPA survives Review selection and Save mapping');
assert.equal(review.contact.website.value, '', 'a project URL must not be promoted to the header website field');

const skills = model.sections.find(section => section.id === 'skills');
assert.equal(skills.entries.length, 4, 'real PDF keeps four skill categories');
assert.equal(skills.entries.filter(entry => entry.title === 'Data Analysis').length, 1);
assert.match(skills.entries.find(entry => entry.title === 'Data Analysis').details, /Power BI/);
assert.equal(skills.entries.some(entry => /Data Analysis:|Interpersonal Skills:/.test(entry.details)), false, 'skill category labels are not duplicated in values');

const experience = model.sections.find(section => section.id === 'experience');
assert.equal(experience.entries.length, 2);
assert.ok(experience.entries.every(entry => entry.title && entry.meta && entry.dates && entry.bullets.length >= 3), 'experience has separate role, organization, dates and bullets');
const education = model.sections.find(section => section.id === 'education');
assert.equal(education.entries[0]?.grade, '3.35', 'GPA survives the export model after reload-shaped profile data');

const projects = model.sections.find(section => section.id === 'projects');
assert.equal(projects.entries.length, 3);
assert.equal(projects.entries.filter(entry => entry.url).length, 1, 'only the linked project gets a website CTA');
assert.ok(projects.entries.every(entry => entry.bullets.length > 0));
assert.equal(model.sections.some(section => section.id === 'links'), false, 'generic imported links never become a duplicate CV section');

const certifications = model.sections.find(section => section.id === 'certifications');
assert.equal(certifications.entries.length, 3, 'certifications remain separate');
const renderedEntries = model.sections.flatMap(section => section.entries);
assert.equal(renderedEntries.some(entry => /\|/.test(JSON.stringify(entry))), false, 'render model contains no pipe delimiters');

// The editor serializes collection textareas as strings. Export must preserve
// those line-separated bullets as structured bullet arrays as well.
const editorShape = buildCVExportModel({
  id: 'editor-shape-fixture',
  careerStage: 'professional',
  content: {
    contact: { name: 'Editor shape' },
    experience: [{ role: 'Trainee', organization: 'NTI', startDate: 'Sep 2025', endDate: 'Oct 2025', bullets: 'Built APIs\nWorked with SQL' }],
    projects: [{ name: 'Linked project', startDate: 'May 2024', endDate: 'May 2024', url: 'https://example.test/project', bullets: 'Shipped the site\nImproved accessibility' }],
    skills: [{ name: 'Power BI', category: 'Data Analysis' }]
  }
});
assert.deepEqual(editorShape.sections.find(section => section.id === 'experience').entries[0].bullets, ['Built APIs', 'Worked with SQL']);
assert.deepEqual(editorShape.sections.find(section => section.id === 'projects').entries[0].bullets, ['Shipped the site', 'Improved accessibility']);

const { bytes } = await exportCareerProfilePdf(profile);
const exportedPdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, disableWorker: true }).promise;
let exportedText = '';
for (let pageNumber = 1; pageNumber <= exportedPdf.numPages; pageNumber += 1) {
  const page = await exportedPdf.getPage(pageNumber);
  exportedText += (await page.getTextContent()).items.map(item => item.str).join(' ') + '\n';
}
assert.equal(exportedText.includes('|'), false, 'exported PDF contains no pipe delimiters');
assert.match(exportedText, /Programming & Tools/);
assert.match(exportedText, /Power BI/);
assert.match(exportedText, /GPA:\s*3\.35/, 'exported PDF keeps the real GPA');
assert.match(exportedText, /Web developer Trainee/);
assert.match(exportedText, /View website/);

const noGradeModel = buildCVExportModel({ id: 'no-grade-fixture', careerStage: 'student', content: { contact: { name: 'No GPA' }, education: [{ institution: 'Example University', degree: 'Bachelor' }] } });
assert.equal(noGradeModel.sections.find(section => section.id === 'education')?.entries[0]?.grade, '', 'missing GPA stays absent rather than rendering an empty line');
const { bytes: noGradeBytes } = await exportCareerProfilePdf({ id: 'no-grade-fixture', careerStage: 'student', content: { contact: { name: 'No GPA' }, education: [{ institution: 'Example University', degree: 'Bachelor' }] } });
const noGradePdf = await pdfjs.getDocument({ data: noGradeBytes, useWorkerFetch: false, disableWorker: true }).promise;
let noGradeText = '';
for (let pageNumber = 1; pageNumber <= noGradePdf.numPages; pageNumber += 1) noGradeText += (await (await noGradePdf.getPage(pageNumber)).getTextContent()).items.map(item => item.str).join(' ');
assert.equal(/GPA\s*:/.test(noGradeText), false, 'PDF does not render an empty GPA line when GPA is absent');
console.log('CVRealPdfImportRegressionTestSuite: real SalehResume PDF structured import, rendered model, and PDF export verified.');
