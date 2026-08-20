/**
 * PortfolioMatcher.js
 * Strictly evidence-based job fit calculator and gap analyzer.
 * Evaluates candidate portfolioData against explicit structured job requirements.
 *
 * Scoring Model (§16):
 * - Required Skills: 35%
 * - Relevant Experience: 25%
 * - Projects / Evidence: 15%
 * - Education: 10%
 * - Certifications: 5%
 * - Preferred Skills: 5%
 * - Other Qualifications / Languages: 5%
 *
 * Explicit Evidence States (§16):
 * MATCHED | PARTIAL | NOT FOUND | UNKNOWN
 *
 * Truthfulness Rule (§15, §18):
 * Never infer unstated skills (JavaScript ≠ React). Never encourage CV fabrication.
 */

const WEIGHTS = {
  requiredSkills: 0.35,
  relevantExperience: 0.25,
  projectsEvidence: 0.15,
  education: 0.10,
  certifications: 0.05,
  preferredSkills: 0.05,
  otherRequirements: 0.05
};

export function matchPortfolioToJob(portfolioData = {}, normalizedJob = {}) {
  // If no requirements were extracted or input was invalid, return no score (§12)
  if (!normalizedJob.hasRequirements) {
    return {
      hasRequirements: false,
      matchScore: 0,
      verdict: 'NO REQUIREMENTS',
      applyAdvice: 'We need the actual job requirements to calculate your fit.',
      reason: normalizedJob.reason || 'We need the actual job requirements to calculate your fit.',
      breakdown: [],
      matchedEvidence: [],
      criticalGaps: [],
      importantGaps: [],
      niceToHaveGaps: [],
      strengths: [],
      gaps: [],
      recommendedProjectOrder: portfolioData.projects || [],
      recommendedSkillOrder: portfolioData.skills || [],
      scoreBreakdown: {
        skills: 0,
        projects: 0,
        experience: 0,
        educationCerts: 0
      },
      suggestedCopy: {
        suggestedHeadline: portfolioData.profession || 'Portfolio Maker',
        suggestedBio: portfolioData.bio || ''
      },
      recruiterHighlights: generateRecruiterHighlights(portfolioData)
    };
  }

  const reqSkills = normalizedJob.requiredSkills || [];
  const prefSkills = normalizedJob.preferredSkills || [];
  const candidateSkills = (portfolioData.skills || []).map(s => (s.name || s).trim());
  const candidateProjects = portfolioData.projects || [];
  const candidateExperience = portfolioData.experience || [];
  const candidateEducation = portfolioData.education || [];
  const candidateCerts = portfolioData.certs || portfolioData.certifications || [];

  const matchedEvidence = [];
  const criticalGaps = [];
  const importantGaps = [];
  const niceToHaveGaps = [];

  // ──────────────────────────────────────────────
  // 1. REQUIRED SKILLS (35%)
  // ──────────────────────────────────────────────
  let reqSkillsMatched = 0;
  reqSkills.forEach(reqSkill => {
    const matchedCandidateSkill = candidateSkills.find(cs => isStrictSkillMatch(cs, reqSkill));
    if (matchedCandidateSkill) {
      reqSkillsMatched++;
      matchedEvidence.push({
        type: 'skill',
        title: reqSkill,
        state: 'MATCHED',
        evidence: `Listed in your skills: "${matchedCandidateSkill}"`
      });
    } else {
      criticalGaps.push({
        skill: reqSkill,
        level: 'REQUIRED',
        state: 'NOT FOUND',
        message: `Required by job, not found in your portfolio.`,
        guidance: `If you genuinely have ${reqSkill} experience, add verified evidence of it to your skills or projects.`
      });
    }
  });
  const reqSkillsScore = reqSkills.length > 0 ? (reqSkillsMatched / reqSkills.length) * 100 : 100;

  // ──────────────────────────────────────────────
  // 2. RELEVANT EXPERIENCE (25%)
  // ──────────────────────────────────────────────
  const requiredExpYears = normalizedJob.requiredExperienceYears;
  let candidateTotalYears = calculateExperienceYears(candidateExperience);
  let expScore = 100;
  let expEvidenceText = '';

  if (requiredExpYears !== null && requiredExpYears > 0) {
    if (candidateTotalYears >= requiredExpYears) {
      expScore = 100;
      expEvidenceText = `${candidateTotalYears} years documented (Required: ${requiredExpYears}+ years)`;
      matchedEvidence.push({
        type: 'experience',
        title: 'Work Experience',
        state: 'MATCHED',
        evidence: expEvidenceText
      });
    } else if (candidateTotalYears > 0) {
      expScore = Math.round((candidateTotalYears / requiredExpYears) * 100);
      expEvidenceText = `${candidateTotalYears} years documented of ${requiredExpYears} required`;
      importantGaps.push({
        skill: 'Experience Duration',
        level: 'IMPORTANT',
        state: 'PARTIAL',
        message: `Job asks for ${requiredExpYears}+ years; portfolio documents ~${candidateTotalYears} years.`,
        guidance: `Ensure all previous relevant employment and internship positions are listed in your experience section.`
      });
    } else {
      expScore = candidateExperience.length > 0 ? 60 : 20;
      expEvidenceText = candidateExperience.length > 0 ? `${candidateExperience.length} positions documented` : 'No experience documented';
      if (candidateExperience.length === 0) {
        importantGaps.push({
          skill: 'Work Experience',
          level: 'IMPORTANT',
          state: 'NOT FOUND',
          message: 'No professional experience entries documented in portfolio.',
          guidance: 'Add your relevant work history, internships, or freelance roles to demonstrate practical background.'
        });
      }
    }
  } else {
    // No specific year requirement in JD
    expScore = candidateExperience.length > 0 ? 100 : 70;
    expEvidenceText = candidateExperience.length > 0 ? `${candidateExperience.length} experience roles documented` : 'Not explicitly required';
  }

  // ──────────────────────────────────────────────
  // 3. PROJECTS / EVIDENCE (15%)
  // ──────────────────────────────────────────────
  let projectsWithReqSkills = 0;
  candidateProjects.forEach(p => {
    const pText = `${p.name || ''} ${p.description || ''} ${p.tech || ''}`.toLowerCase();
    const hasMatch = reqSkills.some(rs => pText.includes(rs.toLowerCase()));
    if (hasMatch) projectsWithReqSkills++;
  });

  let projectsScore = 0;
  if (candidateProjects.length > 0) {
    if (reqSkills.length === 0) {
      projectsScore = 100;
    } else {
      projectsScore = projectsWithReqSkills > 0 ? Math.min(100, Math.round((projectsWithReqSkills / Math.min(3, candidateProjects.length)) * 100)) : 40;
    }
    if (projectsWithReqSkills > 0) {
      matchedEvidence.push({
        type: 'project',
        title: 'Project Proof',
        state: 'MATCHED',
        evidence: `${projectsWithReqSkills} project(s) demonstrate practical application of required skills`
      });
    }
  } else {
    projectsScore = 0;
    importantGaps.push({
      skill: 'Portfolio Projects',
      level: 'IMPORTANT',
      state: 'NOT FOUND',
      message: 'No projects added to your portfolio.',
      guidance: 'Add real-world projects or case studies demonstrating your skills.'
    });
  }

  // ──────────────────────────────────────────────
  // 4. EDUCATION (10%)
  // ──────────────────────────────────────────────
  let educationScore = 100;
  let eduEvidenceText = '';
  if (normalizedJob.requiredEducation) {
    if (candidateEducation.length > 0) {
      educationScore = 100;
      eduEvidenceText = candidateEducation[0].degree || candidateEducation[0].institution || 'Documented degree';
      matchedEvidence.push({
        type: 'education',
        title: 'Education',
        state: 'MATCHED',
        evidence: `${eduEvidenceText} (Matches required: ${normalizedJob.requiredEducation})`
      });
    } else {
      educationScore = 30;
      importantGaps.push({
        skill: 'Education Qualification',
        level: 'IMPORTANT',
        state: 'NOT FOUND',
        message: `Job asks for ${normalizedJob.requiredEducation}; no education entered.`,
        guidance: 'Add your degree or academic background if applicable.'
      });
    }
  } else {
    educationScore = candidateEducation.length > 0 ? 100 : 80;
    eduEvidenceText = candidateEducation.length > 0 ? `${candidateEducation[0].degree || 'Documented'}` : 'Not strictly specified in posting';
  }

  // ──────────────────────────────────────────────
  // 5. CERTIFICATIONS (5%)
  // ──────────────────────────────────────────────
  let certsScore = 100;
  if (normalizedJob.requiredCertifications && normalizedJob.requiredCertifications.length > 0) {
    const certNames = candidateCerts.map(c => (c.name || c.title || '').toLowerCase());
    const matchedCerts = normalizedJob.requiredCertifications.filter(rc => certNames.some(cn => cn.includes(rc.toLowerCase())));
    if (matchedCerts.length > 0) {
      certsScore = 100;
      matchedEvidence.push({
        type: 'certification',
        title: 'Certifications',
        state: 'MATCHED',
        evidence: `Matching: ${matchedCerts.join(', ')}`
      });
    } else {
      certsScore = 0;
      importantGaps.push({
        skill: 'Certifications',
        level: 'IMPORTANT',
        state: 'NOT FOUND',
        message: `Job asks for: ${normalizedJob.requiredCertifications.join(', ')}.`,
        guidance: 'If you hold these certifications, add them under the Certifications section.'
      });
    }
  } else {
    certsScore = candidateCerts.length > 0 ? 100 : 80;
  }

  // ──────────────────────────────────────────────
  // 6. PREFERRED SKILLS (5%)
  // ──────────────────────────────────────────────
  let prefSkillsMatched = 0;
  prefSkills.forEach(prefSkill => {
    const matched = candidateSkills.find(cs => isStrictSkillMatch(cs, prefSkill));
    if (matched) {
      prefSkillsMatched++;
      matchedEvidence.push({
        type: 'preferred_skill',
        title: `Preferred: ${prefSkill}`,
        state: 'MATCHED',
        evidence: `Bonus skill: "${matched}"`
      });
    } else {
      niceToHaveGaps.push({
        skill: prefSkill,
        level: 'NICE_TO_HAVE',
        state: 'NOT FOUND',
        message: `Preferred by job, not listed in portfolio.`,
        guidance: `If you have familiarity with ${prefSkill}, consider mentioning it in project descriptions.`
      });
    }
  });
  const prefSkillsScore = prefSkills.length > 0 ? (prefSkillsMatched / prefSkills.length) * 100 : 100;

  // ──────────────────────────────────────────────
  // 7. WEIGHTED OVERALL SCORE CALCULATION (§16)
  // ──────────────────────────────────────────────
  const finalScore = Math.min(100, Math.max(0, Math.round(
    reqSkillsScore * WEIGHTS.requiredSkills +
    expScore * WEIGHTS.relevantExperience +
    projectsScore * WEIGHTS.projectsEvidence +
    educationScore * WEIGHTS.education +
    certsScore * WEIGHTS.certifications +
    prefSkillsScore * WEIGHTS.preferredSkills +
    100 * WEIGHTS.otherRequirements
  )));

  // ──────────────────────────────────────────────
  // 8. VERDICT & APPLY RECOMMENDATION (§17)
  // ──────────────────────────────────────────────
  let verdict = 'WEAK FIT';
  let applyAdvice = 'LOW PRIORITY — Major mandatory qualifications missing';
  let applyAdviceType = 'low_priority';

  if (finalScore >= 80 && criticalGaps.length === 0) {
    verdict = 'STRONG FIT';
    applyAdvice = 'YES — Strong candidate for this role';
    applyAdviceType = 'yes_strong';
  } else if (finalScore >= 65 && criticalGaps.length <= 2) {
    verdict = 'GOOD FIT';
    applyAdvice = 'YES — But address critical gaps before applying';
    applyAdviceType = 'yes_with_gaps';
  } else if (finalScore >= 50) {
    verdict = 'POSSIBLE FIT';
    applyAdvice = 'POSSIBLY — Important job requirements are missing from your portfolio';
    applyAdviceType = 'possibly';
  } else {
    verdict = 'WEAK FIT';
    applyAdvice = 'LOW PRIORITY — Major mandatory qualifications missing';
    applyAdviceType = 'low_priority';
  }

  // ──────────────────────────────────────────────
  // 9. AUDITABLE CATEGORY BREAKDOWN (§19)
  // ──────────────────────────────────────────────
  const breakdown = [
    {
      category: 'Required Skills',
      weight: '35%',
      score: Math.round(reqSkillsScore),
      detail: reqSkills.length > 0 ? `${reqSkillsMatched} of ${reqSkills.length} required skills matched` : 'No explicit skills listed in job'
    },
    {
      category: 'Relevant Experience',
      weight: '25%',
      score: Math.round(expScore),
      detail: expEvidenceText || `${candidateExperience.length} positions documented`
    },
    {
      category: 'Projects & Evidence',
      weight: '15%',
      score: Math.round(projectsScore),
      detail: candidateProjects.length > 0 ? `${projectsWithReqSkills} of ${candidateProjects.length} projects demonstrate required skills` : '0 projects documented'
    },
    {
      category: 'Education',
      weight: '10%',
      score: Math.round(educationScore),
      detail: eduEvidenceText || 'Documented'
    },
    {
      category: 'Preferred Skills',
      weight: '5%',
      score: Math.round(prefSkillsScore),
      detail: prefSkills.length > 0 ? `${prefSkillsMatched} of ${prefSkills.length} bonus skills matched` : 'None specified'
    }
  ];

  // Backward compatibility aliases for existing tests
  const strengths = matchedEvidence.map(e => e.evidence ? `${e.title}: ${e.evidence}` : e.title);
  const gaps = [...criticalGaps, ...importantGaps, ...niceToHaveGaps];
  const recommendedProjectOrder = rankProjects(candidateProjects, reqSkills);
  const recommendedSkillOrder = rankSkills(portfolioData.skills || [], reqSkills);

  return {
    hasRequirements: true,
    matchScore: finalScore,
    verdict,
    applyAdvice,
    applyAdviceType,
    breakdown,
    matchedEvidence,
    criticalGaps,
    importantGaps,
    niceToHaveGaps,
    strengths,
    gaps,
    recommendedProjectOrder,
    recommendedSkillOrder,
    scoreBreakdown: {
      skills: Math.round(reqSkillsScore),
      projects: Math.round(projectsScore),
      experience: Math.round(expScore),
      educationCerts: Math.round(educationScore)
    },
    suggestedCopy: {
      suggestedHeadline: portfolioData.profession || normalizedJob.title || 'Front-End Developer',
      suggestedBio: portfolioData.bio || ''
    },
    recruiterHighlights: generateRecruiterHighlights(portfolioData)
  };
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
    const matchA = targetSkills.some(ts => isStrictSkillMatch(a.name || a, ts));
    const matchB = targetSkills.some(ts => isStrictSkillMatch(b.name || b, ts));
    if (matchA && !matchB) return -1;
    if (!matchA && matchB) return 1;
    return 0;
  });
}

