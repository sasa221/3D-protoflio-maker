/**
 * PublishService.js
 * Unified publishing architecture & custom domain DNS verification.
 * Enforces renderer-level branding checks based on server-verified entitlements.
 */

import { globalEntitlements, CAPABILITIES } from './EntitlementService.js';
import { resolvePortfolioVariant } from './PortfolioVariantService.js';

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

export function verifyCustomDomainDNS(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return { status: 'failed', error: 'Invalid hostname provided.' };
  }

  const cleanHost = hostname.trim().toLowerCase();
  const cnameTarget = 'cname.3dportfolio.app';

  // Simulates DNS lookup
  const isVerified = cleanHost.includes('.') && !cleanHost.includes(' ') && cleanHost.length > 4;

  if (isVerified) {
    return {
      status: 'active',
      hostname: cleanHost,
      cnameTarget,
      sslStatus: 'active',
      verifiedAt: new Date().toISOString()
    };
  }

  return {
    status: 'pending',
    hostname: cleanHost,
    cnameTarget,
    sslStatus: 'pending',
    instructions: `Add CNAME record pointing ${cleanHost} -> ${cnameTarget}`
  };
}
