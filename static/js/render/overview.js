import { esc, scaleBar, recEmoji, synMetric, renderSynValue, hierHeader, hierConnector, buildStepTrack, _scaleCls, _funnelClsMap } from './helpers.js';

export function computeFunnelAverages(valid) {
  const result = {};
  if (!window.funnelConfig) return result;
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const vals = [];
    for (const item of quantItems) {
      const scores = valid.map(r => r[item.key]).filter(v => v > 0);
      if (scores.length) {
        const max = item.scale === '0-10' || item.scale === '1-10' ? 10 : 7;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        vals.push({ avg, max });
      }
    }
    if (vals.length) {
      const funnelAvg = vals.reduce((a, v) => a + v.avg, 0) / vals.length;
      result[key] = {
        avg: funnelAvg.toFixed(1),
        max: vals[0].max,
        label: funnel.label,
        normalized: funnelAvg / vals[0].max,
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
  const entries = Object.entries(funnelAverages);
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };
  const stageClips = [
    'polygon(0% 0%, 100% 0%, 91% 100%, 9% 100%)',
    'polygon(9% 0%, 91% 0%, 82% 100%, 18% 100%)',
    'polygon(18% 0%, 82% 0%, 73% 100%, 27% 100%)',
  ];

  let html = '<div class="card funnel-visual"><h2>📊 퍼널 점수</h2><div class="funnel-diagram-v2">';
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

function renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw) {
  let strongestFunnel = null, strongestNorm = 0;
  for (const [key, fa] of Object.entries(funnelAverages)) {
    if (fa.normalized > strongestNorm) { strongestNorm = fa.normalized; strongestFunnel = { key, ...fa }; }
  }
  const topPersona = valid.length ? [...valid].sort((a, b) => b.appeal_score - a.appeal_score)[0] : null;

  let mainText = '';
  if (strongestFunnel && topPersona) {
    mainText = `현재의 프로모션은 <strong>${esc(strongestFunnel.label.split('(')[0].trim())}</strong>에서 유효하며, <strong>${esc(topPersona.persona_name)}</strong> 세그먼트에서 가장 반응이 좋았습니다.`;
  } else if (strongestFunnel) {
    mainText = `현재의 프로모션은 <strong>${esc(strongestFunnel.label.split('(')[0].trim())}</strong>에서 가장 유효합니다.`;
  } else if (topPersona) {
    mainText = `<strong>${esc(topPersona.persona_name)}</strong> 세그먼트에서 가장 반응이 좋았습니다.`;
  }

  const innerSteps = [];

  if (mainText) {
    innerSteps.push({ label: '핵심 인사이트', html: `<div class="narrative-main">${mainText}</div>` });
  }

  if (valid.length && window.funnelConfig) {
    let fll = '<div class="funnel-compare-grid">';
    fll += '<div class="fcg-th fcg-th-label"></div>';
    fll += '<div class="fcg-th fcg-th-pos">▲ 최고 반응</div>';
    fll += '<div class="fcg-th fcg-th-neg">▼ 최저 반응</div>';

    for (const [funnelKey, funnel] of Object.entries(window.funnelConfig)) {
      const shortLabel = funnel.label.split('(')[0].trim();
      const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
      const max = quantItems.length && (quantItems[0].scale === '0-10' || quantItems[0].scale === '1-10') ? 10 : 7;
      const scored = valid.map(r => {
        const scores = quantItems.map(item => r[item.key]).filter(v => v > 0);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { r, norm: avg / max };
      }).filter(x => x.norm > 0).sort((a, b) => b.norm - a.norm);
      if (!scored.length) continue;

      const mostPos = scored[0].r;
      const mostNeg = scored[scored.length - 1].r;
      const posComment = funnelKey === 'upper'
        ? (mostPos.first_impression || (mostPos.key_positives || '').split('; ')[0])
        : funnelKey === 'mid'
          ? (mostPos.key_positives || '').split('; ')[0]
          : (mostPos.purchase_trigger_barrier || (mostPos.key_positives || '').split('; ')[0]);
      const negComment = funnelKey === 'lower'
        ? (mostNeg.purchase_trigger_barrier || (mostNeg.key_concerns || '').split('; ')[0])
        : (mostNeg.key_concerns || '').split('; ')[0];

      const posScore = (scored[0].norm * max).toFixed(1);
      const negScore = (scored[scored.length - 1].norm * max).toFixed(1);
      const posPct = Math.round(scored[0].norm * 100);
      const negPct = Math.round(scored[scored.length - 1].norm * 100);
      const color = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' }[funnelKey] || '#6c5ce7';

      // label cell
      fll += `<div class="fcg-label">`;
      fll += `<span class="funnel-dot ${funnelKey}"></span>`;
      fll += `<span class="fcg-label-text ${funnelKey}">${esc(shortLabel)}</span>`;
      fll += `</div>`;

      // positive cell
      fll += `<div class="fcg-cell">`;
      fll += `<div class="fcg-score-col">`;
      fll += `<span class="layer-persona-name">${esc(mostPos.persona_name)}</span>`;
      fll += `<div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${posPct}%;background:${color}"></div></div>`;
      fll += `<span class="layer-score-val" style="color:${color}">${posScore}/${max}</span>`;
      fll += `</div>`;
      fll += `<div class="fcg-comment-col">${posComment ? esc(String(posComment).substring(0, 160)) : ''}</div>`;
      fll += `</div>`;

      // negative cell
      if (scored.length > 1) {
        fll += `<div class="fcg-cell">`;
        fll += `<div class="fcg-score-col">`;
        fll += `<span class="layer-persona-name">${esc(mostNeg.persona_name)}</span>`;
        fll += `<div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${negPct}%;background:#d63031"></div></div>`;
        fll += `<span class="layer-score-val" style="color:#d63031">${negScore}/${max}</span>`;
        fll += `</div>`;
        fll += `<div class="fcg-comment-col">${negComment ? esc(String(negComment).substring(0, 160)) : ''}</div>`;
        fll += `</div>`;
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

function renderAppealChart(reviews) {
  const scored = reviews.filter(r => r.appeal_score > 0).sort((a, b) => b.appeal_score - a.appeal_score);
  if (!scored.length) return '';
  let html = `<div class="card chart-area"><h2>📈 매력도 점수 분포</h2><div>`;
  html += scored.map(r => {
    const score = typeof r.appeal_score === 'number' ? r.appeal_score : parseFloat(r.appeal_score) || 0;
    const pct = score * 10;
    const cls = score >= 7 ? 'high' : score >= 4 ? 'mid' : 'low';
    const display = Number.isInteger(score) ? score : score.toFixed(1);
    return `<div class="bar-row"><div class="name">${esc(r.persona_name)}</div><div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%">${display}</div></div></div>`;
  }).join('');
  html += '</div></div>';
  return html;
}

function renderFunnelSummaries(synthesis, funnelAverages) {
  if (!window.funnelConfig) return '';
  let html = '<div class="funnel-columns">';
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    const fa = funnelAverages ? funnelAverages[key] : null;
    html += renderFunnelColCard(key, funnel, synthesis, fa);
  }
  html += '</div>';
  return html;
}

function renderFunnelColCard(key, funnel, synthesis, fa) {
  const colorMap = { upper: 'var(--upper)', mid: 'var(--mid)', lower: 'var(--lower)' };
  const color = colorMap[key] || 'var(--accent)';
  const shortLabel = funnel.label.split('(')[0].trim();
  const synQuant = [], synQual = [];

  if (synthesis && !synthesis.error) {
    for (const item of funnel.synthesis_items) {
      const val = synthesis[item.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      if (item.type === 'quantitative' && typeof val === 'number') {
        const suffix = item.key.includes('probability') || item.key.includes('conversion') || item.key === 'overall_score' ? '/10' : '/7';
        synQuant.push({ label: item.label, val, suffix });
      } else if (item.type !== 'categorical') {
        synQual.push({ label: item.label, val });
      }
    }
  }

  let html = `<div class="funnel-col-card">`;

  html += `<div class="fcc-header ${key}">`;
  html += `<div class="fcc-label-row"><span class="funnel-dot ${key}"></span><span class="fcc-title">${esc(shortLabel)}</span></div>`;
  if (funnel.desc_who || funnel.desc_goal || funnel.desc_metrics) {
    html += `<div class="fcc-desc-grid">`;
    if (funnel.desc_who) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Who</span><span class="fcc-desc-val">${esc(funnel.desc_who)}</span></div>`;
    if (funnel.desc_goal) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Goal</span><span class="fcc-desc-val">${esc(funnel.desc_goal)}</span></div>`;
    if (funnel.desc_metrics) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Metrics</span><span class="fcc-desc-val">${esc(funnel.desc_metrics)}</span></div>`;
    html += `</div>`;
  }
  if (fa) {
    const pct = Math.round(fa.normalized * 100);
    html += `<div class="fcc-score-row"><span class="fcc-score-num" style="color:${color}">${fa.avg}</span><span class="fcc-score-den">/ ${fa.max}</span><span class="fcc-score-pct">${pct}%</span></div>`;
    html += `<div class="fcc-bar"><div class="fcc-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }
  html += `</div>`;

  html += `<div class="fcc-body">`;
  if (synQuant.length) {
    html += `<div class="fcc-metrics">`;
    for (const m of synQuant.slice(0, 3)) {
      html += `<div class="fcc-metric-row"><span class="fcc-metric-label">${esc(m.label)}</span><span class="fcc-metric-val">${m.val}${m.suffix}</span></div>`;
    }
    html += `</div>`;
  }
  if (synQual.length) {
    html += `<ul class="fcc-qual-list">`;
    for (const item of synQual.slice(0, 3)) {
      const raw = Array.isArray(item.val) ? item.val.slice(0, 3).join(', ') : String(item.val);
      const text = raw.substring(0, 140);
      html += `<li class="fcc-qual-bullet"><span class="fcc-qual-label">${esc(item.label)}</span><span class="fcc-qual-text">${esc(text)}${raw.length > 140 ? '…' : ''}</span></li>`;
    }
    html += `</ul>`;
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}

function renderIntegratedChart(valid) {
  if (!valid.length || !window.funnelConfig) return '';
  const colorMap = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };

  let html = '<div class="card chart-area"><h2>📐 퍼널별 정량 지표 통합</h2><div class="vbar-chart">';
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const color = colorMap[key] || '#6c5ce7';
    const max = (quantItems[0].scale === '0-10' || quantItems[0].scale === '1-10') ? 10 : 7;

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
      html += `<div class="vbar-item">`;
      html += `<span class="vbar-val" style="color:${color}">${item.avg}</span>`;
      html += `<div class="vbar-bar-wrap"><div class="vbar-fill" style="height:${item.pct}%;background:${color}30;border-top:2px solid ${color}"></div></div>`;
      html += `<div class="vbar-label">${esc(item.label)}</div>`;
      html += `</div>`;
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
  if (!quantItems.length) return '';
  const cls = _scaleCls[(_funnelClsMap[funnelKey] || 0) % _scaleCls.length];
  const scaleLabel = quantItems[0].scale || '1-7';
  let html = `<div class="scale-section"><h5>📊 정량 평가 (${scaleLabel})</h5><div class="scale-grid"><div class="scale-group">`;
  for (const item of quantItems) {
    const val = r[item.key];
    if (val == null) continue;
    const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
    html += scaleBar(item.label, val, max, cls);
  }
  html += `</div></div></div>`;
  return html;
}

function renderQualItemsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  let items = '';
  for (const item of qualItems) {
    const val = r[item.key];
    if (!val) continue;
    items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${esc(val)}</div></div>`;
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

function renderTargetDeepDive(valid) {
  if (!valid.length) return '';
  const r = [...valid].sort((a, b) => b.appeal_score - a.appeal_score)[0];
  const emoji = recEmoji(r.recommendation);
  const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns  = (r.key_concerns  || '').split('; ').filter(Boolean);

  let html = '<div class="card target-deep-dive"><h2>🔍 타겟 세그먼트 심층 분석</h2>';
  const scoreDisplay = typeof r.appeal_score === 'number' && !Number.isInteger(r.appeal_score) ? r.appeal_score.toFixed(1) : r.appeal_score;
  html += `<div class="target-persona-header"><span style="font-size:1.4rem">${emoji}</span><span style="font-size:1.05rem;font-weight:700">${esc(r.persona_name)}</span><span class="score-badge ${cls}">${scoreDisplay}/10</span><span class="rec-text">핵심 타겟 세그먼트 · 최고 관심도</span></div>`;
  if (r.first_impression) html += `<div class="impression" style="margin:14px 0 8px">"${esc(r.first_impression)}"</div>`;
  if (r.review_summary) html += `<div class="review-summary" style="margin-bottom:14px"><strong>종합 평가:</strong> ${esc(r.review_summary)}</div>`;
  if (positives.length || concerns.length) {
    html += `<div class="pos-neg" style="margin-bottom:14px"><div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
  }
  if (window.funnelConfig) {
    for (const [funnelKey, funnel] of Object.entries(window.funnelConfig)) {
      const quantSection = renderScaleBarsForFunnel(r, funnelKey);
      const qualSection = renderQualItemsForFunnel(r, funnelKey);
      if (!quantSection && !qualSection) continue;
      html += `<div class="funnel-deep-section">`;
      html += `<div class="funnel-deep-header"><span class="funnel-dot ${funnelKey}"></span><span>${esc(funnel.label.split('(')[0].trim())}</span></div>`;
      html += `<div class="deep-two-col"><div class="deep-quant">${quantSection}</div><div class="deep-qual">${qualSection}</div></div>`;
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

  // ── L1: 종합 요약 ─────────────────────────────────────────
  html += hierHeader('l1', 'L1', '종합 요약');
  html += `<div class="level-zone l1">`;
  html += buildStepTrack([
    { label: '단계별 종합',  html: renderFunnelSummaries(synthesis, funnelAverages) },
    { label: '전략적 권고', html: renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw) },
  ]);
  html += `</div>`;

  html += hierConnector('퍼널 단계 분석');

  // ── L2: 퍼널 단계별 분석 ──────────────────────────────────
  html += hierHeader('l2', 'L2', '퍼널 단계별 분석');
  html += `<div class="level-zone l2">`;
  html += buildStepTrack([
    { label: '정량 지표 통합', html: renderIntegratedChart(valid) },
  ]);
  html += `</div>`;

  html += hierConnector('세부 데이터');

  // ── L3: 세부 분석 ─────────────────────────────────────────
  html += hierHeader('l3', 'L3', '세부 분석');
  html += `<div class="level-zone l3">`;
  html += buildStepTrack([
    { label: '매력도 분포',      html: renderAppealChart(reviews) },
    { label: '타겟 심층 분석',   html: renderTargetDeepDive(valid) },
  ]);
  html += `</div>`;

  document.getElementById('tab-overview').innerHTML = html;
}
