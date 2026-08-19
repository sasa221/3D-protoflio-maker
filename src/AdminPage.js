import {
  adminGetOverview,
  adminGetUsers,
  adminGetPortfolios,
  adminGetGroups,
  adminGetPromos,
  adminGetAuditLog,
  adminGetSystemInfo,
  adminOverrideUserPlan,
  adminOverridePortfolioHosting,
  adminOverrideGroupSeats,
  adminCreatePromo,
  adminDisablePromo,
  adminOverrideUserLegacy,
  logout
} from './services/AuthService.js';
import { getAllThemes } from './three/ProceduralTheme.js';
import { getThemeTier, getThemeBadge } from './config/ThemeTierConfig.js';
import { PLANS, formatPrice } from './config/PlanConfig.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

let currentTab = 'overview';
let cachedData = {
  overview: null,
  users: [],
  portfolios: [],
  groups: [],
  promos: [],
  auditLogs: [],
  system: null
};

export async function renderAdminPage() {
  document.body.innerHTML = `
    <main class="admin-shell">
      <nav class="admin-nav">
        <div style="display:flex;align-items:center;gap:18px">
          <a class="admin-brand" href="/studio">⚡ 3D Portfolio Maker</a>
          <span class="admin-badge" style="font-size:10px;padding:3px 8px">CONTROL CENTER</span>
        </div>
        <div class="admin-actions">
          <a href="/studio" style="font-size:13px;color:rgba(255,255,255,0.7);text-decoration:none">Back to Studio</a>
          <button id="admin-logout" style="font-size:13px;padding:6px 14px">Logout</button>
        </div>
      </nav>

      <section class="admin-content" style="max-width:1240px;margin:0 auto;padding:28px 18px">
        <div class="admin-heading" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div>
            <p style="font-size:11px;letter-spacing:2.5px;color:#8b5cf6;font-weight:800;margin:0">OPERATIONAL MANAGEMENT & ENTITLEMENTS</p>
            <h1 style="font-size:28px;font-weight:900;color:#fff;margin:4px 0 0">Admin Control Center</h1>
          </div>
          <button id="admin-refresh" style="background:#7c3aed;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer">↻ Refresh Data</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="admin-tabs" style="display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-bottom:24px">
          <button class="admin-tab active" data-tab="overview">📊 Overview</button>
          <button class="admin-tab" data-tab="users">👥 Users</button>
          <button class="admin-tab" data-tab="portfolios">🌐 Portfolios</button>
          <button class="admin-tab" data-tab="groups">🏢 Groups</button>
          <button class="admin-tab" data-tab="kil">⏳ Keep It Live</button>
          <button class="admin-tab" data-tab="promos">🎟️ Promo Codes</button>
          <button class="admin-tab" data-tab="themes">🎨 Themes (15)</button>
          <button class="admin-tab" data-tab="audit">🛡️ Audit Log</button>
          <button class="admin-tab" data-tab="system">⚙️ System & Flags</button>
        </div>

        <div id="admin-status" class="admin-status" style="display:none;padding:16px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:18px">Loading platform data…</div>
        <div id="admin-tab-content"></div>
      </section>

      <!-- User Management Modal Drawer -->
      <div id="admin-user-modal" class="modal-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:100;backdrop-filter:blur(8px);align-items:center;justify-content:center">
        <div class="modal-container" style="background:#0c0d14;border:1px solid rgba(255,255,255,0.15);width:min(760px,94vw);max-height:90vh;overflow-y:auto;border-radius:18px;padding:26px;color:#fff">
          <div id="admin-modal-body"></div>
        </div>
      </div>
    </main>`;

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderCurrentTab();
    });
  });

  document.getElementById('admin-refresh').addEventListener('click', loadAllData);
  document.getElementById('admin-logout').addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
  });

  await loadAllData();
}

