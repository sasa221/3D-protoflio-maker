/**
 * AuthErrorMapper.js
 * Centralized, friendly error mapper for Authentication, OTP, and Billing flows.
 * Eliminates raw Supabase/PostgREST error codes and avoids user confusion.
 */

export function mapAuthError(err) {
  if (!err) return 'An unknown error occurred. Please try again.';

  const message = typeof err === 'string' ? err : err.message || '';
  const code = err.code || '';
  const msgLower = message.toLowerCase();

  // 1. Email Confirmation & Verification
  if (
    msgLower.includes('email not confirmed') ||
    msgLower.includes('email_not_confirmed') ||
    code === 'email_not_confirmed' ||
    msgLower.includes('confirm your email')
  ) {
    return {
      type: 'unverified',
      message: 'Verify your email to continue.',
      userFacing: 'Verify your email to continue.'
    };
  }

  // 2. Invalid Credentials / Wrong Password
  if (
    msgLower.includes('invalid login credentials') ||
    msgLower.includes('invalid_credentials') ||
    code === 'invalid_credentials' ||
    msgLower.includes('invalid username or password')
  ) {
    return {
      type: 'invalid_credentials',
      message: "We couldn't sign you in with that email and password.",
      userFacing: "We couldn't sign you in with that email and password."
    };
  }

  // 3. OTP Code Errors
  if (
    msgLower.includes('token has expired') ||
    msgLower.includes('otp expired') ||
    code === 'otp_expired' ||
    msgLower.includes('token expired')
  ) {
    return {
      type: 'otp_expired',
      message: 'This code has expired. Request a new one.',
      userFacing: 'This code has expired. Request a new one.'
    };
  }

  if (
    msgLower.includes('invalid token') ||
    msgLower.includes('token is invalid') ||
    msgLower.includes('invalid otp') ||
    msgLower.includes('token not found') ||
    msgLower.includes('incorrect') ||
    msgLower.includes('wrong code')
  ) {
    return {
      type: 'invalid_otp',
      message: 'That verification code is incorrect.',
      userFacing: 'That verification code is incorrect.'
    };
  }

  // 4. Rate Limiting & Throttling
  if (
    msgLower.includes('rate limit') ||
    msgLower.includes('over_email_send_rate_limit') ||
    msgLower.includes('too many requests') ||
    code === '429'
  ) {
    return {
      type: 'rate_limit',
      message: 'Please wait before requesting another code.',
      userFacing: 'Please wait before requesting another code.'
    };
  }

  // 5. User Already Registered
  if (msgLower.includes('user already registered') || msgLower.includes('email already in use')) {
    return {
      type: 'already_registered',
      message: 'An account with this email already exists. Sign in instead.',
      userFacing: 'An account with this email already exists. Sign in instead.'
    };
  }

  // 6. Network & Connection
  if (msgLower.includes('network') || msgLower.includes('fetch') || msgLower.includes('connection')) {
    return {
      type: 'network',
      message: "We couldn't reach the server. Check your connection and try again.",
      userFacing: "We couldn't reach the server. Check your connection and try again."
    };
  }

  // 7. Password Complexity
  if (msgLower.includes('password should be at least')) {
    return {
      type: 'weak_password',
      message: 'Password must be at least 6 characters.',
      userFacing: 'Password must be at least 6 characters.'
    };
  }

  // Fallback safe message
  return {
    type: 'generic',
    message: 'An error occurred during authentication. Please try again.',
    userFacing: 'An error occurred during authentication. Please try again.'
  };
}