function isStrictSkillMatch(candidateSkill, targetSkill) {
  const c = String(candidateSkill || '').toLowerCase().trim();
  const t = String(targetSkill || '').toLowerCase().trim();
  if (!c || !t) return false;
  if (c === t) return true;

  // Strict equivalence rules (JavaScript is NOT React)
  if ((c === 'javascript' || c === 'js') && (t === 'javascript' || t === 'js')) return true;
  if ((c === 'typescript' || c === 'ts') && (t === 'typescript' || t === 'ts')) return true;
  if ((c === 'html5' || c === 'html') && (t === 'html5' || t === 'html')) return true;
  if ((c === 'css3' || c === 'css') && (t === 'css3' || t === 'css')) return true;
  if ((c === 'react' || c === 'react.js' || c === 'reactjs') && (t === 'react' || t === 'react.js' || t === 'reactjs')) return true;
  if ((c === 'node' || c === 'node.js' || c === 'nodejs') && (t === 'node' || t === 'node.js' || t === 'nodejs')) return true;
  if ((c === 'power bi' || c === 'powerbi') && (t === 'power bi' || t === 'powerbi')) return true;
  if ((c === 'c++' || c === 'cpp') && (t === 'c++' || t === 'cpp')) return true;
  if ((c === 'c#' || c === 'csharp') && (t === 'c#' || t === 'csharp')) return true;

  return false;
}

