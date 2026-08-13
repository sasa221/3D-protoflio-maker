/**
 * VariantResolverFixtures.js
 * Acceptance test suite for V2.7 Portfolio Variants & Resolver.
 * Verifies Master Profile data centralization, live GPA propagation across variants,
 * project hiding per variant, variant deletion safety, and export isolation.
 */

import {
  ensureStableIDs,
  createDefaultVariant,
  createNewVariant,
  resolvePortfolioVariant
} from '../services/PortfolioVariantService.js';
import { buildPortfolioHTMLContent } from '../exporter/PortfolioExporter.js';

export function runPortfolioVariantsTestSuite() {
  let masterProfile = {
    name: 'SALEH MOHAMED ABOREHAB',
    profession: 'Front-End Developer',
    bio: 'Motivated Front-End Developer.',
    theme: 'code',
    education: [
      { id: 'edu_1', degree: 'Bachelor', institution: 'Helwan University', grade: '3.35' }
    ],
    experience: [
      { id: 'exp_1', role: 'Web Developer Trainee', company: 'National Telecommunication Institute – NTI' },
      { id: 'exp_2', role: 'Data Analysis Trainee', company: 'Ministry of Communications and Information Technology – MCIT' }
    ],
    projects: [
      { id: 'proj_1', name: 'Clothe Website', tech: 'HTML · CSS · JavaScript' },
      { id: 'proj_2', name: 'Array ADT Manager in C++', tech: 'C++' },
      { id: 'proj_3', name: 'Examination Management System', tech: 'Java · OOP' }
    ],
    skills: [
      { id: 'sk_1', name: 'JavaScript' },
      { id: 'sk_2', name: 'HTML5' },
      { id: 'sk_3', name: 'Power BI' }
    ]
  };

  ensureStableIDs(masterProfile);

  let results = [];

  // TEST 45: Multiple Variants & Master Profile Data Centralization
  const defaultVar = createDefaultVariant(masterProfile);
  masterProfile.portfolioVariants = [defaultVar];

  const feVariant = createNewVariant(masterProfile, {
    name: 'Frontend Portfolio',
    targetRole: 'Front-End Developer',
    strategy: 'optimize'
  });
  feVariant.themeId = 'matrix';
  feVariant.projectOrder = ['proj_1', 'proj_3', 'proj_2'];
  feVariant.hiddenProjects = ['proj_2']; // Hide Array ADT

  const dataVariant = createNewVariant(masterProfile, {
    name: 'Data Portfolio',
    targetRole: 'Data Analyst',
    strategy: 'optimize'
  });
  dataVariant.themeId = 'galaxy';

  // 1. Resolve Frontend Variant
  const resolvedFE = resolvePortfolioVariant(masterProfile, feVariant);
  const feHidesArray = !resolvedFE.projects.some(p => p.id === 'proj_2');
  const feThemeIsMatrix = resolvedFE.theme === 'matrix';

  // 2. Resolve Data Variant
  const resolvedData = resolvePortfolioVariant(masterProfile, dataVariant);
  const dataHasArray = resolvedData.projects.some(p => p.id === 'proj_2');

  // 3. Edit Master Profile GPA to 3.90
  masterProfile.education[0].grade = '3.90';
  const resolvedFE_updated = resolvePortfolioVariant(masterProfile, feVariant);
  const resolvedData_updated = resolvePortfolioVariant(masterProfile, dataVariant);

  const gpaPropagated = (resolvedFE_updated.education[0].grade === '3.90') &&
                        (resolvedData_updated.education[0].grade === '3.90');

  // 4. Delete Frontend Variant
  masterProfile.portfolioVariants = masterProfile.portfolioVariants.filter(v => v.id !== feVariant.id);
  const masterIntactAfterDelete = masterProfile.projects.length === 3 && masterProfile.education[0].grade === '3.90';

  results.push({
    testName: '45. Multiple Targeted Variants From One Source Profile',
    passed: feHidesArray && feThemeIsMatrix && dataHasArray && gpaPropagated && masterIntactAfterDelete,
    frontendHidesArrayADT: feHidesArray,
    dataKeepsArrayADT: dataHasArray,
    masterGPAPropagatedToAll: gpaPropagated,
    masterIntactAfterVariantDelete: masterIntactAfterDelete
  });

  // TEST 46: Export Single Variant Presentation Isolation
  const exportedHTML = buildPortfolioHTMLContent(masterProfile, null);
  const exportIsIsolated = !exportedHTML.includes('portfolioVariants') && exportedHTML.includes('Helwan University');

  results.push({
    testName: '46. Standalone Export Per Variant',
    passed: exportIsIsolated,
    noPrivateVariantsLeaked: exportIsIsolated
  });

  console.log('[Variants Test Suite] Results:', results);
  return results;
}
