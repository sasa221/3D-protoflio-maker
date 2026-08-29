import assert from 'node:assert/strict';
import { buildImportReview, createImportSelection, applyImportSelection } from '../services/CVImportReviewService.js';
import { buildCVExportModel } from '../services/CVExportService.js';

const source = `سارة أحمد | sara@example.com
SUMMARY
Frontend developer building accessible products.
EXPERIENCE
Frontend Developer
Acme Labs
Jan 2022 - Present
• Built a bilingual dashboard
• Improved load time by 40%
EDUCATION
Helwan University
BSc Computer Science
2020 - 2024
SKILLS
Programming & Tools: JavaScript, React, Git
Data Analysis: SQL, Power BI
PROJECTS
Clothe Website (View Website) May 2024 - Jun 2024 https://example.com/shop
• Shipped a responsive storefront
CERTIFICATIONS
Google UX Certificate
Google
2024`;
const review = buildImportReview(source);
assert.equal(review.experience[0].parsed.role, 'Frontend Developer');
assert.deepEqual(review.experience[0].parsed.bullets, ['Built a bilingual dashboard', 'Improved load time by 40%']);
assert.equal(review.education[0].parsed.startDate, '2020');
assert.equal(review.projects[0].parsed.websiteUrl, 'https://example.com/shop');
assert.equal(review.projects[0].parsed.name, 'Clothe Website');
assert.equal(review.skills.find(item => item.value === 'React').parsed.category, 'Programming & Tools');

const selection = createImportSelection(review);
const result = applyImportSelection({ content: { contact: {}, summary: '', experience: [], education: [], skills: [], projects: [], certifications: [], languages: [], training: [], activities: [] } }, review, selection, { overwriteExisting: true });
assert.equal(result.profile.content.experience[0].organization, 'Acme Labs');
assert.equal(result.profile.content.projects[0].url, 'https://example.com/shop');
assert.equal(result.profile.content.skills[0].category, 'Programming & Tools');

const model = buildCVExportModel({ careerStage: 'professional', content: result.profile.content });
const project = model.sections.find(section => section.id === 'projects').entries[0];
assert.equal(project.url, 'https://example.com/shop');
assert.deepEqual(project.bullets, ['Shipped a responsive storefront']);
console.log('CVStructuredImportTestSuite: passed (structured dates, bullets, categories, project links, and export model)');
