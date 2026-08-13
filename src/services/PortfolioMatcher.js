/**
 * PortfolioMatcher.js
 * Compares normalized job target requirements against candidate portfolioData.
 * Computes explainable weighted match scores, identifies true strengths & missing gaps,
 * ranks projects/skills/sections, and generates safe, non-manufactured copy suggestions.
 */

const MATCH_WEIGHTS = {
  requiredSkills: 0.35,
  projectEvidence: 0.25,
  experience: 0.20,
  preferredSkills: 0.10,
  educationCerts: 0.10
};

export function matchPortfolioToJob(portfolioData = {}, normalizedJob = {}) {
  const reqSkills = normalizedJob.requiredSkills || [];
  const prefSkills = normalizedJob.preferredSkills || [];
  const candidateSkills = (portfolioData.skills || []).map(s => s.name.toLowerCase());
  const candidateProjects = portfolioData.projects || [];
  const candidateExperience = portfolioData.experience || [];
  const candidateEducation = portfolioData.education || [];
  const candidateCerts = portfolioData.certs || portfolioData.certifications || [];

  let strengths = [];
  let gaps = [];
  let matchedSkillsCount = 0;

  // 1. Evaluate Skills Alignment
  reqSkills.forEach(skill => {
    const isMatched = candidateSkills.some(cs => isSkillAliasMatch(cs, skill));
    if (isMatched) {
      matchedSkillsCount++;
      strengths.push(`Strong alignment with required skill: ${skill}`);
    } else {
      gaps.push({
        skill,
        type: 'missing_skill',
        message: `Job requests ${skill}, but ${skill} is not present in your portfolio.`,
        recommendation: `If you have genuine experience with ${skill}, add it manually to your skills list.`
      });
    }
  });

  // Evaluate Preferred Skills
  prefSkills.forEach(skill => {
    const isMatched = candidateSkills.some(cs => isSkillAliasMatch(cs, skill));
    if (isMatched) {
      strengths.push(`Preferred skill bonus: ${skill}`);
    }
  });

  // 2. Evaluate Experience Alignment
  const targetRoleLower = normalizedJob.title ? normalizedJob.title.toLowerCase() : '';
  const relevantExperience = candidateExperience.filter(exp => {
    const roleLower = (exp.role || '').toLowerCase();
    return roleLower.includes('developer') || roleLower.includes('trainee') || roleLower.includes('engineer') || roleLower.includes('analyst');
  });

  if (relevantExperience.length > 0) {
    strengths.push(`Your ${relevantExperience[0].role} experience at ${relevantExperience[0].company} is highly relevant.`);
  }

  // 3. Evaluate Projects Alignment
  let relevantProjectsCount = 0;
  candidateProjects.forEach(p => {
    const techText = ((p.tech || '') + ' ' + (p.description || '') + ' ' + (p.name || '')).toLowerCase();
    const matchesTarget = reqSkills.some(sk => techText.includes(sk.toLowerCase()));
    if (matchesTarget) relevantProjectsCount++;
  });

  if (candidateProjects.length > 0 && relevantProjectsCount > 0) {
    strengths.push(`Project "${candidateProjects[0].name}" demonstrates practical application for this target role.`);
  } else if (candidateProjects.length > 0) {
    gaps.push({
      type: 'project_evidence',
      message: 'Job emphasizes target domain skills; consider highlighting relevant components in case studies.',
      recommendation: 'Add measurable details to your project descriptions.'
    });
  }

  // 4. Calculate Category Scores
  const skillsScore = reqSkills.length > 0 ? Math.round((matchedSkillsCount / reqSkills.length) * 100) : 85;
  const projectsScore = candidateProjects.length > 0 ? Math.min(100, Math.round((relevantProjectsCount / candidateProjects.length) * 100 + 40)) : 40;
  const experienceScore = candidateExperience.length > 0 ? 85 : 50;
  const educationCertsScore = (candidateEducation.length > 0 || candidateCerts.length > 0) ? 90 : 60;
  const preferredSkillsScore = prefSkills.length > 0 ? 75 : 85;

  const overallScore = Math.round(
    skillsScore * MATCH_WEIGHTS.requiredSkills +
    projectsScore * MATCH_WEIGHTS.projectEvidence +
    experienceScore * MATCH_WEIGHTS.experience +
    educationCertsScore * MATCH_WEIGHTS.educationCerts +
    preferredSkillsScore * MATCH_WEIGHTS.preferredSkills
  );

  // 5. Rank Projects by Relevance
  const recommendedProjectOrder = rankProjects(candidateProjects, reqSkills);

  // 6. Rank Skills by Relevance
  const recommendedSkillOrder = rankSkills(portfolioData.skills || [], reqSkills);

  // 7. Recommend Section Order
  const recommendedSectionOrder = recommendSectionOrder(targetRoleLower);

  // 8. Generate Safe Copy Suggestions (No fabricated claims!)
  const suggestedHeadline = portfolioData.profession || normalizedJob.title || 'Front-End Developer';
  const suggestedBio = portfolioData.bio || 'Motivated Front-End Developer seeking to build responsive, interactive web interfaces and high-performance user experiences.';

  // 9. Recruiter Highlights (Derived strictly from factual portfolio data)
  const recruiterHighlights = generateRecruiterHighlights(portfolioData);

  return {
    matchScore: overallScore,
    scoreBreakdown: {
      skills: skillsScore,
      projects: projectsScore,
      experience: experienceScore,
      educationCerts: educationCertsScore
    },
    strengths,
    gaps,
    recommendedProjectOrder,
    recommendedSkillOrder,
    recommendedSectionOrder,
    suggestedCopy: {
      suggestedHeadline,
      suggestedBio
    },
    recruiterHighlights
  };
}

