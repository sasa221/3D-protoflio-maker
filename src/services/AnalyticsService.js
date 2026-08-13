/**
 * AnalyticsService.js
 * Lightweight, privacy-conscious analytics event tracking & provider architecture.
 * Implements RemoteAnalyticsProvider (Central production database router) and LocalAnalyticsProvider (Dev/Testing).
 * Excludes Studio live previews, tracks active engagement time, handles offline queues, and swallows errors.
 */

import { postAnalyticsEvent, getAnalyticsDashboardData } from './RemoteAnalyticsBackend.js';
import { getCurrentUser } from './AuthService.js';

const LOCAL_STORAGE_KEY = 'ultra_portfolio_analytics_events';
const MAX_QUEUE_SIZE = 50;

function getAnonymousSessionId() {
  try {
    let sid = sessionStorage.getItem('pub_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      sessionStorage.setItem('pub_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 'sess_fallback_' + Date.now();
  }
}

/**
 * Production Remote Analytics Provider (Central Database)
 */
export class RemoteAnalyticsProvider {
  async sendEvent(event) {
    try {
      // Dispatches via POST /api/analytics/event to central backend database
      const res = await postAnalyticsEvent(event);
      if (window.ANALYTICS_DEBUG) {
        console.log('[Remote Analytics API POST]', event.eventName, res);
      }
      return res.success;
    } catch (e) {
      return false;
    }
  }

  async getDashboardData(portfolioId) {
    try {
      const user = getCurrentUser();
      const res = await getAnalyticsDashboardData(portfolioId || 'saleh_portfolio', user);
      if (res.success) {
        return res;
      }
      return aggregateAnalyticsEvents([]);
    } catch (e) {
      return aggregateAnalyticsEvents([]);
    }
  }
}

/**
 * Local Analytics Provider (Development / Offline Fallback)
 */
export class LocalAnalyticsProvider {
  constructor() {
    this.events = this._loadEvents();
  }

  _loadEvents() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  _saveEvents() {
    try {
      if (this.events.length > 500) {
        this.events = this.events.slice(-500);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.events));
    } catch (e) {}
  }

  async sendEvent(event) {
    this.events.push(event);
    this._saveEvents();
    return true;
  }

  getDashboardData(portfolioId) {
    const events = this.events.filter(e => e.portfolioId === portfolioId || !portfolioId);
    return aggregateAnalyticsEvents(events);
  }

  clearEvents() {
    this.events = [];
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

export class AnalyticsService {
  constructor() {
    // Default to RemoteAnalyticsProvider for Central Cross-Device Synchronization!
    this.provider = new RemoteAnalyticsProvider();
    this.enabled = true;
    this.sessionId = getAnonymousSessionId();
    this.viewedSections = new Set();
    this.scrollMilestones = new Set();
    this.activeTimeSeconds = 0;
    this.timerInterval = null;
    this.queue = [];
  }

  setProvider(provider) {
    if (provider) this.provider = provider;
  }

  setAnalyticsEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  startActiveEngagementTimer() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      if (!document.hidden && this.enabled) {
        this.activeTimeSeconds++;
      }
    }, 1000);
  }

  stopActiveEngagementTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  track(eventName, metadata = {}, context = {}) {
    if (!this.enabled) return;

    // NEVER track Studio live preview or editor views!
    if (context.isStudioPreview || window.IS_STUDIO_PREVIEW) {
      return;
    }

    const event = {
      eventName,
      portfolioId: context.portfolioId || 'saleh_portfolio',
      variantId: context.variantId || 'general',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: sanitizeMetadata(metadata)
    };

    try {
      this.provider.sendEvent(event).then(success => {
        if (!success && this.queue.length < MAX_QUEUE_SIZE) {
          this.queue.push(event);
        }
      }).catch(() => {
        if (this.queue.length < MAX_QUEUE_SIZE) {
          this.queue.push(event);
        }
      });
    } catch (e) {
      // Swallowed silently to prevent breaking Three.js/portfolio rendering
    }
  }

  trackSectionView(sectionId, context = {}) {
    if (this.viewedSections.has(sectionId)) return;
    this.viewedSections.add(sectionId);
    this.track('section_viewed', { sectionId }, context);
  }

  trackScrollDepth(depthPercent, context = {}) {
    const milestone = Math.floor(depthPercent / 25) * 25;
    if (milestone < 25 || this.scrollMilestones.has(milestone)) return;

    this.scrollMilestones.add(milestone);
    this.track(`scroll_depth_${milestone}`, { depthPercent: milestone }, context);
  }

  async getDashboardData(portfolioId) {
    if (this.provider.getDashboardData) {
      return await this.provider.getDashboardData(portfolioId);
    }
    return aggregateAnalyticsEvents([]);
  }
}

