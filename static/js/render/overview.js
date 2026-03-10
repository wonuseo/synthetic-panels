import { esc, recEmoji, renderSynValue, hierHeader, hierConnector, buildStepTrack } from './helpers.js';

const _FUNNEL_KEYS = ['upper', 'mid', 'lower'];

export function computeFunnelAverages(valid) {
  const result = {};
  if (!window.funnelConfig) return result;
  for (const key of [..._FUNNEL_KEYS, 'overall']) {
    const funnel = window.funnelConfig[key];
    if (!funnel) continue;
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const vals = [];
    for (const item of quantItems) {
      const scores = valid.map(r => r[item.key]).filter(v => v > 0);
      if (scores.length) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        vals.push({ avg, max: 5 });
      }
    }
    if (vals.length) {
      const funnelAvg = vals.reduce((a, v) => a + v.avg, 0) / vals.length;
      result[key] = {
        avg: funnelAvg.toFixed(1),
        max: 5,
        label: funnel.label,
        normalized: funnelAvg / 5,
      };
    }
  }
  return result;
}

function renderMetricGroups(reviews, valid, errors, interested, funnelAverages) {
  let html = '<div class="panel-status-mini">';
  html += `<span class="mini-stat">총 패널 <strong>${reviews.length}명</strong></span>`;
  html += `<span class="mini-stat">유효 응답 <strong>${valid.length}명</strong>${errors ? ` · 오류 <strong>${errors}건</strong>` : ''}</span>`;
  html += `<span class="mini-stat">관심 표명 <strong>${interested}명</strong></span>`;
  html += '</div>';
  if (Object.keys(funnelAverages).length) html += renderFunnelDiagram(funnelAverages);
  return html;
}

function renderFunnelDiagram(funnelAverages) {
  const entries = Object.entries(funnelAverages).filter(([k]) => _FUNNEL_KEYS.includes(k));
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };
  const stageClips = [
    'polygon(0% 0%, 100% 0%, 91% 100%, 9% 100%)',
    'polygon(9% 0%, 91% 0%, 82% 100%, 18% 100%)',
    'polygon(18% 0%, 82% 0%, 73% 100%, 27% 100%)',
  ];

  let html = '<div class="card funnel-visual"><h2>📊 퍼널 점수</h2>';

  // Overall gauge if present
  const overall = funnelAverages.overall;
  if (overall) {
    const pct = Math.round(overall.normalized * 100);
    html += `<div class="overall-gauge">`;
    html += `<div class="overall-gauge-label">Overall</div>`;
    html += `<div class="overall-gauge-bar"><div class="overall-gauge-fill" style="width:${pct}%;background:linear-gradient(90deg,#6c5ce7,#a29bfe)"></div></div>`;
    html += `<div class="overall-gauge-val">${overall.avg} / ${overall.max} <span class="overall-gauge-pct">(${pct}%)</span></div>`;
    html += `</div>`;
  }

  html += '<div class="funnel-diagram-v2">';
  entries.forEach(([key, fa], i) => {
    const color = colors[key] || '#6c5ce7';
    const normPct = Math.round(fa.normalized * 100);
    const shortLabel = fa.label.split('(')[0].trim().split(' & ')[0];
    const clip = stageClips[i] || stageClips[2];

    html += '<div class="fdv2-row">';
    html += `<div class="fdv2-stage" style="clip-path:${clip};background:${color}18">`;
    html += `<div class="fdv2-fill" style="width:${normPct}%;background:${color}35"></div>`;
    html += `<span class="fdv2-label">${esc(shortLabel)}</span>`;
    html += '</div>';
    html += `<div class="fdv2-conn" style="border-top-color:${color}70"></div>`;
    html += `<div class="fdv2-box" style="border-color:${color}50;background:${color}07">`;
    html += `<div class="fdv2-score"><span class="fdv2-num" style="color:${color}">${fa.avg}</span><span class="fdv2-den">/ ${fa.max}</span></div>`;
    html += `<div class="fdv2-bar-bg"><div class="fdv2-bar-fill" style="width:${normPct}%;background:${color}"></div></div>`;
    html += `<span class="fdv2-pct">${normPct}%</span>`;
    html += '</div>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

/* ── Radar Chart (SVG) ── */
export function renderRadarChart(valid, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (quantItems.length < 3) return '';

  const n = quantItems.length;
  const cx = 150, cy = 150, R = 132;
  const maxVal = 5;
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894', overall: '#e84393' };
  const color = colors[funnelKey] || '#6c5ce7';

  // Compute averages
  const avgs = quantItems.map(item => {
    const scores = valid.map(r => r[item.key]).filter(v => v > 0);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  });

  // Generate points
  function polarToXY(i, val) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (val / maxVal) * R;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Grid lines
  let gridLines = '';
  for (let level = 1; level <= 5; level++) {
    const pts = Array.from({ length: n }, (_, i) => polarToXY(i, level).join(',')).join(' ');
    gridLines += `<polygon points="${pts}" fill="none" stroke="#e2e6f0" stroke-width="${level === 5 ? 1.5 : 0.7}"/>`;
  }

  // Axis lines
  let axisLines = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, maxVal);
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e2e6f0" stroke-width="0.7"/>`;
  }

  // Data polygon
  const dataPoints = avgs.map((v, i) => polarToXY(i, v).join(',')).join(' ');

  // Labels
  let labels = '';
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = R + 36;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const anchor = 'middle';
    const lineHeight = 23;
    const lines = splitRadarLabel(quantItems[i].label);
    const startY = ly - ((lines.length - 1) * lineHeight) / 2;
    const val = avgs[i].toFixed(1);
    labels += `<text x="${lx}" y="${startY}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-label">`;
    labels += lines.map((line, idx) => `<tspan x="${lx}" y="${startY + idx * lineHeight}">${esc(line)}</tspan>`).join('');
    labels += `</text>`;
    // Score near the point
    const [px, py] = polarToXY(i, avgs[i]);
    labels += `<text x="${px}" y="${py - 8}" text-anchor="middle" class="radar-val" fill="${color}">${val}</text>`;
  }

  // Dots
  let dots = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, avgs[i]);
    dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"/>`;
  }

  const shortLabel = funnel.label.split('(')[0].trim();
  const stageAvg = avgs.length ? avgs.reduce((sum, v) => sum + v, 0) / avgs.length : 0;
  return `<div class="radar-chart-wrap">
    <div class="radar-chart-title-row">
      <div class="radar-chart-title"><span class="funnel-dot ${funnelKey}"></span>${esc(shortLabel)}</div>
      <span class="radar-chart-avg">평균 ${stageAvg.toFixed(1)}/5</span>
    </div>
    <svg viewBox="-55 -55 420 420" class="radar-svg">
      ${gridLines}${axisLines}
      <polygon points="${dataPoints}" fill="${color}20" stroke="${color}" stroke-width="2"/>
      ${dots}${labels}
    </svg>
  </div>`;
}

