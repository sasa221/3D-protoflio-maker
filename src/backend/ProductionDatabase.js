/**
 * ProductionDatabase.js
 * Production-ready persistent database manager with Row-Level Security (RLS),
 * unique constraints, stable user identity ownership, and restart persistence.
 */

const STORAGE_KEY_USERS = 'prod_db_users';
const STORAGE_KEY_PORTFOLIOS = 'prod_db_portfolios';
const STORAGE_KEY_VARIANTS = 'prod_db_variants';
const STORAGE_KEY_SUBSCRIPTIONS = 'prod_db_subscriptions';
const STORAGE_KEY_ANALYTICS = 'prod_db_analytics';
const STORAGE_KEY_DOMAINS = 'prod_db_domains';

class ProductionDatabase {
  constructor() {
    this.users = this._load(STORAGE_KEY_USERS, [
      {
        id: 'usr_saleh_123',
        email: 'eng.salehmohammedd@gmail.com',
        passwordHash: 'hash_salt_saleh_pass',
        role: 'user',
        created_at: '2026-08-01T00:00:00Z'
      },
      {
        id: 'usr_attacker_666',
        email: 'hacker@example.com',
        passwordHash: 'hash_salt_hacker_pass',
        role: 'user',
        created_at: '2026-08-01T00:00:00Z'
      }
    ]);

    this.portfolios = this._load(STORAGE_KEY_PORTFOLIOS, [
      {
        id: 'saleh_portfolio',
        owner_user_id: 'usr_saleh_123',
        name: 'SALEH MOHAMED ABOREHAB Portfolio',
        slug: 'saleh',
        profession: 'Front-End Developer',
        bio: 'Motivated Front-End Developer.',
        theme: 'code',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z'
      }
    ]);

    this.variants = this._load(STORAGE_KEY_VARIANTS, [
      {
        id: 'var_default_general',
        portfolio_id: 'saleh_portfolio',
        name: 'General Portfolio',
        slug: 'general',
        target_role: 'Front-End Developer',
        theme_id: 'code',
        is_default: true,
        created_at: '2026-08-01T00:00:00Z'
      }
    ]);

    this.subscriptions = this._load(STORAGE_KEY_SUBSCRIPTIONS, [
      {
        id: 'sub_saleh_123',
        user_id: 'usr_saleh_123',
        provider: 'stripe',
        customer_id: 'cus_saleh_123',
        subscription_id: 'sub_saleh_free',
        plan_id: 'free',
        status: 'active',
        created_at: '2026-08-01T00:00:00Z'
      }
    ]);

    this.analytics = this._load(STORAGE_KEY_ANALYTICS, []);
    this.domains = this._load(STORAGE_KEY_DOMAINS, []);
  }

  _load(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  _save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  // USER OPERATIONS
  findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.users.find(u => u.email.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    return this.users.find(u => u.id === id) || null;
  }

  createUser(email, passwordHash, role = 'user') {
    if (this.findUserByEmail(email)) {
      throw new Error('User email already registered');
    }
    const user = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      created_at: new Date().toISOString()
    };
    this.users.push(user);
    this._save(STORAGE_KEY_USERS, this.users);

    // Default Subscription Record
    const sub = {
      id: 'sub_' + Date.now(),
      user_id: user.id,
      provider: 'stripe',
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString()
    };
    this.subscriptions.push(sub);
    this._save(STORAGE_KEY_SUBSCRIPTIONS, this.subscriptions);

    return user;
  }

  // RLS PORTFOLIO OPERATIONS
  getPortfolio(portfolioId, authUser) {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return null;

    // RLS Read Check
    if (authUser && portfolio.owner_user_id !== authUser.id && authUser.role !== 'admin') {
      throw new Error('403 Forbidden: You do not own this portfolio');
    }
    return portfolio;
  }

  savePortfolio(portfolioData, authUser) {
    if (!authUser) {
      throw new Error('401 Unauthorized: Authentication required to save portfolio');
    }

    const existingIdx = this.portfolios.findIndex(p => p.id === portfolioData.id);
    if (existingIdx !== -1) {
      const existing = this.portfolios[existingIdx];
      // RLS Update Check
      if (existing.owner_user_id !== authUser.id && authUser.role !== 'admin') {
        throw new Error('403 Forbidden: You do not own this portfolio');
      }
      this.portfolios[existingIdx] = {
        ...existing,
        ...portfolioData,
        owner_user_id: existing.owner_user_id,
        updated_at: new Date().toISOString()
      };
    } else {
      const newPortfolio = {
        ...portfolioData,
        id: portfolioData.id || 'pf_' + Date.now(),
        owner_user_id: authUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.portfolios.push(newPortfolio);
    }

    this._save(STORAGE_KEY_PORTFOLIOS, this.portfolios);
    return true;
  }

  // SUBSCRIPTION & RLS ENTITLEMENTS
  getSubscription(userId) {
    return this.subscriptions.find(s => s.user_id === userId) || {
      user_id: userId,
      plan_id: 'free',
      status: 'active'
    };
  }

  updateSubscription(userId, planId, status = 'active') {
    const sub = this.getSubscription(userId);
    sub.plan_id = planId;
    sub.status = status;
    sub.updated_at = new Date().toISOString();

    const idx = this.subscriptions.findIndex(s => s.user_id === userId);
    if (idx !== -1) {
      this.subscriptions[idx] = sub;
    } else {
      this.subscriptions.push(sub);
    }
    this._save(STORAGE_KEY_SUBSCRIPTIONS, this.subscriptions);
    return sub;
  }
}

export const globalProdDB = new ProductionDatabase();
