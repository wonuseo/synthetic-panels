import { state } from '../state.js';
import { esc, scaleBar, recEmoji, synMetric, renderSynValue, hierHeader, hierConnector, buildStepTrack, _scaleCls, _funnelClsMap } from './helpers.js';
import { computeFunnelAverages } from './overview.js';

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

export function renderFunnelTab(funnelKey) {
  const $panel = document.getElementById('tab-' + funnelKey);
  if (!window.funnelConfig || !window.funnelConfig[funnelKey]) {
    $panel.innerHTML = '<p>퍼널 설정을 불러올 수 없습니다.</p>';
    return;
  }
  const funnel = window.funnelConfig[funnelKey];
  const valid = state.lastReviews.filter(r => !r.error);
  let html = '';

  html += `<div class="funnel-tab-header">`;
  html += `<div class="funnel-tab-title"><span class="funnel-dot ${funnelKey}" style="display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0"></span>${esc(funnel.label)}</div>`;
  if (funnel.desc_who || funnel.desc_goal || funnel.desc_metrics) {
    html += `<div class="fcc-desc-grid">`;
    if (funnel.desc_who) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Who</span><span class="fcc-desc-val">${esc(funnel.desc_who)}</span></div>`;
    if (funnel.desc_goal) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Goal</span><span class="fcc-desc-val">${esc(funnel.desc_goal)}</span></div>`;
    if (funnel.desc_metrics) html += `<div class="fcc-desc-item"><span class="fcc-desc-tag">Metrics</span><span class="fcc-desc-val">${esc(funnel.desc_metrics)}</span></div>`;
    html += `</div>`;
  }
  html += `</div>`;

  if (state.lastSynthesis && !state.lastSynthesis.error) {
    const synQuant = [], synQual = [], synCat = [];
    for (const item of funnel.synthesis_items) {
      const val = state.lastSynthesis[item.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      if (item.type === 'quantitative' && typeof val === 'number') {
        const suffix = item.key.includes('probability') || item.key.includes('conversion') || item.key === 'overall_score' ? '/10' : '/7';
        synQuant.push({ label: item.label, val, suffix });
      } else if (item.type === 'categorical') {
        synCat.push({ label: item.label, val });
      } else {
        synQual.push({ label: item.label, val });
      }
    }
    if (synQuant.length || synQual.length || synCat.length) {
      html += hierHeader('l1', 'L1', '통합 분석');
      html += `<div class="level-zone l1">`;

      // Build inner steps: 정량 → 정성 → 의사결정
      const synthSteps = [];
      if (synQuant.length) {
        let qHtml = `<div class="syn-metrics">`;
        for (const m of synQuant) qHtml += synMetric(m.label, m.val, m.suffix);
        qHtml += `</div>`;
        synthSteps.push({ label: '정량 지표', html: qHtml });
      }
      if (synQual.length) {
        let qualHtml = `<div class="syn-qual"><h4>💬 정성적 분석</h4>`;
        for (const item of synQual)
          qualHtml += `<div class="syn-qual-item"><div class="sq-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        qualHtml += `</div>`;
        synthSteps.push({ label: '정성적 분석', html: qualHtml });
      }
      if (synCat.length) {
        let catHtml = `<div class="syn-decision"><h4>📋 의사결정 지원</h4>`;
        for (const item of synCat)
          catHtml += `<div class="syn-decision-item"><div class="d-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        catHtml += `</div>`;
        synthSteps.push({ label: '의사결정 지원', html: catHtml });
      }

      html += `<div class="synthesis"><h3>📊 통합 분석</h3>`;
      html += buildStepTrack(synthSteps, true);
      html += `</div>`;
      html += `</div>`;
      html += hierConnector('개별 페르소나');
    }
  }

  html += hierHeader('l2', 'L2', `개별 페르소나 · ${esc(funnel.label.split('(')[0].trim())}`);
  html += `<div class="level-zone l2">`;
  html += `<div class="persona-cards">`;
  [...state.lastReviews].sort((a, b) => b.appeal_score - a.appeal_score).forEach((r, i) => {
    const idx = `${funnelKey}-${i}`;
    const emoji = recEmoji(r.recommendation);
    const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
    const cardSteps = [
      { label: '정량 평가',   html: renderScaleBarsForFunnel(r, funnelKey) },
      { label: '정성 코멘트', html: renderQualItemsForFunnel(r, funnelKey) },
    ].filter(s => s.html.trim());
    html += `<div class="persona-card" id="pc-${idx}">
      <div class="persona-card-header" onclick="toggleCard('${idx}')">
        <span class="emoji">${emoji}</span>
        <span class="name">${esc(r.persona_name)}</span>
        <span class="score-badge ${cls}">${r.appeal_score}/10</span>
        <span class="chevron">▶</span>
      </div>
      <div class="persona-card-body">
        ${cardSteps.length ? buildStepTrack(cardSteps, true) : ''}
      </div>
    </div>`;
  });
  html += `</div>`;
  html += `</div>`;
  $panel.innerHTML = html;
}
