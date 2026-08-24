export const CV_TEMPLATES = {
  'ats-basic': {
    id: 'ats-basic',
    name: 'ATS Basic',
    tier: 'free',
    description: 'Single-column, text-first CV with standard section headings.'
  }
};

export function getCVTemplate(templateId = 'ats-basic') {
  return CV_TEMPLATES[templateId] || CV_TEMPLATES['ats-basic'];
}

