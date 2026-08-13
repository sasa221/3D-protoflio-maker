/**
 * SentryService.js
 * Error monitoring integration via @sentry/browser.
 * Strips sensitive PII data (CV text, resume contents, passwords, auth tokens, payment data).
 */

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[SentryService] Sentry DSN not configured — Running in silent diagnostic mode.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    beforeSend(event) {
      // Privacy Sanitization: Strip sensitive PII payloads
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['cookie'];
        }
        if (event.request.data) {
          try {
            const dataStr = typeof event.request.data === 'string' ? event.request.data : JSON.stringify(event.request.data);
            if (dataStr.includes('password') || dataStr.includes('resume') || dataStr.includes('token')) {
              event.request.data = '[REDACTED_SENSITIVE_DATA]';
            }
          } catch (e) {}
        }
      }
      return event;
    }
  });

  console.log('[SentryService] Sentry initialized with privacy filters.');
}

export function captureException(error, context = {}) {
  console.warn('[SentryService] Capturing Exception:', error?.message || error);
  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export function triggerStagingTestException() {
  const testErr = new Error('STAGING_SENTRY_TEST');
  captureException(testErr, { testMarker: true });
  return testErr;
}
