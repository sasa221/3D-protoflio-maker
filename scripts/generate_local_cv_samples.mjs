import fs from 'node:fs/promises';
import path from 'node:path';
import { exportCareerProfilePdf } from '../src/services/CVExportService.js';

const outputDir = process.argv[2] || path.join(process.env.TEMP || '.', 'career-studio-cv-samples');
await fs.mkdir(outputDir, { recursive: true });
const base = (careerStage, name, content) => ({ id: `sample_${careerStage}`, careerStage, content: { contact: { name, email: 'sample@example.test', phone: '+20 100 000 0000', location: 'Cairo', github: 'https://github.com/example', linkedin: 'https://linkedin.com/in/example' }, summary: '', experience: [], education: [], projects: [], skills: [], certifications: [], languages: [], training: [], activities: [], ...content } });
const student = base('student', 'Student Example', { summary: 'Computer science student building accessible web tools.', education: [{ text: 'BSc Computer Science — Cairo University — 2026' }], projects: [{ text: 'Portfolio Maker — React and Supabase' }], skills: ['JavaScript', 'SQL'] });
const professional = base('professional', 'Professional Example', { summary: 'Product engineer with experience shipping reliable systems.', experience: Array.from({ length: 18 }, (_, index) => ({ text: `Company ${index + 1} — Product Engineer — delivered platform improvements with careful documentation and measurable outcomes.` })), projects: [{ text: 'Internal platform modernization' }], education: [{ text: 'BSc Computer Science — 2019' }], skills: ['JavaScript', 'TypeScript', 'Supabase'] });
for (const [name, profile] of [['student-cv.pdf', student], ['professional-cv.pdf', professional]]) {
  const result = await exportCareerProfilePdf(profile);
  await fs.writeFile(path.join(outputDir, name), result.bytes);
  console.log(`${name}: ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}`);
}
console.log(outputDir);
