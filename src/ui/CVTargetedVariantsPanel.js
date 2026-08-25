import {
  buildTargetedJobFit,
  buildVariantDiff,
} from '../services/CVTargetedVariantService.js';
import { globalEntitlements } from '../services/EntitlementService.js';
import { supabase } from '../services/SupabaseClient.js';
import { persistCareerProfile } from '../services/CareerProfileService.js';

const escape = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function stateLabel(state) {
  return state === 'evidence_found' ? 'Evidence found in Base CV' : state === 'keyword_without_evidence' ? 'Keyword mentioned; evidence needs review' : 'Missing evidence — do not add automatically';
}

function renderAnalysis(analysis) {
  if (!analysis) return '<p style="color:rgba(255,255,255,.58);font-size:13px">Paste a job description and choose Analyze. Nothing will be saved yet.</p>';
  return `<div class="cv-variant-analysis" style="display:grid;gap:12px">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><strong style="color:#fff">${escape(analysis.verdict || 'Analysis')}</strong><span style="color:#67e8f9;font-weight:800">${analysis.hasRequirements ? `${analysis.matchScore}% transparent fit signal` : 'No reliable score'}</span></div>
    <p style="margin:0;color:rgba(255,255,255,.68);font-size:12px">This is evidence guidance, not an ATS guarantee. Confidence: ${escape(analysis.confidence)}.</p>
    <div style="display:grid;gap:6px">${(analysis.breakdown || []).map(item => `<div style="display:flex;justify-content:space-between;gap:10px;color:rgba(255,255,255,.65);font-size:11px"><span>${escape(item.category)} · ${escape(item.weight)}</span><span>${item.score === null || item.score === undefined ? 'N/A' : `${escape(item.score)}%`} · ${escape(item.detail)}</span></div>`).join('')}</div>
    ${(analysis.evidence || []).slice(0, 24).map(item => `<div style="background:rgba(0,0,0,.2);border-radius:8px;padding:9px 10px"><strong style="color:#fff;font-size:12px">${escape(item.title)}</strong><span style="display:block;color:${item.state === 'evidence_found' ? '#86efac' : item.state === 'keyword_without_evidence' ? '#fde68a' : '#fca5a5'};font-size:11px;margin-top:3px">${escape(stateLabel(item.state))}</span><span style="display:block;color:rgba(255,255,255,.62);font-size:11px;margin-top:3px">${escape(item.detail)}</span></div>`).join('')}
  </div>`;
}

function renderDiff(diff = []) {
  const changed = diff.filter(item => item.changed);
  return `<div style="font-size:12px;color:rgba(255,255,255,.7)"><strong style="color:#fff">Review before saving</strong><p style="margin:5px 0">${changed.length ? `Confirmed changes: ${changed.map(item => escape(item.field)).join(', ')}` : 'No Base CV content will be changed. The draft starts from the Base CV and adds private targeting metadata.'}</p></div>`;
}

