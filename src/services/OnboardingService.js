/**
 * OnboardingService.js
 * Central State Machine & Controller for V3.0.2 Guided Onboarding.
 * Persists onboarding state, handles CV & manual data initialization,
 * enforces idempotent Supabase database portfolio creation.
 */

import { getCurrentAuthUser } from './AuthService.js';
import { createPortfolio, saveDraft, publishPortfolio, loadUserPortfoliosFromSupabase } from './DBService.js';
import { ScopedStorageService } from './ScopedStorageService.js';

const STORAGE_KEY = 'portfolio_onboarding_state_v3';
const SESSION_KEY = 'portfolio_onboarding_session_v3';

export const INITIAL_ONBOARDING_STATE = {
  step: 1, // 1: Method, 2: Profile Review / Form, 3: Style, 4: Preview
  startingMethod: null, // 'cv' | 'manual'
  profileDraft: {
    name: '',
    profession: '',
    tagline: '',
    bio: '',
    location: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    social: { github: '', linkedin: '', email: '' }
  },
  selectedTheme: 'code',
  completed: false,
  portfolioId: null,
  publicSlug: ''
};

export class OnboardingService {
  constructor() {
    this.sessionId = this.getSessionId();
    this.state = this.loadState();
  }

  getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `obs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  freshState() {
    return JSON.parse(JSON.stringify(INITIAL_ONBOARDING_STATE));
  }

  isProfileValid(state) {
    return Boolean(state?.profileDraft?.name?.trim() && state?.profileDraft?.profession?.trim());
  }

  normalizeState(candidate) {
    const state = { ...this.freshState(), ...(candidate || {}) };
    state.profileDraft = { ...this.freshState().profileDraft, ...(candidate?.profileDraft || {}) };
    state.step = Number(state.step);
    if (![1, 2, 3].includes(state.step)) state.step = 1;
    if (!['cv', 'manual'].includes(state.startingMethod)) {
      state.startingMethod = null;
      state.step = 1;
    }
    if (state.step >= 2 && !this.isProfileValid(state)) state.step = 1;
    if (state.step === 3 && !state.selectedTheme) state.step = 2;
    return state;
  }

  loadState() {
    try {
      const stored = ScopedStorageService.getItem(STORAGE_KEY, this.state.ownerUserId);
      if (!stored) return this.freshState();
      if (!stored.ownerUserId && stored.sessionId !== this.sessionId) return this.freshState();
      return this.normalizeState(stored);
    } catch (e) {
      return this.freshState();
    }
  }

  async initializeForCurrentUser() {
    const user = await getCurrentAuthUser().catch(() => null);
    const userId = user && user.id !== 'usr_guest' ? user.id : null;
    if (this.state.ownerUserId && this.state.ownerUserId !== userId) this.state = this.freshState();
    if (!userId && this.state.sessionId !== this.sessionId) this.state = this.freshState();
    this.state = this.normalizeState(this.state);
    this.saveState({ ownerUserId: userId, sessionId: this.sessionId });
    return this.state;
  }

  saveState(partialState) {
    this.state = this.normalizeState({ ...this.state, ...partialState, sessionId: this.sessionId });
    try {
      ScopedStorageService.setItem(STORAGE_KEY, this.state, this.state.ownerUserId);
    } catch (e) {}
    return this.state;
  }

  resetState() {
    const prevUserId = this.state.ownerUserId;
    this.state = this.freshState();
    ScopedStorageService.removeItem(STORAGE_KEY, prevUserId);
    return this.state;
  }

  getState() {
    return this.state;
  }

  setStep(step) {
    return this.saveState({ step });
  }

  setStartingMethod(method) {
    return this.saveState({ startingMethod: method, step: 1 });
  }

  updateProfileDraft(data) {
    const updatedDraft = { ...this.state.profileDraft, ...data };
    return this.saveState({ profileDraft: updatedDraft });
  }

  setSelectedTheme(themeId) {
    return this.saveState({ selectedTheme: themeId });
  }

  /**
   * Idempotent portfolio persistence to Supabase
   */
  async saveFirstPortfolio() {
    const authUser = await getCurrentAuthUser();
    if (!authUser || authUser.id === 'usr_guest') {
      throw new Error('Please sign in or create an account to save and publish your portfolio.');
    }

    const draft = this.state.profileDraft;
    const theme = this.state.selectedTheme || 'code';
    const slug = (draft.name || 'portfolio').toLowerCase().trim().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

    // 1. Check existing portfolios to prevent duplicates
    const existing = await loadUserPortfoliosFromSupabase(authUser.id);
    if (existing && existing.id) {
      this.saveState({ portfolioId: existing.id, publicSlug: existing.slug, completed: true });
      await publishPortfolio(existing.master_profile_json || existing);
      return existing;
    }

    // 2. Create new portfolio row
    const masterProfile = {
      id: this.state.portfolioId || `pf_${Date.now()}`,
      name: draft.name || 'My Portfolio',
      profession: draft.profession || 'Developer',
      tagline: draft.tagline || '',
      bio: draft.bio || '',
      location: draft.location || '',
      theme: theme,
      skills: draft.skills || [],
      experience: draft.experience || [],
      projects: draft.projects || [],
      education: draft.education || [],
      social: draft.social || {},
      resume: draft.resume || null
    };

    const newPf = await createPortfolio({
      id: masterProfile.id,
      name: masterProfile.name,
      profession: masterProfile.profession,
      bio: masterProfile.bio,
      theme: theme,
      slug: slug,
      master_profile_json: masterProfile
    });

    if (!newPf || !newPf.id) {
      throw new Error('Database did not return a valid portfolio identifier.');
    }

    // 3. Create initial published snapshot
    await publishPortfolio(newPf.master_profile_json || masterProfile);

    this.saveState({
      portfolioId: newPf.id,
      publicSlug: newPf.slug || slug,
      completed: true
    });

    return newPf;
  }
}

export const onboardingController = new OnboardingService();
