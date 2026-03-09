import { state } from './state.js';
import { loadSavedTheme } from './themes.js';
loadSavedTheme();
import { DEMO_FUNNEL_CONFIG, DEMO_PERSONA_SUMMARIES, DEMO_PANEL_REVIEWS, DEMO_SYNTHESIS } from './demo.js';
import { loadFunnelConfig, loadSurveyTemplate, loadPersonas, runReview, checkReviewLimit } from './api.js';
import { $, updateRunBtn, handleFile, initModelSelectors } from './ui.js';
import { renderOverviewTab } from './render/overview.js';
import { renderFunnelTab } from './render/funnel-tab.js';
import { renderIndividualTab } from './render/individual.js';
import { renderQATab } from './render/qa.js';
import { renderSurveyTab } from './render/survey.js';
import { renderPanelStatsTab } from './render/panel-stats.js';
import { esc } from './render/helpers.js';

let surveyTemplatePromise = null;
const TAB_GROUP_DEFAULT_TAB = {
  summary: 'overview',
  funnel: 'upper',
  'survey-overview': 'survey',
  qa: 'qa',
  individual: 'individual',
};
const tabSelection = { ...TAB_GROUP_DEFAULT_TAB };

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

function setActiveGroup(groupKey) {
  const groupBar = document.getElementById('tab-group-bar');
  const subBar = document.getElementById('tab-sub-bar');
  if (!groupBar || !subBar) return;

  groupBar.querySelectorAll('.tab-group-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.group === groupKey);
  });
  subBar.querySelectorAll('.tab-sub-group').forEach(group => {
    group.classList.toggle('active', group.dataset.group === groupKey);
  });

  const activeSubGroup = subBar.querySelector(`.tab-sub-group[data-group="${groupKey}"]`);
  const subTabCount = activeSubGroup ? activeSubGroup.querySelectorAll('.tab-btn').length : 0;
  subBar.classList.toggle('collapsed', subTabCount <= 1);
}

function setActiveTab(tabKey, { syncGroup = true } = {}) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabKey}"]`);
  const panel = document.getElementById(`tab-${tabKey}`);
  if (!btn || !panel) return;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  panel.classList.add('active');

  const groupKey = btn.closest('.tab-sub-group')?.dataset.group;
  if (!groupKey) return;

  tabSelection[groupKey] = tabKey;
  if (syncGroup) setActiveGroup(groupKey);
}

function activateGroup(groupKey) {
  setActiveGroup(groupKey);
  const subgroup = document.querySelector(`.tab-sub-group[data-group="${groupKey}"]`);
  if (!subgroup) return;

  const preferredTab = tabSelection[groupKey] || TAB_GROUP_DEFAULT_TAB[groupKey];
  const fallbackTab = subgroup.querySelector('.tab-btn')?.dataset.tab;
  const targetTab = preferredTab || fallbackTab;
  if (!targetTab) return;

  setActiveTab(targetTab, { syncGroup: false });
}

function resetTabHierarchy() {
  Object.assign(tabSelection, TAB_GROUP_DEFAULT_TAB);
  activateGroup('summary');
}

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

const BASE_ESTIMATE = {
  concurrency: 5,
  assumedPersonaCount: 10,
  defaultPanelReviewSeconds: [30, 60],
  defaultPersonaSummarySeconds: [18, 35],
  defaultSynthesisSeconds: [15, 35],
  overheadSeconds: [25, 60],
  safetyFactor: 1.15,
};

const MODEL_ESTIMATE_PROFILE = {
  'gpt-4o-mini': {
    review: [28, 55],
    summary: [16, 32],
    synthesis: [14, 30],
  },
  'gpt-4o': {
    review: [45, 95],
    summary: [28, 60],
    synthesis: [24, 55],
  },
};

function getModelEstimateRange(modelName, phase) {
  const fromModel = MODEL_ESTIMATE_PROFILE[modelName];
  if (fromModel && Array.isArray(fromModel[phase])) return fromModel[phase];
  if (phase === 'review') return BASE_ESTIMATE.defaultPanelReviewSeconds;
  if (phase === 'summary') return BASE_ESTIMATE.defaultPersonaSummarySeconds;
  return BASE_ESTIMATE.defaultSynthesisSeconds;
}