async function loadAllData() {
  const status = document.getElementById('admin-status');
  const container = document.getElementById('admin-tab-content');
  if (status) {
    status.style.display = 'block';
    status.textContent = 'Refreshing platform telemetry & database records…';
  }

  try {
    const [overviewData, usersData, portfoliosData, groupsData, promosData, auditData, systemData] = await Promise.all([
      adminGetOverview().catch(() => ({ stats: {}, featureFlags: {} })),
      adminGetUsers().catch(() => ({ users: [] })),
      adminGetPortfolios().catch(() => ({ portfolios: [] })),
      adminGetGroups().catch(() => ({ groups: [] })),
      adminGetPromos().catch(() => ({ promos: [] })),
      adminGetAuditLog(150).catch(() => ({ logs: [] })),
      adminGetSystemInfo().catch(() => ({ featureFlags: {}, pricingReference: {} }))
    ]);

    cachedData = {
      overview: overviewData,
      users: usersData.users || [],
      portfolios: portfoliosData.portfolios || [],
      groups: groupsData.groups || [],
      promos: promosData.promos || [],
      auditLogs: auditData.logs || [],
      system: systemData
    };

    if (status) status.style.display = 'none';
    renderCurrentTab();
  } catch (err) {
    if (status) {
      status.style.display = 'block';
      status.textContent = `Failed to load admin data: ${err.message}`;
    }
  }
}

function renderCurrentTab() {
  const container = document.getElementById('admin-tab-content');
  if (!container) return;

  switch (currentTab) {
    case 'overview':
      container.innerHTML = renderOverviewTab(cachedData.overview);
      break;
    case 'users':
      container.innerHTML = renderUsersTab(cachedData.users);
      installUsersTabHandlers();
      break;
    case 'portfolios':
      container.innerHTML = renderPortfoliosTab(cachedData.portfolios);
      installPortfoliosTabHandlers();
      break;
    case 'groups':
      container.innerHTML = renderGroupsTab(cachedData.groups);
      installGroupsTabHandlers();
      break;
    case 'kil':
      container.innerHTML = renderKILTab(cachedData.portfolios);
      break;
    case 'promos':
      container.innerHTML = renderPromosTab(cachedData.promos);
      installPromosTabHandlers();
      break;
    case 'themes':
      container.innerHTML = renderThemesTab();
      break;
    case 'audit':
      container.innerHTML = renderAuditTab(cachedData.auditLogs);
      break;
    case 'system':
      container.innerHTML = renderSystemTab(cachedData.system);
      break;
  }
}

// ─── 1. OVERVIEW TAB ─────────────────────────────────────────────
function renderOverviewTab(data) {
  const stats = data?.stats || {};
  return `
    <div style="background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:12px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">🔒</span>
      <div>
        <strong style="color:#fde047;font-size:13px;display:block">PAYMENTS: Not connected yet (Phase 8B pending)</strong>
        <span style="color:rgba(255,255,255,0.7);font-size:12px">Centralized server entitlements active. Real financial metrics (MRR/ARR) disabled until payment provider connection.</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:28px">
      ${renderStatCard('Total Users', stats.totalUsers || 0, '#8b5cf6')}
      ${renderStatCard('Free Users', stats.freeUsers || 0, '#06b6d4')}
      ${renderStatCard('Pro Users', stats.proUsers || 0, '#fbbf24')}
      ${renderStatCard('Premium Users', stats.premiumUsers || 0, '#ec4899')}
      ${renderStatCard('Group Members', stats.groupMembers || 0, '#10b981')}
      ${renderStatCard('Total Portfolios', stats.totalPortfolios || 0, '#3b82f6')}
      ${renderStatCard('Published (Live)', stats.publishedPortfolios || 0, '#22c55e')}
      ${renderStatCard('Draft Portfolios', stats.draftPortfolios || 0, '#94a3b8')}
      ${renderStatCard('Finalized Free', stats.finalizedFreePortfolios || 0, '#a855f7')}
      ${renderStatCard('Keep It Live', stats.keepLivePortfolios || 0, '#f97316')}
      ${renderStatCard('Active Groups', stats.activeGroups || 0, '#14b8a6')}
      ${renderStatCard('Active Promos', stats.promoCodesCount || 0, '#eab308')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px">
        <h3 style="font-size:15px;color:#fff;margin:0 0 14px;font-weight:800">Operational Enforcement Status</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:rgba(0,0,0,0.4);border-radius:8px">
          <span style="font-size:13px;color:rgba(255,255,255,0.8)">Current Mode:</span>
          <span style="font-size:12px;font-weight:800;padding:3px 10px;border-radius:6px;background:${stats.enforcementStatus?.includes('ACTIVE') ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)'};color:${stats.enforcementStatus?.includes('ACTIVE') ? '#4ade80' : '#cbd5e1'}">${escapeHtml(stats.enforcementStatus || 'OFF (LEGACY MODE)')}</span>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px">
        <h3 style="font-size:15px;color:#fff;margin:0 0 14px;font-weight:800">Catalog Registry Summary</h3>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:rgba(255,255,255,0.8);line-height:2">
          <span>Catalog Total: <strong>15 Themes</strong></span>
          <span>Free: <strong>3</strong> | Pro: <strong>7</strong> | Premium: <strong>5</strong></span>
        </div>
      </div>
    </div>`;
}

