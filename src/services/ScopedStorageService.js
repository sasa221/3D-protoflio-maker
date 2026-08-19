/**
 * ScopedStorageService.js
 * Centralized, secure user-scoped storage management for browser storage.
 * Ensures data isolation between different accounts on the same device/browser.
 * Prevents cross-account data leakage via universal localStorage/sessionStorage keys.
 */

export class ScopedStorageService {
  static getScopedKey(key, userId = null) {
    if (!userId) {
      // For unauthenticated/anonymous sessions
      return `anon:${key}`;
    }
    return `usr_${userId}:${key}`;
  }

  static getItem(key, userId = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const scopedKey = this.getScopedKey(key, userId);
      const val = window.localStorage.getItem(scopedKey);
      return val ? JSON.parse(val) : null;
    } catch (_) {
      return null;
    }
  }

  static setItem(key, value, userId = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const scopedKey = this.getScopedKey(key, userId);
      window.localStorage.setItem(scopedKey, JSON.stringify(value));
    } catch (_) {}
  }

  static removeItem(key, userId = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const scopedKey = this.getScopedKey(key, userId);
      window.localStorage.removeItem(scopedKey);
    } catch (_) {}
  }

  /**
   * Helper to retrieve all keys currently in localStorage.
   */
  static getAllLocalStorageKeys() {
    const keys = [];
    try {
      if (typeof window === 'undefined' || !window.localStorage) return keys;
      if (typeof window.localStorage.length === 'number') {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) keys.push(k);
        }
      }
      Object.keys(window.localStorage).forEach(k => {
        if (!keys.includes(k) && typeof window.localStorage[k] !== 'function') {
          keys.push(k);
        }
      });
    } catch (_) {}
    return keys;
  }

  /**
   * Clear all stored keys belonging to a specific user on logout or user switch.
   */
  static clearUserStorage(userId) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const allKeys = this.getAllLocalStorageKeys();
      if (!userId) {
        // Clear anonymous keys
        allKeys.forEach(k => {
          if (k.startsWith('anon:')) window.localStorage.removeItem(k);
        });
        return;
      }
      const prefix = `usr_${userId}:`;
      allKeys.forEach(k => {
        if (k.startsWith(prefix)) {
          window.localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }

  /**
   * Wipe all non-system user caches from localStorage and sessionStorage.
   */
  static wipeAllUserCaches() {
    try {
      if (typeof window === 'undefined') return;
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
      if (window.localStorage) {
        const allKeys = this.getAllLocalStorageKeys();
        allKeys.forEach(k => {
          if (k.startsWith('usr_') || k.startsWith('anon:') || k.startsWith('draft_')) {
            window.localStorage.removeItem(k);
          }
        });
      }
    } catch (_) {}
  }
}
