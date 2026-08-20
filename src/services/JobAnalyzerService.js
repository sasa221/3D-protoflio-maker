/**
 * JobAnalyzerService.js
 * Strictly evidence-based job posting parser and requirements extractor.
 * Extracts explicit requirements: skills (required vs preferred), experience years,
 * education, certifications, and languages.
 *
 * CRITICAL RULE (§12): Job Title alone NEVER generates a match score.
 * Actual job description text or posting content is required.
 */

const SKILL_ALIASES = {
  'javascript': ['javascript', 'js', 'ecmascript'],
  'typescript': ['typescript', 'ts'],
  'html5': ['html5', 'html'],
  'css3': ['css3', 'css', 'sass', 'scss'],
  'react': ['react', 'react.js', 'reactjs'],
  'next.js': ['next.js', 'nextjs', 'next'],
  'vue': ['vue', 'vue.js', 'vuejs'],
  'angular': ['angular', 'angularjs'],
  'node.js': ['node.js', 'nodejs', 'node'],
  'python': ['python', 'py'],
  'sql': ['sql', 'mysql', 'postgresql', 'postgres', 'tsql'],
  'power bi': ['power bi', 'powerbi'],
  'data cleaning': ['data cleaning'],
  'excel': ['excel', 'ms excel', 'microsoft excel'],
  'c++': ['c++', 'cpp'],
  'c#': ['c#', 'csharp'],
  'java': ['java'],
  'php': ['php', 'laravel'],
  'three.js': ['three.js', 'threejs', 'webgl'],
  'docker': ['docker', 'containerization'],
  'kubernetes': ['kubernetes', 'k8s'],
  'aws': ['aws', 'amazon web services'],
  'git': ['git', 'github', 'gitlab'],
  'rest apis': ['rest api', 'rest apis', 'restful', 'rest'],
  'graphql': ['graphql'],
  'redux': ['redux'],
  'tailwind css': ['tailwind', 'tailwindcss', 'tailwind css'],
  'figma': ['figma', 'ui/ux', 'ui design'],
  'data visualization': ['data visualization', 'data viz', 'tableau']
};

export class JobAnalyzerService {
  analyzeJobTarget(targetInput = {}) {
    const {
      role = '',
      company = '',
      location = '',
      employmentType = '',
      jobDescription = '',
      jobUrl = ''
    } = targetInput;

    const jdText = (jobDescription || '').trim();
    const fullText = `${role} ${company} ${jdText}`;

    // Extract structured requirements
    const { requiredSkills, preferredSkills } = this._extractSkills(jdText);
    const requiredExperienceYears = this._extractExperienceYears(jdText);
    const requiredEducation = this._extractEducation(jdText);
    const requiredCertifications = this._extractCertifications(jdText);
    const requiredLanguages = this._extractLanguages(jdText);
    const seniority = this._extractSeniority(fullText);
    const parsedEmploymentType = employmentType || this._extractEmploymentType(jdText);

    // RULE (§12): Title alone or empty/insufficient text without requirements generates NO score.
    const hasAnyRequirement =
      jdText.length > 0 &&
      (requiredSkills.length > 0 ||
      preferredSkills.length > 0 ||
      requiredExperienceYears !== null ||
      requiredEducation !== null ||
      requiredCertifications.length > 0 ||
      jdText.split(/\s+/).filter(Boolean).length >= 20);

    if (!hasAnyRequirement) {
      return {
        hasRequirements: false,
        title: role || 'Target Role',
        company: company || '',
        location: location || '',
        employmentType: employmentType || '',
        jobUrl: jobUrl || '',
        requiredSkills: [],
        preferredSkills: [],
        requiredExperienceYears: null,
        requiredEducation: null,
        requiredCertifications: [],
        requiredLanguages: [],
        otherRequirements: [],
        reason: 'We need the actual job requirements to calculate your fit.',
        analyzedAt: new Date().toISOString()
      };
    }

    return {
      hasRequirements: hasAnyRequirement,
      title: role || this._extractTitleFromText(jdText) || 'Target Role',
      company: company || '',
      location: location || '',
      employmentType: parsedEmploymentType,
      jobUrl: jobUrl || '',
      seniority,
      requiredSkills,
      preferredSkills,
      requiredExperienceYears,
      requiredEducation,
      requiredCertifications,
      requiredLanguages,
      otherRequirements: [],
      reason: hasAnyRequirement ? null : 'We need the actual job requirements to calculate your fit.',
      analyzedAt: new Date().toISOString()
    };
  }

