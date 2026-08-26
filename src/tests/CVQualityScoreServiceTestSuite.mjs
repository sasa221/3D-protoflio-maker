import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildCVQualityChecklist,
  getCVStageGuidance
} from '../services/CVQualityScoreService.js';
import { getCareerEntryPaths } from '../services/CareerEntryPathService.js';

const student = {
  careerStage: 'student',
  content: {
    contact: { name: 'Student Example', email: 'student@example.test', location: 'Cairo' },
    summary: 'Computer science student building verified web projects and learning frontend development.',
    education: [{ text: 'BSc Computer Science, Local University' }],
    projects: [{ text: 'Built a study planner for a university course.' }],
    skills: ['JavaScript', 'React'],
    experience: []
  }
};
const studentChecklist = buildCVQualityChecklist(student);
assert.deepEqual(getCareerEntryPaths(true), { buildCV: '/cv/new', importCV: '/cv/new?mode=import', portfolio: '/studio' });
assert.deepEqual(getCareerEntryPaths(false), { buildCV: '/login?next=%2Fcv%2Fnew', importCV: '/login?next=%2Fcv%2Fnew%3Fmode%3Dimport', portfolio: '/login?next=%2Fstart' });
assert.equal(studentChecklist.score, buildCVQualityChecklist(student).score, 'same CV is deterministic');
assert.equal(studentChecklist.breakdown.find(item => item.id === 'stage-focus').label, 'Education');
assert.equal(studentChecklist.breakdown.find(item => item.id === 'stage-focus').earned, 20);
assert.equal(studentChecklist.breakdown.some(item => /full-time|experience/i.test(item.reason) && item.id !== 'stage-focus'), false, 'student score does not add a full-time experience penalty');
assert.match(getCVStageGuidance('student').message, /Education.*Projects.*Training.*Skills/i);

const professional = {
  careerStage: 'professional',
  content: {
    contact: { name: 'Professional Example', email: 'pro@example.test', linkedin: 'https://linkedin.com/in/example' },
    summary: 'Frontend engineer delivering accessible interfaces for internal teams and customers.',
    experience: [{ text: 'Built and maintained React interfaces for an internal product team.' }],
    projects: [{ text: 'Created a dashboard used by the support team.' }],
    skills: ['JavaScript', 'React'],
    education: []
  }
};
const professionalChecklist = buildCVQualityChecklist(professional);
assert.equal(professionalChecklist.breakdown.find(item => item.id === 'stage-focus').label, 'Experience');
assert.equal(professionalChecklist.breakdown.find(item => item.id === 'stage-focus').earned, 20);
assert.match(getCVStageGuidance('professional').message, /Summary.*Experience.*Skills.*Projects.*Education/i);

const locationOnlyChange = JSON.parse(JSON.stringify(student));
locationOnlyChange.content.contact.location = 'Alexandria';
assert.equal(buildCVQualityChecklist(locationOnlyChange).score, studentChecklist.score, 'irrelevant location edit does not change score');

const duplicate = JSON.parse(JSON.stringify(professional));
duplicate.content.projects.push({ text: duplicate.content.projects[0].text });
assert.ok(buildCVQualityChecklist(duplicate).score < professionalChecklist.score, 'duplicate evidence produces an explainable hygiene deduction');
assert.match(buildCVQualityChecklist(duplicate).breakdown.find(item => item.id === 'content-hygiene').reason, /repeated/i);

const landing = fs.readFileSync(new URL('../ui/LandingPage.js', import.meta.url), 'utf8');
assert.match(landing, /Build My CV/);
assert.match(landing, /\/cv\/new/);
assert.match(landing, /Import Existing CV/);
assert.match(landing, /Build a 3D portfolio recruiters remember/);
const entryPaths = fs.readFileSync(new URL('../services/CareerEntryPathService.js', import.meta.url), 'utf8');
assert.match(entryPaths, /mode=import/);
const builder = fs.readFileSync(new URL('../ui/CVBuilderPage.js', import.meta.url), 'utf8');
assert.match(builder, /cv-quality-container/);
assert.match(builder, /data-collection="\$\{type\}"/);
assert.match(builder, /Project name/);
assert.match(builder, /startDate/);
assert.match(builder, /Training \/ course name/);
const qualityPanel = fs.readFileSync(new URL('../ui/CVQualityChecklistPanel.js', import.meta.url), 'utf8');
assert.match(qualityPanel, /data-cv-quality-fix/);
const quality = fs.readFileSync(new URL('../services/CVQualityScoreService.js', import.meta.url), 'utf8');
assert.equal(/fetch\(|XMLHttpRequest|generateSuggestedCopy|openai|supabase/i.test(quality), false, 'quality checklist has no network or AI dependency');

console.log('CVQualityScoreServiceTestSuite: passed (deterministic stage-aware checklist, no student full-time penalty, explainable duplicates, stage guidance, CTA contracts, and no network/AI).');
