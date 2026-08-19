import {
  adminGetOverview,
  adminGetUsers,
  adminGetPortfolios,
  adminGetGroups,
  adminGetPromos,
  adminGetAuditLog,
  adminGetSystemInfo,
  adminGetPaymentRequests,
  adminReviewPayment,
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
  payments: [],
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
          <button class="admin-tab" data-tab="payments">💳 Payment Requests</button>
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

      <!-- Payment Review Modal -->
      <div id="admin-payment-modal" class="modal-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:100;backdrop-filter:blur(8px);align-items:center;justify-content:center">
        <div class="modal-container" style="background:#0c0d14;border:1px solid rgba(255,255,255,0.15);width:min(640px,94vw);max-height:90vh;overflow-y:auto;border-radius:18px;padding:26px;color:#fff">
          <div id="admin-payment-modal-body"></div>
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
    status.style.background = 'rgba(255,255,255,0.05)';
    status.style.border = '1px solid rgba(255,255,255,0.1)';
    status.style.color = '#fff';
    status.textContent = 'Refreshing platform telemetry & database records…';
  }

  const errors = [];
  const safeCall = async (fn, label, fallback) => {
    try {
      return await fn();
    } catch (e) {
      console.error(`[Admin Data] ${label} failed:`, e);
      errors.push(`${label}: ${e.message}`);
      return fallback;
    }
  };

  try {
    const [overviewData, usersData, portfoliosData, groupsData, promosData, paymentsData, auditData, systemData] = await Promise.all([
      safeCall(adminGetOverview, 'Overview', { stats: null, error: true }),
      safeCall(adminGetUsers, 'Users', { users: [] }),
      safeCall(adminGetPortfolios, 'Portfolios', { portfolios: [] }),
      safeCall(adminGetGroups, 'Groups', { groups: [] }),
      safeCall(adminGetPromos, 'Promos', { promos: [] }),
      safeCall(() => adminGetPaymentRequests('all'), 'Payment Requests', { requests: [] }),
      safeCall(() => adminGetAuditLog(150), 'Audit Log', { logs: [] }),
      safeCall(adminGetSystemInfo, 'System Info', { featureFlags: {}, pricingReference: {} })
    ]);

    cachedData = {
      overview: overviewData,
      users: usersData.users || [],
      portfolios: portfoliosData.portfolios || [],
      groups: groupsData.groups || [],
      promos: promosData.promos || [],
      payments: paymentsData.requests || [],
      auditLogs: auditData.logs || [],
      system: systemData
    };

    if (errors.length > 0) {
      if (status) {
        status.style.display = 'block';
        status.style.background = 'rgba(239,68,68,0.15)';
        status.style.border = '1px solid rgba(239,68,68,0.3)';
        status.style.color = '#fca5a5';
        status.innerHTML = `<strong>⚠️ Partial telemetry loading error:</strong><br>${errors.map(e => escapeHtml(e)).join('<br>')}`;
      }
    } else {
      if (status) status.style.display = 'none';
    }

    renderCurrentTab();
  } catch (err) {
    if (status) {
      status.style.display = 'block';
      status.style.background = 'rgba(239,68,68,0.15)';
      status.style.border = '1px solid rgba(239,68,68,0.3)';
      status.style.color = '#fca5a5';
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
    case 'payments':
      container.innerHTML = renderPaymentsTab(cachedData.payments);
      installPaymentsTabHandlers();
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
  if (!data || data.error || !data.stats) {
    return `
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;text-align:center;color:#fca5a5;margin-bottom:24px;">
        <span style="font-size:32px;display:block;margin-bottom:8px">⚠️</span>
        <h3 style="margin:0 0 6px;color:#fff;font-size:16px;">Unable to load platform overview metrics</h3>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);">The server telemetry query encountered an issue. Check server logs or click ↻ Refresh Data above.</p>
      </div>
    `;
  }
  const stats = data.stats;
  return `
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
      <span style="font-size:22px">💳</span>
      <div>
        <strong style="color:#4ade80;font-size:13px;display:block">PAYMENTS: Manual InstaPay Active (Phase 8B)</strong>
        <span style="color:rgba(255,255,255,0.7);font-size:12px">Users submit transfer proof. Admins review and activate subscriptions with server-authoritative pricing and Brevo notifications.</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;margin-bottom:28px">
      ${renderStatCard('Total Users', stats.totalUsers ?? 0, '#8b5cf6')}
      ${renderStatCard('Free Users', stats.freeUsers ?? 0, '#06b6d4')}
      ${renderStatCard('Pro Users', stats.proUsers ?? 0, '#fbbf24')}
      ${renderStatCard('Premium Users', stats.premiumUsers ?? 0, '#ec4899')}
      ${renderStatCard('Group Members', stats.groupMembers ?? 0, '#10b981')}
      ${renderStatCard('Total Portfolios', stats.totalPortfolios ?? 0, '#3b82f6')}
      ${renderStatCard('Published (Live)', stats.publishedPortfolios ?? 0, '#22c55e')}
      ${renderStatCard('Draft Portfolios', stats.draftPortfolios ?? 0, '#94a3b8')}
      ${renderStatCard('Finalized Free', stats.finalizedFreePortfolios ?? 0, '#a855f7')}
      ${renderStatCard('Keep It Live', stats.keepLivePortfolios ?? 0, '#f97316')}
      ${renderStatCard('Active Groups', stats.activeGroups ?? 0, '#14b8a6')}
      ${renderStatCard('Active Promos', stats.promoCodesCount ?? 0, '#eab308')}
      ${renderStatCard('Pending Payments', stats.pendingPaymentsCount ?? 0, '#fde047')}
      ${renderStatCard('Approved Payments', stats.approvedPaymentsCount ?? 0, '#22c55e')}
      ${renderStatCard('Rejected Payments', stats.rejectedPaymentsCount ?? 0, '#ef4444')}
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
  return `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px">
      <span style="font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">${escapeHtml(label)}</span>
      <div style="font-size:24px;font-weight:900;color:${color};margin-top:6px">${typeof val === 'number' ? val.toLocaleString() : escapeHtml(String(val))}</div>
    </div>`;
}

// ─── 2. USERS TAB ────────────────────────────────────────────────
function renderUsersTab(users) {
  return `
    <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap">
      <input type="text" id="user-search-input" placeholder="Search by name, email, user ID…" style="flex:1;min-width:240px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;color:#fff;font-size:13px;outline:none"/>
      <select id="user-filter-plan" style="background:#141624;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;color:#fff;font-size:13px">
        <option value="all">All Plans</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="premium">Premium</option>
        <option value="premium_group">Premium Group</option>
        <option value="legacy">Legacy Grandfathered</option>
        <option value="kil">Keep It Live</option>
      </select>
      <select id="user-sort" style="background:#141624;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;color:#fff;font-size:13px">
        <option value="newest">Sort: Newest First</option>
        <option value="oldest">Sort: Oldest First</option>
        <option value="portfolios">Sort: Most Portfolios</option>
      </select>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">User / Identity</th>
            <th style="padding:14px">Effective Plan</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px">Portfolios</th>
            <th style="padding:14px">Legacy Access</th>
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
  return users.map(u => {
    const name = u.name || u.display_name || u.email?.split('@')[0] || 'User';
    const email = u.email || 'No email';
    const plan = (u.plan || 'free').toLowerCase();
    const status = u.status || 'active';
    const portfolioCount = u.portfolioCount ?? u.portfolios_count ?? 0;
    const hostedCount = u.hostedCount ?? u.hosted_count ?? 0;
    const isLegacy = Boolean(u.isLegacy ?? u.is_legacy);
    const createdAt = u.createdAt || u.created_at;
    const dateStr = createdAt ? new Date(createdAt).toLocaleDateString() : '—';
    const isAdmin = Boolean(u.isAdmin ?? u.is_admin);

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:14px 16px">
          <strong style="color:#fff;display:block">${escapeHtml(name)}</strong>
          <small style="color:rgba(255,255,255,0.5);font-size:11px">${escapeHtml(email)}</small>
          ${isAdmin ? '<span style="font-size:9px;background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 5px;border-radius:4px;font-weight:800;margin-top:2px;display:inline-block">ADMIN</span>' : ''}
        </td>
        <td style="padding:14px">
          <span class="plan plan-${escapeHtml(plan)}" style="font-weight:800;font-size:11px;padding:3px 8px;border-radius:6px">${escapeHtml(plan.toUpperCase())}</span>
        </td>
        <td style="padding:14px">
          <span style="font-size:11px;color:${status === 'active' ? '#4ade80' : '#f87171'}">● ${escapeHtml(status)}</span>
        </td>
        <td style="padding:14px">
          <strong>${portfolioCount}</strong> <small style="color:rgba(255,255,255,0.5)">(${hostedCount} live)</small>
        </td>
        <td style="padding:14px">
          ${isLegacy ? '<span style="color:#38bdf8;font-size:11px;font-weight:700">YES</span>' : '<span style="color:rgba(255,255,255,0.3);font-size:11px">NO</span>'}
        </td>
        <td style="padding:14px;color:rgba(255,255,255,0.6);font-size:12px">
          ${escapeHtml(dateStr)}
        </td>
        <td style="padding:14px 16px;text-align:right">
          <button class="manage-user-btn" data-user-id="${escapeHtml(u.id)}" style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.4);color:#c084fc;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">⚙️ Manage User</button>
        </td>
      </tr>`;
  }).join('');
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
      const uName = (u.name || u.display_name || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      const uId = (u.id || '').toLowerCase();
      const matchesQuery = uName.includes(query) || uEmail.includes(query) || uId.includes(query);
      if (!matchesQuery) return false;
      if (plan === 'legacy') return Boolean(u.isLegacy ?? u.is_legacy);
      if (plan === 'kil') return Boolean(u.hasKIL ?? u.has_kil);
      if (plan !== 'all') return (u.plan || '').toLowerCase() === plan;
      return true;
    });

    if (sort === 'oldest') filtered.sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));
    else if (sort === 'portfolios') filtered.sort((a, b) => (b.portfolioCount || b.portfolios_count || 0) - (a.portfolioCount || a.portfolios_count || 0));
    else filtered.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

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

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:14px">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:900;color:#fff">${escapeHtml(user.name)}</h2>
        <span style="font-size:12px;color:rgba(255,255,255,0.6)">${escapeHtml(user.email)}</span>
        <small style="font-family:monospace;display:block;color:rgba(255,255,255,0.4);font-size:11px">UID: ${escapeHtml(user.id)}</small>
      </div>
      <button id="close-user-modal" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">✕</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px">
        <span style="font-size:11px;color:rgba(255,255,255,0.5)">Current Commercial Plan</span>
        <div style="font-size:16px;font-weight:800;color:#c084fc;margin-top:2px">${escapeHtml(user.plan.toUpperCase())} (${escapeHtml(user.status)})</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px">
        <span style="font-size:11px;color:rgba(255,255,255,0.5)">Legacy Access Mode</span>
        <div style="font-size:16px;font-weight:800;color:${user.isLegacy ? '#38bdf8' : '#94a3b8'};margin-top:2px">${user.isLegacy ? 'GRANDFATHERED (ALL THEMES)' : 'STANDARD COMMERCIAL'}</div>
      </div>
    </div>

    <!-- Override Plan Section -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:16px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#fff;font-weight:800">Plan & Subscription Override (Audited)</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div>
          <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Target Plan Tier</label>
          <select id="modal-override-plan" style="width:100%;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:6px;color:#fff;font-size:12px">
            <option value="free" ${user.plan === 'free' ? 'selected' : ''}>Free Tier</option>
            <option value="pro" ${user.plan === 'pro' ? 'selected' : ''}>Pro Plan</option>
            <option value="premium" ${user.plan === 'premium' ? 'selected' : ''}>Premium Plan</option>
            <option value="premium_group" ${user.plan === 'premium_group' ? 'selected' : ''}>Premium Group</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Subscription State</label>
          <select id="modal-override-status" style="width:100%;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:6px;color:#fff;font-size:12px">
            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="canceling" ${user.status === 'canceling' ? 'selected' : ''}>Canceling</option>
            <option value="grace" ${user.status === 'grace' ? 'selected' : ''}>Grace Period</option>
            <option value="expired" ${user.status === 'expired' ? 'selected' : ''}>Expired</option>
            <option value="keep_it_live" ${user.status === 'keep_it_live' ? 'selected' : ''}>Keep It Live</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;color:rgba(255,255,255,0.6);display:block;margin-bottom:4px">Mandatory Audit Reason (Required for security trail)</label>
        <input type="text" id="modal-override-reason" placeholder="e.g. VIP Customer upgrade / Manual test account setup" style="width:100%;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:6px;color:#fff;font-size:12px;outline:none;box-sizing:border-box"/>
      </div>
      <button id="modal-btn-save-plan" style="background:#7c3aed;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">Apply Plan Override</button>
    </div>

    <!-- Legacy Access Toggle Section -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px">
      <h3 style="margin:0 0 10px;font-size:14px;color:#fff;font-weight:800">Legacy Grandfathering Exemption</h3>
      <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.6)">Grandfathered accounts retain access to all themes without commercial lockouts.</p>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="text" id="modal-legacy-reason" placeholder="Reason for legacy exemption change…" style="flex:1;background:#141624;border:1px solid rgba(255,255,255,0.2);padding:8px;border-radius:6px;color:#fff;font-size:12px;outline:none"/>
        <button id="modal-btn-toggle-legacy" style="background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.4);color:#38bdf8;padding:8px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">
          ${user.isLegacy ? 'Remove Legacy Access' : 'Grant Legacy Access'}
        </button>
      </div>
    </div>`;

  modal.style.display = 'flex';
  document.getElementById('close-user-modal').addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('modal-btn-save-plan').addEventListener('click', async () => {
    const targetPlanId = document.getElementById('modal-override-plan').value;
    const status = document.getElementById('modal-override-status').value;
    const reason = document.getElementById('modal-override-reason').value;

    if (!reason || reason.trim().length < 3) {
      alert('A mandatory audit reason (at least 3 characters) is required for plan override.');
      return;
    }

    try {
      await adminOverrideUserPlan({ userId: user.id, targetPlanId, status, reason: reason.trim() });
      alert('User plan updated successfully.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Error updating plan: ${err.message}`);
    }
  });

  document.getElementById('modal-btn-toggle-legacy').addEventListener('click', async () => {
    const reason = document.getElementById('modal-legacy-reason').value;
    if (!reason || reason.trim().length < 3) {
      alert('A mandatory audit reason is required for legacy status changes.');
      return;
    }

    try {
      await adminOverrideUserLegacy({ userId: user.id, isLegacy: !user.isLegacy, reason: reason.trim() });
      alert('Legacy access updated successfully.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Error updating legacy status: ${err.message}`);
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
            <th style="padding:14px 16px">Portfolio Name / Slug</th>
            <th style="padding:14px">Owner User ID</th>
            <th style="padding:14px">Theme</th>
            <th style="padding:14px">Hosting State</th>
            <th style="padding:14px">Finalized</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${portfolios.length ? portfolios.map(p => {
            const name = p.name || 'Untitled Portfolio';
            const slug = p.slug || '';
            const ownerId = p.ownerUserId || p.owner_user_id || 'Unknown';
            const ownerEmail = p.ownerEmail || p.owner_email || '';
            const theme = p.theme || 'code';
            const isLive = Boolean(p.isLive ?? p.published_at);
            const isFinalized = Boolean(p.isFinalized ?? p.is_finalized);

            return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px">
                <strong style="color:#fff;display:block">${escapeHtml(name)}</strong>
                <small style="color:#38bdf8;font-family:monospace;font-size:11px">/${escapeHtml(slug)}</small>
              </td>
              <td style="padding:14px;font-family:monospace;color:rgba(255,255,255,0.6);font-size:12px">
                ${ownerEmail ? `<span style="color:#fff;display:block;font-size:11px">${escapeHtml(ownerEmail)}</span>` : ''}
                <span style="font-size:10px;color:rgba(255,255,255,0.4)">${escapeHtml(ownerId)}</span>
              </td>
              <td style="padding:14px"><span style="font-weight:700;color:#c084fc">${escapeHtml(theme)}</span></td>
              <td style="padding:14px">
                <span style="font-size:11px;color:${isLive ? '#4ade80' : '#94a3b8'}">● ${isLive ? 'HOSTED & LIVE' : 'DRAFT'}</span>
              </td>
              <td style="padding:14px">
                ${isFinalized ? '<span style="color:#fbbf24;font-size:11px;font-weight:700">🔒 LOCKED</span>' : '<span style="color:rgba(255,255,255,0.4);font-size:11px">EDITABLE</span>'}
              </td>
              <td style="padding:14px 16px;text-align:right">
                ${slug ? `<a href="/u/${escapeHtml(slug)}" target="_blank" style="color:#38bdf8;text-decoration:none;font-weight:700;font-size:12px;margin-right:10px">↗ Open Live</a>` : ''}
                <button class="portfolio-hosting-btn" data-pf-id="${escapeHtml(p.id)}" data-action="${isLive ? 'disable' : 'restore'}" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">
                  ${isLive ? 'Disable Hosting' : 'Restore Hosting'}
                </button>
              </td>
            </tr>`;
          }).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No portfolios found.</td></tr>`}
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
        alert('Group seats adjusted.');
        await loadAllData();
      } catch (err) {
        alert(`Failed: ${err.message}`);
      }
    });
  });
}

// ─── 5. KEEP IT LIVE TAB ─────────────────────────────────────────
function renderKILTab(portfolios) {
  const kilPortfolios = portfolios.filter(p => p.hasKeepLive);
  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;margin-bottom:20px">
      <h3 style="margin:0 0 6px;font-size:16px;color:#fff;font-weight:800">Keep It Live Retained Portfolios</h3>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6)">Annual 500 EGP/portfolio hosting fee for users without active Pro/Premium subscriptions.</p>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Portfolio</th>
            <th style="padding:14px">Owner User ID</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${kilPortfolios.length ? kilPortfolios.map(p => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px"><strong style="color:#fff">${escapeHtml(p.name)}</strong></td>
              <td style="padding:14px;font-family:monospace;color:rgba(255,255,255,0.6)">${escapeHtml(p.ownerUserId)}</td>
              <td style="padding:14px"><span style="color:#f97316;font-weight:700">● KEEP IT LIVE ACTIVE</span></td>
              <td style="padding:14px 16px;text-align:right">
                <a href="/u/${escapeHtml(p.slug)}" target="_blank" style="color:#38bdf8;font-size:12px;font-weight:700;text-decoration:none">↗ View Live</a>
              </td>
            </tr>`).join('') : `<tr><td colspan="4" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No portfolios currently on Keep It Live entitlement.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ─── 6. PAYMENT REQUESTS TAB (PHASE 8B) ──────────────────────────
function renderPaymentsTab(requests) {
  return `
    <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;align-items:center;">
      <select id="payment-filter-status" style="background:#141624;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;color:#fff;font-size:13px">
        <option value="pending">Filter: Pending Review Only</option>
        <option value="approved">Filter: Approved</option>
        <option value="rejected">Filter: Rejected</option>
        <option value="all">Filter: All Payments</option>
      </select>
      <input type="text" id="payment-search-input" placeholder="Search by customer, plan, or request ID…" style="flex:1;min-width:240px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;color:#fff;font-size:13px;outline:none"/>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Customer</th>
            <th style="padding:14px">Requested Plan</th>
            <th style="padding:14px">Expected Amount</th>
            <th style="padding:14px">Promo Code</th>
            <th style="padding:14px">Submitted</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px 16px;text-align:right">Review</th>
          </tr>
        </thead>
        <tbody id="payments-table-body">
          ${renderPaymentRows(requests)}
        </tbody>
      </table>
    </div>`;
}

function renderPaymentRows(requests) {
  if (!requests.length) {
    return `<tr><td colspan="7" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No payment requests found.</td></tr>`;
  }
  return requests.map(r => {
    const statusColor = r.status === 'APPROVED' ? '#4ade80' : r.status === 'REJECTED' ? '#f87171' : '#fde047';
    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:14px 16px">
          <strong style="color:#fff;display:block">${escapeHtml(r.userName || 'User')}</strong>
          <small style="color:rgba(255,255,255,0.5);font-size:11px">${escapeHtml(r.userEmail || 'N/A')}</small>
          <small style="display:block;font-family:monospace;color:rgba(255,255,255,0.3);font-size:10px">${escapeHtml(r.id)}</small>
        </td>
        <td style="padding:14px">
          <strong style="color:#c084fc">${escapeHtml(r.plan_id.toUpperCase())}</strong>
          ${r.group_seats ? `<small style="display:block;color:rgba(255,255,255,0.5)">(${r.group_seats} seats)</small>` : ''}
        </td>
        <td style="padding:14px">
          <strong style="color:#fff">${r.expected_amount_egp} EGP</strong>
        </td>
        <td style="padding:14px">
          ${r.promo_code ? `<span style="background:rgba(234,179,8,0.2);color:#fde047;font-family:monospace;font-size:11px;padding:2px 6px;border-radius:4px">${escapeHtml(r.promo_code)} (-${r.discount_amount_egp} EGP)</span>` : '<span style="color:rgba(255,255,255,0.3);font-size:11px">None</span>'}
        </td>
        <td style="padding:14px;color:rgba(255,255,255,0.5);font-size:12px">
          ${new Date(r.created_at).toLocaleString()}
        </td>
        <td style="padding:14px">
          <span style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44">
            ● ${escapeHtml(r.status)}
          </span>
        </td>
        <td style="padding:14px 16px;text-align:right">
          <button class="review-payment-btn" data-req-id="${escapeHtml(r.id)}" style="background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);color:#c084fc;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            🔍 Review Proof
          </button>
        </td>
      </tr>`;
  }).join('');
}

function installPaymentsTabHandlers() {
  const statusFilter = document.getElementById('payment-filter-status');
  const searchInput = document.getElementById('payment-search-input');

  const filterAndRender = () => {
    const status = statusFilter?.value || 'pending';
    const query = (searchInput?.value || '').toLowerCase();

    let filtered = cachedData.payments.filter(r => {
      if (status !== 'all' && r.status.toLowerCase() !== status) return false;
      if (!query) return true;
      return (
        (r.userName || '').toLowerCase().includes(query) ||
        (r.userEmail || '').toLowerCase().includes(query) ||
        (r.plan_id || '').toLowerCase().includes(query) ||
        (r.id || '').toLowerCase().includes(query)
      );
    });

    const tbody = document.getElementById('payments-table-body');
    if (tbody) tbody.innerHTML = renderPaymentRows(filtered);
    attachReviewPaymentButtons();
  };

  statusFilter?.addEventListener('change', filterAndRender);
  searchInput?.addEventListener('input', filterAndRender);
  attachReviewPaymentButtons();
}

function attachReviewPaymentButtons() {
  document.querySelectorAll('.review-payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.reqId;
      const request = cachedData.payments.find(r => r.id === reqId);
      if (request) openPaymentReviewModal(request);
    });
  });
}

function openPaymentReviewModal(request) {
  const modal = document.getElementById('admin-payment-modal');
  const body = document.getElementById('admin-payment-modal-body');
  if (!modal || !body) return;

  const isPending = request.status === 'PENDING';

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:900;color:#fff">Review Manual InstaPay Transfer</h2>
        <span style="font-size:12px;color:rgba(255,255,255,0.6)">Request ID: <code style="color:#c084fc">${escapeHtml(request.id)}</code></span>
      </div>
      <button id="close-payment-modal" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer">✕</button>
    </div>

    <!-- Request Details -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px;line-height:1.7">
      <div style="display:flex;justify-content:space-between">
        <span style="color:rgba(255,255,255,0.6)">Customer:</span>
        <strong>${escapeHtml(request.userName)} (${escapeHtml(request.userEmail)})</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:rgba(255,255,255,0.6)">Plan Requested:</span>
        <strong style="color:#c084fc">${escapeHtml(request.plan_id.toUpperCase())} ${request.group_seats ? `(${request.group_seats} seats)` : ''}</strong>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:rgba(255,255,255,0.6)">Expected Amount:</span>
        <strong style="color:#4ade80">${request.expected_amount_egp} EGP</strong>
      </div>
      ${request.promo_code ? `
        <div style="display:flex;justify-content:space-between">
          <span style="color:rgba(255,255,255,0.6)">Promo Discount:</span>
          <span style="color:#fde047">${escapeHtml(request.promo_code)} (-${request.discount_amount_egp} EGP)</span>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between">
        <span style="color:rgba(255,255,255,0.6)">Submitted Date:</span>
        <span>${new Date(request.created_at).toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:rgba(255,255,255,0.6)">Current Status:</span>
        <strong style="color:${request.status === 'APPROVED' ? '#4ade80' : request.status === 'REJECTED' ? '#f87171' : '#fde047'}">${escapeHtml(request.status)}</strong>
      </div>
    </div>

    <!-- Transfer Proof Image -->
    <div style="margin-bottom:20px;text-align:center">
      <span style="font-size:12px;color:rgba(255,255,255,0.6);display:block;margin-bottom:8px">Uploaded InstaPay Screenshot:</span>
      ${request.signedProofUrl ? `
        <a href="${escapeHtml(request.signedProofUrl)}" target="_blank" title="Click to view full image">
          <img src="${escapeHtml(request.signedProofUrl)}" style="max-height:220px;max-width:100%;border-radius:10px;border:1px solid rgba(255,255,255,0.2);box-shadow:0 8px 20px rgba(0,0,0,0.5);cursor:zoom-in"/>
        </a>
      ` : `
        <div style="padding:24px;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.15);border-radius:10px;color:rgba(255,255,255,0.4);font-size:12px">
          Proof stored at: <code>${escapeHtml(request.proof_storage_path || 'Pending upload')}</code>
        </div>
      `}
    </div>

    ${isPending ? `
      <div style="display:flex;gap:12px">
        <button id="btn-approve-payment" style="flex:1;padding:12px;background:#22c55e;border:none;border-radius:10px;color:#fff;font-weight:800;font-size:13px;cursor:pointer">
          ✓ Approve & Activate Plan
        </button>
        <button id="btn-reject-payment" style="flex:1;padding:12px;background:#ef4444;border:none;border-radius:10px;color:#fff;font-weight:800;font-size:13px;cursor:pointer">
          ✕ Reject Payment
        </button>
      </div>
    ` : `
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;text-align:center;color:rgba(255,255,255,0.5);font-size:12px">
        This payment request has already been ${escapeHtml(request.status.toLowerCase())} ${request.rejection_reason ? `(Reason: ${escapeHtml(request.rejection_reason)})` : ''}.
      </div>
    `}
  `;

  modal.style.display = 'flex';
  document.getElementById('close-payment-modal').addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('btn-approve-payment')?.addEventListener('click', async () => {
    if (!confirm(`Activate ${request.plan_id.toUpperCase()} plan for ${request.userName}?`)) return;
    try {
      await adminReviewPayment({ requestId: request.id, decision: 'APPROVED' });
      alert('Payment approved and subscription activated.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  });

  document.getElementById('btn-reject-payment')?.addEventListener('click', async () => {
    const reason = prompt('Enter mandatory rejection reason to send to the user (e.g. transfer not found, incorrect amount, blurry receipt):');
    if (!reason || reason.trim().length < 3) {
      alert('A valid rejection reason is required.');
      return;
    }
    try {
      await adminReviewPayment({ requestId: request.id, decision: 'REJECTED', reason: reason.trim() });
      alert('Payment rejected.');
      modal.style.display = 'none';
      await loadAllData();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  });
}

// ─── 7. PROMOS TAB ───────────────────────────────────────────────
function renderPromosTab(promos) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div>
        <h3 style="margin:0;font-size:16px;color:#fff;font-weight:800">Commercial Promo Codes</h3>
        <span style="font-size:12px;color:rgba(255,255,255,0.5)">Discount codes evaluated exclusively on the server.</span>
      </div>
      <button id="btn-open-create-promo" style="background:#7c3aed;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">➕ Create Promo Code</button>
    </div>

    <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02)">
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding:14px 16px">Promo Code</th>
            <th style="padding:14px">Discount</th>
            <th style="padding:14px">Applicable Plans</th>
            <th style="padding:14px">Redemptions</th>
            <th style="padding:14px">Status</th>
            <th style="padding:14px 16px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${promos.length ? promos.map(p => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
              <td style="padding:14px 16px;font-family:monospace;font-weight:800;color:#eab308">${escapeHtml(p.code)}</td>
              <td style="padding:14px"><strong style="color:#fff">${p.discount_value}${p.discount_type === 'percentage' ? '%' : ' EGP'} OFF</strong></td>
              <td style="padding:14px;color:rgba(255,255,255,0.7)">${p.applicable_plans?.length ? escapeHtml(p.applicable_plans.join(', ')) : 'ALL PLANS'}</td>
              <td style="padding:14px">${p.redemption_count || 0} / ${p.max_redemptions || '∞'}</td>
              <td style="padding:14px"><span style="font-size:11px;color:${p.active ? '#4ade80' : '#f87171'}">● ${p.active ? 'ACTIVE' : 'DISABLED'}</span></td>
              <td style="padding:14px 16px;text-align:right">
                ${p.active ? `<button class="disable-promo-btn" data-promo-id="${escapeHtml(p.id)}" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">Disable</button>` : '<span style="color:rgba(255,255,255,0.3);font-size:11px">Disabled</span>'}
              </td>
            </tr>`).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:rgba(255,255,255,0.4)">No promo codes registered.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function installPromosTabHandlers() {
  document.getElementById('btn-open-create-promo')?.addEventListener('click', async () => {
    const code = prompt('Enter promo code (e.g. LAUNCH20):');
    if (!code) return;
    const discountType = prompt('Discount type (percentage or fixed_amount):', 'percentage');
    const discountValue = Number(prompt('Discount value (e.g. 20 for 20% or 100 for 100 EGP):', '20'));
    const reason = prompt('Mandatory audit reason for creating promo:');

    if (!reason || reason.trim().length < 3) {
      alert('A valid reason is required.');
      return;
    }

    try {
      await adminCreatePromo({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue,
        applicablePlans: ['pro', 'premium'],
        reason: reason.trim()
      });
      alert('Promo code created.');
      await loadAllData();
    } catch (err) {
      alert(`Error creating promo: ${err.message}`);
    }
  });

  document.querySelectorAll('.disable-promo-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const promoId = btn.dataset.promoId;
      const reason = prompt('Enter mandatory reason to disable promo:');
      if (!reason || reason.trim().length < 3) return;
      try {
        await adminDisablePromo({ promoId, reason: reason.trim() });
        alert('Promo disabled.');
        await loadAllData();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  });
}

// ─── 8. THEMES TAB (15 THEMES) ───────────────────────────────────
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

// ─── 9. AUDIT LOG TAB ────────────────────────────────────────────
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

// ─── 10. SYSTEM TAB (READ-ONLY) ───────────────────────────────────
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