function calculateExperienceYears(experienceList) {
  if (!Array.isArray(experienceList) || experienceList.length === 0) return 0;
  let totalMonths = 0;

  experienceList.forEach(exp => {
    const period = exp.period || exp.duration || '';
    // Look for explicit numbers e.g. "2 years", "6 months", "2021 - 2023"
    const yearRangeMatch = period.match(/(20\d\d)\s*[-–—]\s*(20\d\d|present|current)/i);
    if (yearRangeMatch) {
      const startYear = parseInt(yearRangeMatch[1], 10);
      const endYear = /present|current/i.test(yearRangeMatch[2]) ? new Date().getFullYear() : parseInt(yearRangeMatch[2], 10);
      const diffYears = Math.max(0.5, endYear - startYear);
      totalMonths += diffYears * 12;
    } else {
      totalMonths += 12; // default 1 year per listed experience entry
    }
  });

  return Math.round((totalMonths / 12) * 10) / 10;
}

function generateRecruiterHighlights(portfolioData) {
  const highlights = [];
  if (portfolioData.profession) highlights.push(`Role: ${portfolioData.profession}`);

  const exp = portfolioData.experience || [];
  if (exp.length > 0) highlights.push(`${exp.length} documented experience role(s)`);

  const topSkills = (portfolioData.skills || []).slice(0, 4).map(s => s.name || s).join(' · ');
  if (topSkills) highlights.push(`Core Stack: ${topSkills}`);

  const edu = portfolioData.education || [];
  if (edu.length > 0) highlights.push(`${edu[0].degree || 'Degree'} — ${edu[0].institution || ''}`);

  return highlights;
}

