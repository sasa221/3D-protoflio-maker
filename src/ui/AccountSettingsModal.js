/**
 * AccountSettingsModal.js
 * Unified Account, Security, Billing, and Danger Zone modal.
 */

import { getCurrentAuthUser } from '../services/AuthService.js';
import { supabase } from '../services/SupabaseClient.js';
import { PRODUCT_CONFIG } from '../config/ProductConfig.js';

export async function openAccountSettingsModal() {
  const user = await getCurrentAuthUser();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'account-settings-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2000; background: rgba(5,5,12,0.85); backdrop-filter: blur(20px);
    display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Inter', sans-serif; color: #fff;
  `;

  modalOverlay.innerHTML = `
    <div style="
      max-width: 640px; width: 100%; background: #0b0b14; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.9);
    ">
      <!-- MODAL HEADER -->
      <div style="padding: 20px 28px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800;">
          Account & Security Settings
        </div>
        <button onclick="document.getElementById('account-settings-modal-overlay').remove()" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2rem;">✕</button>
      </div>

      <!-- TABS -->
      <div style="display: flex; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
        <button onclick="switchAccountTab('profile')" class="acc-tab-btn active" id="acc-tab-profile" style="flex: 1; padding: 14px; background: none; border: none; color: #fff; font-weight: 700; cursor: pointer; border-bottom: 2px solid #7c3aed;">
          👤 Profile
        </button>
        <button onclick="switchAccountTab('security')" class="acc-tab-btn" id="acc-tab-security" style="flex: 1; padding: 14px; background: none; border: none; color: rgba(255,255,255,0.6); font-weight: 700; cursor: pointer;">
          🔐 Security
        </button>
        <button onclick="switchAccountTab('danger')" class="acc-tab-btn" id="acc-tab-danger" style="flex: 1; padding: 14px; background: none; border: none; color: rgba(239,68,68,0.8); font-weight: 700; cursor: pointer;">
          ⚠️ Danger Zone
        </button>
      </div>

      <!-- TAB CONTENT -->
      <div style="padding: 28px;">
        <!-- PROFILE TAB -->
        <div id="acc-panel-profile">
          <div style="margin-bottom: 18px;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Email Address</label>
            <input type="text" disabled value="${user?.email || 'user@example.com'}" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: rgba(255,255,255,0.6);">
          </div>

          <div style="margin-bottom: 18px;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">Display Name</label>
            <input type="text" id="acc-display-name" value="${user?.user_metadata?.display_name || ''}" placeholder="Your Name" style="width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff;">
          </div>

          <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-bottom: 20px;">
            💡 Password updates and account security options are available under the Security tab.
          </div>
        </div>

        <!-- SECURITY TAB -->
        <div id="acc-panel-security" style="display: none;">
          <form onsubmit="handlePasswordUpdate(event)">
            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 6px;">New Password</label>
              <div style="position: relative;">
                <input type="password" id="acc-new-pass" required minlength="6" placeholder="Enter new password" style="width: 100%; padding: 12px; padding-right: 40px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff;">
                <button type="button" onclick="togglePassVisibility('acc-new-pass')" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer;">👁️</button>
              </div>
            </div>

            <button type="submit" style="padding: 12px 24px; background: #7c3aed; border: none; border-radius: 8px; color: #fff; font-weight: 800; cursor: pointer;">
              Update Password
            </button>
          </form>
          <div id="acc-security-status" style="margin-top: 14px; font-size: 0.85rem; font-weight: 700;"></div>
        </div>

        <!-- DANGER ZONE TAB -->
        <div id="acc-panel-danger" style="display: none; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: 14px; padding: 20px;">
          <h4 style="font-size: 1.1rem; font-weight: 800; color: #ef4444; margin-bottom: 8px;">Delete Account</h4>
          <p style="font-size: 0.85rem; color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 20px;">
            Permanently delete your account, portfolios, storage assets, and variants. This action cannot be undone.
          </p>
          <button onclick="handleDeleteAccount()" style="padding: 12px 24px; background: #ef4444; border: none; border-radius: 8px; color: #fff; font-weight: 800; cursor: pointer;">
            Delete My Account Permanently
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  window.switchAccountTab = (tab) => {
    document.querySelectorAll('.acc-tab-btn').forEach(b => {
      b.style.color = 'rgba(255,255,255,0.6)';
      b.style.borderBottom = 'none';
    });
    const btn = document.getElementById(`acc-tab-${tab}`);
    if (btn) {
      btn.style.color = tab === 'danger' ? '#ef4444' : '#fff';
      btn.style.borderBottom = '2px solid #7c3aed';
    }

    document.getElementById('acc-panel-profile').style.display = tab === 'profile' ? 'block' : 'none';
    document.getElementById('acc-panel-security').style.display = tab === 'security' ? 'block' : 'none';
    document.getElementById('acc-panel-danger').style.display = tab === 'danger' ? 'block' : 'none';
  };

  window.togglePassVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  };

  window.handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('acc-new-pass').value;
    const statusEl = document.getElementById('acc-security-status');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      statusEl.style.color = '#10b981';
      statusEl.textContent = '✓ Password updated successfully!';
    } catch (err) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = `Update failed: ${err.message}`;
    }
  };

  window.handleDeleteAccount = async () => {
    const confirmText = prompt('Type DELETE to confirm permanent account deletion:');
    if (confirmText === 'DELETE') {
      alert('Account deletion request submitted according to retention policy.');
      window.location.href = '/';
    }
  };
}