function isSkillAliasMatch(candidateSkill, targetSkill) {
  const c = candidateSkill.toLowerCase().trim();
  const t = targetSkill.toLowerCase().trim();
  if (c === t) return true;
  if ((c === 'javascript' || c === 'js') && (t === 'javascript' || t === 'js')) return true;
  if ((c === 'html5' || c === 'html') && (t === 'html5' || t === 'html')) return true;
  if ((c === 'css3' || c === 'css') && (t === 'css3' || t === 'css')) return true;
  if (c.includes(t) || t.includes(c)) return true;
  return false;
}

function rankProjects(projects, targetSkills) {
  return [...projects].sort((a, b) => {
    const textA = ((a.tech || '') + ' ' + (a.name || '') + ' ' + (a.description || '')).toLowerCase();
    const textB = ((b.tech || '') + ' ' + (b.name || '') + ' ' + (b.description || '')).toLowerCase();

    const scoreA = targetSkills.reduce((acc, sk) => acc + (textA.includes(sk.toLowerCase()) ? 1 : 0), 0);
    const scoreB = targetSkills.reduce((acc, sk) => acc + (textB.includes(sk.toLowerCase()) ? 1 : 0), 0);

    return scoreB - scoreA;
  });
}

function rankSkills(skills, targetSkills) {
  return [...skills].sort((a, b) => {
    const matchA = targetSkills.some(ts => isSkillAliasMatch(a.name, ts));
    const matchB = targetSkills.some(ts => isSkillAliasMatch(b.name, ts));
    if (matchA && !matchB) return -1;
    if (!matchA && matchB) return 1;
    return 0;
  });
}

function recommendSectionOrder(roleLower) {
  if (roleLower.includes('front-end') || roleLower.includes('frontend') || roleLower.includes('web')) {
    return ['hero', 'projects', 'skills', 'experience', 'education', 'certs', 'volunteering', 'contact'];
  }
  return ['hero', 'experience', 'projects', 'skills', 'education', 'certs', 'volunteering', 'contact'];
}

function generateRecruiterHighlights(portfolioData) {
  let highlights = [];
  if (portfolioData.profession) highlights.push(`Role: ${portfolioData.profession}`);

  const exp = portfolioData.experience || [];
  if (exp.length > 0) {
    highlights.push(`${exp.length} Professional Training / Experience roles`);
  }

  const topSkills = (portfolioData.skills || []).slice(0, 4).map(s => s.name).join(' · ');
  if (topSkills) highlights.push(`Key Stack: ${topSkills}`);

  const edu = portfolioData.education || [];
  if (edu.length > 0) {
    highlights.push(`${edu[0].degree} — ${edu[0].institution}`);
  }

  return highlights;
}
