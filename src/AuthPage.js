/**
 * AuthPage.js
 * Login / Sign Up page — shown before the Studio App
 */

import {
  signUp, login, getSession, isLoggedIn, getCurrentUser
} from './services/AuthService.js';
import { PLAN_CONFIG } from './services/EntitlementService.js';

export function renderAuthPage(onSuccess) {
  document.body.innerHTML = `
<div id="auth-page" style="
  min-height:100vh;width:100vw;
  background:#050508;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  font-family:'Inter',sans-serif;
  overflow:hidden;position:relative;
">
  <!-- Animated background canvas -->
  <canvas id="auth-canvas" style="position:fixed;inset:0;z-index:0;width:100%;height:100%"></canvas>

  <!-- Auth Card -->
  <div style="
    position:relative;z-index:10;
    width:100%;max-width:420px;
    background:rgba(10,10,22,0.9);
    backdrop-filter:blur(30px);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:24px;
    padding:40px 36px;
    box-shadow:0 40px 80px rgba(0,0,0,0.6);
    margin:20px;
  ">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="
        width:56px;height:56px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border-radius:16px;
        display:inline-flex;align-items:center;justify-content:center;
        font-size:26px;margin-bottom:16px;
        box-shadow:0 0 30px rgba(124,58,237,0.5);
      ">⚡</div>
      <div style="font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Outfit',sans-serif">
        3D Portfolio Maker
      </div>
      <div style="font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;margin-top:4px">
        Ultra Studio
      </div>
    </div>

    <!-- TABS -->
    <div style="display:flex;background:rgba(255,255,255,0.04);border-radius:12px;padding:4px;margin-bottom:28px;border:1px solid rgba(255,255,255,0.06)">
      <button id="tab-login" onclick="authSwitchTab('login')" style="
        flex:1;padding:9px;border:none;border-radius:9px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        color:#fff;font-size:0.85rem;font-weight:600;cursor:pointer;
        font-family:'Inter',sans-serif;transition:all 0.3s;
      ">Sign In</button>
      <button id="tab-signup" onclick="authSwitchTab('signup')" style="
        flex:1;padding:9px;border:none;border-radius:9px;
        background:transparent;color:rgba(255,255,255,0.4);
        font-size:0.85rem;font-weight:600;cursor:pointer;
        font-family:'Inter',sans-serif;transition:all 0.3s;
      ">Create Account</button>
    </div>

    <!-- LOGIN FORM -->
    <form id="form-login" onsubmit="authDoLogin(event)">
      ${authField('login-email','Email Address','email','your@email.com','✉')}
      ${authField('login-password','Password','password','••••••••','🔑')}
      <div id="login-error" style="display:none;font-size:0.8rem;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px"></div>
      <button type="submit" id="login-btn" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border:none;border-radius:12px;
        color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;
        font-family:'Inter',sans-serif;letter-spacing:0.5px;
        transition:all 0.3s;margin-bottom:16px;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 30px rgba(124,58,237,0.4)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        ⚡ Sign In to Studio
      </button>
    </form>

    <!-- SIGNUP FORM -->
    <form id="form-signup" style="display:none" onsubmit="authDoSignup(event)">
      ${authField('signup-name','Full Name','text','Your Name','👤')}
      ${authField('signup-email','Email Address','email','your@email.com','✉')}
      ${authField('signup-password','Password (min 6 chars)','password','••••••••','🔑')}
      ${authField('signup-confirm','Confirm Password','password','••••••••','🔐')}
      <div id="signup-error" style="display:none;font-size:0.8rem;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px"></div>
      <button type="submit" id="signup-btn" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border:none;border-radius:12px;
        color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;
        font-family:'Inter',sans-serif;letter-spacing:0.5px;
        transition:all 0.3s;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 30px rgba(124,58,237,0.4)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        🚀 Create Free Account
      </button>
    </form>

    <!-- PLAN ENTITLEMENT INFO -->
    <div style="
      margin-top:24px;padding:14px;
      background:rgba(124,58,237,0.06);
      border:1px solid rgba(124,58,237,0.15);
      border-radius:12px;font-size:0.78rem;
      color:rgba(255,255,255,0.5);line-height:1.6;
    ">
      <div style="color:rgba(124,58,237,0.9);font-weight:700;margin-bottom:6px">🆓 Free Plan includes:</div>
      <div>✓ ${PLAN_CONFIG.free.limits.portfolios} Active 3D Portfolio</div>
      <div>✓ Cinematic 3D Rendering & HTML Export</div>
      <div>✓ Standard ${PLAN_CONFIG.free.limits.analyticsDays}-Day Analytics</div>
      <div style="margin-top:8px;color:rgba(245,158,11,0.8);font-weight:600">💎 Pro unlocks up to ${PLAN_CONFIG.pro.limits.portfolios} portfolios, ${PLAN_CONFIG.pro.limits.customDomains} custom domains & ${PLAN_CONFIG.pro.limits.variants} variants</div>
    </div>
  </div>
</div>`;

  initAuthCanvas();

  // Global handlers
  window.authSwitchTab = (tab) => {
    const isLogin = tab === 'login';
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');
    if (formLogin) formLogin.style.display = isLogin ? 'block' : 'none';
    if (formSignup) formSignup.style.display = isLogin ? 'none' : 'block';

    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    if (loginTab) {
      loginTab.style.background = isLogin ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'transparent';
      loginTab.style.color = isLogin ? '#fff' : 'rgba(255,255,255,0.4)';
    }
    if (signupTab) {
      signupTab.style.background = !isLogin ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'transparent';
      signupTab.style.color = !isLogin ? '#fff' : 'rgba(255,255,255,0.4)';
    }
  };

  window.authDoLogin = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    if (btn) {
      btn.textContent = 'Signing in...';
      btn.disabled = true;
    }
    if (err) err.style.display = 'none';

    try {
      const email = document.getElementById('login-email')?.value || '';
      const password = document.getElementById('login-password')?.value || '';
      const res = await login(email, password);

      if (res && res.user) {
        onSuccess(res.user);
      } else {
        if (err) {
          err.textContent = '❌ Login failed. Please check your credentials.';
          err.style.display = 'block';
        }
        if (btn) {
          btn.textContent = '⚡ Sign In to Studio';
          btn.disabled = false;
        }
      }
    } catch (e) {
      if (err) {
        err.textContent = '❌ ' + (e.message || 'Login failed.');
        err.style.display = 'block';
      }
      if (btn) {
        btn.textContent = '⚡ Sign In to Studio';
        btn.disabled = false;
      }
    }
  };

  window.authDoSignup = async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email')?.value || '';
    const password = document.getElementById('signup-password')?.value || '';
    const confirm = document.getElementById('signup-confirm')?.value || '';
    const name = document.getElementById('signup-name')?.value || '';
    const err = document.getElementById('signup-error');
    if (err) err.style.display = 'none';

    if (password !== confirm) {
      if (err) {
        err.textContent = '❌ Passwords do not match!';
        err.style.display = 'block';
      }
      return;
    }

    const btn = document.getElementById('signup-btn');
    if (btn) {
      btn.textContent = 'Creating account...';
      btn.disabled = true;
    }

    try {
      const res = await signUp(email, password, name);
      if (res && res.user) {
        onSuccess(res.user);
      } else {
        if (err) {
          err.textContent = '❌ Account created. Please check your email to confirm.';
          err.style.display = 'block';
        }
        if (btn) {
          btn.textContent = '🚀 Create Free Account';
          btn.disabled = false;
        }
      }
    } catch (e) {
      if (err) {
        err.textContent = '❌ ' + (e.message || 'Signup failed.');
        err.style.display = 'block';
      }
      if (btn) {
        btn.textContent = '🚀 Create Free Account';
        btn.disabled = false;
      }
    }
  };
}

