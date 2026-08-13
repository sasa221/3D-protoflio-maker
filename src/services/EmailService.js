/**
 * EmailService.js
 * Client wrapper for transactional email operations via backend /api/auth/reset-password.
 * Keeps BREVO_API_KEY strictly on the server side.
 */

export async function sendPasswordResetEmail(email) {
  if (!email) throw new Error('Email is required for password reset.');

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to send password reset email');
    }

    return data;
  } catch (err) {
    console.error('[EmailService] Password reset error:', err.message);
    throw err;
  }
}
