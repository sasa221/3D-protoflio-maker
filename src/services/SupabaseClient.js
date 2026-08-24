/**
 * SupabaseClient.js
 * Canonical shared Supabase Client instance for the application.
 * Initialized strictly with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 * Never uses secret keys in frontend code.
 */

import { createClient } from '@supabase/supabase-js';
import { getSafeSupabaseConfig, assertNoBrowserSecretConfig } from '../config/RuntimeSafety.js';

assertNoBrowserSecretConfig();
const { url: supabaseUrl, publishableKey: supabasePublishableKey } = getSafeSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
