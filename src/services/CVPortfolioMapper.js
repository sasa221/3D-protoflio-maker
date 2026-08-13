/**
 * CVPortfolioMapper.js
 * Maps candidate CV data into normalized portfolioData schema.
 * Handles merge strategies, duplicate detection, and theme recommendations.
 */

import { classifyProfession, getAllThemes } from '../three/ProceduralTheme.js';

export function recommendThemesForCandidate(parsedCV) {
  const profession = parsedCV.personal?.headline || parsedCV.experience?.[0]?.role || 'Engineer';
  const primaryTheme = classifyProfession(profession);

  const allThemes = getAllThemes();
  const recommended = [
    {
      theme: primaryTheme,
      reason: `Best match for ${profession} roles and your primary domain skills.`
    }
  ];

  // Add 2 alternate complementary themes
  allThemes.forEach(t => {
    if (recommended.length < 3 && t.id !== primaryTheme.id) {
      if (t.id === 'code' || t.id === 'matrix') {
        recommended.push({
          theme: t,
          reason: `Ideal for technical engineering-heavy and architecture profiles.`
        });
      } else if (t.id === 'cyber' || t.id === 'neon') {
        recommended.push({
          theme: t,
          reason: `Sleek high-tech direction emphasizing infrastructure & security.`
        });
      } else if (t.id === 'cosmic' || t.id === 'galaxy') {
        recommended.push({
          theme: t,
          reason: `Premium modern visual aesthetic suitable for senior leadership.`
        });
      }
    }
  });

  return recommended.slice(0, 3);
}

export function generateSuggestedCopy(parsedCV) {
  const role = parsedCV.personal?.headline || parsedCV.experience?.[0]?.role || 'Front-End Developer';
  const suggestedHeadline = role;
  const suggestedSummary = parsedCV.summary || 
    `Results-driven ${role} focused on engineering quality, scalability, and modern user experiences.`;

  return {
    suggestedHeadline,
    suggestedSummary
  };
}

export function mapCVToPortfolioData(parsedCV, existingPortfolio = {}, options = {}) {
  const {
    mergeStrategy = 'empty_only', // 'replace' | 'merge' | 'empty_only'
    importSections = {
      personal: true,
      summary: true,
      experience: true,
      education: true,
      skills: true,
      projects: true,
      certifications: true
    }
  } = options;

  let target = (mergeStrategy === 'replace') ? {} : JSON.parse(JSON.stringify(existingPortfolio));

  // Helper for empty_only / merge
  const shouldSet = (existingVal) => {
    if (mergeStrategy === 'replace') return true;
    if (mergeStrategy === 'empty_only') return !existingVal || (Array.isArray(existingVal) && existingVal.length === 0);
    return true; // 'merge'
  };

  // 1. Personal & Social
  if (importSections.personal) {
    if (parsedCV.personal?.name && shouldSet(target.name)) target.name = parsedCV.personal.name;
    if (parsedCV.personal?.headline && shouldSet(target.profession)) target.profession = parsedCV.personal.headline;
    if (parsedCV.personal?.location && shouldSet(target.location)) target.location = parsedCV.personal.location;

    if (!target.social) target.social = {};
    if (parsedCV.personal?.email && shouldSet(target.social.email)) target.social.email = parsedCV.personal.email;
    if (parsedCV.personal?.github && shouldSet(target.social.github)) target.social.github = parsedCV.personal.github;
    if (parsedCV.personal?.linkedin && shouldSet(target.social.linkedin)) target.social.linkedin = parsedCV.personal.linkedin;
  }

  // 2. Summary & Tagline
  if (importSections.summary) {
    if (parsedCV.summary && shouldSet(target.bio)) target.bio = parsedCV.summary;
    const { suggestedHeadline } = generateSuggestedCopy(parsedCV);
    if (suggestedHeadline && shouldSet(target.tagline)) target.tagline = suggestedHeadline;
  }

  // 3. Experience
  if (importSections.experience && Array.isArray(parsedCV.experience) && parsedCV.experience.length > 0) {
    if (mergeStrategy === 'replace' || !Array.isArray(target.experience)) {
      target.experience = [...parsedCV.experience];
    } else {
      parsedCV.experience.forEach(newExp => {
        const isDuplicate = target.experience.some(exp =>
          exp.company?.toLowerCase() === newExp.company?.toLowerCase() &&
          exp.role?.toLowerCase() === newExp.role?.toLowerCase()
        );
        if (!isDuplicate) target.experience.push(newExp);
      });
    }
  }

  // 4. Education
  if (importSections.education && Array.isArray(parsedCV.education) && parsedCV.education.length > 0) {
    if (mergeStrategy === 'replace' || !Array.isArray(target.education)) {
      target.education = [...parsedCV.education];
    } else {
      parsedCV.education.forEach(newEdu => {
        const isDuplicate = target.education.some(edu =>
          edu.degree?.toLowerCase() === newEdu.degree?.toLowerCase() &&
          edu.institution?.toLowerCase() === newEdu.institution?.toLowerCase()
        );
        if (!isDuplicate) target.education.push(newEdu);
      });
    }
  }

  // 5. Skills
  if (importSections.skills && Array.isArray(parsedCV.skills) && parsedCV.skills.length > 0) {
    if (mergeStrategy === 'replace' || !Array.isArray(target.skills)) {
      target.skills = [...parsedCV.skills];
    } else {
      parsedCV.skills.forEach(newSkill => {
        const isDuplicate = target.skills.some(s => s.name?.toLowerCase() === newSkill.name?.toLowerCase());
        if (!isDuplicate) target.skills.push(newSkill);
      });
    }
  }

  // 6. Projects
  if (importSections.projects && Array.isArray(parsedCV.projects) && parsedCV.projects.length > 0) {
    if (mergeStrategy === 'replace' || !Array.isArray(target.projects)) {
      target.projects = [...parsedCV.projects];
    } else {
      parsedCV.projects.forEach(newProj => {
        const isDuplicate = target.projects.some(p => p.name?.toLowerCase() === newProj.name?.toLowerCase());
        if (!isDuplicate) target.projects.push(newProj);
      });
    }
  }

  // 7. Certifications
  if (importSections.certifications && Array.isArray(parsedCV.certifications) && parsedCV.certifications.length > 0) {
    if (mergeStrategy === 'replace' || !Array.isArray(target.certs)) {
      target.certs = [...parsedCV.certifications];
    } else {
      parsedCV.certifications.forEach(newCert => {
        const isDuplicate = target.certs?.some(c => c.name?.toLowerCase() === newCert.name?.toLowerCase());
        if (!target.certs) target.certs = [];
        if (!isDuplicate) target.certs.push(newCert);
      });
    }
  }

  // Set default Theme, ViewMode & Array fallbacks
  if (!Array.isArray(target.experience)) target.experience = [];
  if (!Array.isArray(target.education)) target.education = [];
  if (!Array.isArray(target.skills)) target.skills = [];
  if (!Array.isArray(target.projects)) target.projects = [];
  if (!Array.isArray(target.certs)) target.certs = [];
  if (!Array.isArray(target.volunteering)) target.volunteering = parsedCV.volunteering || [];

  if (!target.theme && parsedCV.personal?.headline) {
    target.theme = classifyProfession(parsedCV.personal.headline).id;
  }
  if (!target.viewMode) target.viewMode = 'cinematic';
  if (!target.introMode) target.introMode = 'short';

  return target;
}
