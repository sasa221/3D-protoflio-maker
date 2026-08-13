import { supabase } from './SupabaseClient.js';

/**
 * PortfolioVariantService.js
 * Manages Master Profile data, stable item IDs, variant configurations,
 * and the Variant Resolver (combining Master Profile + Variant Overrides).
 */

export function ensureStableIDs(masterProfile) {
  if (!masterProfile) return;

  const generateId = (prefix, idx) => `${prefix}_${idx + 1}_${Math.random().toString(36).substr(2, 5)}`;

  if (Array.isArray(masterProfile.projects)) {
    masterProfile.projects.forEach((p, idx) => {
      if (!p.id) p.id = generateId('proj', idx);
    });
  }

  if (Array.isArray(masterProfile.skills)) {
    masterProfile.skills.forEach((s, idx) => {
      if (!s.id) s.id = generateId('skill', idx);
    });
  }

  if (Array.isArray(masterProfile.experience)) {
    masterProfile.experience.forEach((e, idx) => {
      if (!e.id) e.id = generateId('exp', idx);
    });
  }

  if (Array.isArray(masterProfile.education)) {
    masterProfile.education.forEach((edu, idx) => {
      if (!edu.id) edu.id = generateId('edu', idx);
    });
  }

  if (Array.isArray(masterProfile.certs)) {
    masterProfile.certs.forEach((c, idx) => {
      if (!c.id) c.id = generateId('cert', idx);
    });
  }

  if (Array.isArray(masterProfile.volunteering)) {
    masterProfile.volunteering.forEach((v, idx) => {
      if (!v.id) v.id = generateId('vol', idx);
    });
  }
}

export function createDefaultVariant(masterProfile) {
  ensureStableIDs(masterProfile);

  return {
    id: 'var_default_general',
    name: 'General Portfolio',
    slug: 'general',
    targetRole: masterProfile.profession || 'Front-End Developer',
    targetCompany: '',
    targetIndustry: '',
    themeId: masterProfile.theme || 'code',
    headlineOverride: null,
    bioOverride: null,
    sectionOrder: ['hero', 'projects', 'skills', 'experience', 'education', 'certs', 'volunteering', 'contact'],
    projectOrder: (masterProfile.projects || []).map(p => p.id),
    skillOrder: (masterProfile.skills || []).map(s => s.id),
    hiddenSections: [],
    hiddenProjects: [],
    recruiterHighlights: [],
    introMode: masterProfile.introMode || 'short',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true
  };
}

