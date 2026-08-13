/**
 * SecuritySanitizer.js
 * Production XSS Sanitizer, URL Security Guard, and Input Validator.
 * Prevents XSS script execution (<script>, onerror=, javascript:), validates safe protocols,
 * and sanitizes user-generated portfolio input strings server-side.
 */

export function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      clean[key] = sanitizeText(val);
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export function validateSafeURL(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return 'https://';
  }

  // Allow safe protocols
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('/')
  ) {
    return trimmed;
  }

  return 'https://' + trimmed;
}

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'www',
  'billing',
  'support',
  'login',
  'signup',
  'dashboard',
  'settings',
  'static',
  'assets'
]);

export function isReservedSlug(slug) {
  if (!slug || typeof slug !== 'string') return true;
  const clean = slug.trim().toLowerCase();
  return RESERVED_SLUGS.has(clean);
}
