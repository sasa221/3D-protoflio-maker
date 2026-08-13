/**
 * AnalyticsDashboard.js
 * Studio UI Panel for Portfolio Analytics & Recruiter Behavior Intelligence.
 * Renders overview KPIs, Resume CTR, Variant Performance comparison, Project opens,
 * Engagement Funnel, Device category breakdown, and Smart Deterministic Insights.
 */

import { globalAnalytics } from '../services/AnalyticsService.js';

export async function renderAnalyticsDashboard(container, portfolioData) {
  if (!container) return;

  container.innerHTML = `<div style="padding: 20px; color: rgba(255,255,255,0.7); font-size: 0.85rem;">⏳ Loading Central Remote Analytics...</div>`;

  const data = await globalAnalytics.getDashboardData(portfolioData?.id || 'saleh_portfolio');
  const overview = data.overview || {};
  const funnel = data.funnel || {};

  container.innerHTML = `
    <div class="analytics-dashboard-panel" style="padding: 20px; color: #fff;">
      <!-- HEADER -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            📊 Portfolio Analytics & Recruiter Intelligence
          </h2>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 4px 0 0 0;">
            Real-time visitor interactions, project engagement, resume CTR, and variant performance.
          </p>
        </div>
        <span style="font-size: 0.72rem; font-weight: 800; color: #a855f7; background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); border-radius: 20px; padding: 4px 12px;">
          🔒 Privacy Preserving
        </span>
      </div>

      <!-- OVERVIEW KPI CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; text-align: center;">
          <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase;">Total Visits</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #3b82f6; margin-top: 4px;">${overview.visits}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 2px;">Sessions</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; text-align: center;">
          <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase;">Resume CTR</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #10b981; margin-top: 4px;">${overview.resumeCTR}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 2px;">${overview.resumeDownloads} Downloads</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; text-align: center;">
          <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase;">Project Opens</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #06b6d4; margin-top: 4px;">${overview.projectOpens}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 2px;">Case Studies</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; text-align: center;">
          <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase;">Contact Clicks</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #a855f7; margin-top: 4px;">${overview.contactClicks}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 2px;">Email / LinkedIn</div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; text-align: center;">
          <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase;">Recruiter View</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #f59e0b; margin-top: 4px;">${data.recruiterModeActivations}</div>
          <div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 2px;">Activations</div>
        </div>
      </div>

      <!-- DETERMINISTIC SMART INSIGHTS -->
      <div style="background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25); border-radius: 14px; padding: 14px 18px; margin-bottom: 24px;">
        <div style="font-size: 0.78rem; font-weight: 800; color: #a855f7; margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;">💡 Smart Portfolio Insights</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${data.insights.map(ins => `
            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 8px;">
              <span>⚡</span> <span>${ins}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- VARIANT PERFORMANCE COMPARISON TABLE -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase;">
          🗂 Portfolio Variant Performance Comparison
        </div>

        ${data.variants.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);">
                <th style="padding: 8px;">Variant Name / ID</th>
                <th style="padding: 8px;">Visits</th>
                <th style="padding: 8px;">Resume CTR</th>
                <th style="padding: 8px;">Project Open Rate</th>
              </tr>
            </thead>
            <tbody>
              ${data.variants.map(v => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 8px; font-weight: 700; color: #fff;">${v.variantId}</td>
                  <td style="padding: 8px;">${v.visits}</td>
                  <td style="padding: 8px; color: #10b981; font-weight: 700;">${v.resumeCTR}</td>
                  <td style="padding: 8px; color: #06b6d4; font-weight: 700;">${v.projectOpenRate}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); text-align: center; padding: 12px;">No variant breakdown data available yet.</div>
        `}
      </div>

      <!-- PROJECT PERFORMANCE & ENGAGEMENT FUNNEL -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- PROJECT PERFORMANCE TABLE -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase;">
            📁 Project Opens & CTAs
          </div>

          ${data.projects.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${data.projects.map(p => `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 700; color: #fff;">${p.name}</div>
                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">Demo: ${p.liveDemoClicks} · GitHub: ${p.githubClicks}</div>
                  </div>
                  <div style="font-size: 1rem; font-weight: 800; color: #06b6d4;">${p.opens} <span style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">opens</span></div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); text-align: center; padding: 12px;">No project opens tracked yet.</div>
          `}
        </div>

        <!-- ENGAGEMENT FUNNEL -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase;">
            📉 Visitor Engagement Funnel
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700;">
              <span>1. Portfolio Visit</span> <span>${funnel.visits}</span>
            </div>
            <div style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700;">
              <span>2. Sections Viewed</span> <span>${funnel.sectionsViewed}</span>
            </div>
            <div style="background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700;">
              <span>3. Project Opened</span> <span>${funnel.projectOpens}</span>
            </div>
            <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700;">
              <span>4. Resume Downloaded</span> <span>${funnel.resumeDownloads}</span>
            </div>
            <div style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 700;">
              <span>5. Contact Clicked</span> <span>${funnel.contactClicks}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
