import { state } from './state.js';
import { DEMO_FUNNEL_CONFIG, DEMO_REVIEWS, DEMO_SYNTHESIS } from './demo.js';
import { loadFunnelConfig, loadPersonas, runReview, saveResults } from './api.js';
import { $, updateRunBtn, handleFile, initModelSelector } from './ui.js';
import { renderOverviewTab } from './render/overview.js';
import { renderFunnelTab } from './render/funnel-tab.js';
import { renderIndividualTab } from './render/individual.js';
import { renderQATab } from './render/qa.js';
import { esc } from './render/helpers.js';

/* ── Toggle helpers (exposed on window for inline onclick handlers) ── */
function toggleCard(idx) {
  document.getElementById('pc-' + idx).classList.toggle('open');
}
function toggleRaw(idx) {
  document.getElementById('raw-' + idx).classList.toggle('show');
}
window.toggleCard = toggleCard;
window.toggleRaw = toggleRaw;

/* ── Show results page ── */
function showResults(payload) {
  const { reviews, synthesis, synthesis_raw } = payload;
  state.lastReviews = reviews;
  state.lastSynthesis = synthesis;
  state.lastSynthesisRaw = synthesis_raw;

  $.pageUpload.classList.add('hidden');
  $.pageResults.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
  document.getElementById('tab-overview').classList.add('active');

  renderOverviewTab(reviews, synthesis, synthesis_raw);
  renderFunnelTab('upper');
  renderFunnelTab('mid');
  renderFunnelTab('lower');
  renderIndividualTab(reviews);
  renderQATab(reviews);
}

/* ── Demo mode ── */
function loadDemo() {
  window.funnelConfig = DEMO_FUNNEL_CONFIG;
  showResults({ reviews: DEMO_REVIEWS, synthesis: DEMO_SYNTHESIS, synthesis_raw: null });
}
window.loadDemo = loadDemo;

/* ── Initialize model selector and load funnel config ── */
initModelSelector();
loadFunnelConfig();

/* ── Provider change ── */
$.provider.addEventListener('change', () => {
  $.providerWarn.classList.toggle('hidden', $.provider.value !== 'Claude');
  initModelSelector();
});

/* ── File drop zone ── */
$.dropZone.addEventListener('click', () => $.fileInput.click());
$.dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  $.dropZone.classList.add('dragover');
});
$.dropZone.addEventListener('dragleave', () => $.dropZone.classList.remove('dragover'));
$.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  $.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
$.fileInput.addEventListener('change', () => {
  if ($.fileInput.files.length) handleFile($.fileInput.files[0]);
});

/* ── Text content input ── */
$.textContent.addEventListener('input', updateRunBtn);

/* ── Load personas ── */
$.btnLoad.addEventListener('click', async () => {
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">로딩 중...</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';

  const result = await loadPersonas();
  if (result.ok) {
    state.personasLoaded = true;
    $.pStatus.innerHTML = `<div class="persona-badge ok">✅ ${result.personas.length}명 로드 완료</div>`;
    $.pListWrap.classList.remove('hidden');
    $.pListWrap.innerHTML = `<div class="persona-list">${
      result.personas.map(p => `
        <div class="persona-list-item">
          <span class="p-name">${esc(p.persona_name)}</span>
          ${p.panel_gender ? `<span class="p-tag">${esc(p.panel_gender)}</span>` : ''}
          ${p.persona_season ? `<span class="p-tag">${esc(p.persona_season)}</span>` : ''}
        </div>`).join('')
    }</div>`;
  } else {
    state.personasLoaded = false;
    $.pStatus.innerHTML = `<div class="persona-badge err">❌ ${result.error}</div>`;
  }
  updateRunBtn();
});

/* ── Run review (SSE) ── */
$.btnRun.addEventListener('click', async () => {
  const textVal = $.textContent.value.trim();
  if ((!state.selectedFile && !textVal) || !state.personasLoaded) return;
  $.btnRun.disabled = true;
  $.progress.classList.remove('hidden');
  $.progressFill.style.width = '0%';
  $.progressText.textContent = '리뷰를 시작합니다...';

  const fd = new FormData();
  if (state.selectedFile) fd.append('file', state.selectedFile);
  if (textVal) fd.append('text_content', textVal);
  fd.append('provider', $.provider.value);
  fd.append('model', $.model.value);
  fd.append('qa_mode', document.getElementById('qa-mode').value);

  try {
    const donePayload = await runReview(
      fd,
      (payload) => {
        const pct = (payload.completed / payload.total) * 100;
        $.progressFill.style.width = pct + '%';
        $.progressText.textContent = `${payload.completed}/${payload.total} 완료 — ${payload.persona_name}`;
      },
      (payload) => {
        $.progressText.textContent = payload.message;
      }
    );
    if (donePayload) {
      showResults(donePayload);
    }
  } catch (e) {
    alert('리뷰 실행 중 오류: ' + e.message);
  }

  $.progress.classList.add('hidden');
  $.btnRun.disabled = false;
});

/* ── Back navigation ── */
$.btnBack.addEventListener('click', () => {
  $.pageResults.classList.add('hidden');
  $.pageUpload.classList.remove('hidden');
});

/* ── Save to Sheets ── */
$.btnSave.addEventListener('click', async () => {
  if (!state.lastReviews.length) return;
  $.btnSave.disabled = true;
  $.btnSave.textContent = '저장 중...';

  const result = await saveResults(
    JSON.stringify(state.lastReviews),
    state.lastSynthesis ? JSON.stringify(state.lastSynthesis) : null
  );

  if (result.ok) {
    $.btnSave.textContent = `✅ ${result.count}건 저장 완료`;
    setTimeout(() => {
      $.btnSave.textContent = '💾 Save to Sheets';
      $.btnSave.disabled = false;
    }, 3000);
  } else {
    alert('저장 실패: ' + result.error);
    $.btnSave.textContent = '💾 Save to Sheets';
    $.btnSave.disabled = false;
  }
});

/* ── Tab switching ── */
document.getElementById('tab-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
});
