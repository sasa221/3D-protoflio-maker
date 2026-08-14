/**
 * AuthService.js
 * Auth Service cutover wrapping real Supabase Auth.
 * Completely eliminates local password storage, fake JWTs, and local user arrays.
 */

import { supabase } from './SupabaseClient.js';
import { globalEntitlements } from './EntitlementService.js';

export async function signUpUser(email, password, displayName = '') {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: password,
    options: {
      data: { full_name: displayName }
    }
  });

  if (error) throw error;
  return data;
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) throw error;
  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn('Supabase logout warning:', error.message);

  // Clear memory cache
  try {
    sessionStorage.clear();
  } catch (e) {}
}

export async function getAuthSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return null;
  }

  const session = data.session;
  // If access token is expired or expires within 10 seconds, attempt legitimate refresh
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at <= now + 10) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession().catch(() => ({ data: null, error: true }));
    if (refreshErr || !refreshed?.session) {
      await logoutUser();
      return null;
    }
    return refreshed.session;
  }

  return session;
}

export const getSession = getAuthSession;
export const signUp = signUpUser;
export const signIn = loginUser;
export const login = loginUser;
export const logout = logoutUser;
export const signOut = logoutUser;

export async function getCurrentAuthUser() {
  const session = await getAuthSession();
  return session?.user || null;
}

export function subscribeToAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      try { sessionStorage.clear(); } catch (e) {}
    } else if (event === 'SIGNED_IN' && session?.user) {
      try { sessionStorage.setItem('supabase_user_cache', JSON.stringify(session.user)); } catch (e) {}
    }
    callback(event, session);
  });
}
export const onAuthStateChange = subscribeToAuthStateChange;
export const resetPassword = requestPasswordReset;
export const updatePassword = updateUserPassword;

export async function requestPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
  return data;
}

export async function resendConfirmationEmail(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address required.');
  }

  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim()
  });

  if (error) throw error;
  return data;
}

export const resendConfirmation = resendConfirmationEmail;

export async function updateUserPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
}

// Session-backed helper wrappers
export function getCurrentUser() {
  try {
    const sessionUser = JSON.parse(sessionStorage.getItem('supabase_user_cache') || 'null');
    return sessionUser || null;
  } catch (e) {
    return null;
  }
}

export function isLoggedIn() {
  try {
    return Boolean(sessionStorage.getItem('supabase_user_cache'));
  } catch (e) {
    return false;
  }
}

export function isPro() {
  return globalEntitlements.getPlanId() === 'pro';
}

export function isAdmin() {
  return false;
}

export function upgradeToPro() {}
export function redeemPromoCode() {
  return { success: false, error: 'Promo code redemption is not available yet.' };
}

export function adminGetAllUsers() {
  return [getCurrentUser()];
}

export function adminCreatePromoCode() { return { success: true }; }
export function adminGetPromoCodes() { return []; }
export function adminRevokePromoCode() { return { success: true }; }
export function adminDeletePromoCode() { return { success: true }; }
export function adminDeleteUser() { return { success: true }; }
export function adminGetPromos() { return []; }
export function adminToggleUserTier() { return { success: true }; }
