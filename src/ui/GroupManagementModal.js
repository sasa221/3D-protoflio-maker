import { getGroupManagement, inviteGroupMember, acceptGroupInvitation, declineGroupInvitation, removeGroupMember } from '../services/AuthService.js';

let activeOverlay = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function groupExpiryBanner(subscription) {
  const end = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  if (!end || Number.isNaN(end.getTime())) return '';
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
  const urgent = daysLeft <= 7;
  const color = urgent ? '#fbbf24' : '#94a3b8';
  const background = urgent ? 'rgba(245,158,11,.1)' : 'rgba(148,163,184,.08)';
  const label = daysLeft > 0 ? `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'has ended';
  return `<div style="margin:14px 0;padding:10px 12px;border-radius:10px;background:${background};border:1px solid ${urgent ? 'rgba(245,158,11,.3)' : 'rgba(148,163,184,.18)'};color:${color};font-size:12px;text-align:center">⏳ Subscription ${label} · ${escapeHtml(end.toLocaleDateString())}</div>`;
}

export async function openGroupManagementModal() {
  activeOverlay?.remove();
  activeOverlay = document.createElement('div');
  activeOverlay.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.84);backdrop-filter:blur(10px);font-family:Inter,system-ui,sans-serif;';
  activeOverlay.innerHTML = `<div style="width:min(560px,100%);max-height:90vh;overflow:auto;background:#0a0b14;border:1px solid rgba(124,58,237,.45);border-radius:22px;padding:24px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.75)"><div style="text-align:center;color:#c084fc;font-weight:800;letter-spacing:1px;font-size:12px">PREMIUM GROUP</div><div style="text-align:center;padding:34px 0;color:rgba(255,255,255,.65)">Loading team…</div></div>`;
  document.body.appendChild(activeOverlay);
  await renderGroupManagement();
}

async function renderGroupManagement(feedback = '') {
  if (!activeOverlay) return;
  const card = activeOverlay.firstElementChild;
  try {
    const data = await getGroupManagement();
    const group = data.group;
    if (data.groupExpired) {
      card.innerHTML = '<button data-close style="float:right;background:none;border:0;color:#fff;font-size:22px;cursor:pointer">×</button><h2 style="margin-top:20px">Premium Group expired</h2><p style="color:#fca5a5;line-height:1.6">The subscription end date has passed, so team access is closed and all members return to Free automatically.</p>';
      bindClose();
      return;
    }
    if (!group) {
      if (data.membership?.status === 'active') {
        const owner = data.membershipOwner?.display_name || data.membershipOwner?.email || 'your team owner';
        const group = data.membershipGroup || {};
        card.innerHTML = `<button data-close style="float:right;background:none;border:0;color:#fff;font-size:22px;cursor:pointer">×</button><div style="text-align:center;font-size:28px;margin-top:16px">👑</div><h2 style="margin:8px 0;text-align:center">Premium Group access is active</h2>${groupExpiryBanner(data.membershipSubscription)}<p style="text-align:center;color:rgba(255,255,255,.65);font-size:13px;line-height:1.6">You’re an active member of ${escapeHtml(owner)}’s Premium Group. Your account and portfolio are separate, and your own Premium limits apply.</p><div style="margin-top:18px;padding:14px;border-radius:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:#86efac;font-size:12px;text-align:center">Premium Group · ${escapeHtml(group.seat_limit || 2)} teammate seats · Status: ACTIVE</div><p style="margin:12px 0 0;text-align:center;color:rgba(255,255,255,.5);font-size:11px">Your group owner manages invitations and membership.</p>`;
      } else {
        card.innerHTML = '<button data-close style="float:right;background:none;border:0;color:#fff;font-size:22px;cursor:pointer">×</button><h2 style="margin-top:20px">Setting up your Premium Group</h2><p style="color:rgba(255,255,255,.68);line-height:1.6">Your group subscription is active, but the team record is still syncing. Try again to load the invite controls.</p><button data-retry-group style="margin-top:12px;width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-weight:800;cursor:pointer">Retry setup</button>';
      }
      bindClose();
      card.querySelector('[data-retry-group]')?.addEventListener('click', () => renderGroupManagement());
      return;
    }
    const members = data.members || [];
    const reservedCount = members.filter(member => ['active', 'pending'].includes(member.status)).length;
    const remainingSeats = Math.max(0, Number(group.seat_limit || 0) - reservedCount);
    const remainingLabel = remainingSeats === 1 ? '1 invitation remaining' : `${remainingSeats} invitations remaining`;
    const rows = members.length ? members.map(member => {
      const profile = member.profile || {};
      const label = profile.display_name || profile.email || member.user_id;
      const statusColor = member.status === 'active' ? '#4ade80' : '#facc15';
      const actions = member.status === 'pending'
        ? `<button data-resend="${escapeHtml(profile.email || '')}" style="background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);color:#7dd3fc;border-radius:7px;padding:4px 7px;font-size:10px;cursor:pointer">Resend</button>`
        : '';
      const pendingRemove = member.status === 'pending'
        ? `<button data-remove="${escapeHtml(member.id)}" title="Cancel invitation" style="background:none;border:0;color:#fca5a5;font-size:15px;cursor:pointer">×</button>`
        : '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)"><div><strong style="display:block">${escapeHtml(label)}</strong><span style="font-size:11px;color:rgba(255,255,255,.5)">${escapeHtml(profile.email || '')}</span></div><div style="display:flex;align-items:center;gap:7px">${actions}<span style="color:${statusColor};font-size:11px;font-weight:800;text-transform:uppercase">${escapeHtml(member.status)}</span>${pendingRemove}</div></div>`;
    }).join('') : '<p style="color:rgba(255,255,255,.55);font-size:13px">No invitations sent yet.</p>';
    card.innerHTML = `
      <button data-close style="float:right;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer">×</button>
      <div style="text-align:center;color:#c084fc;font-weight:800;letter-spacing:1px;font-size:12px">PREMIUM GROUP</div>
      <h2 style="margin:8px 0 6px;text-align:center">Manage your team</h2>
      ${groupExpiryBanner(data.subscription)}
      <p style="margin:0 0 20px;text-align:center;color:rgba(255,255,255,.62);font-size:13px">${reservedCount} of ${group.seat_limit} teammate seats reserved · <strong style="color:#86efac">${remainingLabel}</strong></p>
      ${feedback ? `<div style="margin-bottom:14px;padding:10px 12px;border-radius:9px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);color:#86efac;font-size:12px">${escapeHtml(feedback)}</div>` : ''}
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:0 14px;margin-bottom:20px"><div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)"><strong>${escapeHtml(data.owner?.email || 'You')}</strong><span style="display:block;color:#4ade80;font-size:11px;margin-top:3px">OWNER · ACTIVE</span></div>${rows}</div>
      <form id=group-invite-form style="display:flex;gap:8px;margin-top:10px"><input id=group-invite-email type=email required ${remainingSeats === 0 ? 'disabled' : ''} placeholder="${remainingSeats === 0 ? 'All invitations are reserved' : 'teammate@email.com'}" style="flex:1;min-width:0;background:#141624;border:1px solid rgba(255,255,255,.18);padding:11px 12px;border-radius:10px;color:#fff;outline:none"><button type=submit ${remainingSeats === 0 ? 'disabled' : ''} style="background:${remainingSeats === 0 ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#059669,#0891b2)'};border:0;border-radius:10px;padding:0 16px;color:${remainingSeats === 0 ? 'rgba(255,255,255,.35)' : '#fff'};font-weight:800;cursor:${remainingSeats === 0 ? 'not-allowed' : 'pointer'}">${remainingSeats === 0 ? 'No seats left' : 'Invite'}</button></form>
      <p style="font-size:11px;color:rgba(255,255,255,.48);line-height:1.5;margin:12px 0 0">Accepted members keep their seat for this subscription. You can resend or cancel a pending invitation, then use the freed seat for another email.</p>
    `;
    bindClose();
    card.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await removeGroupMember(group.id, button.dataset.remove); await renderGroupManagement('Member removed. You can invite another email.'); } catch (error) { await renderGroupManagement(error.message); }
    }));
    card.querySelectorAll('[data-resend]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try { const result = await inviteGroupMember(button.dataset.resend); await renderGroupManagement(result.emailSent === false ? 'Invitation saved, but email delivery is not configured.' : 'Invitation resent.'); } catch (error) { await renderGroupManagement(error.message); }
    }));
    card.querySelector('#group-invite-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const input = card.querySelector('#group-invite-email');
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const result = await inviteGroupMember(input.value.trim());
        await renderGroupManagement(result.emailSent === false ? 'Invitation saved, but email delivery is not configured.' : 'Invitation sent. They must accept it from their email.');
      } catch (error) {
        await renderGroupManagement();
        const errorBox = activeOverlay?.querySelector('h2');
        if (errorBox) errorBox.insertAdjacentHTML('afterend', `<p style="color:#fca5a5;font-size:12px">${escapeHtml(error.message)}</p>`);
      }
    });
  } catch (error) {
    card.innerHTML = `<button data-close style="float:right;background:none;border:0;color:#fff;font-size:22px;cursor:pointer">×</button><h2 style="margin-top:20px">Manage your team</h2><p style="color:#fca5a5">${escapeHtml(error.message)}</p>`;
    bindClose();
  }
}