function estimateValidationSeconds(panelCount, modelSelection = {}) {
  const {
    concurrency,
    assumedPersonaCount,
    overheadSeconds,
    safetyFactor,
  } = BASE_ESTIMATE;
  const panelReviewSeconds = getModelEstimateRange(modelSelection.reviewModel, 'review');
  const personaSummarySeconds = getModelEstimateRange(modelSelection.summaryModel, 'summary');
  const synthesisSeconds = getModelEstimateRange(modelSelection.synthesisModel, 'synthesis');

  const reviewBatches = Math.ceil(panelCount / concurrency);
  const personaCount = Math.min(assumedPersonaCount, panelCount);
  const summaryBatches = Math.ceil(personaCount / concurrency);

  const minSeconds = (
    reviewBatches * panelReviewSeconds[0]
    + summaryBatches * personaSummarySeconds[0]
    + synthesisSeconds[0]
    + overheadSeconds[0]
  );
  const maxSeconds = (
    reviewBatches * panelReviewSeconds[1]
    + summaryBatches * personaSummarySeconds[1]
    + synthesisSeconds[1]
    + overheadSeconds[1]
  );
  return {
    minSeconds: Math.ceil(minSeconds * safetyFactor),
    maxSeconds: Math.ceil(maxSeconds * safetyFactor),
  };
}

function fmtMinuteRange(minSeconds, maxSeconds) {
  const minMinutes = Math.max(1, Math.ceil(minSeconds / 60));
  const maxMinutes = Math.max(minMinutes, Math.ceil(maxSeconds / 60));
  if (minMinutes === maxMinutes) return `약 ${minMinutes}분`;
  return `약 ${minMinutes}~${maxMinutes}분`;
}

function renderPanelSizeEstimateGuide() {
  if (!$.panelSizeEstimate || !$.panelSize) return;
  const selectedSize = Number($.panelSize.value || 10);
  const reviewModel = $.reviewModel?.value || 'gpt-4o-mini';
  const summaryModel = $.summaryModel?.value || 'gpt-4o-mini';
  const synthesisModel = $.synthesisModel?.value || 'gpt-4o';
  const { minSeconds, maxSeconds } = estimateValidationSeconds(selectedSize, {
    reviewModel,
    summaryModel,
    synthesisModel,
  });
  const timeLabel = fmtMinuteRange(minSeconds, maxSeconds);

  $.panelSizeEstimate.innerHTML = `
    <div class="panel-size-est-title">검증 예상 소요 시간</div>
    <div class="panel-size-est-main">
      <span class="panel-size-est-size">패널 ${selectedSize}명</span>
      <span class="panel-size-est-time">${timeLabel}</span>
    </div>
    <div class="panel-size-est-note">리뷰 ${esc(reviewModel)} · 요약 ${esc(summaryModel)} · 합성 ${esc(synthesisModel)} 기준의 보수적 추정치입니다.</div>
  `;
}

function formatPct(v) {
  return Number.isFinite(v) ? v.toFixed(1).replace(/\.0$/, '') : '0';
}

const DIST_ORDERS = {
  visit_distribution: ['방문', '미방문'],
  visit_experience_distribution: ['긍정 경험', '중립 경험', '부정 경험'],
  skepticism_distribution: ['높음', '중간', '낮음'],
};

const DIST_COLORS = {
  visit_distribution: {
    방문: '#00b894',
    미방문: '#95a5a6',
  },
  visit_experience_distribution: {
    '긍정 경험': '#00b894',
    '중립 경험': '#74b9ff',
    '부정 경험': '#d63031',
  },
  skepticism_distribution: {
    높음: '#e17055',
    중간: '#fdcb6e',
    낮음: '#00b894',
  },
};

const DIST_FALLBACK_COLORS = ['#6c5ce7', '#0984e3', '#00b894', '#e84393', '#e17055', '#fdcb6e'];

function getDistOrderIndex(statKey, label) {
  const order = DIST_ORDERS[statKey];
  if (!order) return Number.POSITIVE_INFINITY;
  const idx = order.indexOf(label);
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
}

