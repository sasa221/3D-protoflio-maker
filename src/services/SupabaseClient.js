/**
 * SupabaseClient.js
 * Canonical shared Supabase Client instance for the application.
 * Initialized strictly with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 * Never uses secret keys in frontend code.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://kupxhrfijkdlcteniqfp.supabase.co';
const supabasePublishableKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || 'sb_publishable_gILAHxBLwwDjMoNpfLUbLg_fFKiE0f5';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
