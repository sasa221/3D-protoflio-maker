/**
 * JobTargetPanel.js
 * Studio UI Panel for Job Targeting + AI Portfolio Optimizer.
 * Allows users to target a specific job role or paste a job description.
 * Renders explainable match score breakdown, strengths, gaps (with Evidence Required tags),
 * and safe optimization actions (Reorder Projects, Reorder Skills, Reorder Sections, Copy Approval).
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

  container.innerHTML = `
    <div class="job-target-panel" style="padding: 20px; color: #fff;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            🎯 Target Job & AI Optimizer
          </h2>
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin: 4px 0 0 0;">
            Tailor your portfolio presentation for a specific role without mutating your real data.
          </p>
        </div>
        <span style="font-size: 0.72rem; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 20px; padding: 4px 12px;">
          Truthful Matching Active
        </span>
      </div>

      <!-- INPUT FORM -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); display: block; margin-bottom: 4px;">Target Role Title</label>
            <input id="jt-role" class="field-input" value="${currentJobTarget.role}" placeholder="e.g. Front-End Developer" style="width: 100%; font-size: 0.82rem; padding: 8px 12px;"/>
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); display: block; margin-bottom: 4px;">Company Name (Optional)</label>
            <input id="jt-company" class="field-input" value="${currentJobTarget.company}" placeholder="e.g. Acme Corp" style="width: 100%; font-size: 0.82rem; padding: 8px 12px;"/>
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); display: block; margin-bottom: 4px;">Industry (Optional)</label>
            <input id="jt-industry" class="field-input" value="${currentJobTarget.industry}" placeholder="e.g. Tech / FinTech" style="width: 100%; font-size: 0.82rem; padding: 8px 12px;"/>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.7); display: block; margin-bottom: 4px;">Paste Job Description (Optional)</label>
          <textarea id="jt-jd" class="field-input" rows="3" placeholder="Paste full job description text here for detailed keyword matching..." style="width: 100%; font-size: 0.8rem; padding: 8px 12px;">${currentJobTarget.jobDescription}</textarea>
        </div>

        <button id="btn-run-job-analysis" class="btn btn-primary" style="padding: 8px 20px; font-weight: 800; font-size: 0.82rem; width: 100%;">
          ⚡ Analyze Target Job Alignment
        </button>
      </div>

      <!-- EXPLAINABLE MATCH SCORE DASHBOARD -->
      ${analysis ? `
        <div style="display: grid; grid-template-columns: 180px 1fr; gap: 16px; margin-bottom: 20px; background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25); border-radius: 16px; padding: 18px;">
          <div style="text-align: center; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 16px; display: flex; flex-direction: column; justify-content: center;">
            <div style="font-size: 2.4rem; font-weight: 900; color: #10b981; line-height: 1;">${analysis.matchScore}%</div>
            <div style="font-size: 0.75rem; font-weight: 800; color: rgba(255,255,255,0.8); margin-top: 6px; letter-spacing: 1px; text-transform: uppercase;">Overall Match</div>
            <div style="font-size: 0.68rem; color: rgba(255,255,255,0.5); margin-top: 4px;">Explainable Weighted Score</div>
          </div>

          <div>
            <div style="font-size: 0.78rem; font-weight: 800; color: rgba(255,255,255,0.9); margin-bottom: 10px;">Category Breakdown:</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; text-align: center;">
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">Skills</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #a855f7;">${analysis.scoreBreakdown.skills}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; text-align: center;">
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">Projects</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #06b6d4;">${analysis.scoreBreakdown.projects}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; text-align: center;">
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">Experience</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #3b82f6;">${analysis.scoreBreakdown.experience}%</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px; text-align: center;">
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">Education</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #f59e0b;">${analysis.scoreBreakdown.educationCerts}%</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- STRENGTHS & GAPS DISPLAY -->
      ${analysis ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <!-- STRENGTHS -->
          <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 14px; padding: 14px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; margin-bottom: 10px;">STRENGTHS (${analysis.strengths.length})</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${analysis.strengths.map(s => `
                <div style="font-size: 0.78rem; color: rgba(255,255,255,0.85); display: flex; gap: 6px; align-items: flex-start;">
                  <span style="color: #10b981;">✓</span>
                  <span>${s}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- GAPS (WITH EVIDENCE REQUIRED TAGS) -->
          <div style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.2); border-radius: 14px; padding: 14px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #f59e0b; margin-bottom: 10px;">GAPS & RECOMMENDATIONS (${analysis.gaps.length})</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${analysis.gaps.map(g => `
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 10px;">
                  <div style="font-size: 0.75rem; font-weight: 700; color: #f59e0b; margin-bottom: 2px;">
                    ⚠️ Evidence Required
                  </div>
                  <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">${g.message}</div>
                  <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-top: 2px;">💡 ${g.recommendation}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- SAFE OPTIMIZATION ACTIONS -->
      ${analysis ? `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--primary, #7c3aed); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">
            ✨ Safe Optimization Actions
          </div>
          <p style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 14px;">
            These actions reorder existing content and prioritize relevant sections. They will NEVER add fake skills or invent claims.
          </p>

          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
            <button id="btn-apply-safe-all" class="btn btn-primary" style="padding: 10px 18px; font-size: 0.8rem; font-weight: 800;">
              ✨ Apply Safe Optimizations (Reorder All)
            </button>
            <button id="btn-apply-proj-order" class="btn btn-secondary" style="padding: 10px 14px; font-size: 0.78rem;">
              📁 Reorder Projects
            </button>
            <button id="btn-apply-skill-order" class="btn btn-secondary" style="padding: 10px 14px; font-size: 0.78rem;">
              ⚡ Reorder Skills
            </button>
            <button id="btn-apply-sec-order" class="btn btn-secondary" style="padding: 10px 14px; font-size: 0.78rem;">
              📐 Reorder Sections
            </button>
          </div>

          <!-- RECRUITER HIGHLIGHTS PREVIEW -->
          <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px;">
            <div style="font-size: 0.75rem; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 6px;">RECRUITER MODE HIGHLIGHTS:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${analysis.recruiterHighlights.map(h => `
                <span style="background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.3); border-radius: 12px; padding: 3px 10px; font-size: 0.72rem; font-weight: 700; color: #a855f7;">
                  📌 ${h}
                </span>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // EVENT BINDINGS
  const btnRun = container.querySelector('#btn-run-job-analysis');
  if (btnRun) {
    btnRun.addEventListener('click', () => {
      const role = container.querySelector('#jt-role').value;
      const company = container.querySelector('#jt-company').value;
      const industry = container.querySelector('#jt-industry').value;
      const jobDescription = container.querySelector('#jt-jd').value;

      const targetInput = { role, company, industry, jobDescription };
      const normalizedJob = jobAnalyzer.analyzeJobTarget(targetInput);
      const newAnalysis = matchPortfolioToJob(portfolioData, normalizedJob);

      portfolioData.jobTarget = {
        ...targetInput,
        analysis: newAnalysis,
        lastAnalyzedAt: new Date().toISOString()
      };

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
      alert('✨ Safe Optimizations Applied! Projects, Skills, and Sections have been reordered for maximum relevance.');
    });
  }

  const btnApplyProj = container.querySelector('#btn-apply-proj-order');
  if (btnApplyProj) {
    btnApplyProj.addEventListener('click', () => {
      if (analysis?.recommendedProjectOrder) {
        portfolioData.projects = analysis.recommendedProjectOrder;
        onUpdatePortfolioData(portfolioData);
        alert('📁 Projects reordered by relevance to target job.');
      }
    });
  }

  const btnApplySkill = container.querySelector('#btn-apply-skill-order');
  if (btnApplySkill) {
    btnApplySkill.addEventListener('click', () => {
      if (analysis?.recommendedSkillOrder) {
        portfolioData.skills = analysis.recommendedSkillOrder;
        onUpdatePortfolioData(portfolioData);
        alert('⚡ Skills reordered by relevance to target job.');
      }
    });
  }

  const btnApplySec = container.querySelector('#btn-apply-sec-order');
  if (btnApplySec) {
    btnApplySec.addEventListener('click', () => {
      if (analysis?.recommendedSectionOrder) {
        portfolioData.sectionOrder = analysis.recommendedSectionOrder;
        onUpdatePortfolioData(portfolioData);
        alert('📐 Section presentation order updated.');
      }
    });
  }
}
