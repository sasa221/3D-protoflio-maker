import { supabase } from './SupabaseClient.js';

const SENSITIVE_FIELDS = new Set(['location', 'social.email', 'social.phone', 'social.linkedin', 'social.github']);

export const CV_PORTFOLIO_SYNC_FIELDS = [
  { id: 'name', label: 'Name', target: 'Portfolio name' },
  { id: 'bio', label: 'Summary', target: 'Portfolio bio' },
  { id: 'location', label: 'Location', target: 'Portfolio location', sensitive: true },
  { id: 'social.email', label: 'Email', target: 'Contact email', sensitive: true },
  { id: 'social.phone', label: 'Phone', target: 'Contact phone', sensitive: true },
  { id: 'social.linkedin', label: 'LinkedIn', target: 'Social link', sensitive: true },
  { id: 'social.github', label: 'GitHub', target: 'Social link', sensitive: true },
  { id: 'skills', label: 'Skills', target: 'Portfolio skills', list: true },
  { id: 'education', label: 'Education', target: 'Education entries', list: true },
  { id: 'experience', label: 'Experience / training', target: 'Experience entries', list: true },
  { id: 'projects', label: 'Projects', target: 'Project entries', list: true }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(item => (typeof item === 'string' ? text(item) : clone(item))).filter(item => typeof item === 'string' ? item : item && Object.values(item).some(Boolean)) : [];
}

function cvTextItems(items) {
  return list(items).map(item => typeof item === 'string' ? { description: item } : { description: text(item.text || item.description || item.name || item.title) }).filter(item => item.description);
}

function cvSkills(items) {
  return list(items).map(item => {
    const name = text(typeof item === 'string' ? item : item?.name || item?.text);
    return name ? { name } : null;
  }).filter(Boolean);
}

function getSourceValue(profile, id) {
  const content = profile?.content || {};
  const contact = content.contact || {};
  const values = {
    name: text(contact.name),
    bio: text(content.summary),
    location: text(contact.location),
    'social.email': text(contact.email),
    'social.phone': text(contact.phone),
    'social.linkedin': text(contact.linkedin),
    'social.github': text(contact.github),
    skills: cvSkills(content.skills),
    education: cvTextItems(content.education),
    experience: cvTextItems(content.experience || content.training),
    projects: cvTextItems(content.projects)
  };
  return values[id] ?? '';
}

function getTargetValue(portfolio, id) {
  const social = portfolio?.social || {};
  const values = {
    name: text(portfolio?.name),
    bio: text(portfolio?.bio),
    location: text(portfolio?.location),
    'social.email': text(social.email),
    'social.phone': text(social.phone),
    'social.linkedin': text(social.linkedin),
    'social.github': text(social.github),
    skills: list(portfolio?.skills),
    education: list(portfolio?.education),
    experience: list(portfolio?.experience),
    projects: list(portfolio?.projects)
  };
  return values[id] ?? '';
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildPortfolioSyncReview({ careerProfile, portfolio }) {
  if (!careerProfile?.ownerUserId && !careerProfile?.owner_user_id) throw new Error('Career profile ownership is required.');
  if (!portfolio?.owner_user_id && !portfolio?.ownerUserId) throw new Error('Portfolio ownership is required.');
  return CV_PORTFOLIO_SYNC_FIELDS.map(field => {
    const sourceValue = getSourceValue(careerProfile, field.id);
    const targetValue = getTargetValue(portfolio, field.id);
    const status = !hasValue(sourceValue) ? 'empty' : sameValue(sourceValue, targetValue) ? 'unchanged' : hasValue(targetValue) ? 'change' : 'add';
    return { ...field, sourceValue, targetValue, status, defaultSelected: false, sensitive: Boolean(field.sensitive || SENSITIVE_FIELDS.has(field.id)) };
  });
}

function itemKey(item) {
  if (typeof item === 'string') return item.toLowerCase();
  return text(item?.id || item?.name || item?.role || item?.degree || item?.description).toLowerCase();
}

function mergeList(existing, incoming) {
  const output = list(existing);
  const keys = new Set(output.map(itemKey).filter(Boolean));
  for (const item of list(incoming)) {
    const key = itemKey(item);
    if (!key || !keys.has(key)) {
      output.push(clone(item));
      if (key) keys.add(key);
    }
  }
  return output;
}

export function applySelectedPortfolioSync({ careerProfile, portfolio, selectedFields = [], overwriteExisting = false, confirmSensitive = false, ownerUserId }) {
  const profileOwner = careerProfile?.ownerUserId || careerProfile?.owner_user_id;
  const portfolioOwner = portfolio?.owner_user_id || portfolio?.ownerUserId;
  if (!ownerUserId || profileOwner !== ownerUserId || portfolioOwner !== ownerUserId) throw new Error('Career profile and portfolio must belong to the signed-in user.');
  const selected = new Set(selectedFields);
  const review = buildPortfolioSyncReview({ careerProfile, portfolio });
  const next = clone(portfolio);
  next.social = { ...(next.social || {}) };
  const changedFields = [];
  const skippedFields = [];

  for (const field of review) {
    if (!selected.has(field.id) || field.status === 'empty' || field.status === 'unchanged') continue;
    if (field.sensitive && !confirmSensitive) throw new Error('Sensitive CV fields require explicit confirmation.');
    const sourceValue = clone(field.sourceValue);
    if (field.list) {
      const merged = mergeList(field.targetValue, sourceValue);
      if (!sameValue(merged, field.targetValue)) {
        next[field.id] = merged;
        changedFields.push(field.id);
      }
      continue;
    }
    if (hasValue(field.targetValue) && !overwriteExisting) {
      skippedFields.push(field.id);
      continue;
    }
    if (field.id.startsWith('social.')) next.social[field.id.slice(7)] = sourceValue;
    else next[field.id] = sourceValue;
    changedFields.push(field.id);
  }
  next.owner_user_id = portfolioOwner;
  return { portfolio: next, changedFields, skippedFields, review };
}

export async function persistPortfolioSync(portfolio, ownerUserId) {
  if (!portfolio?.id || !ownerUserId || portfolio.owner_user_id !== ownerUserId) throw new Error('Portfolio ownership could not be verified.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData?.user?.id !== ownerUserId) throw new Error('Portfolio ownership could not be verified for this session.');
  const payload = {
    name: portfolio.name || '',
    profession: portfolio.profession || '',
    bio: portfolio.bio || '',
    theme: portfolio.theme || 'code',
    master_profile_json: portfolio,
    default_variant_id: portfolio.activeVariantId || portfolio.default_variant_id || null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('portfolios').update(payload).eq('id', portfolio.id).eq('owner_user_id', ownerUserId).select().single();
  if (error) throw new Error('Portfolio sync was not saved. No ownership-authorized row was updated.');
  return data;
}

export function getSyncFieldValueForDisplay(value) {
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.name || item?.role || item?.degree || item?.description || '').filter(Boolean).join(' · ');
  return text(value);
}
