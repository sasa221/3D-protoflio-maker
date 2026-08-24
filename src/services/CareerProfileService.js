/**
 * CareerProfileService
 * PR-1 local-first repository for the private Master Career Profile.
 * It intentionally uses a namespaced local store while Career Studio is gated.
 * Supabase persistence is introduced only after a separate local/dev project
 * is available and the migration has been applied there.
 */

import { ScopedStorageService } from './ScopedStorageService.js';

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
  const content = { ...clone(EMPTY_CAREER_CONTENT), ...(profile.content || {}) };
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
  return clone(normalized);
}

export function deleteCareerProfile(profileId, ownerUserId = 'local-dev-user') {
  const profiles = readProfiles(ownerUserId);
  const next = profiles.filter(profile => profile.id !== profileId);
  if (next.length === profiles.length) return false;
  writeProfiles(ownerUserId, next);
  return true;
}
