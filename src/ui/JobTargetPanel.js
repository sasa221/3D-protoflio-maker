/**
 * JobTargetPanel.js
 * Studio UI Panel for Job Match & Portfolio Alignment.
 * Answers 3 key questions simply:
 * 1. How well does my portfolio match this job?
 * 2. What already matches well?
 * 3. What should I improve?
 * Keeps detailed scoring math inside a collapsed Advanced Details section.
 */

import { JobAnalyzerService } from '../services/JobAnalyzerService.js';
import { matchPortfolioToJob } from '../services/PortfolioMatcher.js';

export function renderJobTargetPanel(container, portfolioData, onUpdatePortfolioData) {
  if (!container) return;

  const jobAnalyzer = new JobAnalyzerService();
  let currentJobTarget = portfolioData.jobTarget || {
    role: 'Front-End Developer',
    company: '',
    industry: '',
    jobDescription: '',
    analysis: null,
    lastAnalyzedAt: null
  };

  // Run initial analysis if not analyzed yet
  if (!currentJobTarget.analysis) {
    const normalizedJob = jobAnalyzer.analyzeJobTarget(currentJobTarget);
    currentJobTarget.analysis = matchPortfolioToJob(portfolioData, normalizedJob);
    currentJobTarget.lastAnalyzedAt = new Date().toISOString();
  }

  const analysis = currentJobTarget.analysis;
  const score = analysis ? analysis.matchScore : 0;

  // Supportive summary sentence
  let summarySentence = 'Your portfolio has a strong foundation for this role.';
  if (score >= 80) {
    summarySentence = 'Your portfolio is a strong match for this role with high relevance.';
  } else if (score >= 60) {
    summarySentence = 'Your portfolio is a good starting point, but a few targeted improvements could make it even more relevant.';
  } else {
    summarySentence = 'Adding relevant keywords or projects from your actual background will help align your portfolio with this role.';
  }

  // Deduplicate and limit Strengths (Max 3-4)
  const uniqueStrengths = analysis && Array.isArray(analysis.strengths)
    ? Array.from(new Set(analysis.strengths)).slice(0, 4)
    : [];

  // Deduplicate and limit Improvements (Max 3-5)
  const uniqueGaps = analysis && Array.isArray(analysis.gaps)
    ? analysis.gaps.slice(0, 4)
    : [];

  container.innerHTML = `
    <div class="job-target-panel" style="padding: 16px; color: #fff; box-sizing: border-box; max-width: 100%; overflow-x: hidden;">
      <div style="margin-bottom: 16px;">
        <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 4px 0; display: flex; align-items: center; gap: 8px;">
          🎯 Job Match
        </h2>
        <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 0;">
          See how well your portfolio matches a specific job and how to improve it.
        </p>
      </div>

      <!-- INPUT FORM -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; margin-bottom: 16px;">
        <div style="margin-bottom: 10px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.8); display: block; margin-bottom: 4px;">Target Job Title</label>
          <input id="jt-role" class="field-input" value="${currentJobTarget.role || ''}" placeholder="e.g. Front-End Developer" style="width: 100%; font-size: 0.82rem; padding: 8px 12px; box-sizing: border-box;"/>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.8); display: block; margin-bottom: 4px;">Paste Job Description</label>
          <textarea id="jt-jd" class="field-input" rows="3" placeholder="Paste the job description text here..." style="width: 100%; font-size: 0.8rem; padding: 8px 12px; box-sizing: border-box;">${currentJobTarget.jobDescription || ''}</textarea>
        </div>

        <button id="btn-run-job-analysis" class="btn btn-primary" style="padding: 10px 20px; font-weight: 800; font-size: 0.82rem; width: 100%;">
          ⚡ Analyze Job Match
        </button>
      </div>

      <!-- 1. MATCH SCORE -->
      ${analysis ? `
        <div style="background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap;">
            <div style="font-size: 2.2rem; font-weight: 900; color: ${score >= 70 ? '#10b981' : score >= 50 ? '#06b6d4' : '#f59e0b'}; line-height: 1;">
              ${score}% Match
            </div>
            <div style="font-size: 0.82rem; font-weight: 700; color: rgba(255,255,255,0.9);">
              ${currentJobTarget.role || 'Target Role'}
            </div>
          </div>
          <div style="font-size: 0.8rem; color: rgba(255,255,255,0.7); line-height: 1.45;">
            ${summarySentence}
          </div>
        </div>

        <!-- 2. WHAT MATCHES WELL -->
        <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 14px; padding: 14px; margin-bottom: 16px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #10b981; margin-bottom: 8px;">
            ✓ What Matches Well
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${uniqueStrengths.map(s => `
              <div style="font-size: 0.78rem; color: rgba(255,255,255,0.85); display: flex; gap: 6px; align-items: flex-start;">
                <span style="color: #10b981; font-weight: bold;">✓</span>
                <span>${s}</span>
              </div>
            `).join('')}
            ${uniqueStrengths.length === 0 ? `
              <div style="font-size: 0.76rem; color: rgba(255,255,255,0.5);">Portfolio data aligns generally with technical roles.</div>
            ` : ''}
          </div>
        </div>

        <!-- 3. WHAT COULD IMPROVE -->
        <div style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.2); border-radius: 14px; padding: 14px; margin-bottom: 16px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #f59e0b; margin-bottom: 4px;">
            💡 Suggestions to Improve
          </div>
          <div style="font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-bottom: 10px;">
            Add skills or details only if you genuinely have this experience.
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${uniqueGaps.map(g => `
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 10px;">
                <div style="font-size: 0.76rem; color: rgba(255,255,255,0.85); font-weight: 600; margin-bottom: 2px;">
                  ${g.message}
                </div>
                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.6);">
                  ${g.recommendation}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- SAFE ACTIONS -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <button id="btn-apply-safe-all" class="btn btn-primary" style="flex: 1; min-width: 180px; padding: 9px 16px; font-size: 0.78rem; font-weight: 800;">
            ✨ Highlight Relevant Skills & Projects
          </button>
          <button onclick="window.switchWorkspace('create')" class="btn btn-secondary" style="padding: 9px 16px; font-size: 0.78rem; font-weight: 700; white-space: nowrap;">
            ✏️ Edit Portfolio
          </button>
        </div>

        <!-- COLLAPSED DETAILED ANALYSIS -->
        <details style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
          <summary style="font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.7); cursor: pointer; user-select: none;">
            📊 View Detailed Analysis
          </summary>
          
          <div style="margin-top: 12px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 8px;">Category Breakdown:</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Skills</div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #a855f7;">${analysis.scoreBreakdown.skills}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Projects</div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #06b6d4;">${analysis.scoreBreakdown.projects}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Experience</div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #3b82f6;">${analysis.scoreBreakdown.experience}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; text-align: center;">
                <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5);">Education</div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #f59e0b;">${analysis.scoreBreakdown.educationCerts}%</div>
              </div>
            </div>
            <div style="font-size: 0.68rem; color: rgba(255,255,255,0.4); line-height: 1.4;">
              Scoring is calculated based on direct keyword and concept alignment with your confirmed portfolio items. No data is fabricated.
            </div>
          </div>
        </details>
      ` : ''}
    </div>
  `;

  // EVENT BINDINGS
  const btnRun = container.querySelector('#btn-run-job-analysis');
  if (btnRun) {
    btnRun.addEventListener('click', () => {
      const role = container.querySelector('#jt-role')?.value || '';
      const jobDescription = container.querySelector('#jt-jd')?.value || '';

      const targetInput = { role, jobDescription };
      const normalizedJob = jobAnalyzer.analyzeJobTarget(targetInput);
      const newAnalysis = matchPortfolioToJob(portfolioData, normalizedJob);

      portfolioData.jobTarget = {
        ...targetInput,
        analysis: newAnalysis,
        lastAnalyzedAt: new Date().toISOString()
      };

      onUpdatePortfolioData(portfolioData);
      renderJobTargetPanel(container, portfolioData, onUpdatePortfolioData);
    });
  }

  // Safe Optimization Handlers
  const btnApplyAll = container.querySelector('#btn-apply-safe-all');
  if (btnApplyAll) {
    btnApplyAll.addEventListener('click', () => {
      if (!analysis) return;
      if (analysis.recommendedProjectOrder) portfolioData.projects = analysis.recommendedProjectOrder;
      if (analysis.recommendedSkillOrder) portfolioData.skills = analysis.recommendedSkillOrder;
      if (analysis.recommendedSectionOrder) portfolioData.sectionOrder = analysis.recommendedSectionOrder;

      onUpdatePortfolioData(portfolioData);
      alert('✨ Relevant skills and projects have been highlighted and brought forward.');
    });
  }
}
