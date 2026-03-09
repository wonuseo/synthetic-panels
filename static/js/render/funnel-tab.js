import { state } from '../state.js';
import { esc, recEmoji, renderSynValue, hierHeader, hierConnector, buildStepTrack } from './helpers.js';
import { computeFunnelAverages, renderRadarChart } from './overview.js';
import { buildSurveySections, flattenSurveyFields } from './survey-schema.js';

const _FUNNEL_COLORS = { upper: '#DA291C', mid: '#877669', lower: '#54585A' };

/* 퍼널별 정량 지표 그룹: funnelConfig에서 동적으로 로드 */
function _getQuantGroups(funnelKey) {
  return window.funnelConfig?.[funnelKey]?.quant_groups || [];
}

/* ── Internal helpers ── */
function _getNum(v) { return typeof v === 'number' ? v : parseFloat(v) || 0; }
function _pct(v, max = 5) { return Math.round((v / max) * 100); }
function _scoreClass(v) { return v >= 4 ? 'high' : v >= 3 ? 'mid' : 'low'; }
function _metricDefinition(item) {
  return String(item?.definition || '').trim();
}
function _groupDefinition(grpDef) {
  return String(grpDef?.definition || '').trim();
}

function _getSurveyFieldMap() {
  const sections = buildSurveySections(state.surveyTemplate, window.funnelConfig);
  return flattenSurveyFields(sections).reduce((acc, field) => {
    acc[field.key] = field;
    return acc;
  }, {});
}

function _computePersonaGroupAvg(r, grp) {
  const scores = grp.keys.map(k => _getNum(r[k])).filter(v => v > 0);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

function _computePersonaFunnelAvg(r, funnelKey) {
  const funnel = window.funnelConfig?.[funnelKey];
  if (!funnel) return 0;
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  const scores = quantItems.map(i => _getNum(r[i.key])).filter(v => v > 0);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

function _computeSpread(scores) {
  if (!scores.length) return 0;
  return Math.max(...scores) - Math.min(...scores);
}

function _getPersonaPanelReviews(personaId) {
  return (state.lastPanelReviews || []).filter(r => !r.error && r.persona_id === personaId);
}

/* ── Individual-persona radar (single review row) ── */
function renderPersonaRadar(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (quantItems.length < 3) return '';

  const n = quantItems.length;
  const cx = 150, cy = 150, R = 122;
  const maxVal = 5;
  const color = _FUNNEL_COLORS[funnelKey] || '#DA291C';

  const vals = quantItems.map(item => {
    const raw = r[item.key];
    const num = typeof raw === 'number' ? raw : parseFloat(raw) || 0;
    return Math.max(0, Math.min(5, num));
  });

  function polarToXY(i, val) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (val / maxVal) * R;
    return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)];
  }

  let gridLines = '';
  for (let level = 1; level <= 5; level++) {
    const pts = Array.from({ length: n }, (_, i) => polarToXY(i, level).join(',')).join(' ');
    gridLines += `<polygon points="${pts}" fill="none" stroke="#e2e6f0" stroke-width="${level === 5 ? 1.5 : 0.7}"/>`;
  }

  let axisLines = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, maxVal);
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e2e6f0" stroke-width="0.7"/>`;
  }

  const dataPoints = vals.map((v, i) => polarToXY(i, v).join(',')).join(' ');

  let labels = '';
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = R + 42;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const lineHeight = 23;
    const lines = _splitLabel(quantItems[i].label);
    const startY = ly - ((lines.length - 1) * lineHeight) / 2;
    const val = vals[i].toFixed(1);
    labels += `<text x="${lx}" y="${startY}" text-anchor="middle" dominant-baseline="middle" class="radar-label">`;
    labels += lines.map((line, idx) => `<tspan x="${lx}" y="${startY + idx * lineHeight}">${esc(line)}</tspan>`).join('');
    labels += `</text>`;
    const [px, py] = polarToXY(i, vals[i]);
    labels += `<text x="${px}" y="${py - 8}" text-anchor="middle" class="radar-val" fill="${color}">${val}</text>`;
  }

  let dots = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, vals[i]);
    dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
  }

  const stageAvg = vals.length ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;
  return `<div class="radar-chart-wrap">
    <div class="radar-chart-title-row radar-chart-title-row--avg-only">
      <span class="radar-chart-avg">평균 ${stageAvg.toFixed(1)}/5</span>
    </div>
    <svg viewBox="-90 -90 480 480" class="radar-svg">
      ${gridLines}${axisLines}
      <polygon points="${dataPoints}" fill="${color}20" stroke="${color}" stroke-width="2"/>
      ${dots}${labels}
    </svg>
  </div>`;
}

