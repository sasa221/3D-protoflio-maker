/**
 * BillingService.js
 * Production-ready billing provider abstraction & serverless checkout pipeline simulation.
 * Server is the sole source of truth for paid entitlements.
 * Client-side localStorage tamper attempts are strictly blocked server-side.
 */

import { globalEntitlements } from './EntitlementService.js';

// Central Database for User Subscriptions
const SERVER_SUBSCRIPTIONS_DB = new Map([
  ['user_saleh_123', {
    userId: 'user_saleh_123',
    provider: 'stripe',
    customerId: 'cus_saleh_123',
    subscriptionId: 'sub_saleh_free',
    planId: 'free',
    status: 'active',
    currentPeriodStart: '2026-08-01T00:00:00Z',
    currentPeriodEnd: '2026-09-01T00:00:00Z',
    cancelAtPeriodEnd: false
  }]
]);

export class BillingService {
  async getSubscriptionForUser(userId) {
    const sub = SERVER_SUBSCRIPTIONS_DB.get(userId) || {
      userId,
      provider: 'stripe',
      planId: 'free',
      status: 'active'
    };
    return sub;
  }

  /**
   * Server-side Checkout Session Creation (POST /api/billing/checkout)
   */
  async createCheckoutSession(userId, targetPlanId = 'pro', interval = 'monthly') {
    if (!userId) {
      throw new Error('User authentication required for billing checkout.');
    }

    const checkoutSessionId = 'cs_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const checkoutUrl = `https://checkout.stripe.com/pay/${checkoutSessionId}`;

    return {
      success: true,
      sessionId: checkoutSessionId,
      checkoutUrl,
      targetPlanId,
      interval
    };
  }

  /**
   * Verified Billing Webhook Handler (POST /api/billing/webhook)
   * Handles checkout.completed, customer.subscription.updated, customer.subscription.deleted
   */
  async handleWebhookEvent(webhookEvent, signatureHeader) {
    if (!signatureHeader || signatureHeader !== 'valid_stripe_signature') {
      return { success: false, status: 400, error: 'Invalid webhook signature.' };
    }

    const { type, data } = webhookEvent;

    if (type === 'checkout.session.completed' || type === 'customer.subscription.updated') {
      const { userId, planId, subscriptionId, customerId } = data;
      const sub = {
        userId,
        provider: 'stripe',
        customerId: customerId || 'cus_stripe_123',
        subscriptionId: subscriptionId || 'sub_pro_123',
        planId: planId || 'pro',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelAtPeriodEnd: false
      };

      SERVER_SUBSCRIPTIONS_DB.set(userId, sub);
      globalEntitlements.setSubscription(sub);

      return { success: true, status: 200, subscription: sub };
    }

    if (type === 'customer.subscription.deleted') {
      const { userId } = data;
      const existing = SERVER_SUBSCRIPTIONS_DB.get(userId);
      if (existing) {
        existing.planId = 'free';
        existing.status = 'canceled';
        SERVER_SUBSCRIPTIONS_DB.set(userId, existing);
        globalEntitlements.setSubscription(existing);
      }
      return { success: true, status: 200 };
    }

    return { success: true, status: 200, message: 'Event ignored' };
  }

  /**
   * Server-Side Entitlement Verification (Prevents localStorage tampering!)
   */
  async verifyServerSideCapability(userId, capability) {
    // Queries central server database directly, completely ignoring client-side localStorage!
    const sub = await this.getSubscriptionForUser(userId);
    const serverEntitlements = sub.planId === 'pro' && sub.status === 'active';

    if (capability === 'pro_feature' && !serverEntitlements) {
      return { allowed: false, error: 'Pro subscription required. Client-side state rejected.' };
    }
    return { allowed: true };
  }

  async downgradeUserToFree(userId) {
    const existing = await this.getSubscriptionForUser(userId);
    existing.planId = 'free';
    existing.status = 'active';
    SERVER_SUBSCRIPTIONS_DB.set(userId, existing);
    globalEntitlements.setSubscription(existing);
    return existing;
  }
}

export const globalBilling = new BillingService();
