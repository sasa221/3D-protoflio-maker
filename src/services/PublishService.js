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

export async function verifyCustomDomainDNS(hostname, portfolioId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please sign in again.');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const connectResponse = await fetch('/api/portfolio?action=domain-connect', {
    method: 'POST', headers, body: JSON.stringify({ hostname, domain: hostname, portfolioId })
  });
  const connected = await connectResponse.json().catch(() => ({}));
  if (!connectResponse.ok) throw new Error(connected.error || 'Unable to connect domain.');

  const verifyResponse = await fetch('/api/portfolio?action=domain-verify', {
    method: 'POST', headers, body: JSON.stringify({ domain: hostname, portfolioId })
  });
  const verified = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok) throw new Error(verified.error || 'Unable to verify domain.');
  return { ...connected, ...verified, hostname: connected.domain, sslStatus: verified.sslStatus || 'not_provisioned' };
}