function _splitLabel(text, maxCharsPerLine = 8, maxLines = 4) {
  const src = String(text || '').trim();
  if (!src) return [''];
  const withParenBreak = src
    .replace(/\s*\(([^)]+)\)\s*/g, '\n($1)\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const seed = withParenBreak.split('\n').map(s => s.trim()).filter(Boolean);
  const wrapped = [];
  for (const part of seed) {
    if (part.includes(' ')) {
      const words = part.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (w.length <= maxCharsPerLine) wrapped.push(w);
        else {
          for (let i = 0; i < w.length; i += maxCharsPerLine) wrapped.push(w.slice(i, i + maxCharsPerLine));
        }
      }
      continue;
    }
    for (let i = 0; i < part.length; i += maxCharsPerLine) wrapped.push(part.slice(i, i + maxCharsPerLine));
  }
  if (wrapped.length <= maxLines) return wrapped;
  const merged = wrapped.slice(0, maxLines);
  merged[maxLines - 1] = `${merged[maxLines - 1]}…`;
  return merged;
}

/* ── Qualitative items for a funnel ── */
function renderQualItemsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  let items = '';
  for (const item of qualItems) {
    const val = r[item.key];
    if (!val) continue;
    items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${renderSynValue(val)}</div></div>`;
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

function renderFunnelQualSummary(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  const cards = qualItems
    .map(item => ({ label: item.label, val: r[item.key] }))
    .filter(item => item.val)
    .map(item => `<div class="persona-funnel-qual-item"><div class="persona-funnel-qual-label">${esc(item.label)}</div><div class="persona-funnel-qual-text">${renderSynValue(item.val)}</div></div>`)
    .join('');

  if (!cards) return '';
  return `<div class="persona-funnel-qual-wrap">${cards}</div>`;
}

function _computeOverallAvg(review) {
  let sum = 0, count = 0;
  for (const key of ['overall', 'upper', 'mid', 'lower']) {
    const funnel = window.funnelConfig?.[key];
    if (!funnel) continue;
    for (const item of funnel.individual_items.filter(i => i.type === 'quantitative')) {
      const val = _getNum(review[item.key]);
      if (val > 0) { sum += val; count++; }
    }
  }
  return count > 0 ? sum / count : 0;
}

function _renderAllQualItems(review) {
  let html = '';
  for (const key of ['overall', 'upper', 'mid', 'lower']) {
    const funnel = window.funnelConfig?.[key];
    if (!funnel) continue;
    for (const item of funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical')) {
      const val = review[item.key];
      if (!val) continue;
      html += `<div class="pprd-qual-item">
        <div class="pprd-qual-label">${esc(item.label)}</div>
        <div class="pprd-qual-text">${renderSynValue(val)}</div>
      </div>`;
    }
  }
  return html ? `<div class="pprd-qual-grid">${html}</div>` : '';
}

function renderPersonaPanelReviewSummary(personaId, funnelKey) {
  const panelReviews = _getPersonaPanelReviews(personaId);
  if (!panelReviews.length) return '';

  const cards = panelReviews.map((review, index) => {
    const avg = _computeOverallAvg(review);
    const avgDisplay = avg > 0 ? avg.toFixed(1) : '—';
    const cls = _scoreClass(avg);
    const emoji = recEmoji(review.recommendation || '');
    const qualHtml = _renderAllQualItems(review);

    return `<div class="pprd-card">
      <div class="pprd-head">
        <span class="pprd-emoji">${emoji}</span>
        <span class="pprd-id">${esc(review.panel_id || `패널 ${index + 1}`)}</span>
        <span class="score-badge ${cls}">${avgDisplay}/5</span>
        ${review.recommendation ? `<span class="rec-text">${esc(review.recommendation)}</span>` : ''}
      </div>
      ${qualHtml}
    </div>`;
  }).join('');

  const drillId = `funnel-${funnelKey}-${personaId}`;
  return `<div class="persona-panel-review-section">
    <div class="drill-down-header" id="drill-header-${drillId}" onclick="toggleDrillDown('${drillId}')">
      📋 개별 패널 리뷰 (${panelReviews.length}건) ▶
    </div>
    <div class="drill-down-body" id="drill-${drillId}">
      <div class="pprd-list">${cards}</div>
    </div>
  </div>`;
}

/* ── Section 1 Step 01: 퍼널 개요 카드 ── */
function renderFunnelOverviewCard(funnelKey, funnel, valid, funnelAverages) {
  const fa = funnelAverages?.[funnelKey];
  const color = _FUNNEL_COLORS[funnelKey] || '#DA291C';
  const synthesis = state.lastSynthesis && !state.lastSynthesis.error ? state.lastSynthesis : null;

  let html = `<div class="card foc-card">`;

  // Header: funnel name + desc tags
  html += `<div class="foc-header ${funnelKey}">`;
  html += `<div class="foc-title-row"><span class="funnel-dot ${funnelKey}"></span><span class="foc-title">${esc(funnel.label.split('(')[0].trim())}</span></div>`;
  if (funnel.desc_who || funnel.desc_goal || funnel.desc_metrics) {
    html += `<div class="fcc-desc-grid" style="margin-top:8px">`;
    if (funnel.desc_who) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">대상</span><span class="fcc-desc-val">${esc(funnel.desc_who)}</span></div>`;
    if (funnel.desc_goal) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">목표</span><span class="fcc-desc-val">${esc(funnel.desc_goal)}</span></div>`;
    if (funnel.desc_metrics) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">핵심 지표</span><span class="fcc-desc-val">${esc(funnel.desc_metrics)}</span></div>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Score hero
  if (fa) {
    const pct = Math.round(fa.normalized * 100);
    html += `<div class="foc-score-hero">`;
    html += `<span class="foc-score-num" style="color:${color}">${fa.avg}</span>`;
    html += `<span class="foc-score-den">/ ${fa.max}</span>`;
    html += `<span class="foc-score-pct">${pct}%</span>`;
    html += `</div>`;
    html += `<div class="foc-bar"><div class="foc-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }

  html += `</div>`;
  return html;
}

/* ── L3 persona card: grouped quantitative bars ── */
function renderPersonaQuantGrouped(r, funnelKey) {
  const groups = _getQuantGroups(funnelKey);
  const color = _FUNNEL_COLORS[funnelKey] || '#DA291C';
  const funnel = window.funnelConfig?.[funnelKey];
  const funnelQuantItems = funnel ? funnel.individual_items.filter(i => i.type === 'quantitative') : [];
  if (!groups.length) return '';

  let html = `<div class="pqg-wrap">`;
  for (const grp of groups) {
    const grpAvg = _computePersonaGroupAvg(r, grp);
    const cls = _scoreClass(grpAvg);
    html += `<div class="pqg-group">`;
    html += `<div class="pqg-group-header">`;
    html += `<span class="pqg-group-label">${esc(grp.label)}</span>`;
    html += `<span class="pqg-group-score pqg-score-${cls}">${grpAvg > 0 ? grpAvg.toFixed(1) : '—'}/5</span>`;
    html += `</div>`;
    for (const key of grp.keys) {
      const cfg = funnelQuantItems.find(i => i.key === key);
      const label = cfg ? cfg.label : key;
      const val = _getNum(r[key]);
      const pct = _pct(val);
      html += `<div class="pqg-item">`;
      html += `<div class="pqg-label">${esc(label)}</div>`;
      html += `<div class="pqg-bar-row">`;
      html += `<div class="pqg-bar-track"><div class="pqg-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
      html += `<span class="pqg-val" style="color:${color}">${val > 0 ? val.toFixed(1) : '—'}</span>`;
      html += `</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

/* ── Section 1 Step 03: 종합 정성 인사이트 (전체 너비) ── */
function renderSynthesisQualSection(funnelKey, funnel) {
  const synthesis = state.lastSynthesis && !state.lastSynthesis.error ? state.lastSynthesis : null;
  if (!synthesis || !funnel.synthesis_items) return '';

  const synQual = funnel.synthesis_items
    .filter(item => item.type !== 'quantitative')
    .map(item => ({ label: item.label, val: synthesis[item.key] }))
    .filter(({ val }) => val != null && val !== '' && !(Array.isArray(val) && !val.length));
  if (!synQual.length) return '';

  let html = `<div class="card syn-qual-section">`;
  html += `<h3>💡 종합 정성 인사이트</h3>`;
  html += `<div class="syn-qual-grid">`;
  for (const item of synQual) {
    html += `<div class="syn-qual-item"><div class="syn-qual-label">${esc(item.label)}</div><div class="syn-qual-body">${renderSynValue(item.val)}</div></div>`;
  }
  html += `</div>`;
  html += `</div>`;
  return html;
}

function renderGroupQualSummary(funnel) {
  const synthesis = state.lastSynthesis && !state.lastSynthesis.error ? state.lastSynthesis : null;
  if (!synthesis || !funnel?.synthesis_items) return '';

  const items = funnel.synthesis_items
    .filter(item => item.type === 'qualitative')
    .map(item => ({ label: item.label, val: synthesis[item.key] }))
    .filter(item => item.val != null && item.val !== '');

  if (!items.length) return '';

  let html = `<section class="grp-stage-card grp-stage-card-qual grp-stage-row">`;
  html += `<div class="grp-subsection-title">정성 평가 종합</div>`;
  html += `<div class="grp-qual-summary-list">`;
  for (const item of items) {
    html += `<div class="grp-qual-summary-item">`;
    html += `<div class="grp-qual-summary-label">${esc(item.label)}</div>`;
    html += `<div class="grp-qual-summary-text">${renderSynValue(item.val)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  html += `</section>`;
  return html;
}

function renderL2Section(funnelKey, funnel, valid, groups) {
  const cards = groups.map(grp => renderGroupSection(funnelKey, funnel, valid, grp)).filter(Boolean).join('');
  if (!cards) return '';

  let html = `<div class="card l2-stage-section">`;
  html += `<div class="l2-stage-section-head">`;
  html += `<span class="l2-stage-section-title">🧭 퍼널 단계별 카드</span>`;
  html += `<div class="l2-stage-section-pills">`;
  html += `<span class="grp-stage-pill">01 그룹 평균 점수</span>`;
  html += `<span class="grp-stage-pill">02 세부 점수 및 정의</span>`;
  html += `<span class="grp-stage-pill">03 정성 평가 종합</span>`;
  html += `</div>`;
  html += `</div>`;
  html += `<div class="l2-group-grid">${cards}</div>`;
  html += `</div>`;
  return html;
}

/* ── Section 2: 그룹별 분석 카드 ── */
function renderGroupSection(funnelKey, funnel, valid, grpDef) {
  const color = _FUNNEL_COLORS[funnelKey] || '#DA291C';
  const surveyFieldMap = _getSurveyFieldMap();
  const groups = _getQuantGroups(funnelKey);

  // Group average (prefer server-computed value)
  const pyGroups = state.funnelQuantGroupAverages[funnelKey] || [];
  const pyGrp = pyGroups.find(g => g.label === grpDef.label);
  let grpAvg = 0, grpPct = 0;
  if (pyGrp) {
    grpAvg = typeof pyGrp.avg === 'number' ? pyGrp.avg : parseFloat(pyGrp.avg) || 0;
    grpPct = pyGrp.pct ?? _pct(grpAvg);
  } else {
    const scores = valid.flatMap(r => grpDef.keys.map(k => _getNum(r[k]))).filter(v => v > 0);
    grpAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    grpPct = _pct(grpAvg);
  }

  // Map keys to labels from funnelConfig
  const funnelQuantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  const grpItems = grpDef.keys.map(k => {
    const cfg = funnelQuantItems.find(i => i.key === k);
    const surveyField = surveyFieldMap[k] || null;
    return {
      key: k,
      label: cfg ? cfg.label : (surveyField?.label || k),
      definition: _metricDefinition(cfg),
      question: String(surveyField?.question || '').trim(),
    };
  });

  // Compute per-item stats
  const itemStats = grpItems.map(item => {
    const scores = valid.map(r => _getNum(r[item.key])).filter(v => v > 0);
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minV = Math.min(...scores);
    const maxV = Math.max(...scores);
    return {
      ...item,
      avg,
      pct: _pct(avg),
      deviation: maxV - minV,
    };
  }).filter(Boolean);

  const summaryStats = groups.map(group => {
    const pyGroup = pyGroups.find(g => g.label === group.label);
    let avg = 0;
    if (pyGroup) avg = typeof pyGroup.avg === 'number' ? pyGroup.avg : parseFloat(pyGroup.avg) || 0;
    else {
      const values = valid.map(r => _computePersonaGroupAvg(r, group)).filter(v => v > 0);
      avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    const perPersonaScores = valid.map(r => _computePersonaGroupAvg(r, group)).filter(v => v > 0);
    return {
      key: `group-${group.label}`,
      label: group.label,
      avg,
      deviation: _computeSpread(perPersonaScores),
      highlighted: group.label === grpDef.label,
    };
  });
  const funnelScores = valid.map(r => _computePersonaFunnelAvg(r, funnelKey)).filter(v => v > 0);
  summaryStats.push({
    key: 'group-total',
    label: '전체 평균',
    avg: funnelScores.length ? funnelScores.reduce((a, b) => a + b, 0) / funnelScores.length : 0,
    deviation: _computeSpread(funnelScores),
    highlighted: false,
  });

  let html = `<div class="card group-section-card group-section-card--${funnelKey}">`;

  // 2a: Group header
  html += `<div class="grp-header">`;
  html += `<div class="grp-header-top">`;
  html += `<span class="grp-title">${esc(grpDef.label)}</span>`;
  html += `<span class="grp-score" style="color:${color}">${grpAvg.toFixed(1)}<span class="grp-score-max">/5</span></span>`;
  html += `<span class="grp-pct">${grpPct}%</span>`;
  html += `</div>`;
  html += `<div class="grp-bar"><div class="grp-bar-fill" style="width:${grpPct}%;background:${color}"></div></div>`;
  html += `<div class="grp-chips">`;
  for (const sl of (grpDef.sublabels || [])) html += `<span class="grp-chip">${esc(sl)}</span>`;
  html += `</div>`;
  html += `</div>`;

  if (itemStats.length) {
    html += `<div class="grp-stage-grid">`;
    html += `<section class="grp-stage-card grp-stage-card-score grp-stage-row">`;
    html += `<div class="grp-subsection-title">평균 점수 요약</div>`;
    html += `<div class="grp-scoreboard">`;
    for (const stat of summaryStats) {
      const scoreClass = _scoreClass(stat.avg);
      const activeClass = stat.highlighted ? ' grp-scorecard-active' : '';
      html += `<div class="grp-scorecard${activeClass}">`;
      html += `<div class="grp-scorecard-label">${esc(stat.label)}</div>`;
      html += `<div class="grp-scorecard-avg grp-scorecard-${scoreClass}" style="color:${stat.highlighted ? color : ''}">${stat.avg > 0 ? stat.avg.toFixed(1) : '—'}<span>/5</span></div>`;
      html += `<div class="grp-scorecard-dev">편차 ${stat.deviation > 0 ? stat.deviation.toFixed(1) : '0.0'}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `</section>`;

    html += `<section class="grp-stage-card grp-stage-card-metrics grp-stage-row">`;
    html += `<div class="grp-subsection-title">그룹 정의</div>`;
    html += `<p class="grp-definition">${esc(_groupDefinition(grpDef) || `${grpDef.label} 관련 핵심 지표를 묶어 해석한 그룹입니다.`)}</p>`;
    html += `<div class="grp-subsection-title">Metrics 상세</div>`;
    html += `<div class="grp-metric-list">`;
    for (const item of itemStats) {
      html += `<div class="grp-metric-list-item">`;
      html += `<div class="grp-metric-list-head">`;
      html += `<div class="grp-metric-list-label">${esc(item.label)}</div>`;
      html += `<div class="grp-metric-list-score" style="color:${color}">${item.avg.toFixed(1)}<span class="grp-metric-list-score-max">/5</span></div>`;
      html += `</div>`;
      if (item.definition) html += `<div class="grp-metric-list-def">${esc(item.definition)}</div>`;
      if (item.question) {
        html += `<div class="grp-metric-question">`;
        html += `<span class="grp-metric-question-label">설문 질문</span>`;
        html += `<p>${esc(item.question)}</p>`;
        html += `</div>`;
      }
      html += `<div class="grp-bar-item grp-bar-item-card">`;
      html += `<div class="grp-bar-track"><div class="grp-bar-fill-item" style="width:${item.pct}%;background:${color}"></div></div>`;
      html += `</div>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `</section>`;

    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/* ── Section 3 Step 01: 페르소나 요약 테이블 ── */
function renderPersonaSummaryTable(funnelKey, valid) {
  if (!valid.length) return '';
  const groups = _getQuantGroups(funnelKey);

  const rows = valid.map(r => {
    const funnelAvg = _computePersonaFunnelAvg(r, funnelKey);
    const groupAvgs = groups.map(grp => _computePersonaGroupAvg(r, grp));
    return { r, funnelAvg, groupAvgs };
  }).sort((a, b) => b.funnelAvg - a.funnelAvg);

  function scoreCell(v) {
    const cls = v >= 4 ? 'tbl-score-green' : v >= 3 ? 'tbl-score-yellow' : 'tbl-score-red';
    return `<span class="tbl-score ${cls}">${v > 0 ? v.toFixed(1) : '—'}</span>`;
  }

  let html = `<div class="card persona-summary-table-card">`;
  html += `<h3>👥 세그먼트 순위</h3>`;
  html += `<div class="pst-wrap"><table class="persona-summary-tbl">`;
  html += `<thead><tr><th class="pst-rank-th">#</th><th>세그먼트</th><th>추천</th>`;
  for (const grp of groups) html += `<th>${esc(grp.label)}</th>`;
  html += `<th>전체 평균</th></tr></thead><tbody>`;

  rows.forEach(({ r, funnelAvg, groupAvgs }, idx) => {
    const emoji = recEmoji(r.recommendation);
    const rank = idx + 1;
    html += `<tr>`;
    html += `<td class="pst-rank">${rank}</td>`;
    html += `<td class="pst-name">${esc(r.persona_name)}</td>`;
    html += `<td class="pst-emoji">${emoji}</td>`;
    for (const avg of groupAvgs) html += `<td>${scoreCell(avg)}</td>`;
    html += `<td>${scoreCell(funnelAvg)}</td>`;
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  html += `</div>`;
  return html;
}

/* ── Main export ── */
export function renderFunnelTab(funnelKey) {
  const $panel = document.getElementById('tab-' + funnelKey);
  if (!window.funnelConfig || !window.funnelConfig[funnelKey]) {
    $panel.innerHTML = '<p>퍼널 설정을 불러올 수 없습니다.</p>';
    return;
  }
  const funnel = window.funnelConfig[funnelKey];
  const valid = state.lastReviews.filter(r => !r.error);
  const funnelAverages = computeFunnelAverages(valid);
  const groups = _getQuantGroups(funnelKey);

  let html = '';
  const funnelLabel = funnel.label.split('(')[0].trim();

  // ── L1: 퍼널 종합 — 01 퍼널 개요 | 02 정량·정성 종합 | 03 퍼널 단계별 카드
  html += hierHeader('l1', 'L1', `${esc(funnelLabel)} 종합 분석`);
  html += `<div class="level-zone l1">`;
  const radarHtml = `<div class="card funnel-radar-card"><h3>정량 지표 평균</h3><div class="funnel-radar-wrap">${renderRadarChart(valid, funnelKey)}</div></div>`;
  const synQualHtml = renderSynthesisQualSection(funnelKey, funnel);
  let dualHtml = '';
  if (synQualHtml.trim()) {
    dualHtml = `<div class="l1-dual-col"><div class="l1-dual-left">${radarHtml}</div><div class="l1-dual-right">${synQualHtml}</div></div>`;
  } else {
    dualHtml = radarHtml;
  }

  const l2SectionHtml = renderL2Section(funnelKey, funnel, valid, groups);
  const l1Steps = [
    { label: '퍼널 개요',        html: renderFunnelOverviewCard(funnelKey, funnel, valid, funnelAverages) },
    { label: '정량 · 정성 종합', html: dualHtml },
  ];
  if (l2SectionHtml.trim()) l1Steps.push({ label: '퍼널 단계별 카드', html: l2SectionHtml });
  html += buildStepTrack(l1Steps.filter(s => s.html.trim()));
  html += `</div>`;

  html += hierConnector('페르소나별 결과');

  // ── L2: 페르소나별 결과 — 01 세그먼트 비교 | 02 개별 페르소나
  html += hierHeader('l2', 'L2', `페르소나별 결과 · ${esc(funnelLabel)}`);
  html += `<div class="level-zone l2">`;

  const tableHtml = renderPersonaSummaryTable(funnelKey, valid);

  const sortedReviews = [...state.lastReviews].sort(
    (a, b) => _computePersonaFunnelAvg(b, funnelKey) - _computePersonaFunnelAvg(a, funnelKey)
  );

  let cardsHtml = `<div class="persona-cards">`;
  sortedReviews.forEach((r, i) => {
    const idx = `${funnelKey}-${i}`;
    const emoji = recEmoji(r.recommendation);
    const funnelAvg = _computePersonaFunnelAvg(r, funnelKey);
    const cls = _scoreClass(funnelAvg);
    const scoreDisplay = funnelAvg > 0 ? funnelAvg.toFixed(1) : '—';

    const groupPills = groups.map(grp => {
      const avg = _computePersonaGroupAvg(r, grp);
      const pillCls = _scoreClass(avg);
      return `<span class="grp-pill grp-pill-${pillCls}">${esc(grp.label)} ${avg > 0 ? avg.toFixed(1) : '—'}</span>`;
    }).join('');

    const personaRadarHtml = renderPersonaRadar(r, funnelKey);
    const qualHtml = renderFunnelQualSummary(r, funnelKey);
    const panelReviewHtml = renderPersonaPanelReviewSummary(r.persona_id, funnelKey);

    cardsHtml += `<div class="persona-card" id="pc-${idx}">
      <div class="persona-card-header" onclick="toggleCard('${idx}')">
        <span class="emoji">${emoji}</span>
        <span class="name">${esc(r.persona_name)}</span>
        <span class="persona-card-meta-right">
          <span class="persona-group-pills">${groupPills}</span>
          <span class="score-badge ${cls}">${scoreDisplay}/5</span>
        </span>
        <span class="chevron">▶</span>
      </div>
      <div class="persona-card-body">
        <div class="persona-funnel-layout">
          <div class="persona-funnel-left">
            <div class="persona-funnel-pane">
              <div class="persona-funnel-pane-title">정량 평가</div>
              ${personaRadarHtml || '<div class="persona-funnel-empty">정량 데이터 없음</div>'}
            </div>
          </div>
          <div class="persona-funnel-right">
            <div class="persona-funnel-pane">
              <div class="persona-funnel-pane-title">정성적 코멘트</div>
              ${qualHtml || '<div class="persona-funnel-empty">정성 코멘트 없음</div>'}
            </div>
          </div>
        </div>
        ${panelReviewHtml}
      </div>
    </div>`;
  });
  cardsHtml += `</div>`;

  const personaSteps = [];
  if (tableHtml.trim()) personaSteps.push({ label: '세그먼트 비교', html: tableHtml });
  if (valid.length)      personaSteps.push({ label: '개별 페르소나', html: cardsHtml });
  html += buildStepTrack(personaSteps);
  html += `</div>`;

  $panel.innerHTML = html;
}
