import { ScopedStorageService } from './ScopedStorageService.js';
import { JobAnalyzerService } from './JobAnalyzerService.js';
import { matchPortfolioToJob } from './PortfolioMatcher.js';

export const CV_VARIANTS_STORAGE_KEY = 'career_studio_targeted_variants_v1';
const memoryStore = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, max = 30000) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanJobDescription(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim().slice(0, 30000);
}

function ownerKey(ownerUserId) {
  return ownerUserId || 'local-dev-user';
}

function baseContent(profile) {
  return clone(profile?.content || {});
}

function matcherProfile(profile) {
  const content = profile?.content || {};
  return {
    profession: cleanText(content.headline || content.profession || ''),
    bio: cleanText(content.summary || ''),
    skills: Array.isArray(content.skills) ? content.skills.map(item => typeof item === 'string' ? item : item?.name || '').filter(Boolean).map(name => ({ name })) : [],
    experience: Array.isArray(content.experience) ? content.experience : [],
    education: Array.isArray(content.education) ? content.education : [],
    projects: Array.isArray(content.projects) ? content.projects : [],
    certifications: Array.isArray(content.certifications) ? content.certifications : [],
    languages: Array.isArray(content.languages) ? content.languages : []
  };
}

function evidenceState(item, content) {
  const text = JSON.stringify(content || {}).toLowerCase();
  if (item.state === 'MATCHED' || item.state === 'PARTIAL') return 'evidence_found';
  if (item.title && text.includes(String(item.title).toLowerCase())) return 'keyword_without_evidence';
  return 'missing_evidence';
}

export function buildTargetedJobFit(profile, { role = '', company = '', jobDescription = '' } = {}) {
  const description = cleanJobDescription(jobDescription);
  if (description.length < 15) throw new Error('Paste the full job description before analysis.');
  const analyzer = new JobAnalyzerService();
  const normalized = analyzer.analyzeJobTarget({ role: cleanText(role, 160), company: cleanText(company, 160), jobDescription: description, jobUrl: '' });
  const raw = matchPortfolioToJob(matcherProfile(profile), normalized);
  const content = profile?.content || {};
  const evidence = [
    ...(raw.matchedEvidence || []).map(item => ({ title: cleanText(item.title, 160), state: evidenceState(item, content), detail: cleanText(item.evidence || item.title, 500) })),
    ...(raw.criticalGaps || []).map(item => ({ title: cleanText(item.skill, 160), state: evidenceState(item, content), detail: cleanText(item.guidance || item.message, 500) })),
    ...(raw.importantGaps || []).map(item => ({ title: cleanText(item.skill, 160), state: evidenceState(item, content), detail: cleanText(item.guidance || item.message, 500) })),
    ...(raw.niceToHaveGaps || []).map(item => ({ title: cleanText(item.skill, 160), state: evidenceState(item, content), detail: cleanText(item.guidance || item.message, 500) }))
  ];
  return {
    hasRequirements: Boolean(raw.hasRequirements),
    confidence: raw.confidence || 'INSUFFICIENT',
    matchScore: Number.isInteger(raw.matchScore) ? raw.matchScore : 0,
    verdict: cleanText(raw.verdict, 80),
    reason: cleanText(raw.reason || '', 500),
    breakdown: (raw.breakdown || []).map(item => ({ category: cleanText(item.category, 120), weight: cleanText(item.weight, 30), score: item.score, detail: cleanText(item.detail, 240) })),
    evidence,
    requirements: {
      role: cleanText(normalized.title, 160),
      requiredSkills: (normalized.requiredSkills || []).map(item => cleanText(item, 100)),
      preferredSkills: (normalized.preferredSkills || []).map(item => cleanText(item, 100)),
      requiredExperienceYears: normalized.requiredExperienceYears,
      requiredEducation: cleanText(normalized.requiredEducation || '', 120),
      requiredCertifications: (normalized.requiredCertifications || []).map(item => cleanText(item, 120)),
      requiredLanguages: (normalized.requiredLanguages || []).map(item => cleanText(item, 120))
    },
    analyzedAt: new Date().toISOString()
  };
}

