/**
 * AdminPage.js
 * Full Admin Dashboard - Separate Protected Page
 * Access: admin@3dportfolio.app only
 */

import { getAnalytics } from './services/DBService.js';
import { adminGetAllUsers, adminToggleUserTier, adminDeleteUser, logout, getCurrentUser, adminCreatePromoCode, adminGetPromos, adminDeletePromoCode } from './services/AuthService.js';

export function renderAdminPage(onBack) {
  const admin = getCurrentUser();
  const analytics = getAnalytics();
  const users = adminGetAllUsers();

  document.body.innerHTML = `
<div style="
  height:100vh;width:100vw;
  background:#050508;
  font-family:'Inter',sans-serif;
  color:#f0f0f8;
  display:flex;flex-direction:column;
  overflow-y:auto;
  overflow-x:hidden;
">
  <!-- Animated bg -->
  <canvas id="admin-canvas" style="position:fixed;inset:0;z-index:0;opacity:0.3"></canvas>

  <!-- TOP BAR -->
  <nav style="
    position:sticky;top:0;z-index:100;
    background:rgba(5,5,12,0.9);
    backdrop-filter:blur(20px);
    border-bottom:1px solid rgba(255,255,255,0.06);
    padding:0 32px;
    display:flex;align-items:center;justify-content:space-between;
    height:60px;
  ">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="
        width:36px;height:36px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border-radius:10px;display:flex;align-items:center;justify-content:center;
        font-size:18px;box-shadow:0 0 20px rgba(124,58,237,0.4);
      ">⚡</div>
      <div>
        <div style="font-size:0.9rem;font-weight:700;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
          3D Portfolio Maker
        </div>
        <div style="font-size:0.6rem;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase">Admin Dashboard</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="
        background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.15));
        border:1px solid rgba(245,158,11,0.3);
        color:#f59e0b;padding:4px 14px;border-radius:20px;
        font-size:0.72rem;font-weight:700;letter-spacing:1px;
      ">👑 ADMIN</div>
      <span style="font-size:0.82rem;color:rgba(255,255,255,0.4)">${admin?.email}</span>
      <button onclick="adminBack()" style="
        padding:7px 18px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:8px;color:rgba(255,255,255,0.6);
        font-size:0.8rem;cursor:pointer;font-family:'Inter',sans-serif;
        transition:all 0.3s;
      " onmouseover="this.style.borderColor='rgba(255,255,255,0.2)';this.style.color='#fff'"
         onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.6)'">
        ← Back to Studio
      </button>
      <button onclick="adminLogout()" style="
        padding:7px 18px;
        background:rgba(239,68,68,0.1);
        border:1px solid rgba(239,68,68,0.2);
        border-radius:8px;color:#ef4444;
        font-size:0.8rem;cursor:pointer;font-family:'Inter',sans-serif;
        transition:all 0.3s;
      " onmouseover="this.style.background='rgba(239,68,68,0.2)'"
         onmouseout="this.style.background='rgba(239,68,68,0.1)'">
        🚪 Logout
      </button>
    </div>
  </nav>

  <!-- CONTENT -->
  <div style="padding:32px;position:relative;z-index:10;max-width:1400px;margin:0 auto;width:100%">

    <!-- STATS GRID -->
    <h2 style="font-size:1.5rem;font-weight:900;margin-bottom:20px;font-family:'Outfit',sans-serif">
      📊 Platform Analytics
    </h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:40px">
      ${adminStatCard('Total Users', users.length, '👥', '#7c3aed')}
      ${adminStatCard('Pro Users', users.filter(u=>u.tier==='pro').length, '💎', '#f59e0b')}
      ${adminStatCard('Free Users', users.filter(u=>u.tier==='free').length, '🆓', '#06b6d4')}
      ${adminStatCard('Portfolios', analytics.total_portfolios, '🚀', '#10b981')}
      ${adminStatCard('Exports', analytics.total_exports, '📦', '#ec4899')}
      ${adminStatCard('Shares', analytics.total_shares, '🔗', '#8b5cf6')}
    </div>

    <!-- PROFESSION BREAKDOWN -->
    ${Object.keys(analytics.profession_breakdown || {}).length > 0 ? `
    <div style="
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:20px;padding:28px;margin-bottom:32px;
    ">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:20px;color:rgba(255,255,255,0.7)">
        🏆 Top Professions
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">
        ${Object.entries(analytics.profession_breakdown)
          .sort((a,b) => b[1]-a[1]).slice(0,10)
          .map(([k,v]) => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06)">
              <div style="flex:1;font-size:0.83rem;text-transform:capitalize;color:rgba(255,255,255,0.7)">${k.replace(/_/g,' ')}</div>
              <div style="
                background:linear-gradient(135deg,#7c3aed,#06b6d4);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                background-clip:text;
                font-weight:800;font-family:'JetBrains Mono',monospace;
              ">${v}</div>
            </div>
          `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- PROMO CODES SECTION -->
    <div style="
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:20px;padding:24px;margin-bottom:32px;
    ">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        🏷️ Promo Codes Manager (أكواد الخصم والإنهاء)
      </h3>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <input id="new-promo-code" type="text" placeholder="الكود (مثلاً PRO50)" style="
          padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#fff;font-size:0.85rem;outline:none;font-family:'JetBrains Mono',monospace;width:160px;
        "/>
        <input id="new-promo-discount" type="number" placeholder="الخصم %" min="1" max="100" style="
          padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#fff;font-size:0.85rem;outline:none;width:110px;
        "/>
        <input id="new-promo-maxuses" type="number" placeholder="الحد الأقصى للمستخدمين (اختياري)" min="1" style="
          padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#fff;font-size:0.85rem;outline:none;width:220px;
        "/>
        <input id="new-promo-expiry" type="date" title="تاريخ انتهاء الصلاحية" style="
          padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:8px;color:#fff;font-size:0.85rem;outline:none;
        "/>
        <button onclick="adminAddPromo()" style="
          padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#06b6d4);
          border:none;border-radius:8px;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;
        ">+ إضافة كود الخصم</button>
      </div>
      <div id="promo-list-container" style="display:flex;gap:12px;flex-wrap:wrap">
        <!-- Rendered via JS -->
      </div>
    </div>

    <!-- USERS TABLE -->
    <div style="
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:20px;overflow:hidden;
    ">
      <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between">
        <h3 style="font-size:1rem;font-weight:700">👤 All Users (${users.length})</h3>
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.3)">${new Date().toLocaleString()}</div>
      </div>
      ${users.length === 0 ? `
        <div style="padding:48px;text-align:center;color:rgba(255,255,255,0.3);font-size:0.9rem">
          No registered users yet. Users will appear here after they sign up.
        </div>
      ` : `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:rgba(255,255,255,0.03)">
                ${['Name','Email','Tier','Joined','Last Login','Portfolios','Actions']
                  .map(h => `<th style="padding:12px 20px;text-align:left;font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.06)">${h}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody id="users-tbody">
              ${users.map(u => renderUserRow(u)).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- FOOTER -->
    <div style="margin-top:32px;text-align:center;font-size:0.75rem;color:rgba(255,255,255,0.15)">
      3D Portfolio Maker Admin Panel · Last updated ${new Date().toLocaleString()}
    </div>
  </div>
</div>`;

  initAdminCanvas();
  renderPromosList();

  window.adminBack = () => onBack();
  window.adminLogout = () => { logout(); location.reload(); };
  window.adminToggleTier = (email, currentTier) => {
    const newTier = currentTier === 'free' ? 'pro' : 'free';
    adminToggleUserTier(email, newTier);
    const row = document.getElementById(`user-row-${btoa(email)}`);
    if (row) row.outerHTML = renderUserRow({ ...adminGetAllUsers().find(u=>u.email===email), tier: newTier });
    showAdminToast(`User ${email} → ${newTier.toUpperCase()}`);
  };
  window.adminDeleteUserRow = (email) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    adminDeleteUser(email);
    document.getElementById(`user-row-${btoa(email)}`)?.remove();
    showAdminToast(`User ${email} deleted.`);
  };

  window.adminAddPromo = () => {
    const code = document.getElementById('new-promo-code').value.trim();
    const discount = document.getElementById('new-promo-discount').value;
    const maxUses = document.getElementById('new-promo-maxuses').value;
    const expiresAt = document.getElementById('new-promo-expiry').value;

    if (!code || !discount) {
      alert('برجاء إدخال الكود ونسبة الخصم');
      return;
    }
    adminCreatePromoCode(code, discount, maxUses, expiresAt);
    document.getElementById('new-promo-code').value = '';
    document.getElementById('new-promo-discount').value = '';
    document.getElementById('new-promo-maxuses').value = '';
    document.getElementById('new-promo-expiry').value = '';
    renderPromosList();
    showAdminToast(`تم إنشاء كود الخصم: ${code} بنسبة ${discount}%`);
  };

  window.adminRemovePromo = (code) => {
    adminDeletePromoCode(code);
    renderPromosList();
    showAdminToast(`تم مسح كود الخصم ${code}`);
  };

  function renderPromosList() {
    const container = document.getElementById('promo-list-container');
    if (!container) return;
    const promos = adminGetPromos();
    const keys = Object.keys(promos);

    if (keys.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:rgba(255,255,255,0.3)">لا يوجد أكواد خصم مضافة حالياً.</div>';
      return;
    }

    container.innerHTML = keys.map(k => {
      const p = typeof promos[k] === 'object' ? promos[k] : { discount: promos[k], maxUses: null, usedCount: 0, expiresAt: null };
      const limitText = p.maxUses ? `المستخدمون: ${p.usedCount || 0}/${p.maxUses}` : 'مستمر بلا حد';
      const expiryText = p.expiresAt ? `تنتهي: ${p.expiresAt}` : 'بلا تاريخ إنتهاء';

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.25);border-radius:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-family:'JetBrains Mono',monospace;font-weight:800;color:#fff;font-size:0.9rem">${k}</span>
              <span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:800">${p.discount}% OFF</span>
            </div>
            <div style="font-size:0.68rem;color:rgba(255,255,255,0.4);margin-top:4px">
              👥 ${limitText}  •  ⏳ ${expiryText}
            </div>
          </div>
          <button onclick="adminRemovePromo('${k}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.9rem;padding:4px">✕</button>
        </div>
      `;
    }).join('');
  }
}

function renderUserRow(u) {
  const safeid = btoa(u.email);
  const tierColor = u.tier === 'pro' ? '#f59e0b' : 'rgba(255,255,255,0.4)';
  const tierBg = u.tier === 'pro' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)';
  const tierBorder = u.tier === 'pro' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)';
  return `
    <tr id="user-row-${safeid}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s"
        onmouseover="this.style.background='rgba(255,255,255,0.02)'"
        onmouseout="this.style.background='transparent'">
      <td style="padding:14px 20px;font-size:0.85rem;font-weight:600">${u.name}</td>
      <td style="padding:14px 20px;font-size:0.82rem;color:rgba(255,255,255,0.5);font-family:'JetBrains Mono',monospace">${u.email}</td>
      <td style="padding:14px 20px">
        <span style="
          padding:3px 12px;border-radius:20px;font-size:0.7rem;font-weight:700;
          letter-spacing:1px;text-transform:uppercase;
          color:${tierColor};background:${tierBg};border:1px solid ${tierBorder};
        ">${u.tier === 'pro' ? '💎 PRO' : '🆓 FREE'}</span>
      </td>
      <td style="padding:14px 20px;font-size:0.78rem;color:rgba(255,255,255,0.4)">${new Date(u.createdAt).toLocaleDateString()}</td>
      <td style="padding:14px 20px;font-size:0.78rem;color:rgba(255,255,255,0.4)">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</td>
      <td style="padding:14px 20px;font-size:0.82rem;color:rgba(124,58,237,0.9);font-family:'JetBrains Mono',monospace">${u.portfolioCount || 0}</td>
      <td style="padding:14px 20px;display:flex;gap:8px">
        <button onclick="adminToggleTier('${u.email}','${u.tier}')" style="
          padding:5px 12px;border-radius:6px;font-size:0.72rem;cursor:pointer;
          background:${u.tier==='free'?'rgba(245,158,11,0.1)':'rgba(6,182,212,0.1)'};
          border:1px solid ${u.tier==='free'?'rgba(245,158,11,0.3)':'rgba(6,182,212,0.3)'};
          color:${u.tier==='free'?'#f59e0b':'#06b6d4'};
          font-family:'Inter',sans-serif;transition:all 0.2s;
        " onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
          ${u.tier === 'free' ? '⬆ Upgrade Pro' : '⬇ Set Free'}
        </button>
        <button onclick="adminDeleteUserRow('${u.email}')" style="
          padding:5px 12px;border-radius:6px;font-size:0.72rem;cursor:pointer;
          background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);
          color:#ef4444;font-family:'Inter',sans-serif;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(239,68,68,0.18)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">
          🗑
        </button>
      </td>
    </tr>
  `;
}

function adminStatCard(label, value, icon, color) {
  return `
    <div style="
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:16px;padding:24px 20px;
      position:relative;overflow:hidden;
    ">
      <div style="position:absolute;top:16px;right:16px;font-size:22px;opacity:0.5">${icon}</div>
      <div style="
        font-size:2.2rem;font-weight:900;line-height:1;
        font-family:'JetBrains Mono',monospace;
        background:linear-gradient(135deg,${color},${color}aa);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        background-clip:text;
      ">${value}</div>
      <div style="font-size:0.72rem;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:1px;text-transform:uppercase">${label}</div>
    </div>
  `;
}

function showAdminToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:rgba(10,10,22,0.95);border:1px solid rgba(16,185,129,0.3);backdrop-filter:blur(20px);border-radius:12px;padding:12px 18px;font-size:0.85rem;color:#f0f0f8;display:flex;align-items:center;gap:8px;animation:none`;
  t.innerHTML = `✅ ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function initAdminCanvas() {
  const canvas = document.getElementById('admin-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({length:60},()=>({
    x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,
    r:Math.random()*1+0.2,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,
    opacity:Math.random()*.4+.1,hue:270
  }));

  const animate = () => {
    requestAnimationFrame(animate);
    ctx.fillStyle='rgba(5,5,8,0.1)';ctx.fillRect(0,0,w,h);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`hsla(${p.hue},80%,60%,${p.opacity})`;ctx.fill();
    });
  };
  animate();
}
