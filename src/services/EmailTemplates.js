/**
 * EmailTemplates.js
 * Branded, dark-mode responsive email templates for transactional messaging via Brevo.
 * Safe HTML compatible with Gmail, Apple Mail, Outlook, and webmail clients.
 */

function baseLayout(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Maker</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:'Inter',Arial,sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#050508;min-height:100vh;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="540" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background-color:#0c0d16;border:1px solid #1e2030;border-radius:20px;padding:36px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding-bottom:28px;border-bottom:1px solid #1a1c2b;">
              <div style="display:inline-block;width:44px;height:44px;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-radius:12px;text-align:center;line-height:44px;font-size:22px;color:#ffffff;box-shadow:0 0 20px rgba(124,58,237,0.4);">⚡</div>
              <h1 style="margin:12px 0 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Portfolio Maker</h1>
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
              <p style="margin:0 0 4px;">Portfolio Maker — Professional 3D Portfolio Platform</p>
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

/**
 * 1. Verification OTP Email
 */
export function generateOtpEmail({ firstName = 'there', otpCode }) {
  const content = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">Verify your email</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, enter this verification code to complete your Portfolio Maker account registration:
    </p>
    
    <div style="background-color:#131522;border:1px solid #7c3aed;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:900;letter-spacing:6px;color:#c084fc;">${otpCode}</span>
    </div>

    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
      Enter this code on the website where your account is open. This code expires in 10 minutes.
    </p>
  `;
  return baseLayout(content);
}

/**
 * 2. Password Reset Email
 */
export function generatePasswordResetEmail({ firstName = 'there', actionUrl }) {
  const content = `
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, you requested to reset your Portfolio Maker password. Click the secure link below to set a new password:
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="${actionUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;box-shadow:0 8px 20px rgba(124,58,237,0.35);">Reset Password</a>
    </div>

    <p style="margin:0;font-size:12px;color:#6b7280;">
      If you did not request a password reset, you can safely ignore this email.
    </p>
  `;
  return baseLayout(content);
}

/**
 * 3. Admin Notification: New Manual Payment Request
 */
export function generateAdminNewPaymentEmail({ userName, userEmail, planName, amountEGP, requestId, submittedAt, proofUrl }) {
  const content = `
    <div style="background:rgba(234,179,8,0.1);border:1px solid #eab30855;border-radius:10px;padding:10px 14px;margin-bottom:20px;">
      <strong style="color:#fde047;font-size:13px;">🔔 NEW PAYMENT SUBMITTED</strong>
    </div>

    <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#ffffff;">Payment Verification Required</h2>
    <table role="presentation" width="100%" style="font-size:13px;color:#d1d5db;line-height:1.8;margin-bottom:24px;">
      <tr><td width="35%" style="color:#9ca3af;">Customer:</td><td><strong>${userName}</strong> (${userEmail})</td></tr>
      <tr><td style="color:#9ca3af;">Plan Requested:</td><td><strong style="color:#c084fc;">${planName.toUpperCase()}</strong></td></tr>
      <tr><td style="color:#9ca3af;">Expected Amount:</td><td><strong>${amountEGP.toLocaleString()} EGP</strong></td></tr>
      <tr><td style="color:#9ca3af;">Request ID:</td><td style="font-family:monospace;color:#93c5fd;">${requestId}</td></tr>
      <tr><td style="color:#9ca3af;">Submitted:</td><td>${new Date(submittedAt).toLocaleString()}</td></tr>
    </table>

    <div style="text-align:center;margin-top:20px;">
      <a href="https://portfolio-maker-murex.vercel.app/admin" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;">Open Admin Payment Queue</a>
    </div>
  `;
  return baseLayout(content);
}

/**
 * 4. User Payment Approved Email
 */
export function generatePaymentApprovedEmail({ firstName = 'there', planName, activeUntil, groupSeats, portfolioName }) {
  const details = groupSeats
    ? `<p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">Includes Premium access for up to <strong>${groupSeats} group members</strong>.</p>`
    : portfolioName
    ? `<p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">Keep It Live active for portfolio: <strong>${portfolioName}</strong>.</p>`
    : '';

  const content = `
    <div style="background:rgba(34,197,94,0.1);border:1px solid #22c55e55;border-radius:10px;padding:12px 16px;margin-bottom:20px;text-align:center;">
      <span style="font-size:22px;display:block;margin-bottom:4px;">🎉</span>
      <strong style="color:#4ade80;font-size:14px;">Payment Verified & Subscription Activated</strong>
    </div>

    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">Welcome to Portfolio Maker ${planName}!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, your manual InstaPay transfer has been reviewed and approved. Your plan is now active.
    </p>

    <div style="background-color:#131522;border:1px solid #1e2030;border-radius:12px;padding:18px;margin-bottom:24px;font-size:13px;line-height:1.8;">
      <div>Plan: <strong style="color:#c084fc;">${planName.toUpperCase()}</strong></div>
      <div>Status: <strong style="color:#4ade80;">Active</strong></div>
      ${activeUntil ? `<div>Active Until: <strong>${new Date(activeUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>` : ''}
      ${details}
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://portfolio-maker-murex.vercel.app/studio" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;box-shadow:0 8px 20px rgba(124,58,237,0.35);">Open Ultra Studio</a>
    </div>
  `;
  return baseLayout(content);
}

/**
 * 5. User Payment Rejected Email
 */
export function generatePaymentRejectedEmail({ firstName = 'there', planName, reason }) {
  const content = `
    <div style="background:rgba(239,68,68,0.1);border:1px solid #ef444455;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
      <strong style="color:#f87171;font-size:14px;">Payment Verification Notice</strong>
    </div>

    <h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#ffffff;">We couldn't verify your payment</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.5;">
      Hi ${firstName}, we reviewed your transfer submission for <strong>${planName.toUpperCase()}</strong>, but were unable to verify it.
    </p>

    <div style="background-color:#131522;border:1px solid #281e28;border-radius:12px;padding:16px;margin-bottom:24px;">
      <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">Reason:</span>
      <span style="color:#ffffff;font-size:13px;line-height:1.5;">${reason || 'Transfer confirmation was not found or screenshot was unclear.'}</span>
    </div>

    <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">
      No charge was processed. Please verify your InstaPay receipt and submit again, or contact support if you believe this was an error.
    </p>

    <div style="text-align:center;">
      <a href="https://portfolio-maker-murex.vercel.app/pricing" style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;">Review Payment Details</a>
    </div>
  `;
  return baseLayout(content);
}
