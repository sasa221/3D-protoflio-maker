import { createClient } from '@supabase/supabase-js';
import { sendBrevoEmail } from '../src/services/BrevoDispatcher.js';
import { generateGroupInvitationEmail, generateGroupMemberActivatedEmail, generateGroupMemberJoinedEmail } from '../src/services/EmailTemplates.js';

// Feature flags helper
function isServerFeatureEnabled(flagName) {
  const val = process.env[`FF_${flagName}`];
  return val === 'true' || val === '1';
}

const THEME_TIERS = {
  code: 'free', creative: 'free', minimal: 'free',
  hacker: 'pro', data: 'pro', blueprint: 'pro', media: 'pro', health: 'pro', marketing: 'pro', education: 'pro',
  cosmic: 'premium', finance: 'premium', legal: 'premium', obsidian: 'premium', quantum: 'premium'
};
const TIER_HIERARCHY = ['free', 'pro', 'premium'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.query.route || 'check';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kupxhrfijkdlcteniqfp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ─────────────────────────────────────────────────────────────
  // 1. ACTION: CHECK (Entitlement Check)
  // ─────────────────────────────────────────────────────────────
  if (action === 'check') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized — Auth token required' });

    const token = authHeader.replace('Bearer ', '');
    if (!supabaseAnonKey || !supabaseServiceKey) return res.status(503).json({ error: 'Entitlement service is not configured' });

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return res.status(401).json({ error: 'Unauthorized user session' });

      const userId = userData.user.id;
      const { action: checkAction, themeId, portfolioId, targetRole } = req.body || {};

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: sub } = await adminClient.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
      const plan = sub?.plan_id || 'free';
      const status = sub?.status || 'active';
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const now = new Date();

      let effectivePlan = plan;
      if (status !== 'active' && status !== 'grace' && status !== 'canceling') {
        effectivePlan = 'free';
      } else if (plan !== 'free' && periodEnd && !isNaN(periodEnd.getTime()) && periodEnd.getTime() <= now.getTime()) {
        effectivePlan = 'free';
      }

      // Check group membership
      if (effectivePlan === 'free') {
        const { data: groupMember } = await adminClient.from('group_members').select('*, groups(*)').eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (groupMember && groupMember.groups?.status === 'active') {
          const { data: ownerSub } = await adminClient.from('subscriptions').select('status,current_period_end').eq('user_id', groupMember.groups.owner_user_id).maybeSingle();
          const ownerActive = ['active', 'grace', 'canceling'].includes(ownerSub?.status || '') && (!ownerSub?.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (ownerActive) effectivePlan = 'premium';
        }
      }

      // Action: use_theme
      if (checkAction === 'use_theme') {
        if (!isServerFeatureEnabled('THEME_PAYWALL_ENABLED')) return res.status(200).json({ allowed: true, enforcement: 'disabled' });
        if (!themeId) return res.status(400).json({ error: 'Missing themeId' });

        const planTier = effectivePlan === 'pro' ? 'pro' : effectivePlan === 'premium' || effectivePlan === 'premium_group' ? 'premium' : 'free';
        const requiredTier = THEME_TIERS[themeId] || 'free';
        const allowed = TIER_HIERARCHY.indexOf(planTier) >= TIER_HIERARCHY.indexOf(requiredTier);

        if (!allowed) {
          await adminClient.from('entitlement_audit_log').insert({ user_id: userId, action: 'use_theme', result: 'denied', reason: `Theme ${themeId} requires ${requiredTier}, user has ${planTier}`, metadata: { themeId, requiredTier, userTier: planTier } });
          return res.status(403).json({ allowed: false, error: `Theme requires ${requiredTier.toUpperCase()} plan.`, requiredTier, userTier: planTier });
        }
        return res.status(200).json({ allowed: true, themeId, tier: requiredTier });
      }

      // Action: create_portfolio
      if (checkAction === 'create_portfolio') {
        if (!isServerFeatureEnabled('ENTITLEMENT_ENFORCEMENT_ENABLED')) return res.status(200).json({ allowed: true, enforcement: 'disabled' });

        if (effectivePlan === 'free') {
          const { count } = await adminClient.from('portfolio_creation_history').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count || 0) >= 1) {
            await adminClient.from('entitlement_audit_log').insert({ user_id: userId, action: 'create_portfolio', result: 'denied', reason: 'Free plan lifetime limit reached', metadata: { count } });
            return res.status(403).json({ allowed: false, error: 'Free plan is limited to one portfolio lifetime.', code: 'FREE_LIMIT_REACHED' });
          }
          return res.status(200).json({ allowed: true, remainingLifetimeSlots: 1 - (count || 0) });
        }

        if (effectivePlan === 'pro') {
          const { count } = await adminClient.from('portfolio_creation_history').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count || 0) >= 1) {
            return res.status(403).json({ allowed: false, error: 'Pro plan includes one persistent portfolio slot. Please edit or reset your existing portfolio.', code: 'PRO_SLOT_EXISTS' });
          }
          return res.status(200).json({ allowed: true, policy: 'one_persistent_slot' });
        }

        if (effectivePlan === 'premium' || effectivePlan === 'premium_group') {
          const { data: latest } = await adminClient.from('portfolio_creation_history').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (latest) {
            const cooldownMs = 7 * 24 * 60 * 60 * 1000;
            const nextSlot = new Date(new Date(latest.created_at).getTime() + cooldownMs);
            if (Date.now() < nextSlot.getTime()) {
              const remainingHours = Math.ceil((nextSlot.getTime() - Date.now()) / (1000 * 60 * 60));
              return res.status(403).json({ allowed: false, error: `Cooldown active: next portfolio slot available in ${remainingHours} hours.`, nextAvailableAt: nextSlot.toISOString(), remainingHours, code: 'COOLDOWN_ACTIVE' });
            }
          }
          return res.status(200).json({ allowed: true, policy: 'rolling_cooldown' });
        }
      }

      // Action: edit_portfolio
      if (checkAction === 'edit_portfolio') {
        if (!portfolioId) return res.status(400).json({ error: 'Missing portfolioId' });
        const { data: pf } = await adminClient.from('portfolios').select('is_finalized, owner_user_id').eq('id', portfolioId).maybeSingle();
        if (!pf || pf.owner_user_id !== userId) return res.status(403).json({ error: 'Not authorized for this portfolio' });

        if (isServerFeatureEnabled('FREE_FINALIZATION_LOCK_ENABLED') && effectivePlan === 'free' && pf.is_finalized) {
          return res.status(403).json({ allowed: false, error: 'This Free portfolio has been finalized and cannot be edited. Upgrade to Pro to unlock continuous editing.', code: 'FINALIZED_LOCKED' });
        }
        return res.status(200).json({ allowed: true });
      }

      // Default: general capability check
      return res.status(200).json({ allowed: true, effectivePlan, status });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTION: COOLDOWN (Premium Cooldown Check)
  // ─────────────────────────────────────────────────────────────
  if (action === 'cooldown') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: latest } = await adminClient.from('portfolio_creation_history').select('created_at').eq('user_id', userData.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      const serverNow = new Date().toISOString();
      if (!latest) {
        return res.status(200).json({ canCreate: true, serverTime: serverNow, lastCreatedAt: null, nextAvailableAt: null, remainingHours: 0 });
      }

      const cooldownMs = 7 * 24 * 60 * 60 * 1000;
      const nextTime = new Date(new Date(latest.created_at).getTime() + cooldownMs);
      const canCreate = Date.now() >= nextTime.getTime();
      const remainingHours = canCreate ? 0 : Math.ceil((nextTime.getTime() - Date.now()) / (1000 * 60 * 60));

      return res.status(200).json({ canCreate, serverTime: serverNow, lastCreatedAt: latest.created_at, nextAvailableAt: nextTime.toISOString(), remainingHours });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ACTION: GROUP-MANAGE (Premium Groups Management)
  // ─────────────────────────────────────────────────────────────
  if (action === 'group-manage' || action === 'groups') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });
      const userId = userData.user.id;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      if (req.method === 'GET') {
        let { data: group, error: groupErr } = await adminClient.from('groups').select('*').eq('owner_user_id', userId).maybeSingle();
        if (groupErr) return res.status(500).json({ error: groupErr.message });
        // Self-heal accounts upgraded to Premium Group before their group row
        // existed, so the Studio GROUP control always has an actionable team.
        if (!group) {
          const { data: ownerSub } = await adminClient.from('subscriptions').select('plan_id,status,current_period_end,metadata').eq('user_id', userId).maybeSingle();
          const ownerActive = ownerSub?.plan_id === 'premium_group'
            && ['active', 'grace', 'canceling'].includes(ownerSub.status || '')
            && (!ownerSub.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (ownerActive) {
            const metadataSeats = Number(ownerSub.metadata?.seat_count || ownerSub.metadata?.group_seats || ownerSub.metadata?.seatCount);
            const seatLimit = Number.isFinite(metadataSeats) && metadataSeats >= 2 && metadataSeats <= 5 ? metadataSeats : 2;
            const { data: createdGroup, error: createGroupErr } = await adminClient.from('groups').insert([{
              owner_user_id: userId,
              seat_limit: seatLimit,
              plan_type: 'premium_group',
              status: 'active'
            }]).select('*').maybeSingle();
            if (!createGroupErr) {
              group = createdGroup;
            } else if (createGroupErr.code === '23505') {
              group = (await adminClient.from('groups').select('*').eq('owner_user_id', userId).maybeSingle()).data;
            } else {
              return res.status(500).json({ error: createGroupErr.message });
            }
          }
        }
        if (group) {
          const { data: ownerSub } = await adminClient.from('subscriptions').select('plan_id,status,current_period_end').eq('user_id', userId).maybeSingle();
          const groupActive = ownerSub?.plan_id === 'premium_group' && ['active', 'grace', 'canceling'].includes(ownerSub.status || '') && (!ownerSub.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (!groupActive) return res.status(200).json({ group, groupExpired: true, members: [], pendingInvitations: [], subscription: ownerSub ? { status: ownerSub.status, current_period_end: ownerSub.current_period_end || null } : null, owner: { id: userId, email: userData.user.email || '' } });
        }
        if (!group) {
          const { data: pendingInvitations } = await adminClient
            .from('group_members')
            .select('id,group_id,role,status,invited_at,groups(id,seat_limit,status,owner_user_id)')
            .eq('user_id', userId)
            .eq('status', 'pending');
          const { data: membership } = await adminClient.from('group_members').select('id,group_id,role,status,joined_at,groups(id,seat_limit,status,owner_user_id)').eq('user_id', userId).eq('status', 'active').maybeSingle();
          let membershipOwner = null;
          let membershipSubscription = null;
          const membershipGroup = Array.isArray(membership?.groups) ? membership.groups[0] : membership?.groups;
          if (membershipGroup?.owner_user_id) {
            membershipOwner = (await adminClient.from('profiles').select('email,display_name').eq('id', membershipGroup.owner_user_id).maybeSingle()).data || null;
            membershipSubscription = (await adminClient.from('subscriptions').select('status,current_period_end').eq('user_id', membershipGroup.owner_user_id).maybeSingle()).data || null;
          }
          return res.status(200).json({ group: null, members: [], membership: membership || null, membershipGroup: membershipGroup || null, membershipOwner, membershipSubscription, pendingInvitations: pendingInvitations || [], owner: { id: userId, email: userData.user.email || '' } });
        }
        const { data: members, error: membersErr } = await adminClient.from('group_members').select('*').eq('group_id', group.id).order('invited_at', { ascending: true });
        if (membersErr) return res.status(500).json({ error: membersErr.message });
        const memberIds = (members || []).map(member => member.user_id).filter(Boolean);
        const { data: profiles } = memberIds.length
          ? await adminClient.from('profiles').select('id,email,display_name').in('id', memberIds)
          : { data: [] };
        const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
        const { data: ownerSub } = await adminClient.from('subscriptions').select('status,current_period_end').eq('user_id', userId).maybeSingle();
        return res.status(200).json({
          group,
          owner: { id: userId, email: userData.user.email || '' },
          members: (members || []).map(member => ({ ...member, profile: profileById.get(member.user_id) || null })),
          subscription: ownerSub || null
        });
      }

      if (req.method === 'POST') {
        const { subAction, memberEmail, groupId } = req.body || {};
        if (subAction === 'invite_member') {
          if (!memberEmail) return res.status(400).json({ error: 'memberEmail required' });
          const cleanEmail = memberEmail.trim().toLowerCase();
          const { data: targetProfile } = await adminClient.from('profiles').select('id,email,display_name').eq('email', cleanEmail).maybeSingle();
          if (!targetProfile) return res.status(404).json({ error: 'User with this email was not found' });
          if (targetProfile.id === userId) return res.status(400).json({ error: 'The group owner cannot be invited as a member.' });

          const { data: group } = await adminClient.from('groups').select('*, group_members(*)').eq('owner_user_id', userId).maybeSingle();
          if (!group) return res.status(404).json({ error: 'You do not own an active Premium Group' });
          if (group.status !== 'active') return res.status(400).json({ error: 'This Premium Group is not active.' });
          const { data: ownerSub } = await adminClient.from('subscriptions').select('plan_id,status,current_period_end').eq('user_id', userId).maybeSingle();
          const ownerActive = ownerSub?.plan_id === 'premium_group' && ['active', 'grace', 'canceling'].includes(ownerSub.status || '') && (!ownerSub.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (!ownerActive) return res.status(403).json({ error: 'Your Premium Group subscription is inactive or expired.' });
          const existingMember = (group.group_members || []).find(member => member.user_id === targetProfile.id);
          if (existingMember?.status === 'active') return res.status(409).json({ error: 'This user is already an active group member.' });

          // Active and pending teammates both reserve a purchased seat. A
          // pending invitation may be resent/replaced, but a new email cannot
          // be invited beyond the paid seat count.
          const reservedSeats = (group.group_members || []).filter(member => ['active', 'pending'].includes(member.status)).length;
          if (!existingMember || existingMember.status !== 'pending') {
            if (reservedSeats >= group.seat_limit) return res.status(400).json({ error: `Group seat limit of ${group.seat_limit} reached.` });
          }

          const invitedAt = new Date().toISOString();
          const { error: insErr } = existingMember
            ? await adminClient.from('group_members').update({ role: 'member', status: 'pending', invited_at: invitedAt, joined_at: null }).eq('id', existingMember.id)
            : await adminClient.from('group_members').insert({ group_id: group.id, user_id: targetProfile.id, role: 'member', status: 'pending', invited_at: invitedAt, joined_at: null });
          if (insErr) return res.status(500).json({ error: insErr.message });

          const ownerName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Your teammate';
          const invitationUrl = `https://portfolio-maker-murex.vercel.app/studio?group_invite=${encodeURIComponent(group.id)}`;
          const emailResult = await sendBrevoEmail({
            to: cleanEmail,
            subject: `${ownerName} invited you to a Premium Portfolio Group`,
            htmlContent: generateGroupInvitationEmail({ ownerName, invitationUrl, seatLimit: group.seat_limit })
          });
          return res.status(200).json({ success: true, memberEmail: cleanEmail, status: 'pending', resent: Boolean(existingMember), emailSent: emailResult.success, emailError: emailResult.success ? null : emailResult.error });
        }

        if (subAction === 'remove_member') {
          if (!groupId) return res.status(400).json({ error: 'groupId required' });
          const { data: ownedGroup } = await adminClient.from('groups').select('id').eq('id', groupId).eq('owner_user_id', userId).maybeSingle();
          if (!ownedGroup) return res.status(403).json({ error: 'Only the group owner can manage members.' });
          const memberId = String(req.body.memberId || '');
          if (!memberId) return res.status(400).json({ error: 'memberId required' });
          const { data: memberToRemove, error: memberLookupErr } = await adminClient.from('group_members').select('id,status').eq('id', memberId).eq('group_id', groupId).maybeSingle();
          if (memberLookupErr) return res.status(500).json({ error: memberLookupErr.message });
          if (!memberToRemove) return res.status(404).json({ error: 'Invitation was not found.' });
          if (memberToRemove.status === 'active') return res.status(400).json({ error: 'Accepted members cannot be removed. Their seat remains active until the subscription ends.' });
          const { error: removeErr } = await adminClient.from('group_members').update({ status: 'removed' }).eq('id', memberId).eq('group_id', groupId).eq('status', 'pending');
          if (removeErr) return res.status(500).json({ error: removeErr.message });
          return res.status(200).json({ success: true, status: 'removed' });
        }

        if (subAction === 'accept_invitation') {
          if (!groupId) return res.status(400).json({ error: 'groupId required' });
          const { data: group } = await adminClient.from('groups').select('*').eq('id', groupId).eq('status', 'active').maybeSingle();
          if (!group) return res.status(404).json({ error: 'This group invitation is no longer active.' });
          const { data: ownerSub } = await adminClient.from('subscriptions').select('plan_id,status,current_period_end').eq('user_id', group.owner_user_id).maybeSingle();
          const ownerActive = ownerSub?.plan_id === 'premium_group' && ['active', 'grace', 'canceling'].includes(ownerSub.status || '') && (!ownerSub.current_period_end || new Date(ownerSub.current_period_end).getTime() > Date.now());
          if (!ownerActive) return res.status(410).json({ error: 'This Premium Group subscription has expired.' });
          const { data: invitation } = await adminClient.from('group_members').select('*').eq('group_id', groupId).eq('user_id', userId).eq('status', 'pending').maybeSingle();
          if (!invitation) return res.status(404).json({ error: 'No pending invitation was found for this account.' });
          const { count: activeMemberCount } = await adminClient.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId).eq('status', 'active');
          if ((activeMemberCount || 0) >= group.seat_limit) return res.status(400).json({ error: 'This group has no available seat.' });
          const { error: acceptErr } = await adminClient.from('group_members').update({ status: 'active', joined_at: new Date().toISOString() }).eq('id', invitation.id);
          if (acceptErr) return res.status(500).json({ error: acceptErr.message });
          const [{ data: ownerProfile }, { data: memberProfile }] = await Promise.all([
            adminClient.from('profiles').select('email,display_name').eq('id', group.owner_user_id).maybeSingle(),
            adminClient.from('profiles').select('email,display_name').eq('id', userId).maybeSingle()
          ]);
          const ownerName = ownerProfile?.display_name || ownerProfile?.email?.split('@')[0] || 'Your teammate';
          const memberName = memberProfile?.display_name || userData.user.email?.split('@')[0] || 'there';
          const activeUntil = (await adminClient.from('subscriptions').select('current_period_end').eq('user_id', group.owner_user_id).maybeSingle()).data?.current_period_end;
          await Promise.all([
            sendBrevoEmail({
              to: userData.user.email,
              subject: 'Your Premium Group access is active',
              htmlContent: generateGroupMemberActivatedEmail({ memberName, ownerName, activeUntil })
            }),
            ownerProfile?.email ? sendBrevoEmail({
              to: ownerProfile.email,
              subject: `${memberName} joined your Premium Group`,
              htmlContent: generateGroupMemberJoinedEmail({ ownerName, memberEmail: userData.user.email })
            }) : Promise.resolve(null)
          ]);
          return res.status(200).json({ success: true, status: 'active', groupId });
        }

        if (subAction === 'decline_invitation') {
          if (!groupId) return res.status(400).json({ error: 'groupId required' });
          const { error: declineErr } = await adminClient.from('group_members').update({ status: 'declined' }).eq('group_id', groupId).eq('user_id', userId).eq('status', 'pending');
          if (declineErr) return res.status(500).json({ error: declineErr.message });
          return res.status(200).json({ success: true, status: 'declined', groupId });
        }
      }
      return res.status(400).json({ error: 'Invalid group action' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTION: PROMO-VALIDATE (Promo Code Validation)
  // ─────────────────────────────────────────────────────────────
  if (action === 'promo-validate' || action === 'promo') {
    const { code, targetPlan } = req.body || {};
    if (!code) return res.status(400).json({ valid: false, error: 'Promo code required' });

    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: promo } = await adminClient.from('promo_codes').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle();
      if (!promo || !promo.active) return res.status(200).json({ valid: false, error: 'Invalid or inactive promo code' });

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return res.status(200).json({ valid: false, error: 'Promo code has expired' });
      }
      if (promo.max_redemptions && promo.redemption_count >= promo.max_redemptions) {
        return res.status(200).json({ valid: false, error: 'Promo code redemption limit reached' });
      }
      if (targetPlan && promo.applicable_plans?.length && !promo.applicable_plans.includes(targetPlan)) {
        return res.status(200).json({ valid: false, error: `Promo code is not applicable to the ${targetPlan} plan.` });
      }

      return res.status(200).json({ valid: true, code: promo.code, discountType: promo.discount_type, discountValue: promo.discount_value });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. ACTION: AUDIT-LOG (Admin Audit Log Query)
  // ─────────────────────────────────────────────────────────────
  if (action === 'audit-log' || action === 'audit') {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Authentication required' });
    const token = authHeader.replace('Bearer ', '');

    try {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return res.status(401).json({ error: 'Invalid session' });

      const userEmail = (userData.user.email || '').trim().toLowerCase();
      const isAllowedAdmin = userEmail === 'saleh2005mohamed@gmail.com' || [
        ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
        ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [])
      ].map(e => e.trim().toLowerCase()).filter(Boolean).includes(userEmail);

      if (!isAllowedAdmin) {
        return res.status(403).json({ error: 'Administrator access required' });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const { data: logs, error: logErr } = await adminClient.from('entitlement_audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (logErr) return res.status(500).json({ error: logErr.message });
      return res.status(200).json({ logs: logs || [], count: (logs || []).length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown entitlements action: ${action}` });
}
