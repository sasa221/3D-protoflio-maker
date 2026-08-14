/**
 * AuthPage.js
 * Login / Sign Up page — shown before the Studio App
 */

import {
  signUp, login, getSession, isLoggedIn, getCurrentUser, resendConfirmationEmail
} from './services/AuthService.js';
import { PLAN_CONFIG } from './services/EntitlementService.js';

export function renderAuthPage(onSuccess) {
  const isRecovery = window.location.pathname.startsWith('/reset-password') ||
                     window.location.hash.includes('type=recovery') ||
                     window.location.search.includes('type=recovery') ||
                     window.location.search.includes('code=');

  if (isRecovery) {
    renderResetPasswordPage(onSuccess);
    return;
  }

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
      <h1 style="margin:0;font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Outfit',sans-serif">
        3D Portfolio Maker
      </h1>
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
      <div style="display:flex;justify-content:flex-end;margin-top:-6px;margin-bottom:14px">
        <button type="button" onclick="authDoSendResetPassword(event)" style="
          background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.75rem;
          cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline;
          transition:color 0.2s;
        " onmouseover="this.style.color='#a855f7'" onmouseout="this.style.color='rgba(255,255,255,0.4)'">
          🔑 Forgot Password?
        </button>
      </div>
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

  window.authDoResendConfirmation = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email')?.value || document.getElementById('signup-email')?.value || '';
    const err = document.getElementById('login-error') || document.getElementById('signup-error');
    const resendBtn = document.getElementById('resend-confirm-btn');

    if (!email || !email.includes('@')) {
      if (err) {
        err.innerHTML = '❌ Please enter a valid email address first.';
        err.style.display = 'block';
      }
      return;
    }

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = '⏳ Sending confirmation email...';
    }

    try {
      await resendConfirmationEmail(email);
      if (err) {
        err.innerHTML = '✅ Confirmation email sent. Please check your inbox.';
        err.style.color = '#10b981';
        err.style.background = 'rgba(16,185,129,0.1)';
        err.style.borderColor = 'rgba(16,185,129,0.25)';
        err.style.display = 'block';
      }
    } catch (error) {
      if (err) {
        err.innerHTML = '❌ ' + (error.message || 'Failed to resend confirmation email.');
        err.style.display = 'block';
      }
      if (resendBtn) {
        resendBtn.disabled = false;
      }
    }
  };

  window.authDoSendResetPassword = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email')?.value || '';
    const err = document.getElementById('login-error');

    if (!email || !email.includes('@')) {
      if (err) {
        err.innerHTML = '❌ Please enter your email address above first.';
        err.style.color = '#ef4444';
        err.style.background = 'rgba(239,68,68,0.1)';
        err.style.borderColor = 'rgba(239,68,68,0.2)';
        err.style.display = 'block';
      }
      return;
    }

    if (err) {
      err.innerHTML = '⏳ Sending password reset email...';
      err.style.color = '#3b82f6';
      err.style.background = 'rgba(59,130,246,0.1)';
      err.style.borderColor = 'rgba(59,130,246,0.2)';
      err.style.display = 'block';
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (err) {
          err.innerHTML = '✅ Password reset instructions sent to your inbox.';
          err.style.color = '#10b981';
          err.style.background = 'rgba(16,185,129,0.1)';
          err.style.borderColor = 'rgba(16,185,129,0.25)';
          err.style.display = 'block';
        }
      } else {
        throw new Error(data.error || 'Failed to send password reset email');
      }
    } catch (error) {
      if (err) {
        err.innerHTML = '❌ ' + (error.message || 'Error sending password reset email');
        err.style.color = '#ef4444';
        err.style.background = 'rgba(239,68,68,0.1)';
        err.style.borderColor = 'rgba(239,68,68,0.2)';
        err.style.display = 'block';
      }
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
    if (err) {
      err.style.display = 'none';
      err.style.color = '#ef4444';
      err.style.background = 'rgba(239,68,68,0.1)';
      err.style.borderColor = 'rgba(239,68,68,0.2)';
    }

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
      const msg = e.message || '';
      const isUnconfirmed = msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('email_not_confirmed');

      if (err) {
        if (isUnconfirmed) {
          err.innerHTML = `
            <div style="margin-bottom:8px;font-weight:700">❌ Please confirm your email before signing in.</div>
            <button id="resend-confirm-btn" onclick="authDoResendConfirmation(event)" style="
              padding:8px 12px;background:rgba(124,58,237,0.25);border:1px solid rgba(124,58,237,0.5);
              border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;
              margin-top:4px;width:100%;font-family:'Inter',sans-serif;transition:all 0.2s;
            ">
              📧 Resend confirmation email
            </button>
          `;
        } else {
          err.textContent = '❌ ' + (msg || 'Login failed.');
        }
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
  const autocomplete = id.includes('email')
    ? 'email'
    : id.includes('name')
      ? 'name'
      : id.includes('confirm')
        ? 'new-password'
        : id.includes('signup')
          ? 'new-password'
          : 'current-password';

  return `
    <div style="margin-bottom:14px">
      <label for="${id}" style="font-size:0.7rem;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:6px">
        ${icon} ${label}
      </label>
      <input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" placeholder="${placeholder}" required style="
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

export function renderResetPasswordPage(onSuccess) {
  // Parse and store recovery session token immediately upon page load
  try {
    const hash = window.location.hash || '';
    if (hash.includes('access_token=')) {
      const hashPart = hash.replace(/^#/, '');
      const params = new URLSearchParams(hashPart);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken) {
        window.__recoverySession = { accessToken, refreshToken };
        import('./services/SupabaseClient.js').then(({ supabase }) => {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
        });
      }
    }
  } catch (e) {}

  document.body.innerHTML = `
<div id="reset-password-page" style="
  min-height:100vh;width:100vw;
  background:#050508;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  font-family:'Inter',sans-serif;
  overflow:hidden;position:relative;
">
  <!-- Animated background canvas -->
  <canvas id="auth-canvas" style="position:fixed;inset:0;z-index:0;width:100%;height:100%"></canvas>

  <!-- Reset Password Card -->
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
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="
        width:56px;height:56px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border-radius:16px;
        display:inline-flex;align-items:center;justify-content:center;
        font-size:26px;margin-bottom:16px;
        box-shadow:0 0 30px rgba(124,58,237,0.5);
      ">🔑</div>
      <h1 style="margin:0;font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Outfit',sans-serif">
        Set New Password
      </h1>
      <div style="font-size:0.78rem;color:rgba(255,255,255,0.45);margin-top:6px;line-height:1.5">
        Create a new secure password for your 3D Portfolio account
      </div>
    </div>

    <!-- FORM -->
    <form id="form-reset-password" onsubmit="authDoUpdatePassword(event)">
      <div style="margin-bottom:18px">
        <label for="reset-new-password" style="display:block;font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:8px">🔑 New Password (min 8 chars)</label>
        <input type="password" id="reset-new-password" name="new-password" autocomplete="new-password" placeholder="••••••••" required minlength="8" style="
          width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;
          font-size:0.88rem;outline:none;box-sizing:border-box;
        "/>
      </div>
      <div style="margin-bottom:20px">
        <label for="reset-confirm-password" style="display:block;font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:8px">🔐 Confirm New Password</label>
        <input type="password" id="reset-confirm-password" name="confirm-password" autocomplete="new-password" placeholder="••••••••" required minlength="8" style="
          width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;
          font-size:0.88rem;outline:none;box-sizing:border-box;
        "/>
      </div>
      
      <div id="reset-error" style="display:none;font-size:0.8rem;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px"></div>
      <div id="reset-success" style="display:none;font-size:0.85rem;color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:16px;margin-bottom:16px;text-align:center"></div>

      <button type="submit" id="reset-submit-btn" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border:none;border-radius:12px;
        color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;
        font-family:'Inter',sans-serif;letter-spacing:0.5px;
        transition:all 0.3s;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 30px rgba(124,58,237,0.4)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        ⚡ Update Password
      </button>
    </form>
  </div>
</div>
  `;

  initAuthCanvas();

  window.authDoUpdatePassword = async (e) => {
    if (e) e.preventDefault();
    const newPass = document.getElementById('reset-new-password')?.value || '';
    const confirmPass = document.getElementById('reset-confirm-password')?.value || '';
    const btn = document.getElementById('reset-submit-btn');
    const err = document.getElementById('reset-error');
    const succ = document.getElementById('reset-success');

    if (newPass.length < 8) {
      if (err) {
        err.textContent = '❌ Password must be at least 8 characters long.';
        err.style.display = 'block';
      }
      return;
    }

    if (newPass !== confirmPass) {
      if (err) {
        err.textContent = '❌ Passwords do not match.';
        err.style.display = 'block';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Updating Password...';
    }
    if (err) err.style.display = 'none';

    try {
      const { supabase } = await import('./services/SupabaseClient.js');

      if (window.__recoverySession?.accessToken) {
        await supabase.auth.setSession({
          access_token: window.__recoverySession.accessToken,
          refresh_token: window.__recoverySession.refreshToken || ''
        });
      }

      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;

      if (succ) {
        succ.innerHTML = `
          <div style="font-weight:800;font-size:1rem;margin-bottom:6px">✅ Password updated successfully!</div>
          <div style="font-size:0.78rem;color:rgba(255,255,255,0.7);margin-bottom:14px">Your password has been updated. You can now sign in.</div>
          <button type="button" onclick="window.location.href='/login'" style="
            width:100%;padding:11px;background:linear-gradient(135deg,#7c3aed,#06b6d4);
            border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;font-size:0.85rem;
          ">⚡ Proceed to Sign In</button>
        `;
        succ.style.display = 'block';
      }
      if (btn) btn.style.display = 'none';
      const form = document.getElementById('form-reset-password');
      if (form) form.style.display = 'none';

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Password update error:', error);
      if (err) {
        err.textContent = '❌ ' + (error.message || 'Failed to update password.');
        err.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Update Password';
      }
    }
  };
}