export function renderCVTargetedVariantsPanel(container, { ownerUserId = 'local-dev-user', getBaseProfile } = {}) {
  if (!container) return;
  const initialProfile = getBaseProfile?.();
  if (!initialProfile?.id) { container.innerHTML = ''; return; }
  const currentProfile = () => getBaseProfile?.() || initialProfile;
  let variants = [];
  container.innerHTML = `
        <section class="cv-targeted-variants" style="margin-top:24px;background:rgba(6,182,212,.06);border:1px solid rgba(6,182,212,.24);border-radius:16px;padding:18px;color:#fff">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><span style="font-size:10px;letter-spacing:2px;color:#67e8f9;font-weight:800">PRIVATE PRO WORKSPACE</span><h2 style="margin:5px 0;font-size:20px">Targeted CV Variants</h2><p style="margin:0;color:rgba(255,255,255,.68);font-size:12px;max-width:680px">Choose your Base CV, paste the job description, review the evidence, then save a separate draft. The Base CV and public Portfolio never change.</p></div><a href="/cv?profile=${encodeURIComponent(initialProfile.id)}" style="color:#67e8f9;font-size:12px;text-decoration:none">← Back to Base CV</a></div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:16px">
        <form id="cv-targeted-form" style="display:grid;gap:10px"><label style="font-size:12px">Target role<input name="role" required maxlength="160" placeholder="e.g. Frontend Developer" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#090b12;color:#fff"></label><label style="font-size:12px">Company name (private)<input name="company" maxlength="160" placeholder="Optional" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#090b12;color:#fff"></label><label style="font-size:12px">Paste job description only<textarea name="jobDescription" required minlength="15" rows="9" placeholder="Paste the complete requirements here. URL fetching is disabled for this flow." style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#090b12;color:#fff;resize:vertical"></textarea></label><label style="font-size:12px">Optional summary rewrite<input name="summary" maxlength="2400" placeholder="Only if you wrote and confirm this yourself" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#090b12;color:#fff"></label><label style="font-size:11px;color:rgba(255,255,255,.7)"><input type="checkbox" name="confirmSummary"> I wrote this summary and confirm it is truthful.</label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-variant-analyze style="background:#0891b2;color:#fff;border:0;border-radius:8px;padding:9px 13px;font-weight:700">Analyze evidence</button><button type="submit" data-variant-create disabled style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:9px 13px;font-weight:700">Save private Draft Variant</button></div><p data-variant-status aria-live="polite" style="min-height:16px;margin:0;font-size:12px"></p></form>
        <div style="background:rgba(0,0,0,.18);border-radius:12px;padding:13px;min-width:0"><div data-variant-analysis>${renderAnalysis(null)}</div><div data-variant-diff style="margin-top:14px"></div></div>
      </div>
      <div style="margin-top:18px"><h3 style="font-size:14px;margin:0 0 9px">Saved private drafts</h3><div data-variant-list style="display:grid;gap:8px">${renderVariantList(variants)}</div></div>
    </section>`;

  const form = container.querySelector('#cv-targeted-form');
  const status = container.querySelector('[data-variant-status]');
  const analyzeButton = container.querySelector('[data-variant-analyze]');
  const createButton = container.querySelector('[data-variant-create]');
  let latestAnalysis = null;
  let busy = false;
  const sessionToken = async () => (await supabase.auth.getSession()).data?.session?.access_token || '';
  const normalizeRemoteVariant = item => ({
    id: item.id,
    ownerUserId: item.owner_user_id,
    careerProfileId: item.career_profile_id,
    title: item.title,
    targetRole: item.target_role,
    companyName: item.company_name,
    analysis: item.job_fit_json,
    content: item.content_json,
    status: item.status,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  });
  const loadRemoteVariants = async () => {
    const token = await sessionToken();
    if (!token) return;
    const response = await fetch(`/api/portfolio?action=cv-variants&profileId=${encodeURIComponent(initialProfile.id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Targeted drafts could not be loaded.');
    variants = (payload.variants || []).map(normalizeRemoteVariant);
    container.querySelector('[data-variant-list]').innerHTML = renderVariantList(variants);
    bindDeleteButtons();
  };
  const values = () => { const data = new FormData(form); return { role: String(data.get('role') || '').trim(), company: String(data.get('company') || '').trim(), jobDescription: String(data.get('jobDescription') || '').trim(), summary: String(data.get('summary') || '').trim(), confirmSummary: data.get('confirmSummary') === 'on' }; };
  analyzeButton.addEventListener('click', () => {
    if (busy) return;
    try {
      const input = values();
      const base = currentProfile();
      latestAnalysis = buildTargetedJobFit(base, input);
      container.querySelector('[data-variant-analysis]').innerHTML = renderAnalysis(latestAnalysis);
      container.querySelector('[data-variant-diff]').innerHTML = renderDiff(buildVariantDiff(base, base.content));
      createButton.disabled = !latestAnalysis.hasRequirements;
      status.textContent = latestAnalysis.hasRequirements ? 'Analysis ready. Review evidence before saving.' : (latestAnalysis.reason || 'No reliable analysis.');
      status.style.color = latestAnalysis.hasRequirements ? '#86efac' : '#fde68a';
    } catch (error) { latestAnalysis = null; createButton.disabled = true; status.textContent = error.message; status.style.color = '#fca5a5'; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !latestAnalysis?.hasRequirements) return;
    if (globalEntitlements.getEffectivePlanId() === 'free') { status.textContent = 'A local Pro entitlement is required to save targeted variants.'; status.style.color = '#fde68a'; return; }
    busy = true; createButton.disabled = true; analyzeButton.disabled = true;
    try {
      const input = values();
      const base = currentProfile();
      await persistCareerProfile(base, ownerUserId);
      const token = await sessionToken();
      if (!token) throw new Error('Please sign in again before saving a targeted draft.');
      const idempotencyKey = `cv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch('/api/portfolio?action=cv-variant-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          careerProfileId: base.id,
          role: input.role,
          company: input.company,
          jobDescription: input.jobDescription,
          title: input.role,
          acceptedChanges: { summary: input.summary, confirmedSummary: input.confirmSummary },
          idempotencyKey
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Targeted CV draft could not be saved.');
      const variant = normalizeRemoteVariant(payload.variant);
      variants = [variant, ...variants.filter(item => item.id !== variant.id)];
      status.textContent = `Saved private draft: ${variant.title}`; status.style.color = '#86efac';
      container.querySelector('[data-variant-list]').innerHTML = renderVariantList(variants);
      bindDeleteButtons();
    } catch (error) { status.textContent = error.message; status.style.color = '#fca5a5'; }
    finally { busy = false; analyzeButton.disabled = false; createButton.disabled = !latestAnalysis?.hasRequirements; }
  });
  function bindDeleteButtons() {
    container.querySelectorAll('[data-delete-variant]').forEach(button => button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try {
        const token = await sessionToken();
        const response = await fetch('/api/portfolio?action=cv-variant-delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ variantId: button.dataset.deleteVariant })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Private draft could not be deleted.');
        variants = variants.filter(item => item.id !== button.dataset.deleteVariant);
        container.querySelector('[data-variant-list]').innerHTML = renderVariantList(variants);
        bindDeleteButtons();
        status.textContent = 'Private draft deleted. Base CV unchanged.'; status.style.color = '#86efac';
      } catch (error) { status.textContent = error.message; status.style.color = '#fca5a5'; }
      finally { busy = false; }
    }));
  }
  bindDeleteButtons();
  loadRemoteVariants().catch(error => { status.textContent = error.message; status.style.color = '#fca5a5'; });
}

function renderVariantList(variants) {
  if (!variants.length) return '<p style="font-size:12px;color:rgba(255,255,255,.55);margin:0">No targeted drafts yet.</p>';
  return variants.map(item => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(0,0,0,.18);border-radius:9px;padding:9px 10px"><div><strong style="font-size:12px">${escape(item.title)}</strong><span style="display:block;color:rgba(255,255,255,.58);font-size:11px">${escape(item.targetRole)}${item.companyName ? ` · ${escape(item.companyName)}` : ''} · Private draft</span></div><button type="button" data-delete-variant="${escape(item.id)}" style="background:transparent;color:#fca5a5;border:1px solid rgba(248,113,113,.35);border-radius:6px;padding:5px 8px;font-size:11px">Delete</button></div>`).join('');
}
