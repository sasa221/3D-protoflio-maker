/**
 * Deterministic, evidence-only CV completeness checklist.
 * This is not an ATS guarantee, hiring assessment, or content generator.
 */

function text(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function list(content, key) {
  return Array.isArray(content?.[key])
    // Import produces structured entries (for example education has
    // institution + degree rather than a legacy `text` field). Quality must
    // assess the same data the Preview renders, not an older shape only.
    ? content[key].map(item => text(typeof item === 'string' ? item : [item?.text, item?.name, item?.title, item?.role, item?.institution, item?.degree, item?.organization, item?.description, item?.details].filter(Boolean).join(' '))).filter(Boolean)
    : [];
}

function unique(values) {
  return [...new Set(values.map(value => value.toLowerCase()))];
}

function row(id, label, max, earned, reason, fixSection, { applicable = true, tone = earned >= max ? 'complete' : earned > 0 ? 'partial' : 'needs-review' } = {}) {
  return { id, label, max, earned, reason, fixSection, applicable, tone };
}

export function buildCVQualityChecklist(profile = {}) {
  const content = profile.content || {};
  const contact = content.contact || {};
  const stage = profile.careerStage === 'student' ? 'student' : 'professional';
  const name = text(contact.name);
  const email = text(contact.email);
  const summary = text(content.summary);
  const education = list(content, 'education');
  const experience = list(content, 'experience');
  const projects = list(content, 'projects');
  const skills = list(content, 'skills');
  const links = [contact.linkedin, contact.github, contact.website].map(text).filter(Boolean);
  const allItems = ['experience', 'education', 'projects', 'skills', 'certifications', 'languages', 'training', 'activities'].flatMap(key => list(content, key));
  const duplicateCount = allItems.length - unique(allItems).length;
  const stageLabel = stage === 'student' ? 'Education' : 'Experience';
  const stageValues = stage === 'student' ? education : experience;
  const stageReason = stage === 'student'
    ? stageValues.length ? 'Education is present for the student profile.' : 'Add your degree, institution, or current study details if they apply.'
    : stageValues.length ? 'Professional experience is present.' : 'Add work or real client experience if it applies; training can stay clearly labelled as training.';
  const summaryReason = summary.length >= 40
    ? 'A summary is present with enough detail for a human review.'
    : summary.length
      ? 'The summary is present but brief; expand it only with facts you can support.'
      : 'Add a concise summary of your actual focus and experience.';
  const hygieneReason = duplicateCount
    ? `${duplicateCount} repeated item${duplicateCount === 1 ? '' : 's'} detected; remove repeats where they are truly duplicates.`
    : summary.length > 1200
      ? 'The summary is unusually long; shorten it only if the same facts can be stated more clearly.'
      : 'No clear duplicate entries or length issue detected.';

  const breakdown = [
    row('basic-information', 'Basic information', 20, (name ? 10 : 0) + (email ? 10 : 0), name && email ? 'Name and email are present.' : 'Add the missing name or email; the checklist does not invent either value.', !name ? 'name' : 'email'),
    row('summary', 'Summary', 15, summary.length >= 40 ? 15 : summary.length ? 8 : 0, summaryReason, 'summary'),
    row('stage-focus', stageLabel, 20, stageValues.length ? 20 : 0, stageReason, stage === 'student' ? 'education' : 'experience'),
    row('projects', 'Projects', 15, projects.length ? 15 : 0, projects.length ? 'At least one project is present.' : 'Add a real project only if you have one to describe.', 'projects'),
    row('skills', 'Skills', 15, skills.length ? 15 : 0, skills.length ? 'Skills are listed without adding new keywords.' : 'List skills you can support with your own work, study, or training.', 'skills'),
    row('contact-links', 'Contact / links', 10, Math.min(10, links.length * 5), links.length ? 'Professional links are present.' : 'Add LinkedIn, GitHub, or another relevant link only if you want to share it.', 'linkedin'),
    row('content-hygiene', 'Length / empty sections / duplicates', 5, duplicateCount ? 0 : 5, hygieneReason, duplicateCount ? 'summary' : 'summary')
  ];
  const applicable = breakdown.filter(item => item.applicable);
  const maxScore = applicable.reduce((sum, item) => sum + item.max, 0);
  const earnedScore = applicable.reduce((sum, item) => sum + item.earned, 0);
  const score = maxScore ? Math.round((earnedScore / maxScore) * 100) : 0;
  return {
    label: 'CV completeness check',
    disclaimer: 'This checklist measures completeness and clarity only. It is not an ATS guarantee or a judgement of your ability.',
    stage,
    score,
    earnedScore,
    maxScore,
    breakdown
  };
}

export function getCVStageGuidance(stage = 'professional') {
  if (stage === 'student') {
    return {
      label: 'Student / early career',
      message: 'Lead with Education, Projects, Training, and Skills. Add Experience only for real work or client work; coursework is not full-time employment.',
      focus: ['education', 'projects', 'training', 'skills']
    };
  }
  return {
    label: 'Working professional',
    message: 'Lead with a factual Summary and Experience, then show results, Skills, Projects, and Education where they add context.',
    focus: ['summary', 'experience', 'skills', 'projects', 'education']
  };
}