function bindClose() {
  activeOverlay?.querySelector('[data-close]')?.addEventListener('click', () => { activeOverlay?.remove(); activeOverlay = null; });
}

export function closeGroupManagementModal() {
  activeOverlay?.remove();
  activeOverlay = null;
}

export async function showPendingGroupInvitations(invitations = []) {
  if (!invitations.length) return;
  activeOverlay?.remove();
  activeOverlay = document.createElement('div');
  activeOverlay.style.cssText = 'position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.84);backdrop-filter:blur(10px);font-family:Inter,system-ui,sans-serif;';
  activeOverlay.innerHTML = `<div style="width:min(520px,100%);background:#0a0b14;border:1px solid rgba(124,58,237,.45);border-radius:22px;padding:26px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.75)"><div style="text-align:center;font-size:28px">👥</div><h2 style="margin:8px 0;text-align:center">You have a team invitation</h2><p style="text-align:center;color:rgba(255,255,255,.62);font-size:13px">Accept it to activate Premium access on your own account. You can decline and be invited again later.</p>${invitations.map(invitation => { const group = Array.isArray(invitation.groups) ? invitation.groups[0] : invitation.groups; return `<div data-invite-row="${escapeHtml(invitation.group_id)}" style="border-top:1px solid rgba(255,255,255,.1);padding-top:14px;margin-top:14px"><strong>Premium Group</strong><span style="display:block;color:rgba(255,255,255,.55);font-size:12px;margin:4px 0 12px">${escapeHtml(group?.seat_limit || 2)} seats · invited ${escapeHtml(new Date(invitation.invited_at).toLocaleDateString())}</span><div style="display:flex;gap:8px"><button data-accept="${escapeHtml(invitation.group_id)}" style="flex:1;padding:10px;background:linear-gradient(135deg,#059669,#0891b2);border:0;border-radius:9px;color:#fff;font-weight:800;cursor:pointer">Accept</button><button data-decline="${escapeHtml(invitation.group_id)}" style="padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:9px;color:#fff;font-weight:700;cursor:pointer">Decline</button></div></div>`; }).join('')}<button data-close style="display:block;margin:20px auto 0;background:none;border:0;color:rgba(255,255,255,.55);cursor:pointer">Close</button></div>`;
  document.body.appendChild(activeOverlay);
  bindClose();
  activeOverlay.querySelectorAll('[data-accept]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await acceptGroupInvitation(button.dataset.accept); activeOverlay.remove(); activeOverlay = null; window.location.reload(); } catch (error) { button.disabled = false; button.textContent = error.message; }
  }));
  activeOverlay.querySelectorAll('[data-decline]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await declineGroupInvitation(button.dataset.decline); button.closest('[data-invite-row]')?.remove(); } catch (error) { button.disabled = false; button.textContent = error.message; }
  }));
}