function renderStatCard(label, val, color) {
  const isString = typeof val === 'string';
  const displayVal = isString ? val : (Number(val) || 0);
  const fontSize = isString && val.length > 5 ? '15px' : '26px';
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${color}"></div>
      <span style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">${escapeHtml(label)}</span>
      <strong style="font-size:${fontSize};font-weight:900;color:#fff">${escapeHtml(String(displayVal))}</strong>
    </div>`;
}

// ─── 2. USERS TAB ────────────────────────────────────────────────
function renderUsersTab(users) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
      <input type="text" id="user-search-input" placeholder="🔍 Search name, email, or user ID..." style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);padding:10px 14px;border-radius:10px;color:#fff;font-size:13px;width:min(320px,100%)"/>
      <div style="display:flex;gap:10px;align-items:center">
        <select id="user-filter-plan" style="background:#13141f;border:1px solid rgba(255,255,255,0.15);padding:8px 12px;border-radius:8px;color:#fff;font-size:12px">
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="premium_group">Group</option>
          <option value="legacy">Legacy Users</option>
          <option value="kil">Keep It Live</option>
        </select>
        <select id="user-sort" style="background:#13141f;border:1px solid rgba(255,255,255,0.15);padding:8px 12px;border-radius:8px;color:#fff;font-size:12px">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="portfolios">Most Portfolios</option>
        </select>
      </div>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">User Profile</th>
            <th style="padding:14px">Plan & Tier</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px">Portfolios</th>
            <th style="padding:14px">Legacy</th>
            <th style="padding:14px">Joined</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody id="users-table-body">
          ${renderUserRows(users)}
        </tbody>
      </table>
    </div>`;
}