function getDistColor(statKey, label, idx) {
  const map = DIST_COLORS[statKey];
  if (map && map[label]) return map[label];
  return DIST_FALLBACK_COLORS[idx % DIST_FALLBACK_COLORS.length];
}

function normalizeDistLabel(statKey, rawLabel) {
  const label = String(rawLabel || '기타').trim();
  const low = label.toLowerCase();

  if (statKey === 'visit_distribution') {
    if (low === 'yes' || low === 'y') return '방문';
    if (low === 'no' || low === 'n') return '미방문';
  }
  if (statKey === 'visit_experience_distribution') {
    if (low === 'pos' || low === 'positive') return '긍정 경험';
    if (low === 'neg' || low === 'negative') return '부정 경험';
    if (low === 'neu' || low === 'neutral') return '중립 경험';
  }
  if (statKey === 'skepticism_distribution') {
    if (low === 'high') return '높음';
    if (low === 'mid' || low === 'medium') return '중간';
    if (low === 'low') return '낮음';
  }
  return label;
}

function normalizeDistribution(statKey, items) {
  if (!Array.isArray(items) || !items.length) return [];
  const grouped = new Map();

  items.forEach(item => {
    const count = Number(item?.count || 0);
    const ratioRaw = Number(item?.ratio || 0);
    const ratio = Number.isFinite(ratioRaw) ? ratioRaw : 0;
    const label = normalizeDistLabel(statKey, item?.label);
    const prev = grouped.get(label) || { label, count: 0, ratio: 0 };
    prev.count += count;
    prev.ratio += ratio;
    grouped.set(label, prev);
  });

  const merged = Array.from(grouped.values()).filter(x => x.count > 0 || x.ratio > 0);
  const totalCount = merged.reduce((sum, item) => sum + item.count, 0);
  const normalized = merged.map(item => ({
    label: item.label,
    count: item.count,
    ratio: totalCount > 0 ? (item.count / totalCount) * 100 : item.ratio,
  }));

  return normalized.sort((a, b) => {
    const aIdx = getDistOrderIndex(statKey, a.label);
    const bIdx = getDistOrderIndex(statKey, b.label);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return b.count - a.count;
  });
}

function buildPanelStatRows(persona) {
  const stats = persona.panel_stats || {};
  const defs = [
    ['gender_distribution', '성별 분포'],
    ['season_distribution', '시즌 분포'],
    ['budget_distribution', 'CPC'],
    ['visit_distribution', '방문 여부'],
    ['visit_experience_distribution', '방문 경험'],
    ['skepticism_distribution', '회의감 분포'],
  ];

  return defs.map(([key, label]) => ({
    key,
    label,
    items: normalizeDistribution(key, stats[key]),
  })).filter(row => row.items.length);
}

function renderPanelStatChart(statKey, items) {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const prepared = items.map((item, idx) => {
    const ratio = totalCount > 0 ? (item.count / totalCount) * 100 : Math.max(0, item.ratio || 0);
    return {
      ...item,
      ratio,
      color: getDistColor(statKey, item.label, idx),
    };
  }).filter(item => item.count > 0 || item.ratio > 0);

  return `<div class="p-d-chart">
    <div class="p-stack-track">${
      prepared.map(item => `<span class="p-stack-seg" style="width:${item.ratio}%;background:${item.color}"></span>`).join('')
    }</div>
    <div class="p-stack-legend">${
      prepared.map(item => `<span class="p-stack-item">
        <span class="p-stack-dot" style="background:${item.color}"></span>
        <span class="p-stack-text"><strong>${esc(item.label)}</strong> ${esc(String(item.count))}명 (${formatPct(item.ratio)}%)</span>
      </span>`).join('')
    }</div>
  </div>`;
}

