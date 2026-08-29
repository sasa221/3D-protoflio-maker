// Lightweight pricing route entry. It deliberately avoids loading the Studio
// router (and therefore the 3D renderer/runtime) until a user navigates there.
import { getCurrentAuthUser, getCurrentPlanId } from './services/AuthService.js';
import { fetchUserProfileAndEntitlements } from './services/DBService.js';
import { globalEntitlements } from './services/EntitlementService.js';
import { renderPricingPage, getPricingStyles } from './ui/PricingPage.js';

const app = document.getElementById('app') || (() => {
  const node = document.createElement('div');
  node.id = 'app';
  document.body.appendChild(node);
  return node;
})();

let billingModulePromise;
let groupModulePromise;
const loadBilling = () => (billingModulePromise ||= import('./ui/BillingModal.js'));
const loadGroup = () => (groupModulePromise ||= import('./ui/GroupManagementModal.js'));

const user = await getCurrentAuthUser().catch(() => null);
if (user) await fetchUserProfileAndEntitlements(user).catch(() => null);

if (!document.getElementById('pricing-page-styles')) {
  const style = document.createElement('style');
  style.id = 'pricing-page-styles';
  style.textContent = getPricingStyles();
  document.head.appendChild(style);
}

const currentPlan = globalEntitlements.getEffectivePlanId() || getCurrentPlanId() || 'free';
const openGroup = async () => (await loadGroup()).openGroupManagementModal();
const openBilling = async (targetPlan) => (await loadBilling()).openBillingModal({ targetPlan });

renderPricingPage(app, {
  currentPlan,
  onSelectPlan: async (planId) => {
    if (planId === 'free') {
      window.location.href = '/start';
    } else if (planId === 'premium_group' && currentPlan === 'premium_group') {
      await openGroup();
    } else {
      await openBilling(planId);
    }
  }
});

const requestedPlan = new URLSearchParams(window.location.search).get('plan');
if (['pro', 'premium', 'premium_group'].includes(requestedPlan)) {
  queueMicrotask(() => requestedPlan === 'premium_group' && currentPlan === 'premium_group'
    ? openGroup()
    : openBilling(requestedPlan));
}
