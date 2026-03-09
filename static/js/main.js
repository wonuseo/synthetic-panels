import { state } from './state.js';
import { loadSavedTheme } from './themes.js';
loadSavedTheme();
import { DEMO_FUNNEL_CONFIG, DEMO_PERSONA_SUMMARIES, DEMO_PANEL_REVIEWS, DEMO_SYNTHESIS } from './demo/index.js';
import { loadFunnelConfig, loadSurveyTemplate } from './api.js';
import { $, updateRunBtn, handleFile, initModelSelectors } from './ui.js';
import { renderOverviewTab } from './render/overview.js';
import { renderFunnelTab } from './render/funnel-tab.js';
import { renderIndividualTab } from './render/individual.js';
import { renderQATab } from './render/qa.js';
import { renderSurveyTab } from './render/survey.js';
import { renderPanelStatsTab } from './render/panel-stats.js';
import { activateGroup, resetTabHierarchy, initTabController } from './tabs-controller.js';
import { initPersonaLoader } from './persona-loader.js';
import { renderPanelSizeEstimateGuide, initReviewRunner } from './review-runner.js';
import { refreshUsageBadge } from './usage-badge.js';
import { openPdfPrintWindow } from './pdf-exporter.js';

let surveyTemplatePromise = null;

function renderSurveyTabs() {
  renderSurveyTab(state.surveyTemplate, window.funnelConfig);
  renderPanelStatsTab(state.lastPanelReviews, state.surveyTemplate, state.lastPersonaSummaries, window.funnelConfig);
}

async function ensureSurveyTemplate() {
  if (Array.isArray(state.surveyTemplate) && state.surveyTemplate.length) {
    return state.surveyTemplate;
  }
  if (!surveyTemplatePromise) {
    surveyTemplatePromise = loadSurveyTemplate(state.team)
      .then((sections) => {
        state.surveyTemplate = Array.isArray(sections) ? sections : [];
        if (!$.pageResults.classList.contains('hidden')) renderSurveyTabs();
        return state.surveyTemplate;
      })
      .catch(() => {
        state.surveyTemplate = [];
        return state.surveyTemplate;
      });
  }
  return surveyTemplatePromise;
}

/* ── Toggle helpers (exposed on window for inline onclick handlers) ── */
function toggleCard(idx) { document.getElementById('pc-' + idx).classList.toggle('open'); }
function toggleRaw(idx) { document.getElementById('raw-' + idx).classList.toggle('show'); }
function toggleDrillDown(personaId) {
  const el = document.getElementById('drill-' + personaId);
  if (el) el.classList.toggle('show');
  const header = document.getElementById('drill-header-' + personaId);
  if (header) header.classList.toggle('open');
}
window.toggleCard = toggleCard;
window.toggleRaw = toggleRaw;
window.toggleDrillDown = toggleDrillDown;

/* ── Show results page ── */
function showResults(payload) {
  const { persona_summaries, panel_reviews, synthesis, synthesis_raw } = payload;
  state.lastPersonaSummaries = persona_summaries || [];
  state.lastPanelReviews = panel_reviews || [];
  state.lastSynthesis = synthesis;
  state.lastSynthesisRaw = synthesis_raw;
  state.funnelQuantGroupAverages = payload.funnel_quant_group_averages || {};

  const _STRUCTURAL = new Set([
    'persona_id', 'persona_name', 'panel_count', 'panel_reviews',
    'recommendation_distribution', 'funnel_quant_groups', 'quant_averages', 'qual_fields',
  ]);
  state.lastReviews = persona_summaries.map(s => {
    const base = {
      persona_id: s.persona_id,
      persona_name: s.persona_name,
      panel_count: s.panel_count,
      recommendation: Object.keys(s.recommendation_distribution || {}).reduce((a, b) =>
        (s.recommendation_distribution[a] || 0) >= (s.recommendation_distribution[b] || 0) ? a : b, '보통'),
      funnel_quant_groups: s.funnel_quant_groups || {},
      error: null,
    };
    for (const [k, v] of Object.entries(s)) {
      if (!_STRUCTURAL.has(k)) {
        base[k] = v;
        if (k.startsWith('avg_')) base[k.slice(4)] = v;
      }
    }
    Object.assign(base, s.quant_averages || {});
    Object.assign(base, s.qual_fields || {});
    return base;
  });

  $.pageUpload.classList.add('hidden');
  $.pageResults.classList.remove('hidden');
  resetTabHierarchy();

  renderOverviewTab(state.lastReviews, synthesis, synthesis_raw);
  renderFunnelTab('upper');
  renderFunnelTab('mid');
  renderFunnelTab('lower');
  renderSurveyTabs();
  renderIndividualTab(state.lastPersonaSummaries);
  renderQATab(state.lastPanelReviews);
}