function renderPersonaList(personas) {
  return `<div class="persona-list">${
    personas.map(persona => {
      const detailRows = buildPanelStatRows(persona);
      const detailHtml = detailRows.length
        ? `<div class="p-detail-grid">${
            detailRows.map(row => `
              <div class="p-detail-item">
                <span class="p-d-label">${row.label}</span>
                ${renderPanelStatChart(row.key, row.items)}
              </div>`).join('')
          }</div>`
        : '<div class="p-detail-empty">패널 통계 데이터가 없습니다.</div>';

      return `
        <div class="persona-list-item" tabindex="0">
          <div class="persona-list-row">
            <span class="p-name">${esc(persona.persona_name)}</span>
            ${persona.panel_count ? `<span class="p-tag">${esc(String(persona.panel_count))}패널</span>` : ''}
            <span class="p-hover-hint">통계</span>
          </div>
          <div class="persona-hover-card">${detailHtml}</div>
        </div>`;
    }).join('')
  }</div>`;
}

/* ── Show results page ── */
function showResults(payload) {
  const { persona_summaries, panel_reviews, synthesis, synthesis_raw } = payload;
  state.lastPersonaSummaries = persona_summaries || [];
  state.lastPanelReviews = panel_reviews || [];
  state.lastSynthesis = synthesis;
  state.lastSynthesisRaw = synthesis_raw;
  state.funnelQuantGroupAverages = payload.funnel_quant_group_averages || {};

  // Build lastReviews from persona_summaries dynamically — works for both teams + demo data
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
    // Copy all non-structural top-level fields (demo compat: avg_* and qual fields)
    for (const [k, v] of Object.entries(s)) {
      if (!_STRUCTURAL.has(k)) {
        base[k] = v;
        // Also strip avg_ prefix so overview.js can access r.promotion_attractiveness etc.
        if (k.startsWith('avg_')) base[k.slice(4)] = v;
      }
    }
    // Override/extend with quant_averages (new API format, team-agnostic)
    Object.assign(base, s.quant_averages || {});
    // Override/extend with qual_fields (new API format, team-agnostic)
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

  // Update intro text and upload card title
  const introEl = document.getElementById('intro-desc');
  if (introEl) introEl.innerHTML = _TEAM_INTRO[team] || _TEAM_INTRO.marketing;
  const uploadTitle = document.getElementById('upload-card-title');
  if (uploadTitle) uploadTitle.textContent = _TEAM_UPLOAD_TITLE[team] || _TEAM_UPLOAD_TITLE.marketing;

  // Reset personas (different team = different sheet)
  state.personasLoaded = false;
  state.samplingSeed = null;
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">팀이 변경되었습니다. 페르소나를 다시 로드하세요.</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';
  updateRunBtn();

  // Reload funnelConfig and surveyTemplate for the new team
  await loadFunnelConfig(team);
  surveyTemplatePromise = null;
  state.surveyTemplate = [];
  ensureSurveyTemplate();
});

/* ── Initialize model selectors and load funnel config ── */
initModelSelectors();
renderPanelSizeEstimateGuide();
loadFunnelConfig(state.team);
ensureSurveyTemplate();
refreshUsageBadge();

/* ── Provider change ── */
$.provider.addEventListener('change', () => {
  $.providerWarn.classList.toggle('hidden', $.provider.value !== 'Claude');
  initModelSelectors();
  renderPanelSizeEstimateGuide();
});