function splitRadarLabel(text, maxCharsPerLine = 8, maxLines = 4) {
  const src = String(text || '').trim();
  if (!src) return [''];

  // Parenthetical terms are rendered as their own line: 브랜드(enter)적합성 -> 브랜드 / (enter) / 적합성
  const withParenBreak = src
    .replace(/\s*\(([^)]+)\)\s*/g, '\n($1)\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const seed = withParenBreak.split('\n').map(s => s.trim()).filter(Boolean);
  const wrapped = [];
  for (const part of seed) {
    // Word-first wrapping: split by whitespace, then place each word on its own line.
    if (part.includes(' ')) {
      const words = part.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (w.length <= maxCharsPerLine) wrapped.push(w);
        else {
          // Fallback for long single words.
          for (let i = 0; i < w.length; i += maxCharsPerLine) {
            wrapped.push(w.slice(i, i + maxCharsPerLine));
          }
        }
      }
      continue;
    }
    // Fallback for labels without spaces (e.g. Korean compound words).
    for (let i = 0; i < part.length; i += maxCharsPerLine) {
      wrapped.push(part.slice(i, i + maxCharsPerLine));
    }
  }
  if (wrapped.length <= maxLines) return wrapped;
  const merged = wrapped.slice(0, maxLines);
  merged[maxLines - 1] = `${merged[maxLines - 1]}…`;
  return merged;
}

function renderRadarCharts(valid, asCard = true) {
  if (!valid.length || !window.funnelConfig) return '';
  let html = '';
  if (asCard) html += '<div class="card chart-area"><h2>🕸️ 퍼널별 레이더 차트</h2>';
  html += '<div class="radar-grid">';
  for (const key of _FUNNEL_KEYS) {
    html += renderRadarChart(valid, key);
  }
  html += '</div>';
  if (asCard) html += '</div>';
  return html;
}

function renderL1OverallSummaryCard(synthesis) {
  const overallCard = renderOverallSynthesisCard(synthesis);
  if (overallCard) return overallCard;
  return `<div class="card chart-area"><h2>📋 Overall 종합 평가</h2><p style="color:#636e72">Overall 종합 평가 데이터가 없습니다.</p></div>`;
}

function renderL1FunnelCardsSection(synthesis, funnelAverages, valid) {
  let html = '<div class="card chart-area"><h2>🧭 퍼널 단계별 카드</h2>';
  html += renderFunnelSummaries(synthesis, funnelAverages, valid);
  html += '</div>';
  return html;
}