function contentItems(content, key) {
  return Array.isArray(content?.[key]) ? content[key].map(item => typeof item === 'string' ? item : item?.name || item?.text || item?.title || '').filter(Boolean) : [];
}

export function applyConfirmedVariantChanges(profile, changes = {}) {
  const next = baseContent(profile);
  const changedFields = [];
  if (changes.confirmedSummary === true && typeof changes.summary === 'string' && cleanText(changes.summary, 2400)) {
    next.summary = cleanText(changes.summary, 2400);
    changedFields.push('summary');
  }
  if (Array.isArray(changes.highlightedSkills)) {
    const known = new Set(contentItems(next, 'skills').map(item => item.toLowerCase()));
    const selected = changes.highlightedSkills.map(item => cleanText(item, 120)).filter(item => known.has(item.toLowerCase()));
    next.targetedSkills = [...new Set(selected)];
    if (selected.length) changedFields.push('targetedSkills');
  }
  return { content: next, changedFields };
}

export function buildVariantDiff(baseProfile, variantContent) {
  const base = baseContent(baseProfile);
  const variant = clone(variantContent || {});
  const keys = ['contact', 'summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'languages', 'training', 'activities', 'targetedSkills'];
  return keys.map(key => ({
    field: key,
    changed: JSON.stringify(base[key] ?? null) !== JSON.stringify(variant[key] ?? null),
    basePresent: Boolean(Array.isArray(base[key]) ? base[key].length : base[key]),
    variantPresent: Boolean(Array.isArray(variant[key]) ? variant[key].length : variant[key])
  }));
}

function readLocalVariants(ownerUserId) {
  const key = ownerKey(ownerUserId);
  const source = ScopedStorageService.getItem(CV_VARIANTS_STORAGE_KEY, key) || memoryStore.get(key);
  return Array.isArray(source) ? source.filter(item => item?.ownerUserId === ownerKey(ownerUserId)) : [];
}

function writeLocalVariants(ownerUserId, variants) {
  const key = ownerKey(ownerUserId);
  ScopedStorageService.setItem(CV_VARIANTS_STORAGE_KEY, variants, key);
  memoryStore.set(key, clone(variants));
}

export function listLocalTargetedVariants(ownerUserId = 'local-dev-user', profileId = null) {
  return clone(readLocalVariants(ownerUserId).filter(item => !profileId || item.careerProfileId === profileId));
}

export function createLocalTargetedVariant({ ownerUserId = 'local-dev-user', profile, role = '', company = '', jobDescription = '', changes = {}, idempotencyKey = '' } = {}) {
  if (!profile?.id) throw new Error('Choose a Base CV first.');
  if (String(idempotencyKey || '').length < 8) throw new Error('A valid draft request key is required.');
  if (String(changes.jobUrl || '').trim()) throw new Error('Paste the job description; external Job URL fetching is disabled here.');
  const analysis = buildTargetedJobFit(profile, { role, company, jobDescription });
  if (!analysis.hasRequirements) throw new Error(analysis.reason || 'Not enough requirements for a reliable analysis.');
  const existing = readLocalVariants(ownerUserId).find(item => item.careerProfileId === profile.id && item.idempotencyKey === idempotencyKey);
  if (existing) return clone(existing);
  const { content, changedFields } = applyConfirmedVariantChanges(profile, changes);
  const variant = {
    id: `cvv_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ownerUserId: ownerKey(ownerUserId), careerProfileId: profile.id,
    title: cleanText(changes.title || role || 'Targeted CV Draft', 120), targetRole: cleanText(role, 160), companyName: cleanText(company, 160), idempotencyKey,
    jobDescription: cleanJobDescription(jobDescription), analysis, content, changedFields, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  const variants = readLocalVariants(ownerUserId);
  variants.push(variant);
  writeLocalVariants(ownerUserId, variants);
  return clone(variant);
}

export function deleteLocalTargetedVariant(variantId, ownerUserId = 'local-dev-user') {
  const variants = readLocalVariants(ownerUserId);
  const next = variants.filter(item => item.id !== variantId);
  if (next.length === variants.length) return false;
  writeLocalVariants(ownerUserId, next);
  return true;
}
