/**
 * PublishService.js
 * Unified publishing architecture & custom domain DNS verification.
 * Enforces renderer-level branding checks based on server-verified entitlements.
 */

import { globalEntitlements, CAPABILITIES } from './EntitlementService.js';
import { resolvePortfolioVariant } from './PortfolioVariantService.js';
import { supabase } from './SupabaseClient.js';

export function resolvePublishConfig(masterProfile, variant = null) {
  const resolved = resolvePortfolioVariant(masterProfile, variant);

  // Check branding entitlement
  const canRemoveBranding = globalEntitlements.can(CAPABILITIES.REMOVE_BRANDING);
  const showPlatformBranding = canRemoveBranding ? Boolean(masterProfile.showBranding ?? false) : true;

  // Check Custom Domain entitlement
  const canUseCustomDomain = globalEntitlements.can(CAPABILITIES.CUSTOM_DOMAIN);
  const customDomain = canUseCustomDomain ? masterProfile.customDomain || null : null;

  return {
    ...resolved,
    branding: {
      showPlatformBranding
    },
    customDomain
  };
}

async function domainRequest(action, hostname, portfolioId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please sign in again.');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const response = await fetch(`/api/portfolio?action=${action}`, {
    method: 'POST', headers, body: JSON.stringify({ hostname, domain: hostname, portfolioId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Unable to manage custom domain.');
    error.code = result.code;
    error.requiredEnvVars = result.requiredEnvVars;
    throw error;
  }
  return result;
}

export function connectCustomDomain(hostname, portfolioId) {
  return domainRequest('domain-connect', hostname, portfolioId);
}

export function verifyCustomDomainDNS(hostname, portfolioId) {
  return domainRequest('domain-verify', hostname, portfolioId);
}
