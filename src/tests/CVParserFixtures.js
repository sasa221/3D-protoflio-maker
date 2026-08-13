/**
 * CVParserFixtures.js
 * Test fixtures for real-world CV layouts.
 * Includes Saleh Mohamed Aborehab's exact structural acceptance test suite.
 */

import { normalizeCVText } from '../services/CVTextNormalizer.js';
import { CVParserService } from '../services/CVParserService.js';
import { canonicalizeCVData } from '../services/CVCanonicalizer.js';

export const TEST_FIXTURES = {
  // Primary Acceptance Test Case: Saleh Mohamed Aborehab CV Structure
  salehAborehabCV: `
SALEH MOHAMED ABOREHAB LinkedIn Portfolio
Front-End Developer
Giza, Egypt | eng.salehmohammedd@gmail.com | +201270024222
www.linkedin.com/in/saleh-mohammedd/ | https://github.com/sasa221

OBJECTIVES
Motivated Front-End Developer seeking to build responsive, interactive web interfaces and high-performance user experiences.

PROFESSIONAL EXPERIENCE
Web Developer Trainee - National Telecommunication Institute – NTI
Sept 2025 - Oct 2025
• Full-Stack PHP intensive training
• SQL databases, Bootstrap, Laravel
• Responsive interfaces & server-side integration

Data Analysis Trainee - Ministry of Communications and Information Technology – MCIT
Sept 2025 - Oct 2025
• Data Analysis training
• Power BI, Data cleaning & transformation
• Data visualization, interactive reports & dashboards

EDUCATION
Bachelor - Computer Science and Artificial Intelligence
Helwan University
Sept 2023 - June 2027
GPA: 3.35

CERTIFICATIONS
Full Stack PHP - NTI
Innovation and Entrepreneurship - ITIDA
Data Analysis - MCIT

PROJECTS
Clothe Website
May 2024
Built a fully Front-End website using HTML, CSS, and JavaScript with multiple pages.
HTML · CSS · JavaScript

Array ADT Manager in C++
May 2024
A C++ implementation of an Array Abstract Data Type with dynamic memory management.
C++

Examination Management System
Dec 2024
Console-based examination management system. OOP, File Handling, ArrayList, HashMap.
Java · OOP

VOLUNTEERING
Organizing Committee Member - Central Family/Organization Helwan
Nov 2024 - Present
Event organization, Gen-Z program participation, graduation ceremonies, and Best Member recognition.

LANGUAGES
English B2
Arabic Native
`
};

export async function runCVParserTestSuite() {
  const parser = new CVParserService();
  let results = [];

  for (const [key, rawText] of Object.entries(TEST_FIXTURES)) {
    const normalized = normalizeCVText(rawText);
    const parsed = await parser.parse(normalized);
    const canonical = canonicalizeCVData(parsed);

    // Strict Regression Assertions for Saleh's CV
    const passedName = canonical.personal.name === 'SALEH MOHAMED ABOREHAB';
    const passedExpCount = canonical.experience.length === 2;
    const passedEduCount = canonical.education.length === 1;
    const passedProjCount = canonical.projects.length === 3;
    const passedCertCount = canonical.certifications.length === 3;
    const passedLangCount = canonical.languages.length === 2;
    const passedVolCount = canonical.volunteering.length === 1;

    const overallPassed = Boolean(
      passedName &&
      passedExpCount &&
      passedEduCount &&
      passedProjCount &&
      passedCertCount &&
      passedLangCount &&
      passedVolCount
    );

    results.push({
      fixtureKey: key,
      passed: overallPassed,
      candidateName: canonical.personal.name,
      headline: canonical.personal.headline,
      experienceCount: canonical.experience.length,
      educationCount: canonical.education.length,
      skillsCount: canonical.skills.length,
      projectsCount: canonical.projects.length,
      certsCount: canonical.certifications.length,
      languagesCount: canonical.languages.length,
      volunteeringCount: canonical.volunteering.length,
      assertions: {
        passedName,
        passedExpCount,
        passedEduCount,
        passedProjCount,
        passedCertCount,
        passedLangCount,
        passedVolCount
      }
    });
  }

  console.log('[CV Test Suite] Regression Results:', results);
  return results;
}