function getBestFunnelPersonaCombo(valid, funnelAverages) {
  if (!valid.length || !window.funnelConfig) return null;

  let strongestFunnelKey = null;
  let strongestNorm = -1;
  for (const [key, fa] of Object.entries(funnelAverages || {})) {
    if (!_FUNNEL_KEYS.includes(key)) continue;
    if (typeof fa.normalized !== 'number') continue;
    if (fa.normalized > strongestNorm) {
      strongestNorm = fa.normalized;
      strongestFunnelKey = key;
    }
  }
  if (!strongestFunnelKey) return null;

  const funnel = window.funnelConfig[strongestFunnelKey];
  if (!funnel) return null;
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (!quantItems.length) return null;

  const scored = valid.map(r => {
    const vals = quantItems.map(item => r[item.key]).filter(v => v > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { r, avg };
  }).filter(Boolean).sort((a, b) => b.avg - a.avg);

  if (!scored.length) return null;

  return {
    funnelKey: strongestFunnelKey,
    funnelLabel: funnel.label.split('(')[0].trim(),
    persona: scored[0].r,
    score: scored[0].avg,
  };
}

function renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw) {
  const bestCombo = getBestFunnelPersonaCombo(valid, funnelAverages);

  let mainText = '';
  if (bestCombo) {
    mainText = `현재의 프로모션은 <strong>${esc(bestCombo.funnelLabel)}</strong>에서 유효하며, <strong>${esc(bestCombo.persona.persona_name)}</strong> 세그먼트에서 가장 반응이 좋았습니다.`;
  }

  const innerSteps = [];

  if (mainText) {
    innerSteps.push({ label: '핵심 인사이트', html: `<div class="narrative-main">${mainText}</div>` });
  }

  if (valid.length && window.funnelConfig) {
    let fll = '<div class="funnel-compare-grid">';
    fll += '<div class="fcg-th fcg-th-label"></div>';
    fll += '<div class="fcg-th fcg-th-pos">성과 우세 세그먼트</div>';
    fll += '<div class="fcg-th fcg-th-neg">개선 필요 세그먼트</div>';

    for (const funnelKey of _FUNNEL_KEYS) {
      const funnel = window.funnelConfig[funnelKey];
      if (!funnel) continue;
      const shortLabel = funnel.label.split('(')[0].trim();
      const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
      const max = 5;
      const scored = valid.map(r => {
        const scores = quantItems.map(item => r[item.key]).filter(v => v > 0);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { r, norm: avg / max };
      }).filter(x => x.norm > 0).sort((a, b) => b.norm - a.norm);
      if (!scored.length) continue;

      const mostPos = scored[0].r;
      const mostNeg = scored[scored.length - 1].r;
      const posComment = funnelKey === 'upper'
        ? (mostPos.emotional_response || (mostPos.key_positives || '').split('; ')[0])
        : funnelKey === 'mid'
          ? (mostPos.key_positives || '').split('; ')[0]
          : (mostPos.purchase_trigger || (mostPos.key_positives || '').split('; ')[0]);
      const negComment = funnelKey === 'lower'
        ? (mostNeg.purchase_barrier || (mostNeg.key_concerns || '').split('; ')[0])
        : (mostNeg.key_concerns || '').split('; ')[0];

      const posScore = (scored[0].norm * max).toFixed(1);
      const negScore = (scored[scored.length - 1].norm * max).toFixed(1);
      const posPct = Math.round(scored[0].norm * 100);
      const negPct = Math.round(scored[scored.length - 1].norm * 100);
      const gap = Math.max(0, scored[0].norm - scored[scored.length - 1].norm) * max;
      const color = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' }[funnelKey] || '#6c5ce7';

      fll += `<div class="fcg-label"><span class="funnel-dot ${funnelKey}"></span><span class="fcg-label-text ${funnelKey}">${esc(shortLabel)}</span><span class="fcg-gap">격차 ${gap.toFixed(1)}점</span></div>`;
      fll += `<div class="fcg-cell"><div class="fcg-score-col"><span class="layer-persona-name">${esc(mostPos.persona_name)}</span><div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${posPct}%;background:${color}"></div></div><span class="layer-score-val" style="color:${color}">${posScore}/${max}</span></div><div class="fcg-comment-col">${posComment ? esc(String(posComment).substring(0, 160)) : ''}</div></div>`;

      if (scored.length > 1) {
        fll += `<div class="fcg-cell"><div class="fcg-score-col"><span class="layer-persona-name">${esc(mostNeg.persona_name)}</span><div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${negPct}%;background:#d63031"></div></div><span class="layer-score-val" style="color:#d63031">${negScore}/${max}</span></div><div class="fcg-comment-col">${negComment ? esc(String(negComment).substring(0, 160)) : ''}</div></div>`;
      } else {
        fll += `<div class="fcg-cell fcg-empty">—</div>`;
      }
    }
    fll += '</div>';
    innerSteps.push({ label: '퍼널별 반응 비교', html: fll });
  }

  let html = '<div class="card storyline"><h2>🎯 전략적 권고</h2>';
  if (innerSteps.length) html += buildStepTrack(innerSteps, true);
  html += '</div>';
  return html;
}