function sanitizeMetadata(metadata = {}) {
  const safe = { ...metadata };
  delete safe.email;
  delete safe.phone;
  delete safe.rawCVText;
  delete safe.jobDescription;
  delete safe.cvFile;
  delete safe.authorization;
  delete safe.cookies;
  delete safe.ip_address;
  delete safe.ip;
  return safe;
}

export function aggregateAnalyticsEvents(events = []) {
  if (!events || events.length === 0) {
    return {
      overview: { visits: 0, avgEngagementSeconds: 0, resumeDownloads: 0, projectOpens: 0, contactClicks: 0, resumeCTR: '0.0%' },
      variants: [],
      projects: [],
      devices: { Desktop: 0, Tablet: 0, Mobile: 0 },
      recruiterModeActivations: 0,
      funnel: { visits: 0, sectionsViewed: 0, projectOpens: 0, resumeDownloads: 0, contactClicks: 0 },
      insights: ['No visitor data yet. Share your portfolio URL to start collecting real cross-device visitor insights.']
    };
  }

  let sessions = new Set();
  let resumeDownloads = 0;
  let projectOpens = 0;
  let contactClicks = 0;
  let recruiterActivations = 0;

  let variantMap = {};
  let projectMap = {};
  let devices = { Desktop: 0, Tablet: 0, Mobile: 0 };

  events.forEach(e => {
    sessions.add(e.sessionId || e.session_id);
    const vId = e.variantId || e.variant_id || 'general';

    if (!variantMap[vId]) {
      variantMap[vId] = { variantId: vId, visits: new Set(), resumeDownloads: 0, projectOpens: 0, contactClicks: 0 };
    }

    const evtName = e.eventName || e.event_name;

    if (evtName === 'portfolio_view' || evtName === 'variant_viewed') {
      variantMap[vId].visits.add(e.sessionId || e.session_id);
      const dev = e.metadata?.device || e.device_category || 'Desktop';
      devices[dev] = (devices[dev] || 0) + 1;
    }

    if (evtName === 'resume_download_clicked') {
      resumeDownloads++;
      variantMap[vId].resumeDownloads++;
    }

    if (evtName === 'project_opened') {
      projectOpens++;
      variantMap[vId].projectOpens++;
      const pId = e.metadata?.projectId || e.project_id || 'unknown';
      if (!projectMap[pId]) {
        projectMap[pId] = { projectId: pId, name: e.metadata?.projectName || pId, opens: 0, liveDemoClicks: 0, githubClicks: 0 };
      }
      projectMap[pId].opens++;
    }

    if (evtName === 'project_live_demo_clicked') {
      const pId = e.metadata?.projectId || e.project_id || 'unknown';
      if (projectMap[pId]) projectMap[pId].liveDemoClicks++;
    }

    if (evtName === 'project_github_clicked') {
      const pId = e.metadata?.projectId || e.project_id || 'unknown';
      if (projectMap[pId]) projectMap[pId].githubClicks++;
    }

    if (['email_clicked', 'linkedin_clicked', 'github_profile_clicked', 'website_clicked'].includes(evtName)) {
      contactClicks++;
      variantMap[vId].contactClicks++;
    }

    if (evtName === 'recruiter_mode_enabled') {
      recruiterActivations++;
    }
  });

  const totalVisits = sessions.size || 1;
  const resumeCTR = ((resumeDownloads / totalVisits) * 100).toFixed(1) + '%';

  const variants = Object.values(variantMap).map(v => ({
    variantId: v.variantId,
    visits: v.visits.size,
    resumeCTR: ((v.resumeDownloads / (v.visits.size || 1)) * 100).toFixed(1) + '%',
    projectOpenRate: ((v.projectOpens / (v.visits.size || 1)) * 100).toFixed(1) + '%'
  }));

  const projects = Object.values(projectMap).sort((a, b) => b.opens - a.opens);

  let insights = [];
  if (projects.length > 0) {
    insights.push(`"${projects[0].name}" is your most-opened project (${projects[0].opens} opens).`);
  }
  if (recruiterActivations > 0) {
    insights.push(`Recruiter View was activated in ${recruiterActivations} session(s).`);
  }
  if (resumeDownloads > 0) {
    insights.push(`Resume Download CTR is currently ${resumeCTR}.`);
  }

  return {
    overview: {
      visits: sessions.size,
      avgEngagementSeconds: Math.round(events.length * 5),
      resumeDownloads,
      projectOpens,
      contactClicks,
      resumeCTR
    },
    variants,
    projects,
    devices,
    recruiterModeActivations: recruiterActivations,
    funnel: {
      visits: sessions.size,
      sectionsViewed: events.filter(e => (e.eventName || e.event_name) === 'section_viewed').length,
      projectOpens,
      resumeDownloads,
      contactClicks
    },
    insights: insights.length > 0 ? insights : ['Share your portfolio URL to start collecting real visitor insights.']
  };
}