function authField(id, label, type, placeholder, icon) {
  return `
    <div style="margin-bottom:14px">
      <label style="font-size:0.7rem;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:6px">
        ${icon} ${label}
      </label>
      <input id="${id}" type="${type}" placeholder="${placeholder}" required style="
        width:100%;padding:11px 14px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:10px;color:#f0f0f8;
        font-size:0.875rem;outline:none;
        font-family:'Inter',sans-serif;
        transition:all 0.3s;
      "
      onfocus="this.style.borderColor='rgba(124,58,237,0.6)';this.style.background='rgba(124,58,237,0.06)';this.style.boxShadow='0 0 0 3px rgba(124,58,237,0.1)'"
      onblur="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)';this.style.boxShadow=''"/>
    </div>
  `;
}

function initAuthCanvas() {
  const canvas = document.getElementById('auth-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Create floating particles
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.1,
      hue: Math.random() < 0.5 ? 270 : 190 // purple or cyan
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    ctx.fillStyle = 'rgba(5,5,8,0.15)';
    ctx.fillRect(0, 0, w, h);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.opacity})`;
      ctx.fill();
    });

    // Draw connections
    particles.forEach((a, i) => {
      particles.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.strokeStyle = `rgba(124,58,237,${0.15 * (1 - d/120)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      });
    });
  }
  animate();
}
