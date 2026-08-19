import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(503).json({ error: 'Group service not configured' });
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const action = req.query.action || (req.body && req.body.action);

    // Feature flag check
    const groupsEnabled = process.env.FF_GROUP_MANAGEMENT_ENABLED === 'true';
    if (!groupsEnabled && action !== 'seats' && action !== 'members') {
      return res.status(200).json({ allowed: false, message: 'Group management is coming soon.' });
    }

    const GROUP_SEAT_PRICING = { 2: 1500, 3: 1800, 4: 2200, 5: 2800 };

    switch (action) {
      case 'create': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { seatCount } = req.body || {};
        const seats = Number(seatCount);
        if (!seats || seats < 2 || seats > 5) {
          return res.status(400).json({ error: 'Seat count must be between 2 and 5.' });
        }

        // Check user doesn't already own a group
        const { data: existingGroup } = await adminClient
          .from('groups')
          .select('id')
          .eq('owner_user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (existingGroup) {
          return res.status(400).json({ error: 'You already own an active group.' });
        }

        // Create group
        const { data: group, error: groupErr } = await adminClient
          .from('groups')
          .insert([{
            owner_user_id: userId,
            seat_limit: seats,
            plan_type: 'premium_group',
            status: 'active'
          }])
          .select()
          .single();

        if (groupErr) {
          return res.status(500).json({ error: 'Failed to create group: ' + groupErr.message });
        }

        // Add owner as first member
        await adminClient.from('group_members').insert([{
          group_id: group.id,
          user_id: userId,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString()
        }]);

        // Update owner's subscription
        await adminClient.from('subscriptions').upsert({
          user_id: userId,
          plan_id: 'premium_group',
          status: 'active',
          group_id: group.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        return res.status(200).json({
          success: true,
          group: { id: group.id, seatLimit: seats, priceMonthly: GROUP_SEAT_PRICING[seats] }
        });
      }

      case 'invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { memberEmail } = req.body || {};
        if (!memberEmail) return res.status(400).json({ error: 'Member email required.' });

        // Verify caller is group owner
        const { data: ownerGroup } = await adminClient
          .from('groups')
          .select('id, seat_limit')
          .eq('owner_user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!ownerGroup) {
          return res.status(403).json({ error: 'You do not own an active group.' });
        }

        // Check seat availability
        const { count: activeMembers } = await adminClient
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', ownerGroup.id)
          .eq('status', 'active');

        if ((activeMembers || 0) >= ownerGroup.seat_limit) {
          return res.status(400).json({ error: 'Your group has no available seats.' });
        }

        // Find member by email
        const { data: memberProfile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('email', memberEmail.trim().toLowerCase())
          .maybeSingle();

        if (!memberProfile) {
          return res.status(404).json({ error: 'No account found with that email.' });
        }

        // Check not already a member
        const { data: existing } = await adminClient
          .from('group_members')
          .select('id, status')
          .eq('group_id', ownerGroup.id)
          .eq('user_id', memberProfile.id)
          .maybeSingle();

        if (existing && existing.status === 'active') {
          return res.status(400).json({ error: 'This user is already in your group.' });
        }

        // Add or reactivate member
        if (existing) {
          await adminClient.from('group_members')
            .update({ status: 'active', joined_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await adminClient.from('group_members').insert([{
            group_id: ownerGroup.id,
            user_id: memberProfile.id,
            role: 'member',
            status: 'active',
            joined_at: new Date().toISOString()
          }]);
        }

        // Update member's subscription
        await adminClient.from('subscriptions').upsert({
          user_id: memberProfile.id,
          plan_id: 'premium_group',
          status: 'active',
          group_id: ownerGroup.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        return res.status(200).json({ success: true, memberId: memberProfile.id });
      }

      case 'remove': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { memberId } = req.body || {};
        if (!memberId) return res.status(400).json({ error: 'Member ID required.' });

        // Verify caller is group owner
        const { data: group } = await adminClient
          .from('groups')
          .select('id')
          .eq('owner_user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!group) {
          return res.status(403).json({ error: 'You do not own an active group.' });
        }

        // Cannot remove self (owner)
        if (memberId === userId) {
          return res.status(400).json({ error: 'Group owner cannot be removed. Dissolve the group instead.' });
        }

        // Remove member
        await adminClient.from('group_members')
          .update({ status: 'removed' })
          .eq('group_id', group.id)
          .eq('user_id', memberId);

        // Downgrade removed member to free
        await adminClient.from('subscriptions').upsert({
          user_id: memberId,
          plan_id: 'free',
          status: 'active',
          group_id: null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        return res.status(200).json({ success: true });
      }

      case 'seats': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        const { data: group } = await adminClient
          .from('groups')
          .select('id, seat_limit')
          .eq('owner_user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!group) {
          return res.status(200).json({ hasGroup: false });
        }

        const { count: activeMembers } = await adminClient
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('status', 'active');

        return res.status(200).json({
          hasGroup: true,
          total: group.seat_limit,
          used: activeMembers || 0,
          available: group.seat_limit - (activeMembers || 0),
          pricing: GROUP_SEAT_PRICING
        });
      }

      case 'members': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

        // Check user is owner or member
        const { data: membership } = await adminClient
          .from('group_members')
          .select('group_id, role')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!membership) {
          return res.status(200).json({ members: [] });
        }

        const { data: members } = await adminClient
          .from('group_members')
          .select('user_id, role, status, joined_at')
          .eq('group_id', membership.group_id)
          .eq('status', 'active');

        // Get profiles for members
        const memberIds = (members || []).map(m => m.user_id);
        const { data: profiles } = memberIds.length
          ? await adminClient.from('profiles').select('id, email, display_name').in('id', memberIds)
          : { data: [] };

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const enriched = (members || []).map(m => {
          const profile = profileMap.get(m.user_id) || {};
          return {
            userId: m.user_id,
            email: profile.email,
            name: profile.display_name || profile.email?.split('@')[0],
            role: m.role,
            joinedAt: m.joined_at
          };
        });

        return res.status(200).json({ members: enriched, isOwner: membership.role === 'owner' });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e) {
    console.error('Group management error:', e);
    return res.status(500).json({ error: 'Group operation failed' });
  }
}
