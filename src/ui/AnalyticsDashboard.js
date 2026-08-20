/**
 * AnalyticsDashboard.js
 * Studio UI Panel for Portfolio Visitor Insights.
 * Renders top compact KPIs, honest visitor engagement funnel,
 * project performance when data exists, and a single clean zero-data state.
 */

import { globalAnalytics } from '../services/AnalyticsService.js';

export async function renderAnalyticsDashboard(container, portfolioData) {
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 24px; color: rgba(255,255,255,0.7); font-size: 0.85rem; text-align: center;">
      ⏳ Loading portfolio visitor insights...
    </div>
  `;

  const data = await globalAnalytics.getDashboardData(portfolioData?.id || 'default');
  const overview = data.overview || {};
  const funnel = data.funnel || {};

  const totalVisits = Number(overview.visits || 0);
  const uniqueSessions = Number(overview.uniqueSessions || totalVisits);
  const projectOpens = Number(overview.projectOpens || 0);
  const resumeDownloads = Number(overview.resumeDownloads || 0);
  const contactClicks = Number(overview.contactClicks || 0);

  const hasData = totalVisits > 0;

  const slug = portfolioData.slug || (portfolioData.name ? portfolioData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'portfolio');
  const publicUrl = `${window.location.origin}/u/${slug}`;

  container.innerHTML = `
    <div class="analytics-dashboard-panel" style="padding: 16px; color: #fff; font-family: 'Inter', sans-serif; box-sizing: border-box; max-width: 100%;">
      
      <!-- HEADER -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            📊 Visitor Insights
          </h2>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 4px 0 0 0;">
            Real-time visitor interactions, project engagement, and resume downloads.
          </p>
        </div>
        <span style="font-size: 0.68rem; font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); border-radius: 20px; padding: 3px 10px;">
          🔒 PRIVACY PRESERVING
        </span>
      </div>

      <!-- TOP 5 COMPACT KPIS (§20) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Total Visits</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #38bdf8; margin-top: 2px;">${totalVisits}</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Unique Sessions</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #c084fc; margin-top: 2px;">${uniqueSessions}</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Project Opens</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #06b6d4; margin-top: 2px;">${projectOpens}</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Resume DLs</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #34d399; margin-top: 2px;">${resumeDownloads}</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 10px; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Contact Clicks</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #f59e0b; margin-top: 2px;">${contactClicks}</div>
        </div>
      </div>

      <!-- IF ZERO DATA: SINGLE USEFUL EMPTY STATE (§20) -->
      ${!hasData ? `
        <div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 18px; padding: 36px 20px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 32px; display: block; margin-bottom: 10px;">📈</span>
          <h3 style="font-size: 1.05rem; font-weight: 800; color: #fff; margin: 0 0 6px 0;">
            No visitor activity yet.
          </h3>
          <p style="font-size: 0.82rem; color: rgba(255,255,255,0.6); max-width: 440px; margin: 0 auto 18px auto; line-height: 1.5;">
            Share your published portfolio link on LinkedIn, your resume, or job applications to start tracking visitor engagement and project clicks.
          </p>

          <div style="display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
            <button onclick="window.switchWorkspace('publish')" class="btn btn-primary" style="padding: 10px 18px; font-size: 0.82rem; font-weight: 800; background: linear-gradient(135deg,#7c3aed,#06b6d4); border: none; border-radius: 8px; color: #fff; cursor: pointer;">
              🌐 Open Publish & Share
            </button>
            <button id="btn-copy-analytics-url" class="btn btn-secondary" style="padding: 10px 18px; font-size: 0.82rem; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; color: #fff; cursor: pointer;">
              📋 Copy Portfolio Link
            </button>
          </div>
        </div>
      ` : `
        <!-- ENGAGEMENT FUNNEL (§20) -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; margin-bottom: 20px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #c084fc; margin-bottom: 14px; letter-spacing: 0.5px; text-transform: uppercase;">
            📉 Visitor Engagement Funnel
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700;">
              <span>1. Portfolio Visit</span>
              <span style="color: #38bdf8;">${totalVisits} visits</span>
            </div>
            <div style="background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700;">
              <span>2. Projects Explored</span>
              <span style="color: #06b6d4;">${projectOpens} opens ${totalVisits > 0 ? `(${Math.round((projectOpens / totalVisits) * 100)}%)` : ''}</span>
            </div>
            <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.25); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700;">
              <span>3. Resume Downloaded</span>
              <span style="color: #34d399;">${resumeDownloads} downloads ${totalVisits > 0 ? `(${Math.round((resumeDownloads / totalVisits) * 100)}%)` : ''}</span>
            </div>
            <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700;">
              <span>4. Contact Action</span>
              <span style="color: #fbbf24;">${contactClicks} clicks ${totalVisits > 0 ? `(${Math.round((contactClicks / totalVisits) * 100)}%)` : ''}</span>
            </div>
          </div>
        </div>

        <!-- PROJECT PERFORMANCE TABLE (ONLY WHEN DATA EXISTS) (§20) -->
        ${Array.isArray(data.projects) && data.projects.length > 0 ? `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; margin-bottom: 20px;">
            <div style="font-size: 0.82rem; font-weight: 800; color: #38bdf8; margin-bottom: 12px; letter-spacing: 0.5px; text-transform: uppercase;">
              📁 Project Performance
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${data.projects.map(p => `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="font-size: 0.82rem; color: #fff; display: block;">${p.name}</strong>
                    <span style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Demo: ${p.liveDemoClicks || 0} · Source Code: ${p.githubClicks || 0}</span>
                  </div>
                  <div style="font-size: 0.95rem; font-weight: 900; color: #06b6d4;">${p.opens || 0} <span style="font-size: 0.68rem; color: rgba(255,255,255,0.5); font-weight: normal;">opens</span></div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `}

    </div>
  `;

  // Copy URL button handler for zero-data state
  const copyBtn = container.querySelector('#btn-copy-analytics-url');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(publicUrl);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy Portfolio Link'; }, 2000);
      }
    });
  }
}

