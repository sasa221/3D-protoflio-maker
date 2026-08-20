/**
 * AuthPage.js
 * Comprehensive Authentication & Email OTP Verification for Portfolio Maker.
 * Server-authoritative email confirmation with OTP UI,
 * auto-advance, paste support, resend cooldown, and centralized error mapping.
 */

import {
  signUp, login, getSession, isLoggedIn, getCurrentUser, verifyEmailOtp, resendEmailOtp, isEmailVerified
} from './services/AuthService.js';
import { mapAuthError } from './services/AuthErrorMapper.js';
import { PLAN_CONFIG } from './services/EntitlementService.js';
import { EMAIL_OTP_LENGTH } from './config/PlanConfig.js';

function maskEmail(email = '') {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
}

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

  <!-- Auth Card Container -->
  <div id="auth-card-container" style="
    position:relative;z-index:10;
    width:100%;max-width:420px;
    background:rgba(10,10,22,0.92);
    backdrop-filter:blur(30px);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:24px;
    padding:40px 36px;
    box-shadow:0 40px 80px rgba(0,0,0,0.6);
    margin:20px;
  ">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="
        width:56px;height:56px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border-radius:16px;
        display:inline-flex;align-items:center;justify-content:center;
        font-size:26px;margin-bottom:14px;
        box-shadow:0 0 30px rgba(124,58,237,0.5);
      ">⚡</div>
      <h1 style="margin:0;font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Outfit',sans-serif">
        3D Portfolio Maker
      </h1>
      <div style="font-size:0.7rem;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;margin-top:4px">
        Ultra Studio
      </div>
    </div>

    <!-- MAIN AUTH VIEW (Tabs + Forms) -->
    <div id="auth-main-view">
      <!-- TABS -->
      <div style="display:flex;background:rgba(255,255,255,0.04);border-radius:12px;padding:4px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.06)">
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
        ">
          ⚡ Sign In to Studio
        </button>
      </form>

      <!-- SIGNUP FORM -->
      <form id="form-signup" style="display:none" onsubmit="authDoSignup(event)">
        ${authField('signup-name','Full Name','text','Your Name','👤')}
        ${authField('signup-email','Email Address','email','your@email.com','✉')}
        ${authField('signup-password','Password (min 6 chars)','password','••••••••','🔑')}
        ${authField('signup-confirm','Confirm Password','password','••••••••','🔐')}
        <label style="display:flex;align-items:flex-start;gap:9px;margin:2px 0 14px;color:rgba(255,255,255,0.65);font-size:0.76rem;line-height:1.45;cursor:pointer">
          <input id="signup-terms" type="checkbox" required style="margin-top:2px;accent-color:#7c3aed">
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener" style="color:#a855f7">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener" style="color:#06b6d4">Privacy Policy</a>.</span>
        </label>
        <div id="signup-error" style="display:none;font-size:0.8rem;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px"></div>
        <button type="submit" id="signup-btn" style="
          width:100%;padding:13px;
          background:linear-gradient(135deg,#7c3aed,#06b6d4);
          border:none;border-radius:12px;
          color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;
          font-family:'Inter',sans-serif;letter-spacing:0.5px;
          transition:all 0.3s;
        ">
          🚀 Create Free Account
        </button>
      </form>

      <!-- PLAN INFO -->
      <div style="
        margin-top:24px;padding:14px;
        background:rgba(124,58,237,0.06);
        border:1px solid rgba(124,58,237,0.15);
        border-radius:12px;font-size:0.78rem;
        color:rgba(255,255,255,0.5);line-height:1.6;
      ">
        <div style="color:rgba(124,58,237,0.9);font-weight:700;margin-bottom:6px">🆓 Free Plan includes:</div>
        <div>✓ 1 Lifetime 3D Portfolio Slot</div>
        <div>✓ Cinematic 3D Rendering & HTML Export</div>
        <div>✓ Minimal Orbit, Liquid Prism & Code Matrix Themes</div>
      </div>
    </div>

    <!-- OTP VERIFICATION VIEW -->
    <div id="auth-otp-view" style="display:none">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#fff">Verify your email</h2>
        <p style="margin:0;font-size:0.85rem;color:rgba(255,255,255,0.6);line-height:1.4">
          We sent a verification code to<br/>
          <strong id="otp-target-email" style="color:#c084fc"></strong>
        </p>
      </div>

      <!-- Configurable OTP Box Grid -->
      <div style="display:flex;gap:6px;justify-content:center;margin-bottom:20px;flex-wrap:nowrap;" id="otp-input-container">
        ${Array.from({ length: EMAIL_OTP_LENGTH }, (_, i) => `
          <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]*" class="otp-digit" data-index="${i}" style="${otpBoxStyle(EMAIL_OTP_LENGTH)}"/>
        `).join('')}
      </div>

      <div id="otp-status-msg" style="display:none;font-size:0.82rem;border-radius:8px;padding:10px 14px;margin-bottom:16px;text-align:center"></div>

      <button id="otp-verify-btn" onclick="authDoVerifyOtp()" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#7c3aed,#06b6d4);
        border:none;border-radius:12px;
        color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;
        font-family:'Inter',sans-serif;margin-bottom:14px;
        transition:all 0.2s;
      ">
        ✓ Verify Email
      </button>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:rgba(255,255,255,0.6)">
        <button id="otp-resend-btn" onclick="authDoResendOtp()" style="background:none;border:none;color:#a855f7;font-weight:600;cursor:pointer;padding:0;font-size:0.8rem;text-decoration:underline">
          Resend Code
        </button>
        <button onclick="authBackToLogin()" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:0;font-size:0.8rem">
          ← Back to Sign In
        </button>
      </div>
    </div>
  </div>
</div>`;

  initAuthCanvas();
  setupOtpInputHandlers(onSuccess);

  let currentPendingEmail = '';
  let resendCooldownTimer = null;
  let cooldownSecondsLeft = 0;

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

  window.showOtpScreen = (email) => {
    currentPendingEmail = email;
    const mainView = document.getElementById('auth-main-view');
    const otpView = document.getElementById('auth-otp-view');
    const targetEmailLabel = document.getElementById('otp-target-email');
    if (targetEmailLabel) targetEmailLabel.textContent = maskEmail(email);
    if (mainView) mainView.style.display = 'none';
    if (otpView) otpView.style.display = 'block';

    // Focus first OTP box
    const firstInput = document.querySelector('.otp-digit[data-index="0"]');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);

    startResendCountdown(60);
  };

  window.authBackToLogin = () => {
    const mainView = document.getElementById('auth-main-view');
    const otpView = document.getElementById('auth-otp-view');
    if (otpView) otpView.style.display = 'none';
    if (mainView) mainView.style.display = 'block';
    authSwitchTab('login');
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
      const email = document.getElementById('login-email')?.value?.trim() || '';
      const password = document.getElementById('login-password')?.value || '';
      const res = await login(email, password);

      if (res?.user) {
        if (!isEmailVerified(res.user)) {
          showOtpScreen(email);
          return;
        }
        onSuccess(res.user);
      }
    } catch (e) {
      const mapped = mapAuthError(e);
      if (mapped.type === 'unverified') {
        const email = document.getElementById('login-email')?.value?.trim() || '';
        showOtpScreen(email);
        return;
      }

      if (err) {
        err.textContent = mapped.userFacing;
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
    const email = document.getElementById('signup-email')?.value?.trim() || '';
    const password = document.getElementById('signup-password')?.value || '';
    const confirm = document.getElementById('signup-confirm')?.value || '';
    const name = document.getElementById('signup-name')?.value?.trim() || '';
    const acceptedTerms = Boolean(document.getElementById('signup-terms')?.checked);
    const err = document.getElementById('signup-error');
    if (err) err.style.display = 'none';

    if (!acceptedTerms) {
      if (err) {
        err.textContent = 'Please accept the Terms of Service and Privacy Policy.';
        err.style.display = 'block';
      }
      return;
    }

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
      if (res?.user) {
        // If email is already confirmed (e.g. email confirmations disabled in test environment)
        if (isEmailVerified(res.user) && res.session) {
          onSuccess(res.user);
        } else {
          // Transition to OTP Screen
          showOtpScreen(email);
        }
      }
    } catch (e) {
      const mapped = mapAuthError(e);
      if (err) {
        err.textContent = mapped.userFacing;
        err.style.display = 'block';
      }
      if (btn) {
        btn.textContent = '🚀 Create Free Account';
        btn.disabled = false;
      }
    }
  };

  window.authDoVerifyOtp = async () => {
    const digits = Array.from(document.querySelectorAll('.otp-digit')).map(input => input.value).join('');
    const statusMsg = document.getElementById('otp-status-msg');
    const verifyBtn = document.getElementById('otp-verify-btn');

    if (digits.length !== EMAIL_OTP_LENGTH || !/^\d+$/.test(digits)) {
      if (statusMsg) {
        statusMsg.textContent = `Please enter the complete ${EMAIL_OTP_LENGTH}-digit verification code.`;
        statusMsg.style.color = '#ef4444';
        statusMsg.style.background = 'rgba(239,68,68,0.1)';
        statusMsg.style.border = '1px solid rgba(239,68,68,0.2)';
        statusMsg.style.display = 'block';
      }
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
    }
    if (statusMsg) statusMsg.style.display = 'none';

    try {
      const data = await verifyEmailOtp(currentPendingEmail, digits);
      if (statusMsg) {
        statusMsg.textContent = 'Email verified ✓ Redirecting to Studio...';
        statusMsg.style.color = '#10b981';
        statusMsg.style.background = 'rgba(16,185,129,0.1)';
        statusMsg.style.border = '1px solid rgba(16,185,129,0.25)';
        statusMsg.style.display = 'block';
      }
      setTimeout(() => {
        onSuccess(data?.user || getCurrentUser());
      }, 600);
    } catch (err) {
      const mapped = mapAuthError(err);
      if (statusMsg) {
        statusMsg.textContent = mapped.userFacing;
        statusMsg.style.color = '#ef4444';
        statusMsg.style.background = 'rgba(239,68,68,0.1)';
        statusMsg.style.border = '1px solid rgba(239,68,68,0.2)';
        statusMsg.style.display = 'block';
      }
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '✓ Verify Email';
      }
    }
  };

  window.authDoResendOtp = async () => {
    if (cooldownSecondsLeft > 0) return;
    const resendBtn = document.getElementById('otp-resend-btn');
    const statusMsg = document.getElementById('otp-status-msg');

    if (resendBtn) resendBtn.textContent = 'Sending...';

    try {
      await resendEmailOtp(currentPendingEmail);
      if (statusMsg) {
        statusMsg.textContent = 'New verification code sent to your email.';
        statusMsg.style.color = '#10b981';
        statusMsg.style.background = 'rgba(16,185,129,0.1)';
        statusMsg.style.border = '1px solid rgba(16,185,129,0.25)';
        statusMsg.style.display = 'block';
      }
      startResendCountdown(60);
    } catch (err) {
      const mapped = mapAuthError(err);
      if (statusMsg) {
        statusMsg.textContent = mapped.userFacing;
        statusMsg.style.color = '#ef4444';
        statusMsg.style.background = 'rgba(239,68,68,0.1)';
        statusMsg.style.border = '1px solid rgba(239,68,68,0.2)';
        statusMsg.style.display = 'block';
      }
      startResendCountdown(15);
    }
  };

  function startResendCountdown(seconds) {
    clearInterval(resendCooldownTimer);
    cooldownSecondsLeft = seconds;
    const resendBtn = document.getElementById('otp-resend-btn');
    if (!resendBtn) return;

    resendBtn.disabled = true;
    resendBtn.style.color = 'rgba(255,255,255,0.4)';
    resendBtn.style.textDecoration = 'none';
    resendBtn.textContent = `Resend in ${cooldownSecondsLeft}s`;

    resendCooldownTimer = setInterval(() => {
      cooldownSecondsLeft--;
      if (cooldownSecondsLeft <= 0) {
        clearInterval(resendCooldownTimer);
        resendBtn.disabled = false;
        resendBtn.style.color = '#a855f7';
        resendBtn.style.textDecoration = 'underline';
        resendBtn.textContent = 'Resend Code';
      } else {
        resendBtn.textContent = `Resend in ${cooldownSecondsLeft}s`;
      }
    }, 1000);
  }

  window.authDoSendResetPassword = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email')?.value?.trim() || '';
    const err = document.getElementById('login-error');

    if (!email || !email.includes('@')) {
      if (err) {
        err.textContent = 'Please enter your email address in the Email box first.';
        err.style.display = 'block';
      }
      return;
    }

    if (err) {
      err.textContent = '⏳ Sending password reset instructions...';
      err.style.color = '#38bdf8';
      err.style.background = 'rgba(56,189,248,0.1)';
      err.style.border = '1px solid rgba(56,189,248,0.2)';
      err.style.display = 'block';
    }

    try {
      const res = await fetch('/api/public?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (err) {
        err.textContent = '✅ Password reset instructions sent. Please check your inbox.';
        err.style.color = '#10b981';
        err.style.background = 'rgba(16,185,129,0.1)';
        err.style.border = '1px solid rgba(16,185,129,0.25)';
        err.style.display = 'block';
      }
    } catch (_) {
      if (err) {
        err.textContent = 'We sent password reset instructions if an account exists.';
        err.style.display = 'block';
      }
    }
  };
}

function otpBoxStyle(otpLength = EMAIL_OTP_LENGTH) {
  const isLarge = otpLength > 6;
  return `
    width:${isLarge ? '36px' : '46px'};height:${isLarge ? '48px' : '54px'};
    background:rgba(255,255,255,0.06);
    border:1.5px solid rgba(255,255,255,0.15);
    border-radius:10px;
    color:#fff;font-size:${isLarge ? '1.2rem' : '1.4rem'};
    font-weight:800;text-align:center;
    outline:none;font-family:'Courier New',Courier,monospace;
    transition:all 0.2s ease;box-sizing:border-box;
    padding:0;
  `;
}

function setupOtpInputHandlers(onSuccess) {
  setTimeout(() => {
    const inputs = document.querySelectorAll('.otp-digit');
    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!/^[0-9]$/.test(val)) {
          e.target.value = '';
          return;
        }
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        } else {
          // All entered
          const fullCode = Array.from(inputs).map(i => i.value).join('');
          if (fullCode.length === EMAIL_OTP_LENGTH && /^\d+$/.test(fullCode)) {
            window.authDoVerifyOtp();
          }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          inputs[idx - 1].focus();
        } else if (e.key === 'Enter') {
          window.authDoVerifyOtp();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
        const digitsOnly = pasteData.replace(/\D/g, '');
        if (digitsOnly.length >= EMAIL_OTP_LENGTH) {
          const targetDigits = digitsOnly.slice(0, EMAIL_OTP_LENGTH);
          targetDigits.split('').forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
          });
          inputs[inputs.length - 1].focus();
          window.authDoVerifyOtp();
        }
      });

      input.addEventListener('focus', () => {
        input.style.borderColor = '#a855f7';
        input.style.boxShadow = '0 0 12px rgba(168,85,247,0.35)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = 'rgba(255,255,255,0.15)';
        input.style.boxShadow = 'none';
      });
    });
  }, 50);
}

function authField(id, label, type, placeholder, icon) {
  return `
    <div style="margin-bottom:16px">
      <label for="${id}" style="display:block;font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.7);margin-bottom:6px">
        ${icon} ${label}
      </label>
      <input type="${type}" id="${id}" placeholder="${placeholder}" required style="
        width:100%;padding:11px 14px;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:10px;color:#fff;font-size:0.88rem;
        outline:none;font-family:'Inter',sans-serif;
        box-sizing:border-box;transition:border-color 0.2s;
      " onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'"/>
    </div>`;
}

export function renderResetPasswordPage(onSuccess) {
  document.body.innerHTML = `
<div style="min-height:100vh;background:#050508;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;padding:20px;">
  <div style="width:100%;max-width:400px;background:rgba(10,10,22,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:36px;color:#fff;">
    <h2 style="margin:0 0 10px;font-size:1.3rem;font-weight:800;text-align:center;">Set New Password</h2>
    <form id="form-reset-password" onsubmit="authDoUpdatePassword(event)">
      <div style="margin-bottom:16px">
        <label style="font-size:0.75rem;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px">New Password (min 8 chars)</label>
        <input type="password" id="reset-new-password" minlength="8" required placeholder="••••••••" style="width:100%;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;box-sizing:border-box;"/>
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:0.75rem;color:rgba(255,255,255,0.7);display:block;margin-bottom:6px">Confirm New Password</label>
        <input type="password" id="reset-confirm-password" minlength="8" required placeholder="••••••••" style="width:100%;padding:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;box-sizing:border-box;"/>
      </div>
      <div id="reset-error" style="display:none;color:#ef4444;font-size:0.8rem;margin-bottom:14px;"></div>
      <div id="reset-success" style="display:none;color:#10b981;font-size:0.85rem;margin-bottom:14px;text-align:center;"></div>
      <button type="submit" id="reset-submit-btn" style="width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#06b6d4);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer;">
        Update Password
      </button>
    </form>
  </div>
</div>`;

  window.authDoUpdatePassword = async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('reset-new-password')?.value || '';
    const confirmPass = document.getElementById('reset-confirm-password')?.value || '';
    const err = document.getElementById('reset-error');
    const succ = document.getElementById('reset-success');
    const btn = document.getElementById('reset-submit-btn');

    if (newPass !== confirmPass) {
      if (err) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; }
      return;
    }

    if (btn) btn.disabled = true;

    try {
      const { updateUserPassword } = await import('./services/AuthService.js');
      await updateUserPassword(newPass);
      if (succ) {
        succ.textContent = 'Password successfully updated! Redirecting to sign in...';
        succ.style.display = 'block';
      }
      setTimeout(() => { window.location.href = '/login'; }, 1200);
    } catch (error) {
      if (err) { err.textContent = error.message; err.style.display = 'block'; }
      if (btn) btn.disabled = false;
    }
  };
}

function initAuthCanvas() {
  const canvas = document.getElementById('auth-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    radius: Math.random() * 2 + 1,
    alpha: Math.random() * 0.5 + 0.2
  }));

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(124, 58, 237, ${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}