/* ── Demo mode ── */
async function loadDemo() {
  window.funnelConfig = DEMO_FUNNEL_CONFIG;
  await ensureSurveyTemplate();
  showResults({
    persona_summaries: DEMO_PERSONA_SUMMARIES,
    panel_reviews: DEMO_PANEL_REVIEWS,
    synthesis: DEMO_SYNTHESIS,
    synthesis_raw: null,
  });
}
if ($.btnDemo) $.btnDemo.addEventListener('click', () => loadDemo());
window.loadDemo = loadDemo;

/* ── Team toggle ── */
const _TEAM_INTRO = {
  marketing: '가상 페르소나를 활용하여 프로모션 자료에 대한 소비자 반응을 시뮬레이션합니다.<br>브랜드 인지부터 전환까지, 마케팅 퍼널 전 단계의 정량·정성 피드백을 빠르게 확인하세요.',
  commerce: '가상 페르소나를 활용하여 MD 상품에 대한 소비자 반응을 시뮬레이션합니다.<br>상품 매력도부터 구매 전환까지, 커머스 퍼널 전 단계의 정량·정성 피드백을 빠르게 확인하세요.',
};
const _TEAM_UPLOAD_TITLE = {
  marketing: '📎 프로모션 자료 업로드',
  commerce: '📎 MD 상품 자료 업로드',
};

document.getElementById('team-toggle')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.team-btn');
  if (!btn) return;
  const team = btn.dataset.team;
  if (!team || team === state.team) return;

  state.team = team;
  document.querySelectorAll('.team-btn').forEach(b => b.classList.toggle('active', b.dataset.team === team));

  const introEl = document.getElementById('intro-desc');
  if (introEl) introEl.innerHTML = _TEAM_INTRO[team] || _TEAM_INTRO.marketing;
  const uploadTitle = document.getElementById('upload-card-title');
  if (uploadTitle) uploadTitle.textContent = _TEAM_UPLOAD_TITLE[team] || _TEAM_UPLOAD_TITLE.marketing;

  state.personasLoaded = false;
  state.samplingSeed = null;
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">팀이 변경되었습니다. 페르소나를 다시 로드하세요.</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';
  updateRunBtn();

  await loadFunnelConfig(team);
  surveyTemplatePromise = null;
  state.surveyTemplate = [];
  ensureSurveyTemplate();
});

/* ── Panel size change ── */
$.panelSize.addEventListener('change', () => {
  const panelSize = Number($.panelSize.value || 10);
  state.selectedPanelSize = panelSize;
  renderPanelSizeEstimateGuide();
  if (!state.personasLoaded) { updateRunBtn(); return; }
  state.personasLoaded = false;
  state.samplingSeed = null;
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">패널 수가 변경되었습니다. 페르소나를 다시 로드하세요.</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';
  updateRunBtn();
});

/* ── Back navigation ── */
$.btnBack.addEventListener('click', () => {
  $.pageResults.classList.add('hidden');
  $.pageUpload.classList.remove('hidden');
});

/* ── Save PDF report ── */
$.btnSave.addEventListener('click', async () => {
  if (!state.lastPanelReviews.length && !state.lastReviews.length) return;
  $.btnSave.disabled = true;
  $.btnSave.textContent = 'PDF 생성 중...';

  const opened = openPdfPrintWindow();
  if (!opened) {
    alert('팝업이 차단되어 PDF 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요.');
    $.btnSave.textContent = '📄 Save PDF Report';
    $.btnSave.disabled = false;
    return;
  }

  $.btnSave.textContent = '✅ PDF 인쇄 창 열림';
  setTimeout(() => {
    $.btnSave.textContent = '📄 Save PDF Report';
    $.btnSave.disabled = false;
  }, 2500);
});

/* ── File drop zone ── */
$.dropZone.addEventListener('click', () => $.fileInput.click());
$.dropZone.addEventListener('dragover', e => { e.preventDefault(); $.dropZone.classList.add('dragover'); });
$.dropZone.addEventListener('dragleave', () => $.dropZone.classList.remove('dragover'));
$.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  $.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
$.fileInput.addEventListener('change', () => { if ($.fileInput.files.length) handleFile($.fileInput.files[0]); });

$.textContent.addEventListener('input', updateRunBtn);

/* ── Provider change ── */
$.provider.addEventListener('change', () => {
  $.providerWarn.classList.toggle('hidden', $.provider.value !== 'Claude');
  initModelSelectors();
  renderPanelSizeEstimateGuide();
});
[$.reviewModel, $.summaryModel, $.synthesisModel].forEach(sel => {
  sel.addEventListener('change', renderPanelSizeEstimateGuide);
});

/* ── Initialize ── */
initTabController();
initPersonaLoader();
initReviewRunner(showResults, refreshUsageBadge);
initModelSelectors();
renderPanelSizeEstimateGuide();
loadFunnelConfig(state.team);
ensureSurveyTemplate();
refreshUsageBadge();