function renderOverallStackedBarChart(reviews) {
  const valid = reviews.filter(r => !r.error);
  if (!valid.length) return '';

  const personas = valid.map(r => {
    const pa = typeof r.promotion_attractiveness === 'number' ? r.promotion_attractiveness : parseFloat(r.promotion_attractiveness) || 0;
    const pq = typeof r.promotion_quality === 'number' ? r.promotion_quality : parseFloat(r.promotion_quality) || 0;
    const paSafe = Math.max(0, Math.min(5, pa));
    const pqSafe = Math.max(0, Math.min(5, pq));
    const total = paSafe + pqSafe;
    return {
      name: r.persona_name,
      pa: paSafe,
      pq: pqSafe,
      paPct: (paSafe / 10) * 100,
      pqPct: (pqSafe / 10) * 100,
      total,
      totalPct: (total / 10) * 100,
    };
  }).sort((a, b) => b.total - a.total);

  let rows = '';
  for (const p of personas) {
    const totalLabel = Number.isInteger(p.total) ? p.total : p.total.toFixed(1);
    const paLabel = Number.isInteger(p.pa) ? p.pa : p.pa.toFixed(1);
    const pqLabel = Number.isInteger(p.pq) ? p.pq : p.pq.toFixed(1);
    rows += `<div class="overall-stack-row">`;
    rows += `<div class="overall-stack-name">${esc(p.name)}</div>`;
    rows += `<div class="overall-stack-track">`;
    rows += `<div class="overall-stack-seg pa" style="width:${p.paPct}%" title="매력도 ${p.pa}/5"><span class="overall-stack-seg-label">${paLabel}</span></div>`;
    rows += `<div class="overall-stack-seg pq" style="width:${p.pqPct}%" title="퀄리티 ${p.pq}/5"><span class="overall-stack-seg-label">${pqLabel}</span></div>`;
    rows += `</div>`;
    rows += `<div class="overall-stack-val">${totalLabel}/10 <span class="overall-stack-pct">(${Math.round(p.totalPct)}%)</span></div>`;
    rows += `</div>`;
  }

  return `<div class="card chart-area"><h2>📈 OVERALL 점수 분포</h2>
    <div class="overall-stack-legend">
      <span class="legend-item"><span class="legend-dot pa"></span>프로모션 매력도 /5</span>
      <span class="legend-item"><span class="legend-dot pq"></span>프로모션 퀄리티 /5</span>
    </div>
    <div class="overall-stack-wrap">${rows}</div>
  </div>`;
}

