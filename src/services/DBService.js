/**
 * DBService.js
 * Database Service cutover wrapping real Supabase Postgres tables:
 * public.portfolios, public.portfolio_variants, public.subscriptions, public.profiles.
 * Supabase Postgres is the sole authoritative source of truth.
 * LocalStorage serves only as temporary offline safety cache.
 */

import { supabase } from './SupabaseClient.js';
import { globalEntitlements } from './EntitlementService.js';
import { isFeatureEnabled } from '../config/FeatureFlags.js';
import { ensureStableIDs, createDefaultVariant } from './PortfolioVariantService.js';
import { migrateLegacyBase64Assets } from './AssetStorageService.js';

let saveDebounceTimer = null;
let currentServerUpdatedAt = null;
const portfolioInitializationInFlight = new Map();

const EMPTY_PORTFOLIO_SOCIAL = Object.freeze({ github: '', linkedin: '', twitter: '', email: '', phone: '', website: '' });

export function normalizePortfolioMasterProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const storedSocial = source.social && typeof source.social === 'object' ? source.social : {};
  const social = { ...EMPTY_PORTFOLIO_SOCIAL, ...storedSocial };
  // A few legacy imports stored contact values at the root. Promote them only
  // when the canonical social field is empty; never overwrite an explicit
  // user choice or any visibility setting.
  if (!social.email && source.email) social.email = source.email;
  if (!social.phone && source.phone) social.phone = source.phone;
  return { ...source, social };
}

export async function fetchUserProfileAndEntitlements(user) {
  if (!user) return { profile: null, planId: 'free' };

  try {
    // 1. Fetch Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // 2. Fetch Subscription (Entitlement Source of Truth)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const planId = sub?.plan_id || 'free';

    // 3. Fetch Group Membership (if any)
    let groupMembership = null;
    try {
      const { data: gm } = await supabase
        .from('group_members')
        .select('group_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      groupMembership = gm;
    } catch (_) {}

    // Reconcile active group access with the server so an expired owner
    // subscription immediately falls back to Free on the next app load.
    if (groupMembership?.status === 'active') {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          const response = await fetch('/api/entitlements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
            body: JSON.stringify({})
          });
          const serverEntitlements = await response.json().catch(() => ({}));
          if (response.ok && serverEntitlements.effectivePlan === 'free') groupMembership = null;
        }
      } catch (_) {}
    }

    // 4. Fetch Keep It Live entitlements
    let keepLiveEntitlements = [];
    try {
      const { data: kl } = await supabase
        .from('keep_live_entitlements')
        .select('portfolio_id, status, starts_at, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active');
      keepLiveEntitlements = kl || [];
    } catch (_) {}

    // The API is the final entitlement authority. Direct table reads provide
    // the local fallback only when the local server adapter is unavailable;
    // a successful server response always wins over cached/UI state.
    let authoritativeSubscription = sub || { user_id: user.id, plan_id: 'free', status: 'active' };
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const entitlementResponse = await fetch('/api/entitlements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({})
        });
        const serverEntitlement = await entitlementResponse.json().catch(() => ({}));
        if (entitlementResponse.ok && serverEntitlement.effectivePlan) {
          authoritativeSubscription = {
            ...authoritativeSubscription,
            plan_id: serverEntitlement.effectivePlan,
            status: serverEntitlement.status || authoritativeSubscription.status || 'active'
          };
        }
      }
    } catch (_) {}

    globalEntitlements.setSubscription(authoritativeSubscription, groupMembership, keepLiveEntitlements);

    return { profile, planId: authoritativeSubscription.plan_id || planId, subscription: authoritativeSubscription, groupMembership, keepLiveEntitlements };
  } catch (e) {
    console.warn('Error loading Supabase profile/subscription:', e.message);
    return { profile: null, planId: 'free' };
  }
}