[$.reviewModel, $.summaryModel, $.synthesisModel].forEach(sel => {
  sel.addEventListener('change', renderPanelSizeEstimateGuide);
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

/* ── Panel size selection ── */
$.panelSize.addEventListener('change', () => {
  const panelSize = Number($.panelSize.value || 10);
  state.selectedPanelSize = panelSize;
  renderPanelSizeEstimateGuide();
  if (!state.personasLoaded) {
    updateRunBtn();
    return;
  }

  state.personasLoaded = false;
  state.samplingSeed = null;
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">패널 수가 변경되었습니다. 페르소나를 다시 로드하세요.</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';
  updateRunBtn();
});

/* ── Load personas ── */
$.btnLoad.addEventListener('click', async () => {
  $.pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">로딩 중...</div>';
  $.pListWrap.classList.add('hidden');
  $.pListWrap.innerHTML = '';

  const panelSize = Number($.panelSize.value || 10);
  const result = await loadPersonas(panelSize, null, state.team);
  if (result.ok) {
    state.personasLoaded = true;
    state.selectedPanelSize = Number(result.panel_size || panelSize);
    state.samplingSeed = result.sampling_seed || null;
    const totalPanels = result.total_panels || result.personas.reduce((s, p) => s + (p.panel_count || 1), 0);
    $.pStatus.innerHTML = `<div class="persona-badge ok">✅ ${result.personas.length}명 페르소나 · ${totalPanels}개 패널 로드 완료</div>`;
    $.pListWrap.classList.remove('hidden');
    $.pListWrap.innerHTML = renderPersonaList(result.personas);
  } else {
    state.personasLoaded = false;
    state.samplingSeed = null;
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
  fd.append('panel_size', String(state.selectedPanelSize || Number($.panelSize.value || 10)));
  fd.append('team', state.team);
  if (state.samplingSeed) fd.append('sampling_seed', state.samplingSeed);
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

/* ── Save PDF report (all tabs) ── */
function buildPdfReportHtml() {
  const sections = [
    { key: 'overview', title: '개요' },
    { key: 'upper', title: '브랜드 자산' },
    { key: 'mid', title: '수요 창출' },
    { key: 'lower', title: '전환·매출' },
    { key: 'survey', title: '설문지' },
    { key: 'panel-stats', title: '패널 통계' },
    { key: 'qa', title: '품질 검증' },
    { key: 'individual', title: '개별 응답' },
  ];

  const renderedSections = sections.map(section => {
    const source = document.getElementById(`tab-${section.key}`);
    if (!source) return '';

    const clone = source.cloneNode(true);
    clone.classList.remove('tab-panel', 'active');
    clone.querySelectorAll('.persona-card').forEach(el => el.classList.add('open'));
    clone.querySelectorAll('.drill-down-header').forEach(el => el.classList.add('open'));
    clone.querySelectorAll('.drill-down-body').forEach(el => el.classList.add('show'));
    clone.querySelectorAll('.raw-content').forEach(el => el.classList.add('show'));
    clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

    return `
      <section class="pdf-report-section">
        <h2>${section.title}</h2>
        ${clone.innerHTML || '<p>데이터가 없습니다.</p>'}
      </section>
    `;
  }).join('');

  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  return `
    <!doctype html>
    <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Synthetic Panels Report</title>
      <link rel="stylesheet" href="${window.location.origin}/static/app.css" />
      <style>
        :root { color-scheme: light; }
        body { background: #fff; margin: 0; }
        .pdf-report-wrap { max-width: 1120px; margin: 0 auto; padding: 24px 24px 40px; }
        .pdf-report-head { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
        .pdf-report-head h1 { margin: 0; font-size: 1.5rem; }
        .pdf-report-head p { margin: 8px 0 0; color: #6b7280; font-size: 0.9rem; }
        .pdf-report-section { margin: 0 0 28px; page-break-inside: avoid; }
        .pdf-report-section > h2 {
          margin: 0 0 12px;
          font-size: 1.08rem;
          border-left: 4px solid #6c5ce7;
          padding-left: 10px;
        }
        .tab-panel, .persona-card-body, .drill-down-body, .raw-content { display: block !important; }
        .tab-hierarchy, .raw-toggle, .chevron { display: none !important; }
        @page { size: A4; margin: 12mm; }
      </style>
    </head>
    <body>
      <div class="pdf-report-wrap">
        <header class="pdf-report-head">
          <h1>Synthetic Panels 분석 리포트</h1>
          <p>생성 시각: ${generatedAt} (KST)</p>
        </header>
        ${renderedSections}
      </div>
    </body>
    </html>
  `;
}

function openPdfPrintWindow() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const html = buildPdfReportHtml();
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const printNow = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onload = () => setTimeout(printNow, 350);
  return true;
}

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

/* ── Hierarchical tab switching ── */
document.getElementById('tab-group-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-group-btn');
  if (!btn) return;
  const group = btn.dataset.group;
  if (!group) return;
  activateGroup(group);
});

document.getElementById('tab-sub-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (!tab) return;
  setActiveTab(tab);
});
