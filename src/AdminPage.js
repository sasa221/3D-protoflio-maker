import { adminGetOverview, adminSetUserPlan, logout } from './services/AuthService.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

export async function renderAdminPage() {
  document.body.innerHTML = `
    <main class="admin-shell">
      <nav class="admin-nav">
        <a class="admin-brand" href="/studio">⚡ 3D Portfolio Maker</a>
        <div class="admin-actions"><span class="admin-badge">ADMIN</span><a href="/studio">Back to Studio</a><button id="admin-logout">Logout</button></div>
      </nav>
      <section class="admin-content">
        <div class="admin-heading"><div><p>CONTROL CENTER</p><h1>Admin Dashboard</h1></div><button id="admin-refresh">Refresh</button></div>
        <div id="admin-status" class="admin-status">Loading secure platform data…</div>
        <div id="admin-dashboard" hidden></div>
      </section>
    </main>`;

  const dashboard = document.getElementById('admin-dashboard');
  const status = document.getElementById('admin-status');
  const refresh = async () => {
    status.hidden = false;
    status.textContent = 'Loading secure platform data…';
    dashboard.hidden = true;
    try {
      const data = await adminGetOverview();
      dashboard.innerHTML = renderDashboard(data);
      dashboard.hidden = false;
      status.hidden = true;
      installPlanControls(refresh);
    } catch (error) {
      status.textContent = error.message;
    }
  };
  document.getElementById('admin-refresh').addEventListener('click', refresh);
  document.getElementById('admin-logout').addEventListener('click', async () => {
    await logout();
    window.location.href = '/login';
  });
  await refresh();
}

function renderDashboard({ stats, users }) {
  return `
    <div class="admin-stats">
      ${stat('Users', stats.users)}${stat('Pro users', stats.proUsers)}${stat('Portfolios', stats.portfolios)}${stat('Admins', stats.admins)}
    </div>
    <section class="admin-panel">
      <div class="admin-panel-title"><h2>Users & access</h2><span>${users.length} accounts</span></div>
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>User</th><th>Plan</th><th>Role</th><th>Portfolios</th><th>Joined</th><th>Action</th></tr></thead>
        <tbody>${users.map((user) => `
          <tr>
            <td><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td>
            <td><span class="plan plan-${escapeHtml(user.plan)}">${escapeHtml(user.plan)}</span></td>
            <td>${user.isAdmin ? '<span class="admin-badge">ADMIN</span>' : 'Member'}</td>
            <td>${user.portfolioCount}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td><button class="admin-plan-button" data-user-id="${escapeHtml(user.id)}" data-plan="${user.plan === 'pro' ? 'free' : 'pro'}">Set ${user.plan === 'pro' ? 'Free' : 'Pro'}</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
}

function stat(label, value) {
  return `<article class="admin-stat"><strong>${Number(value) || 0}</strong><span>${label}</span></article>`;
}

function installPlanControls(refresh) {
  document.querySelectorAll('.admin-plan-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const nextPlan = button.dataset.plan;
      if (!window.confirm(`Change this user to ${nextPlan.toUpperCase()}?`)) return;
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        await adminSetUserPlan(button.dataset.userId, nextPlan);
        if ('BroadcastChannel' in window) {
          const channel = new BroadcastChannel('portfolio-entitlements');
          channel.postMessage({ userId: button.dataset.userId, planId: nextPlan });
          channel.close();
        }
        await refresh();
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Try again';
        window.alert(error.message);
      }
    });
  });
}
