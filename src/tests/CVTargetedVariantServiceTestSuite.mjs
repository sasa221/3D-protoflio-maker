import assert from 'node:assert/strict';
import {
  applyConfirmedVariantChanges,
  buildTargetedJobFit,
  buildVariantDiff,
  createLocalTargetedVariant,
  deleteLocalTargetedVariant,
  listLocalTargetedVariants,
  CV_VARIANTS_STORAGE_KEY
} from '../services/CVTargetedVariantService.js';

const owner = `variant-service-${Date.now()}`;
const profile = {
  id: 'cp_variant_service', ownerUserId: owner, careerStage: 'professional', content: {
    contact: { name: 'Candidate', email: 'private@example.test' }, summary: 'Frontend engineer building verified interfaces.',
    skills: ['JavaScript', 'React', 'Git'], experience: [{ text: 'Built React interfaces for internal teams.' }],
    education: [{ text: "Bachelor's Degree in Computer Science" }], projects: [{ text: 'React dashboard project' }], certifications: [], languages: []
  }
};
const jd = 'Frontend Developer role. Required: JavaScript, React and Git. Bachelor degree preferred. At least 2 years experience.';

const analysis = buildTargetedJobFit(profile, { role: 'Frontend Developer', company: 'Private Co', jobDescription: jd });
assert.equal(analysis.hasRequirements, true);
assert.ok(Number.isInteger(analysis.matchScore));
assert.ok(analysis.evidence.some(item => item.state === 'evidence_found'));
assert.ok(analysis.evidence.every(item => ['evidence_found', 'missing_evidence', 'keyword_without_evidence'].includes(item.state)));
assert.equal('jobDescription' in analysis, false, 'raw job description is not returned in analysis');

const diff = buildVariantDiff(profile, profile.content);
assert.equal(diff.some(item => item.changed), false, 'initial variant diff has no automatic Base CV changes');
const confirmed = applyConfirmedVariantChanges(profile, { summary: 'User-confirmed truthful summary', confirmedSummary: true, highlightedSkills: ['React', 'Unknown Skill'] });
assert.equal(confirmed.content.summary, 'User-confirmed truthful summary');
assert.deepEqual(confirmed.content.targetedSkills, ['React'], 'highlighting accepts only Base CV skills');

const variant = createLocalTargetedVariant({ ownerUserId: owner, profile, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd, changes: { title: 'Frontend draft', highlightedSkills: ['React'] }, idempotencyKey: 'local_variant_001' });
assert.equal(variant.status, 'draft');
assert.equal(createLocalTargetedVariant({ ownerUserId: owner, profile, role: 'Frontend Developer', company: 'Private Co', jobDescription: jd, idempotencyKey: 'local_variant_001' }).id, variant.id, 'local retry reuses the same draft');
assert.equal(variant.content.summary, profile.content.summary, 'variant creation does not rewrite Base CV');
assert.equal(profile.content.summary, 'Frontend engineer building verified interfaces.');
assert.equal(listLocalTargetedVariants(owner, profile.id).length, 1);
assert.equal(deleteLocalTargetedVariant(variant.id, owner), true);
assert.equal(listLocalTargetedVariants(owner, profile.id).length, 0);
assert.equal(deleteLocalTargetedVariant(variant.id, 'other-owner'), false, 'other owner cannot delete draft');
assert.equal(CV_VARIANTS_STORAGE_KEY.includes('career_studio'), true);

assert.throws(() => buildTargetedJobFit(profile, { jobDescription: 'too short' }), /full job description/);
assert.throws(() => createLocalTargetedVariant({ ownerUserId: owner, profile, role: 'Frontend', jobDescription: jd, changes: { jobUrl: 'https://example.com' }, idempotencyKey: 'local_variant_002' }), /external Job URL/);

console.log('CVTargetedVariantServiceTestSuite: passed (truthful evidence, Base CV immutability, confirmed-only changes, private drafts, ownership deletion, and no URL fetch).');
