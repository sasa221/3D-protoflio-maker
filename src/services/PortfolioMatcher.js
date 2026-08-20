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

  const evaluableCategories = [];

  // ──────────────────────────────────────────────
  // 1. REQUIRED SKILLS (Base Weight: 35)
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

  if (reqSkills.length > 0) {
    const reqSkillsScore = Math.round((reqSkillsMatched / reqSkills.length) * 100);
    evaluableCategories.push({
      key: 'requiredSkills',
      category: 'Required Skills',
      baseWeight: 35,
      score: reqSkillsScore,
      scoreDisplay: `${reqSkillsScore}%`,
      isApplicable: true,
      detail: `${reqSkillsMatched} of ${reqSkills.length} required skills matched`
    });
  } else {
    evaluableCategories.push({
      key: 'requiredSkills',
      category: 'Required Skills',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 2. RELEVANT EXPERIENCE (Base Weight: 25)
  // ──────────────────────────────────────────────
  const requiredExpYears = normalizedJob.requiredExperienceYears;
  const candidateTotalYears = calculateExperienceYears(candidateExperience);

  if (requiredExpYears !== null && requiredExpYears > 0) {
    let expScore = 0;
    let expEvidenceText = '';
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
    } else if (candidateTotalYears === 0) {
      expScore = 0;
      expEvidenceText = '0 years documented of ' + requiredExpYears + ' required';
      importantGaps.push({
        skill: 'Work Experience',
        level: 'IMPORTANT',
        state: 'NOT FOUND',
        message: 'No professional experience entries documented in portfolio.',
        guidance: 'Add your relevant work history, internships, or freelance roles to demonstrate practical background.'
      });
    }

    const hasVerifiableDuration = candidateTotalYears !== null;
    evaluableCategories.push({
      key: 'relevantExperience',
      category: 'Relevant Experience',
      baseWeight: hasVerifiableDuration ? 25 : 0,
      score: hasVerifiableDuration ? expScore : null,
      scoreDisplay: hasVerifiableDuration ? `${expScore}%` : 'N/A',
      isApplicable: hasVerifiableDuration,
      detail: hasVerifiableDuration ? expEvidenceText : 'Experience dates are missing; excluded from score'
    });
  } else {
    evaluableCategories.push({
      key: 'relevantExperience',
      category: 'Relevant Experience',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 3. PROJECTS & EVIDENCE (Base Weight: 15)
  // ──────────────────────────────────────────────
  if (reqSkills.length > 0) {
    let projectsWithReqSkills = 0;
    candidateProjects.forEach(p => {
      const pText = `${p.name || ''} ${p.description || ''} ${p.tech || ''}`.toLowerCase();
      const hasMatch = reqSkills.some(rs => pText.includes(rs.toLowerCase()));
      if (hasMatch) projectsWithReqSkills++;
    });

    let projectsScore = 0;
    if (candidateProjects.length > 0) {
      // Direct ratio: matched projects / total projects
      projectsScore = Math.round((projectsWithReqSkills / candidateProjects.length) * 100);
      if (projectsWithReqSkills > 0) {
        matchedEvidence.push({
          type: 'project',
          title: 'Project Evidence',
          state: 'MATCHED',
          evidence: `${projectsWithReqSkills} of ${candidateProjects.length} project(s) demonstrate required skills`
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

    evaluableCategories.push({
      key: 'projectsEvidence',
      category: 'Projects & Evidence',
      baseWeight: 15,
      score: projectsScore,
      scoreDisplay: `${projectsScore}%`,
      isApplicable: true,
      detail: candidateProjects.length > 0 ? `${projectsWithReqSkills} of ${candidateProjects.length} projects demonstrate required skills` : '0 projects documented'
    });
  } else {
    evaluableCategories.push({
      key: 'projectsEvidence',
      category: 'Projects & Evidence',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 4. EDUCATION (Base Weight: 10)
  // ──────────────────────────────────────────────
  if (normalizedJob.requiredEducation) {
    let educationScore = 0;
    let eduEvidenceText = '';
    const matchingEducation = candidateEducation.find(entry => educationMeetsRequirement(entry, normalizedJob.requiredEducation));
    if (matchingEducation) {
      educationScore = 100;
      eduEvidenceText = matchingEducation.degree || matchingEducation.institution || 'Documented degree';
      matchedEvidence.push({
        type: 'education',
        title: 'Education',
        state: 'MATCHED',
        evidence: `${eduEvidenceText} (Matches required: ${normalizedJob.requiredEducation})`
      });
    } else {
      educationScore = 0;
      eduEvidenceText = '0 education entries documented';
      importantGaps.push({
        skill: 'Education Qualification',
        level: 'IMPORTANT',
        state: 'NOT FOUND',
        message: `Job asks for ${normalizedJob.requiredEducation}; no matching degree is documented.`,
        guidance: 'Add your real degree or academic background if applicable.'
      });
    }

    evaluableCategories.push({
      key: 'education',
      category: 'Education',
      baseWeight: 10,
      score: educationScore,
      scoreDisplay: `${educationScore}%`,
      isApplicable: true,
      detail: eduEvidenceText
    });
  } else {
    evaluableCategories.push({
      key: 'education',
      category: 'Education',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 5. CERTIFICATIONS (Base Weight: 5)
  // ──────────────────────────────────────────────
  if (normalizedJob.requiredCertifications && normalizedJob.requiredCertifications.length > 0) {
    const certNames = candidateCerts.map(c => (c.name || c.title || '').toLowerCase());
    const matchedCerts = normalizedJob.requiredCertifications.filter(rc => certNames.some(cn => cn.includes(rc.toLowerCase())));
    const certsScore = Math.round((matchedCerts.length / normalizedJob.requiredCertifications.length) * 100);

    if (matchedCerts.length > 0) {
      matchedEvidence.push({
        type: 'certification',
        title: 'Certifications',
        state: 'MATCHED',
        evidence: `Matching: ${matchedCerts.join(', ')}`
      });
    }

    if (matchedCerts.length < normalizedJob.requiredCertifications.length) {
      importantGaps.push({
        skill: 'Certifications',
        level: 'IMPORTANT',
        state: 'NOT FOUND',
        message: `Job asks for: ${normalizedJob.requiredCertifications.join(', ')}.`,
        guidance: 'If you hold these certifications, add them under the Certifications section.'
      });
    }

    evaluableCategories.push({
      key: 'certifications',
      category: 'Certifications',
      baseWeight: 5,
      score: certsScore,
      scoreDisplay: `${certsScore}%`,
      isApplicable: true,
      detail: `${matchedCerts.length} of ${normalizedJob.requiredCertifications.length} required certs matched`
    });
  } else {
    evaluableCategories.push({
      key: 'certifications',
      category: 'Certifications',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 6. PREFERRED SKILLS (Base Weight: 5)
  // ──────────────────────────────────────────────
  if (prefSkills.length > 0) {
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

    const prefSkillsScore = Math.round((prefSkillsMatched / prefSkills.length) * 100);
    evaluableCategories.push({
      key: 'preferredSkills',
      category: 'Preferred Skills',
      baseWeight: 5,
      score: prefSkillsScore,
      scoreDisplay: `${prefSkillsScore}%`,
      isApplicable: true,
      detail: `${prefSkillsMatched} of ${prefSkills.length} bonus skills matched`
    });
  } else {
    evaluableCategories.push({
      key: 'preferredSkills',
      category: 'Preferred Skills',
      baseWeight: 0,
      score: null,
      scoreDisplay: 'N/A',
      isApplicable: false,
      detail: 'Not specified by employer'
    });
  }

  // ──────────────────────────────────────────────
  // 7. DYNAMIC WEIGHT NORMALIZATION & SCORING (§2)
  // ──────────────────────────────────────────────
  const activeCategories = evaluableCategories.filter(c => c.isApplicable && c.score !== null);
  const totalActiveWeight = activeCategories.reduce((sum, c) => sum + c.baseWeight, 0);

  let rawScore = 0;
  if (totalActiveWeight > 0) {
    const weightedSum = activeCategories.reduce((sum, c) => sum + (c.score * c.baseWeight), 0);
    rawScore = Math.round(weightedSum / totalActiveWeight);
  }

  // ──────────────────────────────────────────────
  // 8. CONSERVATIVE SCORE CAPS & GUARDS (§10)
  // ──────────────────────────────────────────────
  let finalScore = rawScore;

  // CAP 1: If required skills exist and 0 were matched, max score is 40%
  if (reqSkills.length > 0 && reqSkillsMatched === 0) {
    finalScore = Math.min(finalScore, 40);
  }

  // CAP 2: If NO direct evidence matched across entire portfolio, max score is 25%
  if (matchedEvidence.length === 0) {
    finalScore = Math.min(finalScore, 25);
  }

  // CAP 3: If mandatory hard requirements are missing, max score is 75%
  if (criticalGaps.length > 0) {
    finalScore = Math.min(finalScore, 75);
  }

  // ──────────────────────────────────────────────
  // 9. VERDICT & APPLY RECOMMENDATION (§11)
  // ──────────────────────────────────────────────
  let verdict = 'WEAK FIT';
  let applyAdvice = 'LOW PRIORITY — Major mandatory qualifications missing';
  let applyAdviceType = 'low_priority';

  if (finalScore >= 85 && criticalGaps.length === 0 && matchedEvidence.length >= 2) {
    verdict = 'STRONG FIT';
    applyAdvice = 'YES — Strong candidate with verified matching qualifications';
    applyAdviceType = 'yes_strong';
  } else if (finalScore >= 70 && criticalGaps.length <= 1 && matchedEvidence.length >= 1) {
    verdict = 'GOOD FIT';
    applyAdvice = 'YES — Good fit, but address minor gaps in your portfolio';
    applyAdviceType = 'yes_with_gaps';
  } else if (finalScore >= 50 && matchedEvidence.length >= 1) {
    verdict = 'POSSIBLE FIT';
    applyAdvice = 'CONSIDER — Meets some requirements, but notable qualification gaps exist';
    applyAdviceType = 'possibly';
  } else {
    verdict = 'WEAK FIT';
    applyAdvice = 'LOW PRIORITY — Major mandatory qualifications missing';
    applyAdviceType = 'low_priority';
  }

  // Auditable breakdown table with dynamic normalized weights
  const breakdown = evaluableCategories.map(c => ({
    category: c.category,
    weight: c.isApplicable && totalActiveWeight > 0 ? `${Math.round((c.baseWeight / totalActiveWeight) * 100)}%` : 'Excluded (N/A)',
    score: c.score,
    scoreDisplay: c.scoreDisplay,
    isApplicable: c.isApplicable,
    detail: c.detail
  }));

  // Backward compatibility aliases
  const strengths = matchedEvidence.map(e => e.evidence ? `${e.title}: ${e.evidence}` : e.title);
  const gaps = [...criticalGaps, ...importantGaps, ...niceToHaveGaps];
  const recommendedProjectOrder = rankProjects(candidateProjects, reqSkills);
  const recommendedSkillOrder = rankSkills(portfolioData.skills || [], reqSkills);

  return {
    hasRequirements: true,
    confidence: normalizedJob.confidence || 'MEDIUM',
    matchScore: finalScore,
    verdict,
    applyAdvice,
    applyAdviceType,
    breakdown,
    evaluableCategories,
    totalActiveWeight,
    matchedEvidence,
    criticalGaps,
    importantGaps,
    niceToHaveGaps,
    strengths,
    gaps,
    recommendedProjectOrder,
    recommendedSkillOrder,
    scoreBreakdown: {
      skills: activeCategories.find(c => c.key === 'requiredSkills')?.score || 0,
      projects: activeCategories.find(c => c.key === 'projectsEvidence')?.score || 0,
      experience: activeCategories.find(c => c.key === 'relevantExperience')?.score || 0,
      educationCerts: activeCategories.find(c => c.key === 'education')?.score || 0
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
  let datedEntries = 0;

  experienceList.forEach(exp => {
    const period = exp.period || exp.duration || '';
    // Look for explicit numbers e.g. "2 years", "6 months", "2021 - 2023"
    const yearRangeMatch = period.match(/(20\d\d)\s*[-–—]\s*(20\d\d|present|current)/i);
    if (yearRangeMatch) {
      const startYear = parseInt(yearRangeMatch[1], 10);
      const endYear = /present|current/i.test(yearRangeMatch[2]) ? new Date().getFullYear() : parseInt(yearRangeMatch[2], 10);
      const diffYears = Math.max(0.5, endYear - startYear);
      totalMonths += diffYears * 12;
      datedEntries++;
    }
  });

  if (datedEntries === 0) return null;
  return Math.round((totalMonths / 12) * 10) / 10;
}

function educationMeetsRequirement(entry, requiredEducation) {
  const text = `${entry?.degree || ''} ${entry?.field || ''}`.toLowerCase();
  const levels = [
    ['associate', ['associate', 'diploma']],
    ['bachelor', ['bachelor', 'b.sc', 'bsc', 'bs ', 'b.s.']],
    ['master', ['master', 'm.sc', 'msc', 'ms ', 'm.s.']],
    ['phd', ['phd', 'ph.d', 'doctorate']]
  ];
  const candidateLevel = levels.findIndex(([, aliases]) => aliases.some(alias => text.includes(alias)));
  const required = String(requiredEducation || '').toLowerCase();
  const requiredLevel = levels.findIndex(([name]) => required.includes(name));
  return candidateLevel >= 0 && requiredLevel >= 0 && candidateLevel >= requiredLevel;
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
