/**
 * CareerProfileService
 * PR-1 local-first repository for the private Master Career Profile.
 * It intentionally uses a namespaced local store while Career Studio is gated.
 * Supabase persistence is introduced only after a separate local/dev project
 * is available and the migration has been applied there.
 */

import { ScopedStorageService } from './ScopedStorageService.js';
import { supabase } from './SupabaseClient.js';

export const CAREER_PROFILE_SCHEMA_VERSION = 1;
export const CAREER_PROFILE_STORAGE_KEY = 'career_studio_profiles_v1';

export const EMPTY_CAREER_CONTENT = Object.freeze({
  contact: { name: '', email: '', phone: '', location: '', github: '', linkedin: '', website: '' },
  summary: '',
  experience: [],
  education: [],
  projects: [],
  skills: [],
  certifications: [],
  languages: [],
  training: [],
  activities: []
});

const memoryStore = new Map();
const hydrationInFlight = new Map();
const pendingWrites = new Map();
const writeQueues = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ownerKey(ownerUserId) {
  return ownerUserId || 'local-dev-user';
}

function readProfiles(ownerUserId) {
  const raw = ScopedStorageService.getItem(CAREER_PROFILE_STORAGE_KEY, ownerKey(ownerUserId));
  const source = Array.isArray(raw) ? raw : (memoryStore.get(ownerKey(ownerUserId)) || []);
  return source.filter(profile => profile?.ownerUserId === ownerKey(ownerUserId));
}

function writeProfiles(ownerUserId, profiles) {
  ScopedStorageService.setItem(CAREER_PROFILE_STORAGE_KEY, profiles, ownerKey(ownerUserId));
  memoryStore.set(ownerKey(ownerUserId), clone(profiles));
}

function fromRow(row) {
  if (!row?.id || !row?.owner_user_id) return null;
  const normalized = normalizeCareerProfile({
    id: row.id,
    ownerUserId: row.owner_user_id,
    label: row.label,
    careerStage: row.career_stage,
    schemaVersion: CAREER_PROFILE_SCHEMA_VERSION,
    content: row.content_json || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }, row.owner_user_id);
  // Preserve server timestamps; normalizeCareerProfile refreshes timestamps
  // for client edits, but hydration must not make an old row look newer.
  normalized.createdAt = row.created_at || normalized.createdAt;
  normalized.updatedAt = row.updated_at || normalized.updatedAt;
  return normalized;
}

function toRow(profile) {
  return {
    id: profile.id,
    owner_user_id: profile.ownerUserId,
    label: profile.label,
    career_stage: profile.careerStage,
    content_json: profile.content,
    updated_at: profile.updatedAt,
    created_at: profile.createdAt
  };
}

function isBrowserUser(ownerUserId) {
  return typeof window !== 'undefined' && Boolean(ownerUserId) && ownerUserId !== 'local-dev-user';
}

async function hasAuthenticatedOwner(ownerUserId) {
  if (!isBrowserUser(ownerUserId)) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id === ownerUserId;
  } catch (_) {
    return false;
  }
}

/**
 * Supabase is authoritative for authenticated browser sessions. Local storage
 * is only a cache/offline draft and is never allowed to overwrite a successful
 * server hydration with an empty or older snapshot.
 */
export async function hydrateCareerProfiles(ownerUserId) {
  const owner = ownerKey(ownerUserId);
  if (!(await hasAuthenticatedOwner(owner))) return listCareerProfiles(owner);
  if (hydrationInFlight.has(owner)) return hydrationInFlight.get(owner);

  const promise = (async () => {
    const { data, error } = await supabase
      .from('career_profiles')
      .select('id,owner_user_id,label,career_stage,content_json,created_at,updated_at')
      .eq('owner_user_id', owner)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const serverProfiles = (data || []).map(fromRow).filter(Boolean);
    const pending = pendingWrites.get(owner);
    const merged = pending?.size
      ? [...serverProfiles.filter(item => !pending.has(item.id)), ...[...pending.values()]]
      : serverProfiles;
    writeProfiles(owner, merged);
    return merged.map(clone);
  })().finally(() => hydrationInFlight.delete(owner));
  hydrationInFlight.set(owner, promise);
  return promise;
}

