import { state } from './state.js';
import { DEMO_FUNNEL_CONFIG, DEMO_PERSONA_SUMMARIES, DEMO_PANEL_REVIEWS, DEMO_SYNTHESIS } from './demo.js';
import { loadFunnelConfig, loadPersonas, runReview, saveResults, checkReviewLimit } from './api.js';
import { $, updateRunBtn, handleFile, initModelSelectors } from './ui.js';
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
function toggleDrillDown(personaId) {
  const el = document.getElementById('drill-' + personaId);
  if (el) el.classList.toggle('show');
  const header = document.getElementById('drill-header-' + personaId);
  if (header) header.classList.toggle('open');
}
window.toggleCard = toggleCard;
window.toggleRaw = toggleRaw;
window.toggleDrillDown = toggleDrillDown;

/* ── Format seconds as m:ss ── */
function fmtTime(sec) {
  if (sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Show results page ── */
function showResults(payload) {
  const { persona_summaries, panel_reviews, synthesis, synthesis_raw } = payload;
  state.lastPersonaSummaries = persona_summaries || [];
  state.lastPanelReviews = panel_reviews || [];
  state.lastSynthesis = synthesis;
  state.lastSynthesisRaw = synthesis_raw;

  // Build lastReviews from persona_summaries for backward compat with overview/funnel tabs
  // Map persona summaries to review-like objects with float averages
  state.lastReviews = persona_summaries.map(s => ({
    persona_id: s.persona_id,
    persona_name: s.persona_name,
    panel_count: s.panel_count,
    appeal_score: s.avg_appeal_score,
    first_impression: s.first_impression,
    key_positives: s.key_positives,
    key_concerns: s.key_concerns,
    recommendation: Object.keys(s.recommendation_distribution || {}).reduce((a, b) =>
      (s.recommendation_distribution[a] || 0) >= (s.recommendation_distribution[b] || 0) ? a : b, '보통'),
    review_summary: s.review_summary,
    like_dislike: s.avg_like_dislike,
    favorable_unfavorable: s.avg_favorable_unfavorable,
    value_for_money: s.avg_value_for_money,
    price_fairness: s.avg_price_fairness,
    brand_self_congruity: s.avg_brand_self_congruity,
    brand_image_fit: s.avg_brand_image_fit,
    message_clarity: s.avg_message_clarity,
    attention_grabbing: s.avg_attention_grabbing,
    info_sufficiency: s.avg_info_sufficiency,
    competitive_preference: s.competitive_preference,
    likelihood_high: s.avg_likelihood_high,
    probability_consider_high: s.avg_probability_consider_high,
    willingness_high: s.avg_willingness_high,
    purchase_probability_juster: s.avg_purchase_probability_juster,
    perceived_message: s.perceived_message,
    emotional_response: s.emotional_response,
    purchase_trigger_barrier: s.purchase_trigger_barrier,
    recommendation_context: s.recommendation_context,
    error: null,
  }));

  $.pageUpload.classList.add('hidden');
  $.pageResults.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
  document.getElementById('tab-overview').classList.add('active');

  renderOverviewTab(state.lastReviews, synthesis, synthesis_raw);
  renderFunnelTab('upper');
  renderFunnelTab('mid');
  renderFunnelTab('lower');
  renderIndividualTab(state.lastPersonaSummaries);
  renderQATab(state.lastPanelReviews);
}

/* ── Demo mode ── */
function loadDemo() {
  window.funnelConfig = DEMO_FUNNEL_CONFIG;
  showResults({
    persona_summaries: DEMO_PERSONA_SUMMARIES,
    panel_reviews: DEMO_PANEL_REVIEWS,
    synthesis: DEMO_SYNTHESIS,
    synthesis_raw: null,
  });
}
window.loadDemo = loadDemo;

/* ── Usage badge ── */
async function refreshUsageBadge() {
  try {
    const info = await checkReviewLimit();
    const d = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
    $.usageBadge.classList.remove('hidden', 'warn', 'locked');
    if (info.needs_password) {
      $.usageBadge.classList.add('locked');
      $.usageBadge.textContent = `🔒 ${d} 사용량: ${info.today_count}/${info.limit} (비밀번호 필요)`;
    } else if (info.today_count >= info.limit - 1 && info.today_count > 0) {
      $.usageBadge.classList.add('warn');
      $.usageBadge.textContent = `⚠️ ${d} 사용량: ${info.today_count}/${info.limit}`;
    } else {
      $.usageBadge.textContent = `📊 ${d} 사용량: ${info.today_count}/${info.limit}`;
    }
  } catch {}
}

/* ── Initialize model selectors and load funnel config ── */
initModelSelectors();
loadFunnelConfig();
refreshUsageBadge();

/* ── Provider change ── */
$.provider.addEventListener('change', () => {
  $.providerWarn.classList.toggle('hidden', $.provider.value !== 'Claude');
  initModelSelectors();
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
    const totalPanels = result.total_panels || result.personas.reduce((s, p) => s + (p.panel_count || 1), 0);
    $.pStatus.innerHTML = `<div class="persona-badge ok">✅ ${result.personas.length}명 페르소나 · ${totalPanels}개 패널 로드 완료</div>`;
    $.pListWrap.classList.remove('hidden');
    $.pListWrap.innerHTML = `<div class="persona-list">${
      result.personas.map(p => `
        <div class="persona-list-item">
          <span class="p-name">${esc(p.persona_name)}</span>
          ${p.panel_gender ? `<span class="p-tag">${esc(p.panel_gender)}</span>` : ''}
          ${p.persona_season ? `<span class="p-tag">${esc(p.persona_season)}</span>` : ''}
          ${p.panel_count ? `<span class="p-tag">${p.panel_count}패널</span>` : ''}
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

  // Check daily limit and ask for password if needed
  let password = null;
  try {
    const limitInfo = await checkReviewLimit();
    if (limitInfo.needs_password) {
      password = prompt(`오늘 ${limitInfo.today_count}/${limitInfo.limit}회 사용했습니다. 비밀번호를 입력해주세요:`);
      if (!password) return;
    }
  } catch {}

  $.btnRun.disabled = true;
  $.progress.classList.remove('hidden');
  $.progressFill.style.width = '0%';
  $.progressText.textContent = '리뷰를 시작합니다...';
  $.progressTime.textContent = '';

  const fd = new FormData();
  if (state.selectedFile) fd.append('file', state.selectedFile);
  if (textVal) fd.append('text_content', textVal);
  fd.append('provider', $.provider.value);
  fd.append('review_model', $.reviewModel.value);
  fd.append('summary_model', $.summaryModel.value);
  fd.append('synthesis_model', $.synthesisModel.value);
  fd.append('qa_mode', document.getElementById('qa-mode').value);
  if (password) fd.append('password', password);

  try {
    const donePayload = await runReview(
      fd,
      (payload) => {
        if (payload.phase === 'panel_review') {
          const pct = (payload.completed / payload.total) * 100;
          $.progressFill.style.width = pct + '%';
          $.progressText.textContent = `패널 리뷰 ${payload.completed}/${payload.total} — ${payload.persona_name}`;
          // Time estimate
          if (payload.elapsed_seconds && payload.completed >= 3) {
            const perItem = payload.elapsed_seconds / payload.completed;
            const remaining = perItem * (payload.total - payload.completed);
            $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 남은 시간 약 ${fmtTime(remaining)}`;
          } else if (payload.elapsed_seconds) {
            $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 추정 중...`;
          }
        } else if (payload.phase === 'persona_synthesis') {
          const pct = (payload.completed / payload.total) * 100;
          $.progressFill.style.width = pct + '%';
          $.progressText.textContent = `페르소나 종합 ${payload.completed}/${payload.total} — ${payload.persona_name}`;
          if (payload.elapsed_seconds && payload.completed >= 2) {
            const perItem = payload.elapsed_seconds / payload.completed;
            const remaining = perItem * (payload.total - payload.completed);
            $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 남은 시간 약 ${fmtTime(remaining)}`;
          } else if (payload.elapsed_seconds) {
            $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 추정 중...`;
          }
        }
      },
      (payload) => {
        $.progressText.textContent = payload.message;
        $.progressTime.textContent = '';
      }
    );
    if (donePayload) {
      showResults(donePayload);
    }
  } catch (e) {
    if (e.needsPassword) {
      alert(e.message);
    } else {
      alert('리뷰 실행 중 오류: ' + e.message);
    }
  }

  $.progress.classList.add('hidden');
  $.btnRun.disabled = false;
  refreshUsageBadge();
});

/* ── Back navigation ── */
$.btnBack.addEventListener('click', () => {
  $.pageResults.classList.add('hidden');
  $.pageUpload.classList.remove('hidden');
});

/* ── Save to Sheets ── */
$.btnSave.addEventListener('click', async () => {
  if (!state.lastPanelReviews.length && !state.lastReviews.length) return;
  $.btnSave.disabled = true;
  $.btnSave.textContent = '저장 중...';

  const result = await saveResults(
    JSON.stringify(state.lastPanelReviews.length ? state.lastPanelReviews : state.lastReviews),
    state.lastSynthesis ? JSON.stringify(state.lastSynthesis) : null,
    state.lastPersonaSummaries.length ? JSON.stringify(state.lastPersonaSummaries) : null
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
