/**
 * JobMatcherFixtures.js
 * Acceptance test suite for V2.6 Job Targeting & AI Portfolio Optimizer.
 * Verifies explainable scoring, gap detection, project ranking, and strict truthfulness enforcement.
 */

import { JobAnalyzerService } from '../services/JobAnalyzerService.js';
import { matchPortfolioToJob } from '../services/PortfolioMatcher.js';

export function runJobTargetingTestSuite() {
  const analyzer = new JobAnalyzerService();

  const mockPortfolio = {
    name: 'SALEH MOHAMED ABOREHAB',
    profession: 'Front-End Developer',
    skills: [
      { name: 'JavaScript', category: 'Programming & Tools', level: null },
      { name: 'HTML5', category: 'Programming & Tools', level: null },
      { name: 'CSS3', category: 'Programming & Tools', level: null },
      { name: 'PHP', category: 'Programming & Tools', level: null },
      { name: 'Java', category: 'Programming & Tools', level: null },
      { name: 'Power BI', category: 'Data Analysis', level: null },
      { name: 'Data Cleaning', category: 'Data Analysis', level: null },
      { name: 'MySQL', category: 'Data Analysis', level: null }
    ],
    projects: [
      { name: 'Array ADT Manager in C++', tech: 'C++', description: 'Dynamic memory management in C++' },
      { name: 'Clothe Website', tech: 'HTML · CSS · JavaScript', description: 'Responsive multi-page website' },
      { name: 'Examination Management System', tech: 'Java · OOP', description: 'Console examination system' }
    ],
    experience: [
      { role: 'Web Developer Trainee', company: 'National Telecommunication Institute – NTI' }
    ],
    education: [
      { degree: 'Bachelor', institution: 'Helwan University' }
    ]
  };

  let results = [];

  // TEST 37: Frontend Developer Target
  const frontendJob = analyzer.analyzeJobTarget({
    role: 'Frontend Developer',
    jobDescription: 'Required: JavaScript, HTML, CSS, React, Responsive Design, Git, REST APIs.'
  });
  const feMatch = matchPortfolioToJob(mockPortfolio, frontendJob);

  const feHasStrengths = feMatch.strengths.some(s => s.toLowerCase().includes('javascript'));
  const feHasReactGap = feMatch.gaps.some(g => g.skill === 'React');
  const feClotheFirst = feMatch.recommendedProjectOrder[0].name === 'Clothe Website';
  const feNoFakeSkills = !mockPortfolio.skills.some(s => s.name === 'React');

  results.push({
    testName: '37. Frontend Developer Target',
    passed: feHasStrengths && feHasReactGap && feClotheFirst && feNoFakeSkills,
    matchScore: feMatch.matchScore,
    firstProject: feMatch.recommendedProjectOrder[0].name,
    reactGapDetected: feHasReactGap,
    noFakeSkillInserted: feNoFakeSkills
  });

  // TEST 38: Data Analyst Target
  const dataJob = analyzer.analyzeJobTarget({
    role: 'Junior Data Analyst',
    jobDescription: 'Required: Power BI, Data Cleaning, Data Visualization, SQL, Excel.'
  });
  const dataMatch = matchPortfolioToJob(mockPortfolio, dataJob);

  const dataHasPowerBIStrength = dataMatch.strengths.some(s => s.toLowerCase().includes('power bi'));
  const dataHasExcelGap = dataMatch.gaps.some(g => g.skill === 'Excel');

  results.push({
    testName: '38. Data Analyst Target',
    passed: dataHasPowerBIStrength && dataHasExcelGap,
    matchScore: dataMatch.matchScore,
    powerBISupported: dataHasPowerBIStrength,
    excelGapDetected: dataHasExcelGap
  });

  // TEST 39: Truthfulness Guard
  const missingStackJob = analyzer.analyzeJobTarget({
    role: 'Full Stack Engineer',
    jobDescription: 'Required: React, TypeScript, Next.js.'
  });

  const skillsBeforeCount = mockPortfolio.skills.length;
  const missingMatch = matchPortfolioToJob(mockPortfolio, missingStackJob);
  const skillsAfterCount = mockPortfolio.skills.length;

  const truthfulnessPassed = (skillsBeforeCount === skillsAfterCount) && (missingMatch.gaps.length === 3);

  results.push({
    testName: '39. Truthfulness Guard (No Fabricated Skills)',
    passed: truthfulnessPassed,
    skillsUnmutated: skillsBeforeCount === skillsAfterCount,
    gapsCount: missingMatch.gaps.length
  });

  console.log('[Job Matcher Test Suite] Results:', results);
  return results;
}