function renderUserRows(users) {
  if (!users.length) {
    return `<tr><td colspan="7" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No matching user accounts found.</td></tr>`;
  }
  return users.map(u => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:14px 16px">
        <strong style="color:#fff;display:block">${escapeHtml(u.name)}</strong>
        <small style="color:rgba(255,255,255,0.5);font-size:11px">${escapeHtml(u.email)}</small>
        ${u.isAdmin ? '<span style="font-size:9px;background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 5px;border-radius:4px;font-weight:800;margin-top:2px;display:inline-block">ADMIN</span>' : ''}
      </td>
      <td style="padding:14px">
        <span class="plan plan-${escapeHtml(u.plan)}" style="font-weight:800;font-size:11px;padding:3px 8px;border-radius:6px">${escapeHtml(u.plan.toUpperCase())}</span>
      </td>
      <td style="padding:14px">
        <span style="font-size:11px;color:${u.status === 'active' ? '#4ade80' : '#f87171'}">● ${escapeHtml(u.status)}</span>
      </td>
      <td style="padding:14px">
        <strong>${u.portfolioCount}</strong> <small style="color:rgba(255,255,255,0.5)">(${u.hostedCount} live)</small>
      </td>
      <td style="padding:14px">
        ${u.isLegacy ? '<span style="color:#38bdf8;font-size:11px;font-weight:700">YES</span>' : '<span style="color:rgba(255,255,255,0.3);font-size:11px">NO</span>'}
      </td>
      <td style="padding:14px;color:rgba(255,255,255,0.6);font-size:12px">
        ${new Date(u.createdAt).toLocaleDateString()}
      </td>
      <td style="padding:14px 16px;text-align:right">
        <button class="manage-user-btn" data-user-id="${escapeHtml(u.id)}" style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.4);color:#c084fc;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">⚙️ Manage User</button>
      </td>
    </tr>`).join('');
}

function installUsersTabHandlers() {
  const searchInput = document.getElementById('user-search-input');
  const planFilter = document.getElementById('user-filter-plan');
  const sortSelect = document.getElementById('user-sort');

  const filterAndRender = () => {
    const query = (searchInput?.value || '').toLowerCase();
    const plan = planFilter?.value || 'all';
    const sort = sortSelect?.value || 'newest';

    let filtered = cachedData.users.filter(u => {
      const matchesQuery = u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.id.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (plan === 'legacy') return u.isLegacy;
      if (plan === 'kil') return u.hasKIL;
      if (plan !== 'all') return u.plan === plan;
      return true;
    });

    if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === 'portfolios') filtered.sort((a, b) => b.portfolioCount - a.portfolioCount);
    else filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById('users-table-body');
    if (tbody) tbody.innerHTML = renderUserRows(filtered);
    attachManageUserButtons();
  };

  searchInput?.addEventListener('input', filterAndRender);
  planFilter?.addEventListener('change', filterAndRender);
  sortSelect?.addEventListener('change', filterAndRender);
  attachManageUserButtons();
}

function attachManageUserButtons() {
  document.querySelectorAll('.manage-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const user = cachedData.users.find(u => u.id === userId);
      if (user) openUserManagementModal(user);
    });
  });
}

function openUserManagementModal(user) {
  const modal = document.getElementById('admin-user-modal');
  const body = document.getElementById('admin-modal-body');
  if (!modal || !body) return;

  const planObj = PLANS[user.plan] || PLANS.free;

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:14px;margin-bottom:18px">
      <div>
        <h2 style="margin:0;font-size:20px;font-weight:900">${escapeHtml(user.name)}</h2>
        <small style="color:rgba(255,255,255,0.5)">ID: ${escapeHtml(user.id)} • ${escapeHtml(user.email)}</small>
      </div>
      <button id="close-user-modal" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer">✕</button>
    </div>

    <!-- Evaluated Capabilities -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:20px">
      <h4 style="margin:0 0 10px;font-size:12px;color:#8b5cf6;text-transform:uppercase;letter-spacing:1px">Current Evaluated Capabilities</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div>canCreatePortfolio: <strong>${user.portfolioCount < (planObj.limits?.portfolios || 1) ? '✅ ALLOW' : '❌ AT LIMIT'}</strong></div>
        <div>canPublishHosted: <strong>${planObj.hosted ? '✅ ALLOW' : '❌ DENIED (PRO+)'}</strong></div>
        <div>canUseProThemes: <strong>${['pro', 'premium', 'premium_group'].includes(user.plan) ? '✅ ALLOW' : '❌ DENIED'}</strong></div>
        <div>canUsePremiumThemes: <strong>${['premium', 'premium_group'].includes(user.plan) ? '✅ ALLOW' : '❌ DENIED'}</strong></div>
        <div>canExportPDF: <strong>${user.plan !== 'free' ? '✅ ALLOW' : '❌ DENIED'}</strong></div>
        <div>canRemoveBranding: <strong>${['premium', 'premium_group'].includes(user.plan) ? '✅ ALLOW' : '❌ DENIED'}</strong></div>
        <div>Custom Domain: <strong>${['premium', 'premium_group'].includes(user.plan) ? '⏳ ENTITLED (COMING SOON)' : '❌ DENIED'}</strong></div>
        <div>Legacy Access: <strong>${user.isLegacy ? '🌟 GRANDFATHERED' : 'STANDARD'}</strong></div>
      </div>
    </div>

    <!-- Cooldown Section (Premium) -->
    ${user.plan.includes('premium') ? `
      <div style="background:rgba(236,72,153,0.08);border:1px solid rgba(236,72,153,0.25);border-radius:12px;padding:12px;margin-bottom:20px;font-size:12px">
        <h4 style="margin:0 0 6px;color:#f472b6;font-size:12px;text-transform:uppercase">7-Day Rolling Creation Cooldown</h4>
        <div>Last Created: <strong>${user.cooldown?.lastCreatedAt ? new Date(user.cooldown.lastCreatedAt).toLocaleString() : 'None recorded'}</strong></div>
        <div>Next Slot Available: <strong>${user.cooldown?.nextAvailableAt ? new Date(user.cooldown.nextAvailableAt).toLocaleString() : 'Available now'}</strong></div>
        <div>Status: <strong>${user.cooldown?.remainingHours > 0 ? `⏳ ${user.cooldown.remainingHours} hours remaining` : '✅ Ready to create'}</strong></div>
      </div>
    ` : ''}

    <!-- Plan Override Form -->
    <div style="border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:16px;background:rgba(124,58,237,0.05)">
      <h4 style="margin:0 0 12px;font-size:13px;color:#c084fc;font-weight:800">⚙️ Manual Plan Override (Audited)</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Target Commercial Plan</label>
          <select id="override-target-plan" style="width:100%;background:#13141f;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:8px;color:#fff;font-size:12px">
            <option value="free" ${user.plan === 'free' ? 'selected' : ''}>Free (0 EGP)</option>
            <option value="pro" ${user.plan === 'pro' ? 'selected' : ''}>Pro (600 EGP/mo)</option>
            <option value="premium" ${user.plan === 'premium' ? 'selected' : ''}>Premium (1,000 EGP/mo)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Subscription Status</label>
          <select id="override-target-status" style="width:100%;background:#13141f;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:8px;color:#fff;font-size:12px">
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="grace" ${user.status === 'grace' ? 'selected' : ''}>Grace Period</option>
            <option value="canceling" ${user.status === 'canceling' ? 'selected' : ''}>Canceling</option>
            <option value="expired" ${user.status === 'expired' ? 'selected' : ''}>Expired</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Mandatory Audit Reason</label>
        <input type="text" id="override-reason-input" placeholder="e.g. Support compensation, VIP sponsor..." style="width:100%;background:#13141f;border:1px solid rgba(255,255,255,0.2);padding:8px 12px;border-radius:8px;color:#fff;font-size:12px;box-sizing:border-box"/>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <button id="toggle-legacy-btn" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
          ${user.isLegacy ? 'Remove Legacy Status' : 'Grant Legacy Status'}
        </button>
        <button id="submit-plan-override-btn" style="background:#7c3aed;border:none;color:#fff;padding:8px 20px;border-radius:8px;font-weight:800;cursor:pointer;font-size:12px">
          Apply Audited Override
        </button>
      </div>
    </div>`;

  modal.style.display = 'flex';

  document.getElementById('close-user-modal')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('toggle-legacy-btn')?.addEventListener('click', async () => {
    const reason = prompt(`Enter mandatory reason to ${user.isLegacy ? 'remove' : 'grant'} legacy status for ${user.name}:`);
    if (!reason || reason.trim().length < 3) {
      alert('A valid reason is required.');
      return;
    }
    try {
      await adminOverrideUserLegacy({ userId: user.id, isLegacy: !user.isLegacy, reason: reason.trim() });
      alert('Legacy status updated.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  document.getElementById('submit-plan-override-btn')?.addEventListener('click', async () => {
    const targetPlan = document.getElementById('override-target-plan')?.value;
    const targetStatus = document.getElementById('override-target-status')?.value;
    const reason = document.getElementById('override-reason-input')?.value;

    if (!reason || reason.trim().length < 3) {
      alert('Please provide a mandatory audit reason (at least 3 characters).');
      return;
    }

    const confirmed = window.confirm(`CONFIRM AUDITED OVERRIDE:\n\nChange ${user.name} from ${user.plan.toUpperCase()} to ${targetPlan.toUpperCase()}?\nReason: "${reason}"\n\nThis will write an immutable audit log.`);
    if (!confirmed) return;

    try {
      await adminOverrideUserPlan({
        userId: user.id,
        targetPlanId: targetPlan,
        status: targetStatus,
        reason: reason.trim()
      });
      alert('Plan override successfully recorded in audit log.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Override failed: ${err.message}`);
    }
  });
}

// ─── 3. PORTFOLIOS TAB ───────────────────────────────────────────
function renderPortfoliosTab(portfolios) {
  return `
    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Portfolio</th>
            <th style="padding:14px">Owner</th>
            <th style="padding:14px">Theme</th>
            <th style="padding:14px">Hosting State</th>
            <th style="padding:14px">Created</th>
            <th style="padding:14px 16px;text-align:right">Safe Actions</th>
          </tr>
        </thead>
        <tbody>
          ${portfolios.length ? portfolios.map(p => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px">
                <strong style="color:#fff;display:block">${escapeHtml(p.name || 'Untitled')}</strong>
                <small style="color:rgba(255,255,255,0.5)">/u/${escapeHtml(p.slug)}</small>
              </td>
              <td style="padding:14px">
                <span style="color:rgba(255,255,255,0.8)">${escapeHtml(p.ownerName)}</span>
                <small style="color:rgba(255,255,255,0.4);display:block;font-size:11px">${escapeHtml(p.ownerEmail)}</small>
              </td>
              <td style="padding:14px">
                <span style="font-weight:700;color:#c084fc">${escapeHtml(p.theme)}</span>
                <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);margin-left:4px">${p.tierRequired.toUpperCase()}</span>
              </td>
              <td style="padding:14px">
                ${p.isLive ? '<span style="color:#4ade80;font-weight:700">🟢 LIVE</span>' : '<span style="color:rgba(255,255,255,0.4)">⚪ DRAFT</span>'}
              </td>
              <td style="padding:14px;color:rgba(255,255,255,0.5);font-size:12px">
                ${new Date(p.created_at).toLocaleDateString()}
              </td>
              <td style="padding:14px 16px;text-align:right">
                <a href="/u/${escapeHtml(p.slug)}" target="_blank" style="color:#38bdf8;text-decoration:none;font-weight:700;font-size:12px;margin-right:10px">↗ Open Live</a>
                <button class="portfolio-hosting-btn" data-pf-id="${escapeHtml(p.id)}" data-action="${p.isLive ? 'disable' : 'restore'}" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">
                  ${p.isLive ? 'Disable Hosting' : 'Restore Hosting'}
                </button>
              </td>
            </tr>`).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No portfolios found.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function installPortfoliosTabHandlers() {
  document.querySelectorAll('.portfolio-hosting-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pfId = btn.dataset.pfId;
      const action = btn.dataset.action;
      const reason = prompt(`Enter mandatory reason to ${action} hosting for portfolio ${pfId}:`);
      if (!reason || reason.trim().length < 3) {
        alert('A valid reason is required.');
        return;
      }
      try {
        await adminOverridePortfolioHosting({ portfolioId: pfId, hostingAction: action, reason: reason.trim() });
        alert(`Hosting ${action}d successfully.`);
        await loadAllData();
      } catch (err) {
        alert(`Failed: ${err.message}`);
      }
    });
  });
}