export async function persistCareerProfile(profile, ownerUserId = profile?.ownerUserId) {
  const normalized = normalizeCareerProfile(profile, ownerUserId);
  const owner = normalized.ownerUserId;
  if (!(await hasAuthenticatedOwner(owner))) return normalized;
  const queueKey = `${owner}:${normalized.id}`;
  const previous = writeQueues.get(queueKey) || Promise.resolve();
  const task = previous.catch(() => null).then(async () => {
    if (!pendingWrites.has(owner)) pendingWrites.set(owner, new Map());
    pendingWrites.get(owner).set(normalized.id, normalized);
    const { error } = await supabase.from('career_profiles').upsert(toRow(normalized), { onConflict: 'id' });
    if (error) throw error;
    // Persist the base CV document as a private companion row. The profile JSON
    // remains the canonical content; the document row makes document recovery
    // explicit without storing a generated PDF or sending data elsewhere.
    const { error: documentError } = await supabase.from('career_documents').upsert({
      id: `cv_${normalized.id}`,
      career_profile_id: normalized.id,
      owner_user_id: owner,
      document_type: 'base_cv',
      title: normalized.label || 'My CV',
      template_id: 'ats-basic',
      content_override_json: normalized.content,
      status: 'draft',
      updated_at: normalized.updatedAt,
      created_at: normalized.createdAt
    }, { onConflict: 'id' });
    if (documentError) throw documentError;
    pendingWrites.get(owner).delete(normalized.id);
    return normalized;
  });
  const queued = task.finally(() => {
    if (writeQueues.get(queueKey) === queued) writeQueues.delete(queueKey);
  });
  writeQueues.set(queueKey, queued);
  return task;
}

export function createEmptyCareerProfile({ ownerUserId = 'local-dev-user', stage = 'professional', label = 'My Career Profile' } = {}) {
  if (!['student', 'professional'].includes(stage)) throw new Error('Career stage must be student or professional.');
  const now = new Date().toISOString();
  return {
    id: `cp_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ownerUserId: ownerKey(ownerUserId),
    label: String(label || 'My Career Profile').trim().slice(0, 80),
    careerStage: stage,
    schemaVersion: CAREER_PROFILE_SCHEMA_VERSION,
    content: clone(EMPTY_CAREER_CONTENT),
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeCareerProfile(profile, ownerUserId = profile?.ownerUserId) {
  if (!profile?.id) throw new Error('Career profile id is required.');
  const owner = ownerKey(ownerUserId);
  if (profile.ownerUserId !== owner) throw new Error('Career profile ownership mismatch.');
  const incoming = profile.content && typeof profile.content === 'object' ? profile.content : {};
  // Merge nested contact data as well as top-level sections. A shallow merge
  // leaves older rows with a partial contact object, which made the server
  // value visible in Preview/PDF but blank in the edit form after hydration.
  const content = {
    ...clone(EMPTY_CAREER_CONTENT),
    ...clone(incoming),
    contact: {
      ...clone(EMPTY_CAREER_CONTENT.contact),
      ...(incoming.contact && typeof incoming.contact === 'object' ? clone(incoming.contact) : {})
    }
  };
  for (const key of Object.keys(EMPTY_CAREER_CONTENT)) {
    if (Array.isArray(EMPTY_CAREER_CONTENT[key]) && !Array.isArray(content[key])) content[key] = [];
  }
  return { ...clone(profile), ownerUserId: owner, content, schemaVersion: CAREER_PROFILE_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
}

export function listCareerProfiles(ownerUserId = 'local-dev-user') {
  return readProfiles(ownerUserId).map(profile => clone(profile));
}

export function getCareerProfile(profileId, ownerUserId = 'local-dev-user') {
  return listCareerProfiles(ownerUserId).find(profile => profile.id === profileId) || null;
}

export function saveCareerProfile(profile, ownerUserId = profile?.ownerUserId) {
  const normalized = normalizeCareerProfile(profile, ownerUserId);
  const profiles = readProfiles(normalized.ownerUserId);
  const index = profiles.findIndex(item => item.id === normalized.id);
  if (index === -1) profiles.push(normalized);
  else profiles[index] = normalized;
  writeProfiles(normalized.ownerUserId, profiles);
  if (isBrowserUser(normalized.ownerUserId)) {
    // Keep the UI responsive while making the server write authoritative. The
    // caller can await persistCareerProfile when it needs an explicit result.
    persistCareerProfile(normalized, normalized.ownerUserId).catch(error => {
      console.warn('Career profile server save failed:', error.message);
    });
  }
  return clone(normalized);
}

export function deleteCareerProfile(profileId, ownerUserId = 'local-dev-user') {
  const profiles = readProfiles(ownerUserId);
  const next = profiles.filter(profile => profile.id !== profileId);
  if (next.length === profiles.length) return false;
  writeProfiles(ownerUserId, next);
  return true;
}
