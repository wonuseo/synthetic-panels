import { state } from './state.js';
import { loadSavedTheme } from './themes.js';
loadSavedTheme();
import { DEMO_FUNNEL_CONFIG, DEMO_COMMERCE_FUNNEL_CONFIG, DEMO_PERSONA_SUMMARIES, DEMO_PANEL_REVIEWS, DEMO_SYNTHESIS } from './demo/index.js';
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
  window._demoFunnelConfigs = { marketing: DEMO_FUNNEL_CONFIG, commerce: DEMO_COMMERCE_FUNNEL_CONFIG };
  window._currentDemoSurveyTeam = 'marketing';
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

function switchDemoSurveyTeam(team) {
  if (!window._demoFunnelConfigs) return;
  window._currentDemoSurveyTeam = team;
  renderSurveyTab([], window._demoFunnelConfigs[team]);
}
window.switchDemoSurveyTeam = switchDemoSurveyTeam;

/* ── Metrics summary ── */
const _TEAM_METRICS = {
  marketing: {
    upper: {
      label: '브랜드 인지도',
      desc: '잠재 고객 대상 · 브랜드 인지 및 태도 형성 단계',
      quant: ['브랜드 호감도', '브랜드 적합성', '메시지 명확성', '주목도', '브랜드 신뢰도'],
      qual:  ['지각된 메시지', '감정적 반응', '브랜드 연상'],
    },
    mid: {
      label: '고객 획득',
      desc: '잠재·신규 고객 대상 · 수요 확보 및 고객 획득 단계',
      quant: ['매력도', '가성비', '가격 적정성', '정보 충분성', '추천 의향'],
      qual:  ['긍정 요소', '우려 사항', '경쟁 대안 비교', '정보 부족 사항'],
    },
    lower: {
      label: '전환 및 매출',
      desc: '구매 고려 고객 대상 · 최종 전환과 매출 단계',
      quant: ['구매 가능성', '고려 확률', '구매 의향', '재구매 의향', '구매 시급성'],
      qual:  ['구매 촉진 요소', '구매 장벽', '가격 인식'],
    },
  },
  commerce: {
    upper: {
      label: 'Product (상품 매력)',
      desc: '잠재 소비자 대상 · 상품 차별성 및 브랜드 인지 단계',
      quant: ['상품 차별성', '브랜드 프리미엄', '상품 신뢰도', '비주얼 매력도', '스토리 매력도'],
      qual:  ['상품 첫인상', '감정적 반응', '브랜드 연상'],
    },
    mid: {
      label: 'Value (가치 인식)',
      desc: '잠재·신규 고객 대상 · 가격 대비 가치 인식 단계',
      quant: ['가격 대비 가치', '품질 기대감', '선물 적합성', '정보 충분성', '추천 의향'],
      qual:  ['긍정 요소', '우려 사항', '경쟁 상품 비교', '정보 부족 사항'],
    },
    lower: {
      label: 'Purchase (구매 전환)',
      desc: '구매 고려 고객 대상 · 최종 구매 전환 및 재구매 단계',
      quant: ['구매 가능성', '고려 확률', '구매 의향', '재구매 의향', '구매 시급성'],
      qual:  ['구매 촉진 요소', '구매 장벽', '가격 인식'],
    },
  },
};

function renderMetricsSummary(team) {
  const el = document.getElementById('metrics-summary');
  if (!el) return;
  const data = _TEAM_METRICS[team] || _TEAM_METRICS.marketing;
  const teamLabel = team === 'commerce' ? '커머스비즈니스팀' : '마케팅팀';
  el.innerHTML = `
    <div class="metrics-summary-header">
      📊 측정 지표 <span>${teamLabel}</span>
    </div>
    <div class="metrics-funnel-grid">
      ${['upper', 'mid', 'lower'].map(f => {
        const d = data[f];
        return `
          <div class="metrics-funnel-card" data-funnel="${f}">
            <div class="metrics-funnel-name">${d.label}</div>
            <div class="metrics-funnel-desc">${d.desc}</div>
            <div class="metrics-group-label">정량 지표</div>
            <div class="metrics-badge-list">
              ${d.quant.map(m => `<span class="metrics-badge-quant">${m} (1-5)</span>`).join('')}
            </div>
            <div class="metrics-group-label">정성 지표</div>
            <div class="metrics-badge-list">
              ${d.qual.map(m => `<span class="metrics-badge-qual">${m} (서술형)</span>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

renderMetricsSummary(state.team);

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

  renderMetricsSummary(team);

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
initReviewRunner(showResults);
initModelSelectors();
renderPanelSizeEstimateGuide();
loadFunnelConfig(state.team);
ensureSurveyTemplate();
