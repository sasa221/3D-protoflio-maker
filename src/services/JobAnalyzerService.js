/**
 * JobAnalyzerService.js
 * Analyzes target role title and job description text to extract normalized requirements,
 * skills, technologies, responsibilities, and qualifications.
 * Supports semantic alias matching (e.g. JS ≈ JavaScript, HTML ≈ HTML5, PowerBI ≈ Power BI).
 */

const SKILL_ALIASES = {
  'javascript': ['js', 'ecmascript', 'javascript'],
  'typescript': ['ts', 'typescript'],
  'html5': ['html', 'html5'],
  'css3': ['css', 'css3', 'sass', 'scss'],
  'react': ['react.js', 'reactjs', 'react'],
  'vue': ['vue.js', 'vuejs', 'vue'],
  'node.js': ['node', 'nodejs', 'node.js'],
  'power bi': ['powerbi', 'power bi', 'power-bi'],
  'c++': ['cpp', 'c++'],
  'c#': ['csharp', 'c#'],
  'python': ['py', 'python'],
  'sql': ['mysql', 'postgresql', 'postgres', 'sql', 'tsql'],
  'rest api': ['rest', 'restful', 'apis', 'rest api', 'api integration']
};

export class JobAnalyzerService {
  analyzeJobTarget(targetInput = {}) {
    const {
      role = '',
      company = '',
      industry = '',
      jobDescription = ''
    } = targetInput;

    const fullText = `${role} ${industry} ${jobDescription}`.toLowerCase();

    // 1. Identify Seniority
    let seniority = 'Mid Level';
    if (fullText.includes('junior') || fullText.includes('trainee') || fullText.includes('intern') || fullText.includes('associate')) {
      seniority = 'Junior / Entry Level';
    } else if (fullText.includes('senior') || fullText.includes('lead') || fullText.includes('principal') || fullText.includes('architect')) {
      seniority = 'Senior / Lead';
    }

    // 2. Extract Technologies & Skills
    const { requiredSkills, preferredSkills, technologies } = this._extractSkillsFromText(fullText, role);

    // 3. Extract Soft Skills
    const softSkills = this._extractSoftSkills(fullText);

    // 4. Extract Qualifications & Domain Keywords
    const qualifications = this._extractQualifications(fullText);
    const domainKeywords = this._extractDomainKeywords(fullText, role);

    return {
      title: role || 'Target Role',
      company: company || '',
      industry: industry || '',
      seniority,
      requiredSkills,
      preferredSkills,
      technologies,
      responsibilities: [],
      qualifications,
      softSkills,
      domainKeywords,
      analyzedAt: new Date().toISOString()
    };
  }

  _extractSkillsFromText(fullText, roleTitle) {
    const knownSkillsList = [
      'JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'React', 'Vue', 'Next.js', 'Node.js',
      'Python', 'C++', 'C', 'Java', 'PHP', 'Laravel', 'Bootstrap', 'Tailwind', 'Three.js',
      'Power BI', 'Data Cleaning', 'Data Transformation', 'Data Visualization', 'SQL', 'MySQL',
      'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Git', 'REST APIs', 'GraphQL', 'Redux',
      'Figma', 'UI/UX', 'Analytical Thinking'
    ];

    let required = [];
    let preferred = [];
    let tech = [];

    knownSkillsList.forEach(skill => {
      const aliases = SKILL_ALIASES[skill.toLowerCase()] || [skill.toLowerCase()];
      const matches = aliases.some(alias => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(fullText);
      });

      if (matches) {
        tech.push(skill);
        if (fullText.includes('plus') || fullText.includes('preferred') || fullText.includes('nice to have')) {
          preferred.push(skill);
        } else {
          required.push(skill);
        }
      }
    });

    // Default required skills based on role title if description is brief
    const lowerRole = roleTitle.toLowerCase();
    if (required.length === 0) {
      if (lowerRole.includes('front-end') || lowerRole.includes('frontend') || lowerRole.includes('web developer')) {
        required = ['JavaScript', 'HTML5', 'CSS3', 'React', 'Responsive Design', 'Git', 'REST APIs'];
        tech = [...required];
      } else if (lowerRole.includes('data analyst') || lowerRole.includes('data analysis')) {
        required = ['Power BI', 'SQL', 'Data Cleaning', 'Data Visualization', 'Excel'];
        tech = [...required];
      } else if (lowerRole.includes('cyber') || lowerRole.includes('security')) {
        required = ['Network Security', 'Linux', 'Python', 'Incident Response'];
        tech = [...required];
      }
    }

    return {
      requiredSkills: Array.from(new Set(required)),
      preferredSkills: Array.from(new Set(preferred)),
      technologies: Array.from(new Set(tech))
    };
  }

  _extractSoftSkills(fullText) {
    const softSkillsList = [
      'Problem Solving', 'Communication', 'Teamwork', 'Time Management',
      'Management', 'Organization Skills', 'Adaptability', 'Analytical Thinking'
    ];
    return softSkillsList.filter(s => fullText.includes(s.toLowerCase()));
  }

  _extractQualifications(fullText) {
    let quals = [];
    if (fullText.includes('bachelor') || fullText.includes('b.sc') || fullText.includes('computer science')) {
      quals.push("Bachelor's degree in Computer Science or related field");
    }
    if (fullText.includes('certification') || fullText.includes('certificate')) {
      quals.push("Relevant professional certifications");
    }
    return quals;
  }

  _extractDomainKeywords(fullText, roleTitle) {
    const keywords = ['Responsive Design', 'UI Components', 'Data Dashboards', 'Database Design', 'Agile'];
    return keywords.filter(k => fullText.includes(k.toLowerCase()) || roleTitle.toLowerCase().includes('front-end'));
  }
}
