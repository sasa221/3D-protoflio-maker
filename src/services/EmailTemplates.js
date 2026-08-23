/**
 * EmailTemplates.js
 * Branded, dark-mode responsive email templates for transactional messaging via Brevo.
 * Safe HTML compatible with Gmail, Apple Mail, Outlook, and webmail clients.
 */

function baseLayout(content, footerNote = 'Portfolio Maker — Professional 3D Portfolio Platform') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Portfolio Maker</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:'Inter',Arial,-apple-system,BlinkMacSystemFont,sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#050508;min-height:100vh;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#0c0d16;border:1px solid #1e2030;border-radius:20px;padding:36px;box-shadow:0 20px 40px rgba(0,0,0,0.5);text-align:left;">
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding-bottom:28px;border-bottom:1px solid #1a1c2b;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <div style="display:inline-block;width:38px;height:38px;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-radius:10px;text-align:center;line-height:38px;font-size:20px;color:#ffffff;box-shadow:0 0 16px rgba(124,58,237,0.4);">⚡</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:900;color:#ffffff;letter-spacing:0.5px;">3D Portfolio Maker</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding-top:28px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid #1a1c2b;text-align:center;color:#6b7280;font-size:11px;line-height:1.6;">
              <p style="margin:0 0 4px;font-weight:600;color:#9ca3af;">${footerNote}</p>
              <p style="margin:0;">If you did not request this email, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateGroupInvitationEmail({ ownerName = 'A teammate', invitationUrl, seatLimit = 2 }) {
  const safeOwner = String(ownerName).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#039;' }[char]));
  const safeUrl = String(invitationUrl || 'https://portfolio-maker-murex.vercel.app/studio').replace(/"/g, '&quot;');
  const content = `
    <div style="background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.35);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center;">
      <span style="font-size:24px;display:block;margin-bottom:4px;">👥</span>
      <strong style="color:#c084fc;font-size:13px;letter-spacing:0.5px;">PREMIUM GROUP INVITATION</strong>
    </div>
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">You’re invited to a Premium Portfolio Group</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">${safeOwner} invited you to join their ${seatLimit}-seat group. You’ll use your own account and portfolio while receiving Premium features and your own usage limits.</p>
    <div style="text-align:center;margin:28px 0;"><a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 30px;border-radius:10px;">Accept Invitation</a></div>
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">Sign in with this email first, then click the button to activate your seat. If you weren’t expecting this invitation, you can ignore it.</p>
  `;
  return baseLayout(content, '3D Portfolio Maker — Premium Group Invitation');
}

export function generateGroupMemberActivatedEmail({ memberName = 'there', ownerName = 'your team owner', activeUntil, studioUrl = 'https://portfolio-maker-murex.vercel.app/studio' }) {
  const content = `
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center;"><span style="font-size:24px;display:block;margin-bottom:4px;">🎉</span><strong style="color:#4ade80;font-size:13px;letter-spacing:.5px;">YOU’RE IN THE GROUP</strong></div>
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Welcome to your Premium Group</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">Hi ${memberName}, ${ownerName}’s invitation was accepted. Your own account now has Premium features, its own portfolio, and its own usage limits.</p>
    ${activeUntil ? `<p style="margin:0 0 18px;font-size:13px;color:#c084fc;">Access is active until <strong>${new Date(activeUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>` : ''}
    <div style="text-align:center;margin:28px 0;"><a href="${studioUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 30px;border-radius:10px;">Open My Studio</a></div>
  `;
  return baseLayout(content, '3D Portfolio Maker — Premium Group Access');
}

export function generateGroupMemberJoinedEmail({ ownerName = 'there', memberEmail, studioUrl = 'https://portfolio-maker-murex.vercel.app/studio' }) {
  const content = `
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center;"><span style="font-size:24px;display:block;margin-bottom:4px;">✅</span><strong style="color:#4ade80;font-size:13px;letter-spacing:.5px;">NEW MEMBER JOINED</strong></div>
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Your Premium Group is growing</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.6;">${memberEmail || 'A teammate'} accepted your invitation and now has their own Premium account and usage limits.</p>
    <div style="text-align:center;margin:28px 0;"><a href="${studioUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0891b2);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 30px;border-radius:10px;">Manage My Team</a></div>
  `;
  return baseLayout(content, '3D Portfolio Maker — Group Management');
}

/**
 * 1. Verification OTP Email
 */
export function generateOtpEmail({ firstName = 'there', otpCode }) {
  const content = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Verify your email</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#d1d5db;line-height:1.5;">
      Enter this verification code in 3D Portfolio Maker:
    </p>
    
    <div style="background-color:#131522;border:1.5px solid #7c3aed;border-radius:14px;padding:22px;text-align:center;margin-bottom:22px;box-shadow:0 0 24px rgba(124,58,237,0.15);">
      <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:900;letter-spacing:8px;color:#c084fc;">${otpCode}</span>
    </div>

    <p style="margin:0 0 12px;font-size:13px;color:#d1d5db;line-height:1.5;">
      Return to the verification screen and enter the code above. This code expires shortly.
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `;
  return baseLayout(content, '3D Portfolio Maker — Account Security');
}

/**
 * 2. Password Reset Email
 */
export function generatePasswordResetEmail({ firstName = 'there', actionUrl }) {
  const content = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#d1d5db;line-height:1.5;">
      You requested to reset your 3D Portfolio Maker password. Click the secure link below to set a new password:
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${actionUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;box-shadow:0 8px 20px rgba(124,58,237,0.35);">Reset Password</a>
    </div>

    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `;
  return baseLayout(content, '3D Portfolio Maker — Account Security');
}

/**
 * 3. Admin Notification: New Manual Payment Request
 */
export function generateAdminNewPaymentEmail({ userName, userEmail, planName, amountEGP, requestId, submittedAt }) {
  const content = `
    <div style="background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.35);border-radius:10px;padding:10px 14px;margin-bottom:20px;">
      <strong style="color:#fde047;font-size:12px;letter-spacing:0.5px;">🔔 ADMIN ALERT — NEW PAYMENT REVIEW</strong>
    </div>

    <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#ffffff;">Payment Verification Required</h2>
    <table role="presentation" width="100%" style="font-size:13px;color:#d1d5db;line-height:1.9;margin-bottom:24px;">
      <tr><td width="35%" style="color:#9ca3af;">Customer:</td><td><strong>${userName}</strong></td></tr>
      <tr><td style="color:#9ca3af;">Email:</td><td>${userEmail}</td></tr>
      <tr><td style="color:#9ca3af;">Requested Plan:</td><td><strong style="color:#c084fc;">${planName.toUpperCase()}</strong></td></tr>
      <tr><td style="color:#9ca3af;">Expected Amount:</td><td><strong style="color:#4ade80;">${amountEGP.toLocaleString()} EGP</strong></td></tr>
      <tr><td style="color:#9ca3af;">Request ID:</td><td style="font-family:monospace;color:#93c5fd;">${requestId}</td></tr>
      <tr><td style="color:#9ca3af;">Submitted:</td><td>${new Date(submittedAt).toLocaleString()}</td></tr>
    </table>

    <div style="text-align:center;margin-top:20px;">
      <a href="https://portfolio-maker-murex.vercel.app/admin" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;">Review Payment</a>
    </div>
  `;
  return baseLayout(content, '3D Portfolio Maker — Operational Notification');
}

/**
 * 4. User Payment Approved Email
 */
export function generatePaymentApprovedEmail({ firstName = 'there', planName, activeUntil, groupSeats, portfolioName }) {
  const details = groupSeats
    ? `<div style="margin-top:6px;font-size:13px;color:#c084fc;">Group Access: <strong>${groupSeats} member seats</strong></div>`
    : portfolioName
    ? `<div style="margin-top:6px;font-size:13px;color:#c084fc;">Portfolio: <strong>${portfolioName}</strong></div>`
    : '';

  const content = `
    <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.35);border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center;">
      <span style="font-size:22px;display:block;margin-bottom:4px;">🎉</span>
      <strong style="color:#4ade80;font-size:13px;letter-spacing:0.5px;">PAYMENT VERIFIED</strong>
    </div>

    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Welcome to 3D Portfolio Maker ${planName.toUpperCase()}!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, your payment has been reviewed and approved.
    </p>

    <div style="background-color:#131522;border:1px solid #1e2030;border-radius:12px;padding:18px;margin-bottom:24px;font-size:13px;line-height:1.8;">
      <div>Plan: <strong style="color:#c084fc;">${planName.toUpperCase()}</strong></div>
      <div>Status: <strong style="color:#4ade80;">Active</strong></div>
      ${activeUntil ? `<div>Active Until: <strong>${new Date(activeUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>` : ''}
      ${details}
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://portfolio-maker-murex.vercel.app/studio${groupSeats ? '?manage_group=1' : ''}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;box-shadow:0 8px 20px rgba(124,58,237,0.35);">${groupSeats ? 'Open Studio & Invite Team' : 'Open Studio'}</a>
    </div>
  `;
  return baseLayout(content, '3D Portfolio Maker — Subscription Management');
}

/**
 * 5. User Payment Rejected Email
 */
export function generatePaymentRejectedEmail({ firstName = 'there', planName, reason }) {
  const content = `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:12px 16px;margin-bottom:20px;">
      <strong style="color:#f87171;font-size:13px;letter-spacing:0.5px;">Update on your payment verification</strong>
    </div>

    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">We couldn't verify this payment submission</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, we reviewed your transfer submission for <strong>${planName.toUpperCase()}</strong>, but were unable to verify it.
    </p>

    <div style="background-color:#131522;border:1px solid #281e28;border-radius:12px;padding:16px;margin-bottom:24px;">
      <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Reason:</span>
      <span style="color:#ffffff;font-size:13px;line-height:1.5;">${reason || 'Transfer confirmation was not found or screenshot was unclear.'}</span>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">
      No charge was processed. Please check your InstaPay receipt and submit again, or contact support if you have questions.
    </p>

    <div style="text-align:center;">
      <a href="https://portfolio-maker-murex.vercel.app/pricing" style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;">Review Payment Details</a>
    </div>
  `;
  return baseLayout(content, '3D Portfolio Maker — Billing Support');
}