  _extractSkills(text) {
    const lower = text.toLowerCase();
    const required = new Set();
    const preferred = new Set();

    // Segment into preferred vs required sections if explicit headings exist
    const prefSectionMatch = text.match(/(?:preferred|nice to have|plus|bonus|optional|desired)[\s\S]{1,600}/i);
    const prefSectionText = prefSectionMatch ? prefSectionMatch[0].toLowerCase() : '';

    const knownSkills = Object.keys(SKILL_ALIASES);

    knownSkills.forEach(canonical => {
      const aliases = SKILL_ALIASES[canonical];
      const matched = aliases.some(alias => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i').test(lower);
      });

      if (matched) {
        // Format display name
        const displayName = canonical.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          .replace('Javascript', 'JavaScript')
          .replace('Typescript', 'TypeScript')
          .replace('Html5', 'HTML5')
          .replace('Css3', 'CSS3')
          .replace('Sql', 'SQL')
          .replace('Aws', 'AWS')
          .replace('Rest Apis', 'REST APIs')
          .replace('Ui/ux', 'UI/UX');

        if (prefSectionText && aliases.some(a => prefSectionText.includes(a))) {
          preferred.add(displayName);
        } else {
          required.add(displayName);
        }
      }
    });

    return {
      requiredSkills: Array.from(required),
      preferredSkills: Array.from(preferred)
    };
  }

  _extractExperienceYears(text) {
    const match = text.match(/(\d+)\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)(?:\s+of)?(?:\s+relevant|\s+professional|\s+work)?\s+experience/i)
      || text.match(/experience\s*:\s*(\d+)\+?\s*(?:years?|yrs?)/i)
      || text.match(/minimum\s*(?:of\s*)?(\d+)\s*(?:years?|yrs?)/i);

    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num <= 20) {
        return num;
      }
    }
    return null;
  }

  _extractEducation(text) {
    const lower = text.toLowerCase();
    if (lower.includes('phd') || lower.includes('doctorate')) return 'PhD';
    if (lower.includes('master') || lower.includes('m.sc') || lower.includes('ms degree')) return "Master's Degree";
    if (lower.includes('bachelor') || lower.includes('b.sc') || lower.includes('bs degree') || lower.includes('degree in computer') || lower.includes('degree in engineering')) {
      return "Bachelor's Degree";
    }
    if (lower.includes('diploma') || lower.includes('associate degree')) return 'Associate / Diploma';
    return null;
  }

  _extractCertifications(text) {
    const certs = [];
    const lower = text.toLowerCase();
    if (lower.includes('aws certified') || lower.includes('aws solutions architect')) certs.push('AWS Certification');
    if (lower.includes('pmp')) certs.push('PMP');
    if (lower.includes('scrum master') || lower.includes('csm')) certs.push('Scrum Master');
    if (lower.includes('cissp')) certs.push('CISSP');
    if (lower.includes('comptia')) certs.push('CompTIA');
    return certs;
  }

  _extractLanguages(text) {
    const langs = [];
    const lower = text.toLowerCase();
    if (lower.includes('fluent in english') || lower.includes('english proficiency') || lower.includes('excellent english')) langs.push('English');
    if (lower.includes('fluent in arabic') || lower.includes('arabic language')) langs.push('Arabic');
    if (lower.includes('german') || lower.includes('french')) langs.push('Additional European Language');
    return langs;
  }

  _extractSeniority(text) {
    const lower = text.toLowerCase();
    if (lower.includes('principal') || lower.includes('staff') || lower.includes('lead') || lower.includes('architect')) return 'Senior / Lead';
    if (lower.includes('senior') || lower.includes('sr.')) return 'Senior';
    if (lower.includes('junior') || lower.includes('entry') || lower.includes('graduate') || lower.includes('intern') || lower.includes('associate')) return 'Junior / Entry';
    return 'Mid-Level';
  }

  _extractEmploymentType(text) {
    const lower = text.toLowerCase();
    if (lower.includes('full-time') || lower.includes('full time')) return 'Full-time';
    if (lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
    if (lower.includes('contract') || lower.includes('freelance')) return 'Contract';
    if (lower.includes('remote') || lower.includes('work from home')) return 'Remote';
    return 'Full-time';
  }

  _extractTitleFromText(text) {
    const firstLine = text.trim().split('\n')[0].trim();
    if (firstLine.length > 3 && firstLine.length < 60 && !firstLine.includes('.')) {
      return firstLine;
    }
    return '';
  }
}