export async function loadUserPortfoliosFromSupabase(user) {
  if (!user) return null;

  try {
    // Query portfolios owned by user via RLS
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('owner_user_id', user.id);

    if (error) {
      console.warn('Supabase portfolio query warning:', error.message);
    }

    if (portfolios && portfolios.length > 0) {
      // 1. Existing portfolio found in Supabase
      const pRow = portfolios[0];
      currentServerUpdatedAt = pRow.updated_at;
      // Keep contact data in the legacy master JSON stable across reloads. A
      // few older rows have a partial `social` object, so normalize it before
      // the Studio binds inputs and before any autosave can run.
      let masterData = normalizePortfolioMasterProfile(pRow.master_profile_json);

      const defaultName = user.user_metadata?.full_name || user.user_metadata?.name || 'Your Portfolio';
      masterData.id = pRow.id;
      masterData.name = pRow.name || masterData.name || defaultName;
      masterData.slug = pRow.slug || 'portfolio';
      masterData.profession = pRow.profession || masterData.profession || '';
      masterData.bio = pRow.bio || masterData.bio || '';
      masterData.theme = pRow.theme || masterData.theme || 'code';
      masterData.owner_user_id = pRow.owner_user_id;
      // Publication state is authoritative at the row level. Never trust a stale
      // timestamp embedded in an older JSON snapshot.
      if (pRow.published_at) {
        masterData.publishedAt = pRow.published_at;
        masterData.published_at = pRow.published_at;
      } else {
        delete masterData.publishedAt;
        delete masterData.published_at;
        delete masterData.publicUrl;
      }

      ensureStableIDs(masterData);

      // Perform idempotent migration of legacy Base64 assets to Supabase Storage
      migrateLegacyBase64Assets(masterData, user.id).then(wasMigrated => {
        if (wasMigrated) {
          console.log('[Asset Storage] Legacy Base64 assets migrated to Supabase Storage!');
          savePortfolioDebounced(masterData);
        }
      });

      // Load variants from public.portfolio_variants
      const variants = await loadVariantsFromSupabase(pRow.id);
      if (variants && variants.length > 0) {
        masterData.portfolioVariants = variants;
        masterData.activeVariantId = pRow.default_variant_id || variants[0].id;
      }

      return masterData;
    } else {
      // 2. No portfolio exists -> Initialize initial Master Portfolio in Supabase
      if (portfolioInitializationInFlight.has(user.id)) return portfolioInitializationInFlight.get(user.id);
      const initialization = createInitialSupabasePortfolio(user).finally(() => portfolioInitializationInFlight.delete(user.id));
      portfolioInitializationInFlight.set(user.id, initialization);
      return await initialization;
    }
  } catch (e) {
    console.error('Error fetching Supabase portfolios:', e);
    return null;
  }
}

import { ScopedStorageService } from './ScopedStorageService.js';

export async function createInitialSupabasePortfolio(user) {
  const portfolioId = 'pf_' + Date.now();
  const slug = 'user-' + user.id.substr(0, 8);
  const defaultName = user.user_metadata?.full_name || user.user_metadata?.name || 'Your Portfolio';

  const initialMaster = {
    id: portfolioId,
    owner_user_id: user.id,
    name: defaultName,
    profession: '',
    bio: '',
    theme: 'code',
    education: [],
    experience: [],
    projects: [],
    skills: [],
    social: { github: '', linkedin: '', twitter: '', email: user.email || '', website: '' }
  };

  ensureStableIDs(initialMaster);

  // Variant ids are scoped to a portfolio. The old global
  // `var_default_general` id caused a duplicate-key failure when a second
  // account initialized its first Portfolio.
  const defaultVariant = { ...createDefaultVariant(initialMaster), id: `var_${portfolioId}_default` };
  initialMaster.portfolioVariants = [defaultVariant];
  initialMaster.activeVariantId = defaultVariant.id;

  // Insert Portfolio into Supabase
  const { error: pErr } = await supabase
    .from('portfolios')
    .upsert([
      {
        id: portfolioId,
        owner_user_id: user.id,
        name: initialMaster.name,
        slug: slug,
        profession: initialMaster.profession,
        bio: initialMaster.bio,
        theme: initialMaster.theme,
        master_profile_json: initialMaster,
        default_variant_id: defaultVariant.id,
        updated_at: new Date().toISOString()
      }
    ], { onConflict: 'id' });

  if (pErr) throw new Error('Failed to initialize portfolio in database: ' + pErr.message);

  // Insert Default Variant into public.portfolio_variants
  const { error: vErr } = await supabase
    .from('portfolio_variants')
    .insert([
      {
        id: defaultVariant.id,
        portfolio_id: portfolioId,
        name: defaultVariant.name,
        slug: defaultVariant.slug,
        target_role: defaultVariant.targetRole,
        theme_id: defaultVariant.themeId,
        is_default: true,
        overrides_json: defaultVariant
      }
    ]);

  if (vErr) throw new Error('Failed to initialize portfolio variant: ' + vErr.message);

  return initialMaster;
}

export async function loadVariantsFromSupabase(portfolioId) {
  try {
    const { data: rows, error } = await supabase
      .from('portfolio_variants')
      .select('*')
      .eq('portfolio_id', portfolioId);

    if (error || !rows) return [];

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      targetRole: r.target_role,
      themeId: r.theme_id,
      isDefault: r.is_default,
      ...(r.overrides_json || {})
    }));
  } catch (e) {
    return [];
  }
}