export function resolvePortfolioVariant(masterProfile = {}, variantInput = null) {
  ensureStableIDs(masterProfile);

  const variants = masterProfile.portfolioVariants || [];
  let activeVariant = variantInput;

  if (!activeVariant) {
    activeVariant = variants.find(v => v.id === masterProfile.activeVariantId) ||
                    variants.find(v => v.isDefault) ||
                    createDefaultVariant(masterProfile);
  }

  // 1. Resolve Overrides (Headline, Bio, Theme)
  const profession = activeVariant.headlineOverride || masterProfile.profession || 'Front-End Developer';
  const bio = activeVariant.bioOverride || masterProfile.bio || '';
  const theme = activeVariant.themeId || masterProfile.theme || 'code';
  const introMode = activeVariant.introMode || masterProfile.introMode || 'short';

  // 2. Filter & Order Projects by Stable IDs
  const hiddenProjectIds = new Set(activeVariant.hiddenProjects || []);
  let rawProjects = (masterProfile.projects || []).filter(p => !hiddenProjectIds.has(p.id));

  let projects = [];
  if (Array.isArray(activeVariant.projectOrder) && activeVariant.projectOrder.length > 0) {
    const projectMap = new Map(rawProjects.map(p => [p.id, p]));
    activeVariant.projectOrder.forEach(id => {
      if (projectMap.has(id)) {
        projects.push(projectMap.get(id));
        projectMap.delete(id);
      }
    });
    // Append remaining projects
    projectMap.forEach(p => projects.push(p));
  } else {
    projects = rawProjects;
  }

  // 3. Order Skills by Stable IDs
  let rawSkills = masterProfile.skills || [];
  let skills = [];
  if (Array.isArray(activeVariant.skillOrder) && activeVariant.skillOrder.length > 0) {
    const skillMap = new Map(rawSkills.map(s => [s.id, s]));
    activeVariant.skillOrder.forEach(id => {
      if (skillMap.has(id)) {
        skills.push(skillMap.get(id));
        skillMap.delete(id);
      }
    });
    skillMap.forEach(s => skills.push(s));
  } else {
    skills = rawSkills;
  }

  // 4. Section Order & Section Visibility
  const hiddenSections = new Set(activeVariant.hiddenSections || []);
  let defaultSectionOrder = ['hero', 'projects', 'skills', 'experience', 'education', 'certs', 'volunteering', 'contact'];
  let sectionOrder = (activeVariant.sectionOrder || defaultSectionOrder).filter(sec => !hiddenSections.has(sec));

  return {
    ...masterProfile,
    name: masterProfile.name || 'Candidate',
    profession,
    tagline: profession,
    bio,
    theme,
    introMode,
    projects,
    skills,
    experience: masterProfile.experience || [],
    education: masterProfile.education || [],
    certs: masterProfile.certs || [],
    volunteering: masterProfile.volunteering || [],
    social: masterProfile.social || {},
    resume: masterProfile.resume || null,
    availability: masterProfile.availability || { status: 'open' },
    sectionOrder,
    activeVariant
  };
}

export function createNewVariant(masterProfile, options = {}) {
  ensureStableIDs(masterProfile);

  const {
    name = 'New Portfolio Version',
    targetRole = 'Front-End Developer',
    targetCompany = '',
    targetIndustry = '',
    strategy = 'optimize', // 'optimize' | 'copy_current' | 'blank'
    analysisResults = null
  } = options;

  const id = 'var_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'version';

  let projectOrder = (masterProfile.projects || []).map(p => p.id);
  let skillOrder = (masterProfile.skills || []).map(s => s.id);
  let sectionOrder = ['hero', 'projects', 'skills', 'experience', 'education', 'certs', 'volunteering', 'contact'];
  let themeId = masterProfile.theme || 'code';
  let recruiterHighlights = [];

  if (strategy === 'optimize' && analysisResults) {
    if (analysisResults.recommendedProjectOrder) {
      projectOrder = analysisResults.recommendedProjectOrder.map(p => p.id);
    }
    if (analysisResults.recommendedSkillOrder) {
      skillOrder = analysisResults.recommendedSkillOrder.map(s => s.id);
    }
    if (analysisResults.recommendedSectionOrder) {
      sectionOrder = analysisResults.recommendedSectionOrder;
    }
    if (analysisResults.recruiterHighlights) {
      recruiterHighlights = analysisResults.recruiterHighlights;
    }
  }

  const newVariant = {
    id,
    name,
    slug,
    targetRole,
    targetCompany,
    targetIndustry,
    themeId,
    headlineOverride: null,
    bioOverride: null,
    sectionOrder,
    projectOrder,
    skillOrder,
    hiddenSections: [],
    hiddenProjects: [],
    recruiterHighlights,
    introMode: 'short',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: false
  };

  if (!masterProfile.portfolioVariants) masterProfile.portfolioVariants = [];
  masterProfile.portfolioVariants.push(newVariant);
  masterProfile.activeVariantId = id;

  // Persist variant row to Supabase
  if (masterProfile.id) {
    supabase.from('portfolio_variants').insert([
      {
        id,
        portfolio_id: masterProfile.id,
        name: newVariant.name,
        slug: newVariant.slug,
        target_role: newVariant.targetRole,
        theme_id: newVariant.themeId,
        is_default: false,
        overrides_json: newVariant
      }
    ]).then(({ error }) => {
      if (error) console.warn('Supabase variant insert warning:', error.message);
    });
  }

  return newVariant;
}
