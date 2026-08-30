import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractImportText, buildImportReview, createImportSelection, applyImportSelection } from '../src/services/CVImportReviewService.js';
import { buildCVExportModel } from '../src/services/CVExportService.js';
import { buildCVQualityChecklist } from '../src/services/CVQualityScoreService.js';
import { buildTargetedJobFit } from '../src/services/CVTargetedVariantService.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const corpusRoot = process.argv[2];
if (!corpusRoot) throw new Error('Usage: node scripts/benchmark_cv_ultra_hard.mjs <corpus-root>');

const truth = JSON.parse(await fs.readFile(path.join(corpusRoot, 'ground_truth', 'ground_truth_full.json'), 'utf8'));
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const includes = (haystack, needle) => normalize(haystack).includes(normalize(needle));

async function asFile(filePath, type) {
  const bytes = await fs.readFile(filePath);
  return new File([bytes], path.basename(filePath), { type });
}

async function extractPdfLikeApp(filePath) {
  const bytes = new Uint8Array(await fs.readFile(filePath));
  const document = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, disableWorker: true }).promise;
  const embeddedLinks = [];
  const pages = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    for (const annotation of await page.getAnnotations()) {
      const url = String(annotation?.url || annotation?.unsafeUrl || '').trim();
      // Keep this intentionally identical to the app's current PDF extractor.
      if (/^(?:https?:\/\/|mailto:|tel:)/i.test(url) && !embeddedLinks.includes(url)) embeddedLinks.push(url);
    }
    const content = await page.getTextContent();
    let line = ''; let lastY = null; let lastXEnd = null; const lines = [];
    for (const item of content.items) {
      const y = item.transform?.[5] ?? null; const x = item.transform?.[4] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
        if (line.trim()) lines.push(line.trim());
        line = item.str; lastXEnd = x === null ? null : x + (item.width || 0);
      } else {
        const previous = line.trim().split(/\s+/).at(-1) || '';
        const splitWord = /^[A-Z]$/.test(previous) && /^[a-z]/.test(String(item.str || ''));
        const gap = x !== null && lastXEnd !== null ? x - lastXEnd : null;
        line += line && !splitWord && (gap === null || gap > 1.5) ? ` ${item.str}` : item.str;
        lastXEnd = x === null ? null : x + (item.width || 0);
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }
  return { text: pages.join('\n\n'), embeddedLinks };
}

function evaluate(record, review) {
  const foundSkills = review.skills.map(item => item.parsed?.name || item.value).join('\n');
  const foundExperience = review.experience.map(item => JSON.stringify(item.parsed || item.value)).join('\n');
  const foundEducation = review.education.map(item => JSON.stringify(item.parsed || item.value)).join('\n');
  const expectedLinks = record.expected_links || [];
  // QR decoding has a dedicated pixel-level test. This comparison verifies
  // every non-QR URL reaches the import review; it does not pretend a Node
  // text parser can read a QR bitmap.
  const expectedWebLinks = expectedLinks.filter(link => /^https?:/i.test(link.target) && link.source !== 'qr');
  const expectedEmail = expectedLinks.find(link => /^mailto:/i.test(link.target))?.target.replace(/^mailto:/i, '').split('?')[0] || '';
  const foundLinks = [
    review.contact.linkedin.value,
    review.contact.github.value,
    review.contact.website.value,
    ...review.links.map(item => item.parsed?.url || ''),
    ...review.projects.map(item => item.parsed?.url || '')
  ].filter(Boolean);
  const checks = {
    name: includes(review.contact.name.value, record.name),
    email: !expectedEmail || includes(review.contact.email.value, expectedEmail),
    role: includes(foundExperience, record.role_en) || includes(foundExperience, record.role_ar) || includes(review.summary.value, record.role_en) || includes(review.summary.value, record.role_ar),
    company: includes(foundExperience, record.experience[0].company),
    education: includes(foundEducation, record.education.university),
    skills: record.skills.every(skill => includes(foundSkills, skill)),
    webLinks: expectedWebLinks.every(link => foundLinks.some(found => normalize(found) === normalize(link.target)))
  };
  const base = { id: `benchmark-${record.id}`, ownerUserId: 'benchmark-user', careerStage: 'student', content: { contact: {}, summary: '', experience: [], education: [], projects: [], skills: [], certifications: [], languages: [], training: [], activities: [] } };
  const profile = applyImportSelection(base, review, createImportSelection(review), { overwriteExisting: true }).profile;
  const model = buildCVExportModel(profile);
  const checklist = buildCVQualityChecklist(profile);
  checks.previewEducation = model.sections.find(section => section.id === 'education')?.entries?.length > 0;
  checks.qualityEducation = checklist.breakdown.find(item => item.id === 'stage-focus')?.earned === 20;
  const beforeJobFit = JSON.stringify(profile.content);
  const jobDescription = `${record.role_en} role. Required skills: ${record.skills.join(', ')}. Bachelor degree preferred. At least 2 years experience.`;
  const jobFit = buildTargetedJobFit(profile, { role: record.role_en, jobDescription });
  checks.jobFit = jobFit.hasRequirements && JSON.stringify(profile.content) === beforeJobFit;
  return checks;
}

const results = [];
for (const record of truth) {
  for (const format of ['docx', 'pdf']) {
    const filePath = path.join(corpusRoot, format, `${record.filename_stem}.${format}`);
    try {
      const extracted = format === 'docx'
        ? await extractImportText(await asFile(filePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
        : { ...(await extractPdfLikeApp(filePath)), format: 'pdf', fileName: path.basename(filePath) };
      const review = buildImportReview(extracted.text, extracted);
      const checks = evaluate(record, review);
      results.push({ id: record.id, format, scenario: record.scenario, ...checks, ...(checks.role ? {} : { expectedRole: record.role_ar || record.role_en, extractedExperience: review.experience.map(item => item.parsed || item.value) }), error: '' });
    } catch (error) {
      results.push({ id: record.id, format, scenario: record.scenario, name: false, email: false, role: false, company: false, education: false, skills: false, webLinks: false, previewEducation: false, qualityEducation: false, jobFit: false, error: error.message });
    }
  }
}

const fields = ['name', 'email', 'role', 'company', 'education', 'skills', 'webLinks', 'previewEducation', 'qualityEducation', 'jobFit'];
const totals = Object.fromEntries(fields.map(field => [field, results.filter(result => result[field]).length]));
const failures = results.filter(result => fields.some(field => !result[field]) || result.error);
const scenarios = Object.entries(Object.groupBy(results, result => result.scenario)).map(([scenario, entries]) => ({
  scenario,
  total: entries.length,
  passedAll: entries.filter(entry => fields.every(field => entry[field])).length,
  failures: entries.filter(entry => fields.some(field => !entry[field])).length
})).sort((a, b) => b.failures - a.failures || a.scenario.localeCompare(b.scenario));

console.log(JSON.stringify({ totalFiles: results.length, totals, fullyPassing: results.length - failures.length, failing: failures.length, scenarios, failures }, null, 2));
assert.equal(failures.length, 0, `${failures.length}/${results.length} corpus files failed one or more ground-truth checks.`);