function renderOverallSynthesisCard(synthesis) {
  if (!synthesis || synthesis.error || !window.funnelConfig) return '';
  const overall = window.funnelConfig.overall;
  if (!overall || !overall.synthesis_items) return '';

  const goNoGoColors = {
    '강력 추천': { bg: '#e8f8f5', border: '#00b894', text: '#007f67', badge: '#00b894' },
    '조건부 추천': { bg: '#e8f4fd', border: '#0984e3', text: '#0660aa', badge: '#0984e3' },
    '수정 후 재검토': { bg: '#fef3ee', border: '#e17055', text: '#b85a38', badge: '#e17055' },
    '비추천': { bg: '#fdecea', border: '#d63031', text: '#a52020', badge: '#d63031' },
  };

  const goNoGoIcons = {
    '강력 추천': '✅', '조건부 추천': '🔵', '수정 후 재검토': '⚠️', '비추천': '🚫',
  };

  const s = synthesis;
  const exec = s.executive_summary;
  const gonogo = s.go_nogo_recommendation;
  const impPriority = s.improvement_priority;
  const actionRecs = s.actionable_recommendations;
  const usageStrat = s.usage_strategy;

  // Detect go/nogo verdict word
  const goNoGoVerdict = gonogo
    ? (['강력 추천', '조건부 추천', '수정 후 재검토', '비추천'].find(v => String(gonogo).startsWith(v)) || '')
    : '';
  const gng = goNoGoColors[goNoGoVerdict] || { bg: '#f8f8fc', border: '#6c5ce7', text: '#3d1f8b', badge: '#6c5ce7' };
  const gngIcon = goNoGoIcons[goNoGoVerdict] || '📋';

  let html = '<div class="overall-synthesis-card">';
  html += '<div class="osc-header"><span class="osc-icon">📋</span><span class="osc-title">Overall 종합 평가</span></div>';
  html += '<div class="osc-body">';

  // ── Section 1: 핵심 요약
  if (exec) {
    html += `<div class="osc-section osc-section-summary">`;
    html += `<div class="osc-section-label"><span class="osc-section-num">01</span>핵심 요약</div>`;
    html += `<div class="osc-summary-text">${esc(String(exec))}</div>`;
    html += `</div>`;
  }

  // ── Section 2: Go/No-Go (prominent separate box)
  if (gonogo) {
    html += `<div class="osc-section osc-gonogo-section" style="background:${gng.bg};border-color:${gng.border}">`;
    html += `<div class="osc-section-label"><span class="osc-section-num" style="background:${gng.badge};color:#fff">02</span>Go/No-Go 의사결정</div>`;
    html += `<div class="osc-gonogo-verdict" style="color:${gng.text}">`;
    html += `<span class="osc-gonogo-icon">${gngIcon}</span>`;
    html += `<span class="osc-gonogo-label" style="background:${gng.badge}">${esc(goNoGoVerdict || '—')}</span>`;
    html += `</div>`;
    // Rationale text (everything after the verdict word)
    const rationale = goNoGoVerdict ? String(gonogo).slice(goNoGoVerdict.length).replace(/^[\s\-–—:,]+/, '') : String(gonogo);
    if (rationale) {
      html += `<div class="osc-gonogo-rationale" style="color:${gng.text}">${esc(rationale)}</div>`;
    }
    html += `</div>`;
  }

  // ── Section 3: 프로모션 개선 방향
  const hasImprovement = impPriority || (Array.isArray(actionRecs) && actionRecs.length);
  if (hasImprovement) {
    html += `<div class="osc-section osc-section-improve">`;
    html += `<div class="osc-section-label"><span class="osc-section-num">03</span>프로모션 개선 방향 <span class="osc-section-sub">소재 직접 수정 제안</span></div>`;
    if (impPriority) {
      html += `<div class="osc-improve-priority">`;
      html += `<span class="osc-priority-chip">최우선 개선 영역</span>`;
      html += `<div class="osc-priority-text">${esc(String(impPriority))}</div>`;
      html += `</div>`;
    }
    if (Array.isArray(actionRecs) && actionRecs.length) {
      html += `<ol class="osc-recs-list">`;
      actionRecs.forEach((rec, i) => {
        html += `<li class="osc-recs-item"><span class="osc-recs-num">${i + 1}</span><span>${esc(String(rec))}</span></li>`;
      });
      html += `</ol>`;
    }
    html += `</div>`;
  }

  // ── Section 4: 활용 방안 제안
  if (Array.isArray(usageStrat) && usageStrat.length) {
    html += `<div class="osc-section osc-section-usage">`;
    html += `<div class="osc-section-label"><span class="osc-section-num">04</span>활용 방안 제안 <span class="osc-section-sub">채널·배포·운용 전략</span></div>`;
    html += `<ol class="osc-recs-list osc-usage-list">`;
    usageStrat.forEach((item, i) => {
      html += `<li class="osc-recs-item osc-usage-item"><span class="osc-recs-num usage">${i + 1}</span><span>${esc(String(item))}</span></li>`;
    });
    html += `</ol>`;
    html += `</div>`;
  }

  // ── Section 5: 세그먼트 인사이트 (cross-funnel)
  const segInsights = s.segment_insights;
  const targetPriority = s.target_segment_priority;
  const hasSegment = (Array.isArray(segInsights) && segInsights.length) || (Array.isArray(targetPriority) && targetPriority.length);
  if (hasSegment) {
    html += `<div class="osc-section osc-section-segment">`;
    html += `<div class="osc-section-label"><span class="osc-section-num">05</span>세그먼트 인사이트 <span class="osc-section-sub">Cross-funnel 관점</span></div>`;
    if (Array.isArray(segInsights) && segInsights.length) {
      html += `<div class="osc-segment-block">`;
      html += `<div class="osc-segment-sublabel">반응 차이</div>`;
      html += `<ul class="osc-segment-list">${segInsights.map(v => `<li>${esc(String(v))}</li>`).join('')}</ul>`;
      html += `</div>`;
    }
    if (Array.isArray(targetPriority) && targetPriority.length) {
      html += `<div class="osc-segment-block">`;
      html += `<div class="osc-segment-sublabel">타겟 우선순위</div>`;
      html += `<ol class="osc-segment-list osc-segment-priority">${targetPriority.map((v, i) => `<li><span class="osc-seg-rank">${i + 1}</span>${esc(String(v))}</li>`).join('')}</ol>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  html += '</div></div>';
  return html;
}

function renderFunnelSummaries(synthesis, funnelAverages, valid) {
  if (!window.funnelConfig) return '';
  let html = '';
  html += '<div class="funnel-columns">';
  for (const key of _FUNNEL_KEYS) {
    const funnel = window.funnelConfig[key];
    if (!funnel) continue;
    const fa = funnelAverages ? funnelAverages[key] : null;
    html += renderFunnelColCard(key, funnel, synthesis, fa, valid);
  }
  html += '</div>';
  return html;
}

function renderFunnelColCardRadar(valid, funnelKey) {
  if (!window.funnelConfig || !valid || !valid.length) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';

  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (quantItems.length < 3) return '';

  const n = quantItems.length;
  const cx = 110, cy = 110, R = 78;
  const maxVal = 5;
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };
  const color = colors[funnelKey] || '#6c5ce7';

  const avgs = quantItems.map(item => {
    const scores = valid.map(r => r[item.key]).filter(v => v > 0);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  });

  function polarToXY(i, val) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (val / maxVal) * R;
    return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)];
  }

  let gridLines = '';
  for (let level = 1; level <= 5; level++) {
    const pts = Array.from({ length: n }, (_, i) => polarToXY(i, level).join(',')).join(' ');
    gridLines += `<polygon points="${pts}" fill="none" stroke="#e2e6f0" stroke-width="${level === 5 ? 1.2 : 0.7}"/>`;
  }

  let axisLines = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, maxVal);
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e2e6f0" stroke-width="0.7"/>`;
  }

  const dataPoints = avgs.map((v, i) => polarToXY(i, v).join(',')).join(' ');

  let labels = '';
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = R + 24;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const lineHeight = 14;
    const lines = splitRadarLabel(quantItems[i].label, 6, 3);
    const startY = ly - ((lines.length - 1) * lineHeight) / 2;

    labels += `<text x="${lx}" y="${startY}" text-anchor="middle" dominant-baseline="middle" class="fcc-radar-label">`;
    labels += lines.map((line, idx) => `<tspan x="${lx}" y="${startY + idx * lineHeight}">${esc(line)}</tspan>`).join('');
    labels += `</text>`;
    const [px, py] = polarToXY(i, avgs[i]);
    labels += `<text x="${px}" y="${py - 7}" text-anchor="middle" class="fcc-radar-val" fill="${color}">${avgs[i].toFixed(1)}</text>`;
  }

  let dots = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = polarToXY(i, avgs[i]);
    dots += `<circle cx="${x}" cy="${y}" r="2.8" fill="${color}" stroke="white" stroke-width="1.3"/>`;
  }

  return `<div class="fcc-radar-wrap">
    <svg viewBox="-10 -10 240 240" class="fcc-radar-svg">
      ${gridLines}${axisLines}
      <polygon points="${dataPoints}" fill="${color}20" stroke="${color}" stroke-width="1.8"/>
      ${dots}${labels}
    </svg>
  </div>`;
}

