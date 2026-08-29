import assert from 'node:assert/strict';
import { buildImportReview } from '../services/CVImportReviewService.js';
import { normalizeCVText } from '../services/CVTextNormalizer.js';
import { CVParserService } from '../services/CVParserService.js';
import { canonicalizeCVData } from '../services/CVCanonicalizer.js';
import { buildCVExportModel } from '../services/CVExportService.js';

// Text fixture mirrors the line structure extracted from SalehResume (1).pdf.
const salehFixture = `SALEH MOHAMED ABOREHAB\nGiza, Egypt | eng.salehmohammedd@gmail.com | +201270024222\nPROFESSIONAL EXPERIENCE\n• National Telecommunication Institute – NTI\nWeb developer Trainee, sept 2025 - oct 2025\n- Completed one-month intensive training in Full-Stack PHP development, covering both front-end and back-end.\n- Worked with SQL databases, Bootstrap, and Laravel framework to build and manage dynamic web applications.\n- Gained hands-on experience in developing responsive interfaces and integrating server-side functionalities.\n• Ministry of Communications and Information Technology-MCIT\nData analysis Trainee, sept 2025 - oct 2025\n- Completed practical training in Data Analysis with a strong focus on Power BI tools and dashboards.\n- Learned how to clean, transform, and visualize large datasets to extract actionable insights.\n- Built interactive reports and performance dashboards to support decision-making processes.\nSKILLS\n- Programming & Tools: Python, MySQL, JavaScript, Java, C++, C, HTML5, PHP, CSS3.\n- Data Analysis: Power BI, Data Cleaning & Transformation, Data Visualization, Analytical Thinking.\n- Interpersonal Skills: Management, Organization Skills, Problem Solving, Communication, Teamwork, Time Management, Adaptability.\n- Languages: English B2, Arabic Native`;

const review = buildImportReview(salehFixture, { format: 'pdf', fileName: 'SalehResume (1).pdf' });
assert.equal(review.skills.filter(item => item.parsed.category === 'Programming & Tools').length, 9);
assert.equal(review.skills.filter(item => item.parsed.category === 'Data Analysis').length, 4);
assert.equal(review.skills.filter(item => item.parsed.category === 'Interpersonal Skills').length, 7);
assert.equal(review.skills.some(item => item.value === 'Power BI' && item.parsed.category === 'Data Analysis'), true);
assert.equal(review.experience[0].parsed.role, 'Web developer Trainee');
assert.equal(review.experience[0].parsed.organization, 'National Telecommunication Institute');
assert.equal(review.experience[0].parsed.startDate, 'sept 2025');
assert.equal(review.experience[0].parsed.endDate, 'oct 2025');
assert.equal(review.experience[0].parsed.bullets.length, 3);

const parser = new CVParserService();
const normalizedFixture = normalizeCVText(salehFixture);
normalizedFixture.embeddedLinks = ['https://sasa221.github.io/american-wommen/'];
const parsed = await parser.parse(normalizedFixture);
const canonical = canonicalizeCVData(parsed);
assert.equal(canonical.experience[1].role, 'Data analysis Trainee');
assert.equal(canonical.experience[1].organization, 'Ministry of Communications and Information Technology');
assert.equal(canonical.experience[1].organizationShort, 'MCIT');
assert.equal(canonical.skills.find(item => item.name === 'Power BI').category, 'Data Analysis');
assert.equal(canonical.skills.filter(item => item.category === 'Data Analysis').length, 4);
assert.equal(canonical.skills.some(item => /Data Analysis:|Interpersonal Skills:/.test(item.name)), false);
assert.equal(canonical.languages.length, 2);

const model = buildCVExportModel({ careerStage: 'professional', content: { contact: { name: canonical.personal.name }, summary: canonical.summary, experience: canonical.experience, skills: canonical.skills } });
const skillSection = model.sections.find(section => section.id === 'skills');
assert.equal(skillSection.entries.length, 3);
assert.equal(skillSection.entries.find(entry => entry.title === 'Data Analysis').details.includes('Power BI'), true);
assert.equal(skillSection.entries.filter(entry => entry.title === 'Data Analysis').length, 1);
const legacyPrefixedModel = buildCVExportModel({ careerStage: 'professional', content: {
  contact: { name: 'Legacy prefixed skills' },
  skills: [
    { name: 'Programming & Tools: Python', category: 'Programming & Tools' },
    { name: 'Data Analysis: Power BI', category: 'Data Analysis' },
    { name: 'Interpersonal Skills: Communication', category: 'Interpersonal Skills' }
  ]
} });
const legacySkillEntries = legacyPrefixedModel.sections.find(section => section.id === 'skills').entries;
assert.deepEqual(legacySkillEntries.map(entry => [entry.title, entry.details]), [
  ['Programming & Tools', 'Python'],
  ['Data Analysis', 'Power BI'],
  ['Interpersonal Skills', 'Communication']
], 'legacy category prefixes are removed from grouped export details');
assert.equal(legacySkillEntries.filter(entry => entry.title === 'Data Analysis').length, 1);
assert.equal(legacySkillEntries.some(entry => entry.details.startsWith(`${entry.title}:`)), false);
assert.equal(model.sections.find(section => section.id === 'experience').entries[0].title, 'NTI — Web developer Trainee');
assert.equal(model.sections.find(section => section.id === 'experience').entries[0].meta, 'National Telecommunication Institute');
console.log('CVRealImportRegressionTestSuite: passed (real PDF-shaped skills grouping, experience fields/bullets, and grouped export model)');