// ─── 4. GROUPS TAB ───────────────────────────────────────────────
function renderGroupsTab(groups) {
  return `
    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Group ID</th>
            <th style="padding:14px">Owner User ID</th>
            <th style="padding:14px">Seat Limit</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px">Created</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${groups.length ? groups.map(g => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px;font-family:monospace;color:#c084fc">${escapeHtml(g.id)}</td>
              <td style="padding:14px;font-family:monospace;color:rgba(255,255,255,0.6)">${escapeHtml(g.owner_user_id)}</td>
              <td style="padding:14px"><strong style="color:#fff">${g.seat_limit} seats</strong> <small style="color:rgba(255,255,255,0.4)">(2–5 max)</small></td>
              <td style="padding:14px"><span style="color:#4ade80">● ${escapeHtml(g.status)}</span></td>
              <td style="padding:14px;color:rgba(255,255,255,0.5);font-size:12px">${new Date(g.created_at).toLocaleDateString()}</td>
              <td style="padding:14px 16px;text-align:right">
                <button class="override-seats-btn" data-group-id="${escapeHtml(g.id)}" data-seats="${g.seat_limit}" style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);color:#c084fc;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">Adjust Seats</button>
              </td>
            </tr>`).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No active Premium Groups.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function installGroupsTabHandlers() {
  document.querySelectorAll('.override-seats-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const groupId = btn.dataset.groupId;
      const current = Number(btn.dataset.seats);
      const newSeatsStr = prompt(`Enter new seat count (between 2 and 5) for group ${groupId}:`, String(current));
      if (!newSeatsStr) return;
      const newSeats = Number(newSeatsStr);
      if (isNaN(newSeats) || newSeats < 2 || newSeats > 5) {
        alert('Seat limit must be between 2 and 5.');
        return;
      }
      const reason = prompt(`Enter mandatory audit reason for adjusting seats to ${newSeats}:`);
      if (!reason || reason.trim().length < 3) {
        alert('A valid reason is required.');
        return;
      }
      try {
        await adminOverrideGroupSeats({ groupId, seatLimit: newSeats, reason: reason.trim() });
        alert('Seats successfully updated.');
        await loadAllData();
      } catch (err) {
        alert(`Failed: ${err.message}`);
      }
    });
  });
}