function renderFunnelColCardQuantInsight(key, funnel, synthesis, valid) {
  if (!valid.length) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (!quantItems.length) return '';

  // LLM 인사이트 우선
  const llmInsight = synthesis?.[key + '_quant_insight'];
  if (llmInsight && llmInsight.trim()) {
    return `<div class="fcc-quant-insight fcc-quant-insight--llm">
      <div class="fcc-quant-insight-title">💡 정량 지표 해석</div>
      <div class="fcc-quant-insight-text">${esc(llmInsight.trim())}</div>
    </div>`;
  }

  // 규칙 기반 fallback
  const itemStats = quantItems.map(item => {
    const scores = valid.map(r => { const v = r[item.key]; return typeof v === 'number' ? v : parseFloat(v) || 0; }).filter(v => v > 0);
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const spread = Math.max(...scores) - Math.min(...scores);
    return { label: item.label, avg, spread };
  }).filter(Boolean);

  if (!itemStats.length) return '';

  const funnelAvg = itemStats.reduce((s, i) => s + i.avg, 0) / itemStats.length;
  const sorted = [...itemStats].sort((a, b) => b.avg - a.avg);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const highSpread = itemStats.filter(i => i.spread >= 1.5);

  const parts = [];
  const overallLevel = funnelAvg >= 4.0 ? '전반적으로 긍정적인' : funnelAvg >= 3.0 ? '전반적으로 보통 수준의' : '전반적으로 낮은';
  parts.push(`${overallLevel} 반응 (평균 ${funnelAvg.toFixed(1)}/5).`);
  if (itemStats.length > 1 && top.avg - bottom.avg >= 0.5) {
    parts.push(`<strong>${esc(top.label)}</strong>(${top.avg.toFixed(1)})이 가장 높고, <strong>${esc(bottom.label)}</strong>(${bottom.avg.toFixed(1)})이 가장 낮아 지표 간 격차가 있음.`);
  }
  if (highSpread.length) {
    parts.push(`<strong>${esc(highSpread[0].label)}</strong> 등 ${highSpread.length}개 지표에서 페르소나 간 편차가 커 세그먼트별 대응이 필요함.`);
  }

  return `<div class="fcc-quant-insight">
    <div class="fcc-quant-insight-title">💡 정량 지표 해석</div>
    <div class="fcc-quant-insight-text">${parts.join(' ')}</div>
  </div>`;
}