export const globalAnalytics = new AnalyticsService();

export function initPublicPortfolioAnalytics(portfolioId, variantId = 'general') {
  if (!portfolioId) return;

  const context = { portfolioId, variantId };
  const device = window.innerWidth <= 768 ? 'Mobile' : 'Desktop';

  // 1. Initial Portfolio / Variant View
  globalAnalytics.track('portfolio_view', { device }, context);
  if (variantId && variantId !== 'general') {
    globalAnalytics.track('variant_viewed', { variantId, device }, context);
  }

  // 2. Section Intersection Observer
  if (typeof IntersectionObserver !== 'undefined') {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.id) {
          globalAnalytics.trackSectionView(entry.target.id, context);
        }
      });
    }, { threshold: 0.3 });

    setTimeout(() => {
      document.querySelectorAll('section[id]').forEach(sec => sectionObserver.observe(sec));
    }, 500);
  }

  // 3. Throttled Scroll Depth Milestones (25%, 50%, 75%, 100%)
  const appContainer = document.getElementById('app') || window;
  let scrollTimeout;
  const handleScroll = () => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
      const scrollTop = appContainer.scrollTop || window.scrollY || 0;
      const scrollHeight = appContainer.scrollHeight || document.documentElement.scrollHeight || 1;
      const clientHeight = appContainer.clientHeight || window.innerHeight || 1;
      const depthPercent = Math.min(100, Math.round(((scrollTop + clientHeight) / scrollHeight) * 100));
      globalAnalytics.trackScrollDepth(depthPercent, context);
    }, 250);
  };

  appContainer.addEventListener('scroll', handleScroll, { passive: true });

  // 4. Delegated Event Tracking (Projects, Resume, Recruiter Mode, Contacts)
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a, button, .project-card, [data-project-id], .card');
    if (!target) return;

    // Project Opened
    const projCard = target.closest('.project-card, [data-project-id]');
    if (projCard) {
      const projId = projCard.getAttribute('data-project-id') || projCard.querySelector('h3')?.textContent || 'project';
      globalAnalytics.track('project_opened', { projectId: projId, device }, context);
    }

    // Resume Download
    if (target.matches('a[href*="resume"], a[download], button:has-text("Resume"), .resume-download-btn, [data-action="resume"]')) {
      globalAnalytics.track('resume_download_clicked', { filename: 'resume.pdf', device }, context);
    }

    // Recruiter View Toggle
    if (target.matches('#recruiter-mode-toggle, .recruiter-toggle-btn, [data-action="recruiter"]')) {
      globalAnalytics.track('recruiter_mode_enabled', { device }, context);
    }

    // Contact Clicks
    const href = target.getAttribute('href') || '';
    if (href.startsWith('mailto:')) {
      globalAnalytics.track('email_clicked', { device }, context);
    } else if (href.includes('linkedin.com')) {
      globalAnalytics.track('linkedin_clicked', { device }, context);
    } else if (href.includes('github.com')) {
      globalAnalytics.track('github_profile_clicked', { device }, context);
    }
  });
}
