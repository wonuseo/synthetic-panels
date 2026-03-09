import { $ } from './ui.js';
import { state } from './state.js';
import { loadPersonas } from './api.js';
import { updateRunBtn } from './ui.js';
import { esc } from './render/helpers.js';

function formatPct(v) {
  return Number.isFinite(v) ? v.toFixed(1).replace(/\.0$/, '') : '0';
}

const DIST_ORDERS = {
  visit_distribution: ['방문', '미방문'],
  visit_experience_distribution: ['긍정 경험', '중립 경험', '부정 경험'],
  skepticism_distribution: ['높음', '중간', '낮음'],
};

const DIST_COLORS = {
  visit_distribution: { 방문: '#00b894', 미방문: '#95a5a6' },
  visit_experience_distribution: { '긍정 경험': '#00b894', '중립 경험': '#74b9ff', '부정 경험': '#d63031' },
  skepticism_distribution: { 높음: '#e17055', 중간: '#fdcb6e', 낮음: '#00b894' },
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
    return { ...item, ratio, color: getDistColor(statKey, item.label, idx) };
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

export function renderPersonaList(personas) {
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

export function initPersonaLoader() {
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
}
