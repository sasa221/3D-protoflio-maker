import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import {
  CV_IMPORT_LIMITS,
  applyImportSelection,
  buildImportReview,
  createImportSelection,
  extractImportText,
  releaseImportSession,
  validateImportFile
} from '../services/CVImportReviewService.js';

function file(name, type, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return { name, type, size: data.byteLength, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
}

const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Sam Test Candidate</w:t></w:r></w:p>
<w:p><w:r><w:t>sam@example.test | +20 100 222 3333 | https://github.com/sam-test</w:t></w:r></w:p>
<w:p><w:r><w:t>SUMMARY</w:t></w:r></w:p><w:p><w:r><w:t>Frontend engineer with verified React experience.</w:t></w:r></w:p>
<w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p><w:p><w:r><w:t>Built an internal React dashboard in 2024.</w:t></w:r></w:p>
<w:p><w:r><w:t>EDUCATION</w:t></w:r></w:p><w:p><w:r><w:t>BSc Computer Science, Local University</w:t></w:r></w:p>
<w:p><w:r><w:t>SKILLS</w:t></w:r></w:p><w:p><w:r><w:t>JavaScript, React, Git</w:t></w:r></w:p>
</w:body></w:document>`;
const docxBytes = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(xml) });
const docx = file('sam-test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBytes);

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const logs = [];
console.log = (...args) => logs.push(args.join(' '));
console.warn = (...args) => logs.push(args.join(' '));
console.error = (...args) => logs.push(args.join(' '));
let extracted;
try {
  extracted = await extractImportText(docx);
} finally {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
}
assert.equal(extracted.format, 'docx');
assert.match(extracted.text, /Sam Test Candidate/);
assert.match(extracted.text, /sam@example\.test/);
assert.equal(logs.some(line => /Sam Test|sam@example|React/.test(line)), false, 'CV content is never logged');

const review = buildImportReview(extracted.text, extracted);
assert.equal(review.contact.name.value, 'Sam Test Candidate');
assert.equal(review.contact.email.value, 'sam@example.test');
assert.deepEqual(review.skills.map(item => item.value), ['JavaScript', 'React', 'Git']);
assert.equal(review.summary.value, 'Frontend engineer with verified React experience.');
assert.equal('rawText' in review, false);
assert.equal('originalText' in review, false);
assert.ok(review.warnings.length === 0, 'complete synthetic fixture should not need structural warnings');
const salehPdfText = `SALEH MOHAMED ABOREHAB LinkedIn Portfolio
Giza, Egypt | eng.salehmohammedd@gmail.com | +201270024222
| www.linkedin.com/in/saleh-mohammedd/ | https://github.com/sasa221
OBJECTIVES
Front-End Developer skilled in JavaScript, HTML5, and CSS3, with additional experience in PHP, Laravel, and MySQL.
PROFESSIONAL EXPERIENCE
National Telecommunication Institute - NTI
Web developer Trainee, sept 2025 - oct 2025
EDUCATION
Helwan University
Bachelor, Computer Science and Artificial Intelligence, sept 2023 - June 2027
PROJECTS
Clothe Website, May 2024
Built a responsive website.
SKILLS
JavaScript, HTML5, CSS3`;
const salehReview = buildImportReview(salehPdfText, { format: 'pdf', fileName: 'SalehResume (1).pdf' });
assert.equal(salehReview.contact.name.value, 'SALEH MOHAMED ABOREHAB');
assert.equal(salehReview.contact.location.value, 'Giza, Egypt');
assert.equal(salehReview.contact.email.value, 'eng.salehmohammedd@gmail.com');
assert.equal(salehReview.contact.phone.value, '+201270024222');
assert.equal(salehReview.contact.linkedin.value, 'https://www.linkedin.com/in/saleh-mohammedd/');
assert.equal(salehReview.contact.github.value, 'https://github.com/sasa221');
assert.match(salehReview.summary.value, /^Front-End Developer skilled/);
assert.doesNotMatch(salehReview.contact.name.value, /LinkedIn|Portfolio/);
assert.doesNotMatch(salehReview.contact.location.value, /Front-End Developer/);
assert.equal(salehReview.experience.length, 1, 'one compact experience entry is produced for the short fixture');
assert.equal(salehReview.education.length, 1, 'education lines are grouped into one review entry');
assert.equal(salehReview.projects.length, 1, 'project title and details are grouped into one review entry');
const maliciousReview = buildImportReview('<img src=x onerror=alert(1)>\nattacker@example.test\nSKILLS\n<script>alert(2)</script>', { format: 'docx' });
assert.equal(maliciousReview.contact.name.value, '<img src=x onerror=alert(1)>');
assert.match(fs.readFileSync(new URL('../ui/CVImportReviewPanel.js', import.meta.url), 'utf8'), /escape\(item\.value\)/, 'review UI escapes extracted values before HTML insertion');

const selection = createImportSelection(review);
assert.equal(selection.contact.name.selected, true, 'clearly extracted fields start selected for a one-click import review');
selection.contact.name.selected = true;
selection.summary.selected = true;
selection.experience[0].selected = true;
selection.education[0].selected = true;
selection.skills[0].selected = true;
selection.skills[1].selected = true;
selection.skills[2].selected = true;
selection.contact.email.selected = false;
selection.skills[1].selected = false;
const base = {
  id: 'base-import-test', ownerUserId: 'user-a', content: {
    contact: { name: 'Existing Name', email: 'existing@example.test' },
    summary: 'Existing summary', skills: [{ text: 'Existing Skill' }], experience: [], education: [], projects: []
  }
};
const merged = applyImportSelection(base, review, selection);
assert.equal(merged.profile.content.contact.name, 'Existing Name', 'existing contact is preserved by default');
assert.equal(merged.profile.content.contact.email, 'existing@example.test', 'unselected contact stays private and unchanged');
assert.equal(merged.profile.content.summary, 'Existing summary', 'existing summary is not overwritten implicitly');
assert.ok(merged.profile.content.skills.some(item => item.text === 'JavaScript'));
assert.equal(merged.profile.content.skills.some(item => item.text === 'React'), false, 'unselected field is not saved');
assert.ok(merged.skippedFields.includes('contact.name'));

const overwritten = applyImportSelection(base, review, selection, { overwriteExisting: true });
assert.equal(overwritten.profile.content.contact.name, 'Sam Test Candidate', 'overwrite requires explicit opt-in');
assert.equal(overwritten.profile.content.summary, review.summary.value);

assert.throws(() => validateImportFile(file('resume.txt', 'text/plain', strToU8('not supported'))), /Unsupported format/);
assert.throws(() => validateImportFile(file('empty.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Uint8Array())), /empty/);
assert.throws(() => validateImportFile(file('large.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Uint8Array(CV_IMPORT_LIMITS.maxBytes + 1))), /10MB/);
assert.rejects(() => extractImportText(file('broken.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', strToU8('PK\x03\x04broken'))), /damaged|missing|read locally/);
const macroDocx = zipSync({ 'word/document.xml': strToU8(xml), 'word/vbaProject.bin': new Uint8Array([1, 2, 3]) });
assert.rejects(() => extractImportText(file('macro.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', macroDocx)), /Macro-enabled/);
assert.rejects(() => extractImportText(file('missing.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zipSync({ '[Content_Types].xml': strToU8('<Types/>') }))), /body is missing/);
assert.rejects(() => extractImportText(file('short.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:t>tiny</w:t></w:p></w:body></w:document>') }))), /too little/);

const session = { file: docx, text: extracted.text, review, selected: selection };
releaseImportSession(session);
assert.deepEqual(session, { file: null, text: null, review: null, selected: null });

originalLog('CVImportReviewServiceTestSuite: passed (local DOCX extraction, field review, explicit merge/overwrite, limits, corrupt/macro rejection, no content logging, and session cleanup).');
