/**
 * JobTargetPanel.js
 * Studio UI Panel for Job Fit Analyzer.
 * Strictly evidence-based role matching, structured requirement extraction from URL or pasted JD,
 * explainable weighted score, honest gap analysis, and auditable category breakdowns.
 */

import { JobAnalyzerService } from '../services/JobAnalyzerService.js';
import { matchPortfolioToJob } from '../services/PortfolioMatcher.js';
import { globalEntitlements } from '../services/EntitlementService.js';
import { openBillingModal } from './BillingModal.js';

export function renderJobTargetPanel(container, portfolioData, onUpdatePortfolioData) {
  if (!container) return;

  const jobAnalyzer = new JobAnalyzerService();
  let currentJobTarget = portfolioData.jobTarget || {
    role: '',
    company: '',
    jobUrl: '',
    jobDescription: '',
    analysis: null,
    lastAnalyzedAt: null
  };

  // Run initial analysis ONLY if valid job description text exists
  if (!currentJobTarget.analysis && currentJobTarget.jobDescription && currentJobTarget.jobDescription.trim().length >= 50) {
    const normalizedJob = jobAnalyzer.analyzeJobTarget(currentJobTarget);
    currentJobTarget.analysis = matchPortfolioToJob(portfolioData, normalizedJob);
    currentJobTarget.lastAnalyzedAt = new Date().toISOString();
  }

  const analysis = currentJobTarget.analysis;
  const hasAnalysis = analysis && analysis.hasRequirements;
  const score = hasAnalysis ? analysis.matchScore : 0;
  const verdict = hasAnalysis ? analysis.verdict : '';
  const applyAdvice = hasAnalysis ? analysis.applyAdvice : '';
  const applyAdviceType = hasAnalysis ? analysis.applyAdviceType : '';

  const isPaid = globalEntitlements.getEffectivePlanId() !== 'free';
  const lifetimeAnalysesCount = Number(portfolioData.jobFitAnalysesCount || (portfolioData.jobTarget?.analysis ? 1 : 0));
  const isFreeAnalysisExhausted = !isPaid && lifetimeAnalysesCount >= 1 && !hasAnalysis;

  container.innerHTML = `
    <div class="job-target-panel" style="padding: 16px; color: #fff; box-sizing: border-box; max-width: 100%; overflow-x: hidden; font-family: 'Inter', sans-serif;">
      
      <!-- HEADER -->
      <div style="margin-bottom: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            🎯 Job Fit Analyzer
          </h2>
          <span style="font-size: 0.68rem; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2px 10px;">
            EVIDENCE-BASED
          </span>
        </div>
        <p style="font-size: 0.8rem; color: rgba(255,255,255,0.65); margin: 4px 0 0 0; line-height: 1.45;">
          Calculate your evidence-based fit for specific job postings. We analyze actual requirements and identify genuine gaps without fabricating qualifications.
        </p>
      </div>

      <!-- FREE PLAN QUOTA NOTICE -->
      ${!isPaid ? `
        <div style="background: rgba(124,58,237,0.06); border: 1px solid rgba(124,58,237,0.2); border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; font-size: 0.76rem; color: rgba(255,255,255,0.75); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span>🆓 <strong>Free Plan:</strong> Includes 1 lifetime Job Fit analysis. Results remain permanently viewable.</span>
          ${isFreeAnalysisExhausted ? `
            <button onclick="openBillingModal({targetPlan:'pro'})" style="background: linear-gradient(135deg,#7c3aed,#06b6d4); border: none; border-radius: 8px; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 5px 12px; cursor: pointer;">
              Unlock Unlimited Analyses with Pro
            </button>
          ` : ''}
        </div>
      ` : ''}

      <!-- INPUT FORM -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 20px;">
        
        <!-- PRIMARY INPUT: JOB POSTING URL (§12, §13) -->
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.85); display: block; margin-bottom: 4px;">
            1. Job Posting URL (Primary Input)
          </label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <input id="jt-url" type="url" inputmode="url" autocomplete="url" class="field-input" value="${currentJobTarget.jobUrl || ''}" placeholder="https://www.linkedin.com/jobs/view/... or company career link" style="min-width: 0; flex: 1 1 260px; font-size: 0.8rem; padding: 10px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; outline: none;"/>
            <button id="btn-extract-job-url" type="button" class="btn btn-secondary" style="flex: 0 0 auto; min-height: 40px; font-size: 0.76rem; font-weight: 700; padding: 0 14px; white-space: nowrap; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.35); color: #38bdf8; border-radius: 8px; cursor: pointer;">
              ⚡ Fetch Posting
            </button>
          </div>
          <div id="url-fetch-feedback" style="display: none; font-size: 0.72rem; margin-top: 6px; padding: 6px 10px; border-radius: 6px;"></div>
        </div>

        <div style="text-align: center; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.3); letter-spacing: 2px; margin: 10px 0;">
          ─── OR PASTE JOB DESCRIPTION ───
        </div>

        <!-- SECONDARY FALLBACK: JOB DESCRIPTION TEXT (§12) -->
        <div style="margin-bottom: 12px;">
          <label style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.85); display: block; margin-bottom: 4px;">
            2. Job Description Text
          </label>
          <textarea id="jt-jd" class="field-input" rows="4" placeholder="Paste the complete job description, requirements, and qualifications here..." style="width: 100%; font-size: 0.8rem; padding: 10px 12px; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; line-height: 1.45; outline: none;">${currentJobTarget.jobDescription || ''}</textarea>
        </div>

        <!-- OPTIONAL METADATA -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <div>
            <label style="font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 4px;">Job Title (Optional)</label>
            <input id="jt-role" class="field-input" value="${currentJobTarget.role || ''}" placeholder="e.g. Senior Frontend Engineer" style="width: 100%; font-size: 0.78rem; padding: 8px 10px; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff;"/>
          </div>
          <div>
            <label style="font-size: 0.72rem; font-weight: 600; color: rgba(255,255,255,0.6); display: block; margin-bottom: 4px;">Company Name (Optional)</label>
            <input id="jt-company" class="field-input" value="${currentJobTarget.company || ''}" placeholder="e.g. Acme Corp" style="width: 100%; font-size: 0.78rem; padding: 8px 10px; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff;"/>
          </div>
        </div>

        <!-- ANALYZE ACTION -->
        <button id="btn-run-job-analysis" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 800; font-size: 0.86rem; background: linear-gradient(135deg,#7c3aed,#06b6d4); color: #fff; border-radius: 10px; cursor: pointer; border: none; box-shadow: 0 4px 14px rgba(124,58,237,0.35);">
          ⚡ Calculate Evidence-Based Job Fit
        </button>
      </div>

      <!-- RESULTS SECTION (§17, §18, §19) -->
      ${hasAnalysis ? `
        <!-- 1. FIT SCORE & VERDICT BANNER -->
        <div style="background: linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.08)); border: 1px solid rgba(124,58,237,0.35); border-radius: 16px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
            <div>
              <div style="font-size: 0.72rem; font-weight: 800; color: #c084fc; letter-spacing: 1px; text-transform: uppercase;">
                ${currentJobTarget.role || 'TARGET ROLE'} ${currentJobTarget.company ? `· ${currentJobTarget.company}` : ''}
              </div>
              <div style="font-size: 2.2rem; font-weight: 900; color: #fff; line-height: 1.1; margin-top: 4px;">
                ${score}% <span style="font-size: 1.2rem; font-weight: 700; color: rgba(255,255,255,0.8);">Job Fit</span>
              </div>
            </div>

            <div style="text-align: right;">
              <span style="font-size: 0.8rem; font-weight: 900; letter-spacing: 0.5px; padding: 6px 14px; border-radius: 20px; ${
                verdict === 'STRONG FIT' ? 'background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4);' :
                verdict === 'GOOD FIT' ? 'background: rgba(6,182,212,0.2); color: #38bdf8; border: 1px solid rgba(6,182,212,0.4);' :
                verdict === 'POSSIBLE FIT' ? 'background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4);' :
                'background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4);'
              }">
                ${verdict}
              </span>
            </div>
          </div>

          <!-- SHOULD YOU APPLY? (§17) -->
          <div style="background: rgba(0,0,0,0.35); border-left: 3px solid ${
            applyAdviceType === 'yes_strong' ? '#10b981' :
            applyAdviceType === 'yes_with_gaps' ? '#06b6d4' :
            applyAdviceType === 'possibly' ? '#f59e0b' : '#ef4444'
          }; border-radius: 0 10px 10px 0; padding: 10px 14px; font-size: 0.8rem;">
            <strong style="color: #fff; display: block; margin-bottom: 2px;">Should You Apply?</strong>
            <span style="color: rgba(255,255,255,0.85);">${applyAdvice}</span>
          </div>
        </div>

        <!-- 2. WHAT YOU MATCH (EXACT PORTFOLIO EVIDENCE) (§18) -->
        <div style="background: rgba(16,185,129,0.04); border: 1px solid rgba(16,185,129,0.2); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 0.84rem; font-weight: 800; color: #34d399; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span>✓</span> WHAT YOU MATCH (Confirmed Portfolio Evidence)
          </div>

          ${analysis.matchedEvidence && analysis.matchedEvidence.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${analysis.matchedEvidence.map(item => `
                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(16,185,129,0.15); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                  <div>
                    <strong style="font-size: 0.82rem; color: #fff; display: block;">${item.title}</strong>
                    <span style="font-size: 0.74rem; color: rgba(255,255,255,0.7);">${item.evidence}</span>
                  </div>
                  <span style="font-size: 0.65rem; font-weight: 800; color: #34d399; background: rgba(16,185,129,0.15); padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                    MATCHED
                  </span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size: 0.78rem; color: rgba(255,255,255,0.6); padding: 8px;">No direct skill matches found between this job posting and your portfolio.</div>
          `}
        </div>

        <!-- 3. CRITICAL GAPS (REQUIRED SKILLS MISSING) (§18) -->
        ${analysis.criticalGaps && analysis.criticalGaps.length > 0 ? `
          <div style="background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.2); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
            <div style="font-size: 0.84rem; font-weight: 800; color: #f87171; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span> CRITICAL GAPS (Mandatory Requirements Not Found)
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${analysis.criticalGaps.map(gap => `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(239,68,68,0.18); border-radius: 10px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="font-size: 0.82rem; color: #fca5a5;">${gap.skill}</strong>
                    <span style="font-size: 0.65rem; font-weight: 800; color: #ef4444; background: rgba(239,68,68,0.15); padding: 2px 8px; border-radius: 6px;">
                      REQUIRED · NOT FOUND
                    </span>
                  </div>
                  <div style="font-size: 0.74rem; color: rgba(255,255,255,0.7); line-height: 1.4;">
                    ${gap.guidance}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 4. IMPORTANT & NICE-TO-HAVE GAPS (§18) -->
        ${(analysis.importantGaps?.length || analysis.niceToHaveGaps?.length) ? `
          <div style="background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.2); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
            <div style="font-size: 0.84rem; font-weight: 800; color: #fbbf24; margin-bottom: 10px;">
              💡 IMPORTANT &amp; NICE-TO-HAVE GAPS
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${(analysis.importantGaps || []).map(gap => `
                <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <strong style="font-size: 0.8rem; color: #fde047;">${gap.skill}</strong>
                    <span style="font-size: 0.65rem; font-weight: 700; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px;">IMPORTANT</span>
                  </div>
                  <div style="font-size: 0.73rem; color: rgba(255,255,255,0.65);">${gap.guidance}</div>
                </div>
              `).join('')}

              ${(analysis.niceToHaveGaps || []).map(gap => `
                <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <strong style="font-size: 0.8rem; color: #e2e8f0;">${gap.skill}</strong>
                    <span style="font-size: 0.65rem; font-weight: 700; color: #94a3b8; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px;">NICE TO HAVE</span>
                  </div>
                  <div style="font-size: 0.73rem; color: rgba(255,255,255,0.65);">${gap.guidance}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 5. AUDITABLE CATEGORY BREAKDOWN TABLE (§19) -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 0.82rem; font-weight: 800; color: #a855f7; letter-spacing: 0.5px; text-transform: uppercase;">
              📊 Auditable Score Breakdown
            </div>
            <span style="font-size: 0.68rem; font-weight: 800; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 6px;">
              CONFIDENCE: ${analysis.confidence || 'MEDIUM'}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(analysis.breakdown || []).map(item => `
              <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div>
                  <div style="font-size: 0.8rem; font-weight: 700; color: #fff;">
                    ${item.category} <span style="font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: normal;">${item.isApplicable ? `(Normalized Weight: ${item.weight})` : '(Not specified by employer)'}</span>
                  </div>
                  <div style="font-size: 0.72rem; color: rgba(255,255,255,0.65); margin-top: 2px;">
                    ${item.detail}
                  </div>
                </div>
                <div style="font-size: 1.1rem; font-weight: 900; color: ${!item.isApplicable || item.score === null ? 'rgba(255,255,255,0.3)' : item.score >= 75 ? '#34d399' : item.score >= 50 ? '#38bdf8' : '#f87171'}; font-family: monospace;">
                  ${item.scoreDisplay || (item.score !== null ? `${item.score}%` : 'N/A')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ACTIONS -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button onclick="window.switchWorkspace('create')" class="btn btn-secondary" style="flex: 1; padding: 11px; font-size: 0.82rem; font-weight: 700;">
            ✏️ Edit Portfolio to Address Gaps
          </button>
        </div>
      ` : analysis && !analysis.hasRequirements ? `
        <!-- INSUFFICIENT JOB REQUIREMENTS WARNING (§3, §4, §12) -->
        <div style="background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.25); border-radius: 14px; padding: 18px; margin-bottom: 16px; text-align: center;">
          <span style="font-size: 24px; display: block; margin-bottom: 6px;">ℹ️</span>
          <strong style="color: #fde047; font-size: 14px; display: block; margin-bottom: 6px;">${analysis.reason || "We couldn't identify enough job requirements to calculate a reliable Job Fit score."}</strong>
          <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0; line-height: 1.5;">
            Paste the complete job description, including requirements and qualifications, for an accurate analysis.
          </p>
        </div>
      ` : ''}

    </div>
  `;

  // ──────────────────────────────────────────────
  // EVENT BINDINGS
  // ──────────────────────────────────────────────

  // 1. URL Fetch Button Handler
  const btnFetchUrl = container.querySelector('#btn-extract-job-url');
  const urlInput = container.querySelector('#jt-url');
  const jdTextarea = container.querySelector('#jt-jd');
  const roleInput = container.querySelector('#jt-role');
  const feedback = container.querySelector('#url-fetch-feedback');

  if (btnFetchUrl) {
    btnFetchUrl.addEventListener('click', async () => {
      const url = urlInput?.value?.trim();
      if (!url) {
        showFeedback(feedback, 'Please enter a valid job posting URL first.', 'error');
        return;
      }
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        showFeedback(feedback, 'Enter a complete URL starting with https://', 'error');
        urlInput?.focus();
        return;
      }

      btnFetchUrl.disabled = true;
      btnFetchUrl.textContent = '⏳ Fetching...';
      showFeedback(feedback, 'Connecting to job posting site...', 'info');

      try {
        const response = await fetch('/api/portfolio?action=extract-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const result = await response.json().catch(() => ({}));

        if (result.success && result.extractedText) {
          if (jdTextarea) jdTextarea.value = result.extractedText;
          if (roleInput && !roleInput.value && result.suggestedTitle) {
            roleInput.value = result.suggestedTitle;
          }
          showFeedback(feedback, '✓ Job requirements extracted successfully. Click "Calculate Evidence-Based Job Fit" below.', 'success');
        } else {
          showFeedback(feedback, result.error || "This job site blocks automatic reading. Paste the job description below and we'll analyze it directly.", 'error');
        }
      } catch (err) {
        showFeedback(feedback, "This job site blocks automatic reading. Paste the job description below and we'll analyze it directly.", 'error');
      } finally {
        btnFetchUrl.disabled = false;
        btnFetchUrl.textContent = '⚡ Fetch Posting';
      }
    });
  }
  urlInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      btnFetchUrl?.click();
    }
  });

  // 2. Run Analysis Button Handler
  const btnRun = container.querySelector('#btn-run-job-analysis');
  if (btnRun) {
    btnRun.addEventListener('click', () => {
      const role = roleInput?.value?.trim() || '';
      const company = container.querySelector('#jt-company')?.value?.trim() || '';
      const jobUrl = urlInput?.value?.trim() || '';
      const jobDescription = jdTextarea?.value?.trim() || '';

      const targetInput = { role, company, jobUrl, jobDescription };
      const normalizedJob = jobAnalyzer.analyzeJobTarget(targetInput);
      const newAnalysis = matchPortfolioToJob(portfolioData, normalizedJob);

      // Track usage quota
      portfolioData.jobFitAnalysesCount = (portfolioData.jobFitAnalysesCount || 0) + 1;
      portfolioData.jobTarget = {
        ...targetInput,
        analysis: newAnalysis,
        lastAnalyzedAt: new Date().toISOString()
      };

      onUpdatePortfolioData(portfolioData);
      renderJobTargetPanel(container, portfolioData, onUpdatePortfolioData);
    });
  }

  function showFeedback(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    if (type === 'error') {
      el.style.background = 'rgba(239,68,68,0.15)';
      el.style.border = '1px solid rgba(239,68,68,0.3)';
      el.style.color = '#fca5a5';
    } else if (type === 'success') {
      el.style.background = 'rgba(16,185,129,0.15)';
      el.style.border = '1px solid rgba(16,185,129,0.3)';
      el.style.color = '#6ee7b7';
    } else {
      el.style.background = 'rgba(6,182,212,0.15)';
      el.style.border = '1px solid rgba(6,182,212,0.3)';
      el.style.color = '#38bdf8';
    }
  }
}