function renderFunnelColCard(key, funnel, synthesis, fa, valid) {
  const colorMap = { upper: 'var(--upper)', mid: 'var(--mid)', lower: 'var(--lower)' };
  const color = colorMap[key] || 'var(--accent)';
  const shortLabel = funnel.label.split('(')[0].trim();
  const synQual = [];

  if (synthesis && !synthesis.error) {
    for (const item of funnel.synthesis_items) {
      const val = synthesis[item.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      if (item.type !== 'quantitative' && item.type !== 'categorical') {
        synQual.push({ label: item.label, val });
      }
    }
  }

  let html = `<div class="funnel-col-card">`;

  html += `<div class="fcc-header ${key}">`;
  html += `<div class="fcc-label-row"><span class="funnel-dot ${key}"></span><span class="fcc-title">${esc(shortLabel)}</span></div>`;
  if (funnel.desc_who || funnel.desc_goal || funnel.desc_metrics) {
    html += `<div class="fcc-desc-grid">`;
    if (funnel.desc_who) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">대상</span><span class="fcc-desc-val">${esc(funnel.desc_who)}</span></div>`;
    if (funnel.desc_goal) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">목표</span><span class="fcc-desc-val">${esc(funnel.desc_goal)}</span></div>`;
    if (funnel.desc_metrics) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">핵심 지표</span><span class="fcc-desc-val">${esc(funnel.desc_metrics)}</span></div>`;
    html += `</div>`;
  }
  if (fa) {
    const pct = Math.round(fa.normalized * 100);
    html += `<div class="fcc-score-row"><span class="fcc-score-num" style="color:${color}">${fa.avg}</span><span class="fcc-score-den">/ ${fa.max}</span><span class="fcc-score-pct">${pct}%</span></div>`;
    html += `<div class="fcc-bar"><div class="fcc-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }
  html += `</div>`;

  html += `<div class="fcc-body">`;
  html += renderFunnelColCardRadar(valid, key);
  html += renderFunnelColCardQuantInsight(key, funnel, synthesis, valid);
  if (synQual.length) {
    html += `<ul class="fcc-qual-list">`;
    for (const item of synQual.slice(0, 3)) {
      html += `<li class="fcc-qual-bullet"><span class="fcc-qual-label">${esc(item.label)}</span><div class="fcc-qual-text">${renderSynValue(item.val)}</div></li>`;
    }
    html += `</ul>`;
  }
  html += `</div></div>`;
  return html;
}

function renderIntegratedChart(valid) {
  if (!valid.length || !window.funnelConfig) return '';
  const colorMap = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };

  let html = '<div class="card chart-area"><h2>📐 퍼널별 정량 지표 통합</h2><div class="vbar-chart">';
  for (const key of _FUNNEL_KEYS) {
    const funnel = window.funnelConfig[key];
    if (!funnel) continue;
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const color = colorMap[key] || '#6c5ce7';
    const max = 5;

    const items = quantItems.map(item => {
      const scores = valid.map(r => r[item.key]).filter(v => v > 0);
      if (!scores.length) return null;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { label: item.label, avg: avg.toFixed(1), pct: Math.round((avg / max) * 100) };
    }).filter(Boolean);
    if (!items.length) continue;

    html += `<div class="vbar-funnel-group">`;
    html += `<div class="vbar-group-header"><span class="funnel-dot ${key}"></span><span class="vbar-group-label ${key}">${esc(funnel.label.split('(')[0].trim())}</span><span class="vbar-max-label">/ ${max}</span></div>`;
    html += `<div class="vbar-bars">`;
    for (const item of items) {
      html += `<div class="vbar-item"><span class="vbar-val" style="color:${color}">${item.avg}</span><div class="vbar-bar-wrap"><div class="vbar-fill" style="height:${item.pct}%;background:${color}30;border-top:2px solid ${color}"></div></div><div class="vbar-label">${esc(item.label)}</div></div>`;
    }
    html += `</div></div>`;
  }
  html += '</div></div>';
  return html;
}

function renderScaleBarsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (quantItems.length < 3) return '';

  const n = quantItems.length;
  const cx = 150, cy = 150, R = 122;
  const maxVal = 5;
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894', overall: '#e84393' };
  const color = colors[funnelKey] || '#6c5ce7';

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
    const anchor = 'middle';
    const lineHeight = 23;
    const lines = splitRadarLabel(quantItems[i].label);
    const startY = ly - ((lines.length - 1) * lineHeight) / 2;
    const val = vals[i].toFixed(1);
    labels += `<text x="${lx}" y="${startY}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-label">`;
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

function renderQualItemsForFunnel(r, funnelKey, limit = 3) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  let items = '';
  let count = 0;
  for (const item of qualItems) {
    if (count >= limit) break;
    const val = r[item.key];
    if (!val) continue;
    items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${renderSynValue(val)}</div></div>`;
    count++;
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

function renderTargetFunnelAverages(funnelAverages, comboFunnelKey = null) {
  if (!funnelAverages || !window.funnelConfig) return '';
  const orderedKeys = comboFunnelKey
    ? [comboFunnelKey, ..._FUNNEL_KEYS.filter(k => k !== comboFunnelKey)]
    : _FUNNEL_KEYS;

  let cards = '';
  for (const key of orderedKeys) {
    const fa = funnelAverages[key];
    const funnel = window.funnelConfig[key];
    if (!fa || !funnel) continue;
    const rawAvg = typeof fa.avg === 'number' ? fa.avg : parseFloat(fa.avg);
    const avg = Number.isFinite(rawAvg) ? rawAvg : 0;
    const pct = Math.max(0, Math.min(100, Math.round((avg / 5) * 100)));
    const shortLabel = funnel.label.split('(')[0].trim();
    const isBest = comboFunnelKey === key;

    cards += `<div class="target-funnel-avg-card ${key}${isBest ? ' best' : ''}">`;
    cards += `<div class="target-funnel-avg-head"><span class="funnel-dot ${key}"></span><span class="target-funnel-avg-label">${esc(shortLabel)}</span><span class="target-funnel-avg-score">${avg.toFixed(1)}/5</span></div>`;
    cards += `<div class="target-funnel-avg-bar"><div class="target-funnel-avg-fill ${key}" style="width:${pct}%"></div></div>`;
    cards += `<div class="target-funnel-avg-foot"><span>평균 점수</span><span>${pct}%</span></div>`;
    cards += `</div>`;
  }

  if (!cards) return '';
  return `<div class="target-funnel-avg-wrap"><h5>📊 퍼널별 평균 점수</h5><div class="target-funnel-avg-grid">${cards}</div></div>`;
}

function renderTargetDeepDive(valid, funnelAverages) {
  if (!valid.length) return '';
  const bestCombo = getBestFunnelPersonaCombo(valid, funnelAverages);
  const r = bestCombo ? bestCombo.persona : [...valid].sort((a, b) => (b.appeal || 0) - (a.appeal || 0))[0];
  const emoji = recEmoji(r.recommendation);
  const score = bestCombo
    ? bestCombo.score
    : (typeof r.appeal === 'number' ? r.appeal : parseFloat(r.appeal) || 0);
  const cls = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns  = (r.key_concerns  || '').split('; ').filter(Boolean);
  const scoreDisplay = Number.isInteger(score) ? score : score.toFixed(1);
  const comboFunnelLabel = bestCombo ? bestCombo.funnelLabel : '';
  const comboFunnelKey = bestCombo ? bestCombo.funnelKey : null;

  let html = '<div class="card target-deep-dive"><h2>🔍 타겟 세그먼트 심층 분석</h2>';
  html += `<div class="target-summary-section">`;
  html += `<div class="target-persona-header"><span style="font-size:1.4rem">${emoji}</span><span style="font-size:1.05rem;font-weight:700">${esc(r.persona_name)}</span><span class="score-badge ${cls}">${scoreDisplay}/5</span><span class="rec-text">${comboFunnelLabel ? `핵심 타겟 세그먼트 · ${esc(comboFunnelLabel)} 최고 반응 조합` : '핵심 타겟 세그먼트 · 최고 관심도'}</span></div>`;
  html += renderTargetFunnelAverages(funnelAverages, comboFunnelKey);
  html += `</div>`;
  if (r.emotional_response) html += `<div class="impression target-quote">"${esc(r.emotional_response)}"</div>`;
  if (positives.length || concerns.length) {
    html += `<div class="pos-neg" style="margin-bottom:14px"><div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
  }
  if (r.review_summary) html += `<div class="review-summary" style="margin-bottom:14px"><strong>종합 평가:</strong> ${esc(r.review_summary)}</div>`;
  if (window.funnelConfig) {
    const orderedFunnelKeys = _FUNNEL_KEYS;
    const rowNumMap = { upper: '01', mid: '02', lower: '03' };
    for (const funnelKey of orderedFunnelKeys) {
      const funnel = window.funnelConfig[funnelKey];
      if (!funnel) continue;
      const stagePrefix = { upper: 'Upper', mid: 'Mid', lower: 'Lower' }[funnelKey] || funnelKey;
      const shortLabel = funnel.label.split('(')[0].trim();
      const stageLabel = `${stagePrefix}: ${shortLabel}`;
      const quantSection = renderScaleBarsForFunnel(r, funnelKey);
      const qualSection = renderQualItemsForFunnel(r, funnelKey);
      if (!quantSection && !qualSection) continue;

      html += `<div class="funnel-deep-section">`;
      html += `<div class="funnel-row-head"><div class="funnel-row-tag"><span class="funnel-row-num">${rowNumMap[funnelKey] || '00'}</span><span class="funnel-row-label">${esc(stageLabel)} 응답 요약</span></div></div>`;
      html += `<div class="deep-two-col${(quantSection && qualSection) ? '' : ' single'}">`;
      if (quantSection) html += `<div class="deep-col deep-quant">${quantSection}</div>`;
      if (qualSection) html += `<div class="deep-col deep-qual">${qualSection}</div>`;
      html += `</div>`;
      html += `</div>`;
    }
  }
  html += '</div>';
  return html;
}

export function renderOverviewTab(reviews, synthesis, synthesis_raw) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error).length;
  const interested = reviews.filter(r => r.recommendation && (
    r.recommendation.includes('관심 있음') || (r.recommendation.includes('Interested') && !r.recommendation.includes('Not'))
  )).length;

  const funnelAverages = computeFunnelAverages(valid);

  let html = '';

  // ── L1: 종합 요약
  html += hierHeader('l1', 'L1', '종합 요약');
  html += `<div class="level-zone l1">`;
  html += buildStepTrack([
    { label: 'Overall 종합 평가', html: renderL1OverallSummaryCard(synthesis) },
    { label: '전략적 권고', html: renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw) },
    { label: '퍼널 단계별 카드', html: renderL1FunnelCardsSection(synthesis, funnelAverages, valid) },
  ]);
  html += `</div>`;

  html += hierConnector('세부 데이터');

  // ── L2: 세부 분석
  html += hierHeader('l2', 'L2', '세부 분석');
  html += `<div class="level-zone l2">`;
  html += buildStepTrack([
    { label: 'Overall 점수 분포', html: renderOverallStackedBarChart(reviews) },
    { label: '타겟 심층 분석',    html: renderTargetDeepDive(valid, funnelAverages) },
  ]);
  html += `</div>`;

  document.getElementById('tab-overview').innerHTML = html;
}
