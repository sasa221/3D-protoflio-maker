/**
 * UsageLimitService.js
 * Metered tracking service for portfolio counts, variants, HTML exports, and custom domains.
 * Evaluates current usage against globalEntitlements limits.
 */

import { globalEntitlements } from './EntitlementService.js';

export class UsageLimitService {
  canCreateVariant(currentVariantsCount) {
    const maxAllowed = globalEntitlements.getLimit('variants');
    if (maxAllowed === -1) return true;
    return currentVariantsCount < maxAllowed;
  }

  canCreatePortfolio(currentPortfoliosCount) {
    const maxAllowed = globalEntitlements.getLimit('portfolios');
    if (maxAllowed === -1) return true;
    return currentPortfoliosCount < maxAllowed;
  }

  canConnectCustomDomain(currentDomainsCount) {
    const maxAllowed = globalEntitlements.getLimit('customDomains');
    if (maxAllowed === -1) return true;
    return currentDomainsCount < maxAllowed;
  }

  getRemainingExports(currentExportsThisMonth) {
    const maxAllowed = globalEntitlements.getLimit('exportsPerMonth');
    if (maxAllowed === -1) return Infinity;
    return Math.max(0, maxAllowed - currentExportsThisMonth);
  }

  canExportHTML(currentExportsThisMonth) {
    return this.getRemainingExports(currentExportsThisMonth) > 0;
  }
}

export const globalUsageLimit = new UsageLimitService();