// ─── 5. KEEP IT LIVE TAB ─────────────────────────────────────────
function renderKILTab(portfolios) {
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:20px">
      <h3 style="margin:0 0 8px;font-size:16px;color:#fff;font-weight:800">Keep It Live Retentions (500 EGP/year/portfolio)</h3>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6)">Read-only hosting continuity for expired subscribers. Active portfolios governed by KIL entitlements are listed below.</p>
    </div>
    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Portfolio Name</th>
            <th style="padding:14px">Owner</th>
            <th style="padding:14px">Live URL</th>
            <th style="padding:14px">KIL Protection</th>
          </tr>
        </thead>
        <tbody>
          ${portfolios.map(p => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px"><strong style="color:#fff">${escapeHtml(p.name)}</strong></td>
              <td style="padding:14px;color:rgba(255,255,255,0.7)">${escapeHtml(p.ownerEmail)}</td>
              <td style="padding:14px"><a href="/u/${escapeHtml(p.slug)}" target="_blank" style="color:#38bdf8;text-decoration:none">/u/${escapeHtml(p.slug)}</a></td>
              <td style="padding:14px"><span style="color:rgba(255,255,255,0.5)">Standard / Inactive</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── 6. PROMO CODES TAB ──────────────────────────────────────────
function renderPromosTab(promos) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div>
        <h3 style="margin:0;font-size:18px;font-weight:900;color:#fff">Commercial Promo Codes</h3>
        <small style="color:rgba(255,255,255,0.5)">Server-authoritative discounts for future checkout workflows.</small>
      </div>
      <button id="open-create-promo-btn" style="background:#7c3aed;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px">+ Create Promo Code</button>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Code</th>
            <th style="padding:14px">Discount</th>
            <th style="padding:14px">Applicable Plans</th>
            <th style="padding:14px">Redemptions</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${promos.length ? promos.map(pr => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px"><strong style="font-family:monospace;color:#fbbf24;font-size:14px">${escapeHtml(pr.code)}</strong></td>
              <td style="padding:14px">${pr.discount_value}${pr.discount_type === 'percentage' ? '%' : ' EGP'} OFF</td>
              <td style="padding:14px;color:rgba(255,255,255,0.7)">${escapeHtml((pr.applicable_plans || []).join(', '))}</td>
              <td style="padding:14px">${pr.redemption_count || 0} / ${pr.max_redemptions || '∞'}</td>
              <td style="padding:14px">${pr.active ? '<span style="color:#4ade80">● Active</span>' : '<span style="color:#f87171">✕ Disabled</span>'}</td>
              <td style="padding:14px 16px;text-align:right">
                ${pr.active ? `<button class="disable-promo-btn" data-promo-id="${escapeHtml(pr.id)}" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">Disable</button>` : '<span style="color:rgba(255,255,255,0.3)">Archived</span>'}
              </td>
            </tr>`).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No promo codes created yet.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function installPromosTabHandlers() {
  document.getElementById('open-create-promo-btn')?.addEventListener('click', () => {
    const code = prompt('Enter uppercase promo code (e.g. LAUNCH50):');
    if (!code) return;
    const discountType = prompt('Enter discount type: "percentage" or "fixed_amount":', 'percentage');
    if (!discountType || !['percentage', 'fixed_amount'].includes(discountType)) return;
    const discountValue = Number(prompt('Enter discount amount (e.g. 20 for 20%):', '20'));
    if (isNaN(discountValue) || discountValue <= 0) return;
    const reason = prompt('Enter mandatory audit reason for creating promo:');
    if (!reason || reason.trim().length < 3) return;

    adminCreatePromo({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue,
      applicablePlans: ['pro', 'premium'],
      reason: reason.trim()
    }).then(() => {
      alert('Promo code created.');
      loadAllData();
    }).catch(err => alert(`Failed: ${err.message}`));
  });

  document.querySelectorAll('.disable-promo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const promoId = btn.dataset.promoId;
      const reason = prompt('Enter mandatory audit reason to disable promo:');
      if (!reason || reason.trim().length < 3) return;
      adminDisablePromo({ promoId, reason: reason.trim() }).then(() => {
        alert('Promo disabled.');
        loadAllData();
      }).catch(err => alert(`Failed: ${err.message}`));
    });
  });
}

// ─── 7. THEMES TAB (15 THEMES) ───────────────────────────────────
function renderThemesTab() {
  const themes = getAllThemes();
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;margin-bottom:20px">
      <h3 style="margin:0 0 6px;font-size:16px;color:#fff;font-weight:800">Approved 15-Theme Catalog Registry (Read-Only)</h3>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6)">All 15 themes are mapped to commercial tiers in centralized <code style="color:#c084fc">ThemeTierConfig.js</code>.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px">
      ${themes.map(t => {
        const tier = getThemeTier(t.id);
        const badge = getThemeBadge(t.id);
        const primaryHex = '#' + (t.primaryColor || 0x7c3aed).toString(16).padStart(6, '0');
        const badgeColor = tier === 'premium' ? '#ec4899' : tier === 'pro' ? '#fbbf24' : '#06b6d4';
        return `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:24px">${t.emoji}</span>
              <div>
                <strong style="color:#fff;font-size:14px;display:block">${escapeHtml(t.name)}</strong>
                <small style="color:rgba(255,255,255,0.4);font-family:monospace">id: ${escapeHtml(t.id)}</small>
              </div>
            </div>
            <div style="text-align:right">
              <span style="font-size:10px;font-weight:900;padding:2px 8px;border-radius:6px;background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}55">${tier.toUpperCase()}</span>
              <small style="display:block;color:rgba(255,255,255,0.5);font-size:10px;margin-top:4px">${t.particleCount || 2000} pts</small>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── 8. AUDIT LOG TAB ────────────────────────────────────────────
function renderAuditTab(logs) {
  return `
    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Timestamp</th>
            <th style="padding:14px">Action</th>
            <th style="padding:14px">Target / User</th>
            <th style="padding:14px">Reason</th>
            <th style="padding:14px 16px">Details</th>
          </tr>
        </thead>
        <tbody>
          ${logs.length ? logs.map(l => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:12px 16px;color:rgba(255,255,255,0.5);white-space:nowrap">${new Date(l.created_at).toLocaleString()}</td>
              <td style="padding:12px"><strong style="color:#c084fc;font-family:monospace">${escapeHtml(l.action)}</strong></td>
              <td style="padding:12px;font-family:monospace;color:rgba(255,255,255,0.7)">${escapeHtml(l.user_id || 'Global')}</td>
              <td style="padding:12px;color:#fff">${escapeHtml(l.reason || 'N/A')}</td>
              <td style="padding:12px 16px;color:rgba(255,255,255,0.5);font-family:monospace;font-size:11px">${escapeHtml(JSON.stringify(l.metadata || {}))}</td>
            </tr>`).join('') : `<tr><td colspan="5" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">Audit log is empty.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ─── 9. SYSTEM TAB (READ-ONLY) ───────────────────────────────────
function renderSystemTab(system) {
  const flags = system?.featureFlags || {};
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:22px">
        <h3 style="margin:0 0 10px;font-size:16px;color:#fff;font-weight:800">Deployment Feature Flags (READ-ONLY)</h3>
        <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.5)">Feature flags are locked to environment configuration. Browser clients cannot mutate deployment flags.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${Object.entries(flags).map(([key, val]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:12px">
              <span style="font-family:monospace;color:rgba(255,255,255,0.8)">${escapeHtml(key)}</span>
              <span style="font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;background:${val ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'};color:${val ? '#4ade80' : '#f87171'}">${val ? 'ON' : 'OFF'}</span>
            </div>`).join('')}
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:22px">
        <h3 style="margin:0 0 10px;font-size:16px;color:#fff;font-weight:800">Plan Pricing Reference (Locked)</h3>
        <p style="margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.5)">SaaS Commercial pricing locked per approved business model.</p>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>Free Tier</span><strong>0 EGP</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>Pro Plan</span><strong>600 EGP/month</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>Premium Plan</span><strong>1,000 EGP/month</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span>Premium Group (2–5 seats)</span><strong>1,500 – 2,800 EGP/month</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span>Keep It Live (Retention)</span><strong>500 EGP/year/portfolio</strong>
          </div>
        </div>
      </div>
    </div>`;
}