export function savePortfolioDebounced(masterProfile, onStatusChange) {
  if (!masterProfile || !masterProfile.id) return;

  // 1. Instant local offline draft update (User Scoped Resilience Layer)
  try {
    const currentUserId = masterProfile.owner_user_id || null;
    ScopedStorageService.setItem(`draft_${masterProfile.id}`, masterProfile, currentUserId);
  } catch (e) {}

  if (onStatusChange) onStatusChange('Saving...');

  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

  saveDebounceTimer = setTimeout(async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        if (onStatusChange) onStatusChange('Offline — Saved Locally');
        return;
      }

      const updatedAt = new Date().toISOString();

      const row = {
        id: masterProfile.id,
        owner_user_id: user.data.user.id,
        slug: masterProfile.slug || ('user-' + user.data.user.id.substr(0, 8)),
        name: masterProfile.name,
        profession: masterProfile.profession,
        bio: masterProfile.bio,
        theme: masterProfile.theme,
        master_profile_json: masterProfile,
        default_variant_id: masterProfile.activeVariantId,
        updated_at: updatedAt
      };

      // Verify ownership before an upsert. This removes the old update-only
      // no-op path for a missing row while keeping cross-account writes denied.
      const { data: existing, error: ownershipError } = await supabase
        .from('portfolios')
        .select('id,owner_user_id')
        .eq('id', masterProfile.id)
        .maybeSingle();
      if (ownershipError) throw ownershipError;
      if (existing && existing.owner_user_id !== user.data.user.id) throw new Error('Portfolio ownership mismatch.');

      const { error } = await supabase
        .from('portfolios')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase autosave error:', error.message);
        if (onStatusChange) onStatusChange('Save Failed — Saved Locally');
      } else {
        currentServerUpdatedAt = updatedAt;
        // Clear user-scoped local draft cache on successful Supabase persistence
        ScopedStorageService.removeItem(`draft_${masterProfile.id}`, user.data.user.id);
        if (onStatusChange) onStatusChange('Saved');
      }
    } catch (e) {
      if (onStatusChange) onStatusChange('Offline — Saved Locally');
    }
  }, 1500);
}

// Backward compatibility helper wrappers for existing UI forms
export function getCurrentDraft() {
  return null;
}
export function saveDraft(data) {
  savePortfolioDebounced(data);
}
export async function incrementStat() {}
export function encodePortfolioToURL(p) {
  return window.location.origin + '/#' + btoa(JSON.stringify(p));
}
export function getAnalytics() {
  return { total_portfolios: 1, total_exports: 0, total_shares: 0, tier_breakdown: { pro: 0 } };
}
export async function createPortfolio(data = {}) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user || !user.id) {
    throw new Error('User must be authenticated to create a portfolio.');
  }

  const portfolioId = data.id || ('pf_' + Date.now());
  const slug = data.slug || ('user-' + user.id.substr(0, 8));
  const masterJson = normalizePortfolioMasterProfile(data.master_profile_json || data);
  masterJson.id = portfolioId;

  const row = {
    id: portfolioId,
    owner_user_id: user.id,
    name: data.name || masterJson.name || 'My Portfolio',
    profession: data.profession || masterJson.profession || 'Developer',
    bio: data.bio || masterJson.bio || '',
    theme: data.theme || masterJson.theme || 'code',
    slug: slug,
    master_profile_json: masterJson,
    default_variant_id: masterJson.activeVariantId || 'var_default',
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: lookupError } = await supabase
    .from('portfolios')
    .select('id,owner_user_id')
    .eq('id', portfolioId)
    .maybeSingle();
  if (lookupError) throw new Error('Failed to check portfolio ownership: ' + lookupError.message);
  if (existing && existing.owner_user_id !== user.id) throw new Error('Portfolio ownership mismatch.');

  // Upsert is intentional here: the Studio initializes a draft before the
  // first Save Draft click, so inserting the same id again created a noisy
  // duplicate-key warning. Ownership is checked above and RLS remains active.
  const { data: saved, error } = await supabase
    .from('portfolios')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw new Error('Failed to save portfolio in database: ' + error.message);

  if (existing) return saved || row;

  // Record portfolio creation in history for entitlement tracking
  try {
    await supabase.from('portfolio_creation_history').insert([{
      user_id: user.id,
      portfolio_id: portfolioId,
      action: 'create'
    }]);
  } catch (_) {}

  return saved || row;
}
export function getAllPortfolios() {
  return [];
}

export async function publishPortfolio(masterProfile) {
  if (!masterProfile || !masterProfile.id) return { success: false, error: 'No portfolio provided.' };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return { success: false, error: 'Please sign in again before publishing.' };

    const slug = masterProfile.slug || ('user-' + masterProfile.owner_user_id?.substr(0, 8));
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        portfolioId: masterProfile.id,
        slug,
        masterProfile
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Publishing failed.' };
    }

    if (result.portfolio?.master_profile_json) {
      Object.assign(masterProfile, result.portfolio.master_profile_json);
    }
    masterProfile.publishedAt = result.publishedAt;
    masterProfile.published_at = result.publishedAt;
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function consumeExportAllowance(masterProfile) {
  if (!masterProfile?.id) return { success: false, error: 'No portfolio provided.' };
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) return { success: false, error: 'Please sign in again before exporting.' };
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        action: 'consume_export',
        portfolioId: masterProfile.id,
        slug: masterProfile.slug || `user-${masterProfile.owner_user_id?.slice(0, 8) || 'portfolio'}`
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return { success: false, error: result.error || 'Export limit check failed.' };
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}
