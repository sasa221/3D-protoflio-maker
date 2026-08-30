import {
  buildImportReview,
  createImportSelection,
  extractImportText,
  applyImportSelection,
  releaseImportSession
} from '../services/CVImportReviewService.js';
import { saveCareerProfile } from '../services/CareerProfileService.js';

const escape = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export function renderCVImportReviewPanel(container, { ownerUserId = 'local-dev-user', getBaseProfile, onSaved, autoOpen = false } = {}) {
  if (!container) return;
  container.innerHTML = `<button type="button" data-open-cv-import style="width:100%;background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.3);color:#67e8f9;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Import PDF/DOCX locally → Review fields</button>`;
  const open = () => renderImportDialog();
  container.querySelector('[data-open-cv-import]').addEventListener('click', open);
  if (autoOpen) setTimeout(open, 0);

  function renderImportDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'cv-import-review-overlay';
    overlay.innerHTML = `<div class="cv-import-review-card" role="dialog" aria-modal="true" aria-label="Private CV import review"><button type="button" data-import-close aria-label="Close" style="float:right;background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer">×</button><span style="font-size:10px;letter-spacing:2px;color:#67e8f9;font-weight:800">PRIVATE LOCAL IMPORT</span><h2 style="margin:6px 0;font-size:22px">Import and review your CV</h2><p style="color:rgba(255,255,255,.68);font-size:12px;margin:0 0 15px">Only PDF/DOCX bytes are read in this browser session. Nothing is uploaded, published, or used to rewrite your content.</p><div data-import-input><label class="cv-import-file-drop">Choose PDF or DOCX<input type="file" data-import-file accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label><div style="text-align:center;color:rgba(255,255,255,.45);font-size:11px;margin:10px">or paste CV text locally</div><textarea data-import-paste rows="6" placeholder="Paste text only if you prefer not to select a file" style="width:100%;box-sizing:border-box;background:#080a12;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:10px;resize:vertical"></textarea><button type="button" data-import-paste-start style="margin-top:9px;background:#0891b2;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700">Review pasted text</button></div><div data-import-progress style="display:none;margin-top:14px"><strong data-import-progress-label style="font-size:13px">Reading locally…</strong><div style="height:7px;background:rgba(255,255,255,.1);border-radius:8px;margin-top:8px;overflow:hidden"><div data-import-progress-bar style="height:100%;width:0;background:linear-gradient(90deg,#7c3aed,#06b6d4)"></div></div></div><div data-import-review style="margin-top:14px"></div><p data-import-status aria-live="polite" style="min-height:18px;color:#fca5a5;font-size:12px"></p></div>`;
    document.body.appendChild(overlay);
    let session = { review: null, file: null };
    const status = overlay.querySelector('[data-import-status]');
    const progress = overlay.querySelector('[data-import-progress]');
    const progressLabel = overlay.querySelector('[data-import-progress-label]');
    const progressBar = overlay.querySelector('[data-import-progress-bar]');
    const close = () => { releaseImportSession(session); session = { review: null, file: null }; overlay.remove(); };
    overlay.querySelector('[data-import-close]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    const showProgress = ({ label, percent }) => { progress.style.display = 'block'; progressLabel.textContent = label; progressBar.style.width = `${percent}%`; };
    const beginReview = (review) => { session.review = review; session.file = null; overlay.querySelector('[data-import-input]').style.display = 'none'; progress.style.display = 'none'; renderReview(review); };
    const parseFile = async file => {
      try { session.file = file; const extracted = await extractImportText(file, { onProgress: showProgress }); const review = buildImportReview(extracted.text, extracted); extracted.text = null; beginReview(review); }
      catch (error) { session.file = null; progress.style.display = 'none'; status.textContent = error.message || 'Import failed safely.'; }
    };
    overlay.querySelector('[data-import-file]').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) parseFile(file); event.target.value = ''; });
    overlay.querySelector('[data-import-paste-start]').addEventListener('click', () => { const text = overlay.querySelector('[data-import-paste]').value; try { if (text.trim().length < 20) throw new Error('Paste at least 20 characters to review.'); beginReview(buildImportReview(text, { format: 'pasted-text', fileName: 'Pasted CV text' })); } catch (error) { status.textContent = error.message; } });

    function fieldRow(path, item, multiline = false) {
      const input = multiline ? `<textarea data-import-field="${escape(path)}" rows="3">${escape(item.value)}</textarea>` : `<input data-import-field="${escape(path)}" value="${escape(item.value)}">`;
      const confidence = item.confidence === 'medium' ? ' · CHECK STRUCTURE' : '';
      return `<label class="cv-import-field"><input type="checkbox" data-import-select="${escape(path)}" ${item.selected ? 'checked' : ''}><span><strong>${escape(path.split('.').slice(-1)[0])}</strong><em>EXTRACTED · REVIEW${confidence}</em>${input}</span></label>`;
    }
    function listRows(key, items) { return items.map((item, index) => fieldRow(`${key}.${index}`, item, true)).join('') || `<p style="color:rgba(255,255,255,.5);font-size:12px">Not clearly extracted.</p>`; }
    function renderReview(review) {
      const selection = createImportSelection(review);
      const view = overlay.querySelector('[data-import-review]');
      view.innerHTML = `<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:10px;color:#fde68a;font-size:12px"><strong>Everything found is selected. Review it, uncheck anything you do not want, then save.</strong>${review.warnings.length ? `<ul style="margin:6px 0 0;padding-left:18px">${review.warnings.map(w => `<li>${escape(w)}</li>`).join('')}</ul>` : ''}</div><div style="display:flex;gap:8px;margin-top:10px"><button type="button" data-import-select-all>Select all</button><button type="button" data-import-clear-all>Deselect all</button></div><div class="cv-import-section"><h3>Contact</h3>${Object.entries(selection.contact).map(([key, item]) => fieldRow(`contact.${key}`, item)).join('')}</div><div class="cv-import-section"><h3>Summary</h3>${fieldRow('summary', selection.summary, true)}</div>${['experience','education','skills','projects','certifications','languages','training','activities'].map(key => `<div class="cv-import-section"><h3>${escape(key)}</h3>${listRows(key, selection[key] || [])}</div>`).join('')}<label style="display:flex;gap:8px;align-items:center;font-size:12px;color:rgba(255,255,255,.75);margin-top:12px"><input type="checkbox" data-import-overwrite> Replace my existing CV fields with the selected imported fields</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" data-import-save style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:800">Save selected fields</button><button type="button" data-import-cancel style="background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:10px 14px">Cancel</button></div>`;
      view.querySelector('[data-import-select-all]').addEventListener('click', () => view.querySelectorAll('[data-import-select]').forEach(input => { input.checked = true; }));
      view.querySelector('[data-import-clear-all]').addEventListener('click', () => view.querySelectorAll('[data-import-select]').forEach(input => { input.checked = false; }));
      view.querySelector('[data-import-cancel]').addEventListener('click', close);
      view.querySelector('[data-import-save]').addEventListener('click', () => {
        const base = getBaseProfile?.();
        if (!base?.id) { status.textContent = 'Base CV is unavailable; nothing was saved.'; return; }
        const nextSelection = createImportSelection(review);
        view.querySelectorAll('[data-import-field]').forEach(input => {
          const path = input.dataset.importField.split('.'); const key = path[0];
          if (path.length === 2 && /^\d+$/.test(path[1])) {
            const item = nextSelection[key][Number(path[1])];
            if (item.value !== input.value) item.parsed = undefined;
            item.value = input.value;
          } else if (key === 'contact') nextSelection.contact[path[1]].value = input.value;
          else {
            if (nextSelection[key].value !== input.value) nextSelection[key].parsed = undefined;
            nextSelection[key].value = input.value;
          }
        });
        view.querySelectorAll('[data-import-select]').forEach(input => { const path = input.dataset.importSelect.split('.'); const key = path[0]; if (path.length === 2 && /^\d+$/.test(path[1])) nextSelection[key][Number(path[1])].selected = input.checked; else if (key === 'contact') nextSelection.contact[path[1]].selected = input.checked; else nextSelection[key].selected = input.checked; });
        const result = applyImportSelection(base, review, nextSelection, { overwriteExisting: view.querySelector('[data-import-overwrite]').checked });
        if (!result.changedFields.length) { status.textContent = 'No fields selected or existing values were preserved. Nothing changed.'; return; }
        let saved;
        try {
          saved = saveCareerProfile(result.profile, ownerUserId);
        } catch (error) {
          status.textContent = error?.message || 'The selected fields could not be saved.';
          return;
        }
        releaseImportSession(session); session = { review: null, file: null }; overlay.remove(); onSaved?.(saved, result);
      });
    }
  }
}
