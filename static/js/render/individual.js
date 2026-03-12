import { esc, scaleBar, recEmoji, renderQA, renderSynValue, buildStepTrack, _scaleCls, renderQualGrid } from './helpers.js';

const _FUNNEL_KEYS = ['upper', 'mid', 'lower'];

function _renderScaleGroups(title, getValue, skip = (v) => v == null) {
  if (!window.funnelConfig) return '';
  let html = `<div class="scale-section"><h5>${title}</h5><div class="scale-grid">`;
  let clsIdx = 0;
  for (const key of ['overall', ..._FUNNEL_KEYS]) {
    const funnel = window.funnelConfig[key];
    if (!funnel) continue;
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) { clsIdx++; continue; }
    const cls = _scaleCls[clsIdx % _scaleCls.length];
    html += `<div class="scale-group"><h6>${esc(funnel.label.split('(')[0].trim())} (1-5)</h6>`;
    for (const item of quantItems) {
      const val = getValue(item);
      if (skip(val)) continue;
      html += scaleBar(item.label, val, 5, cls);
    }
    html += '</div>';
    clsIdx++;
  }
  html += '</div></div>';
  return html;
}

function renderScaleBars(r) {
  return _renderScaleGroups('📊 정량 평가', item => r[item.key]);
}

function renderAvgScaleBars(summary) {
  if (!window.funnelConfig) return '';
  const avgR = {};
  for (const key of ['overall', ..._FUNNEL_KEYS]) {
    const funnel = window.funnelConfig[key];
    if (!funnel) continue;
    for (const item of funnel.individual_items.filter(i => i.type === 'quantitative')) {
      avgR[item.key] = summary['avg_' + item.key];
    }
  }
  return _renderScaleGroups('📊 평균 정량 평가', item => avgR[item.key], v => v == null || v === 0);
}

function renderQualItems(r) {
  if (!window.funnelConfig) return '';
  const allQualItems = ['overall', ..._FUNNEL_KEYS].flatMap(key => {
    const funnel = window.funnelConfig[key];
    if (!funnel) return [];
    return funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  });
  return renderQualGrid(allQualItems, r);
}

export function renderPersonaCard(r, idx) {
  const emoji = recEmoji(r.recommendation);
  const score = r.appeal || 0;
  const cls = score >= 4 ? 'high' : score >= 3 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns = (r.key_concerns || '').split('; ').filter(Boolean);

  const steps = [];

  if (r.emotional_response) {
    steps.push({ label: '감정적 반응', html: `<div class="impression">"${esc(r.emotional_response)}"</div>` });
  }

  if (positives.length || concerns.length) {
    steps.push({
      label: '반응 분석',
      html: `<div class="pos-neg">
        <div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>`,
    });
  }

  const scalesHtml = renderScaleBars(r);
  if (scalesHtml) steps.push({ label: '정량 평가', html: scalesHtml });

  const qualHtml = renderQualItems(r);
  if (qualHtml) steps.push({ label: '정성 코멘트', html: qualHtml });

  const qaHtml = renderQA(r.qa_result);
  if (qaHtml) steps.push({ label: 'QA 검증', html: qaHtml });

  return `<div class="persona-card" id="pc-ind-${idx}">
    <div class="persona-card-header" onclick="toggleCard('ind-${idx}')">
      <span class="emoji">${emoji}</span>
      <span class="name">${esc(r.persona_name)}</span>
      <span class="score-badge ${cls}">${score}/5</span>
      <span class="rec-text">${esc(r.recommendation)}</span>
      ${r.qa_result && r.qa_result.qa_mode !== 'off' ? `<span class="qa-badge ${r.qa_result.qa_passed ? 'pass' : 'fail'}">${r.qa_result.qa_passed ? 'QA PASS' : 'QA FAIL'}</span>` : ''}
      <span class="chevron">▶</span>
    </div>
    <div class="persona-card-body">
      ${r.error ? `<div style="color:#d63031;margin-bottom:10px">오류: ${esc(r.error)}</div>` : ''}
      ${buildStepTrack(steps, true)}
      <button class="raw-toggle" onclick="toggleRaw('ind-${idx}')">Raw Response 보기</button>
      <pre class="raw-content" id="raw-ind-${idx}">${esc(r.raw_response)}</pre>
    </div>
  </div>`;
}

function renderRecDist(dist) {
  if (!dist || !Object.keys(dist).length) return '';
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const emojiMap = { '매우 관심 있음': '🟢', '다소 관심 있음': '🔵', '보통': '🟡', '관심 없음': '🟠', '전혀 관심 없음': '🔴' };
  let html = '<div class="rec-dist">';
  for (const [rec, count] of Object.entries(dist)) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const emoji = emojiMap[rec] || '⚪';
    html += `<span class="rec-dist-item">${emoji} ${esc(rec)} ${count}명(${pct}%)</span>`;
  }
  html += '</div>';
  return html;
}

function renderPersonaSummaryCard(summary, idx) {
  const appealScore = summary.avg_appeal || 0;
  const appealCls = appealScore >= 4 ? 'high' : appealScore >= 3 ? 'mid' : 'low';
  const topRec = Object.keys(summary.recommendation_distribution || {}).reduce((a, b) =>
    (summary.recommendation_distribution[a] || 0) >= (summary.recommendation_distribution[b] || 0) ? a : b, '보통');
  const emoji = recEmoji(topRec);

  const steps = [];

  const qualFields = [
    { key: 'overall_impression', label: '종합 첫인상' },
    { key: 'emotional_response', label: '감정적 반응' },
    { key: 'perceived_message', label: '지각된 메시지' },
    { key: 'brand_association', label: '브랜드 연상' },
    { key: 'key_positives', label: '공통 긍정 요소' },
    { key: 'key_concerns', label: '공통 우려 사항' },
    { key: 'competitive_comparison', label: '경쟁 대안 비교' },
    { key: 'information_gap', label: '정보 부족 사항' },
    { key: 'purchase_trigger', label: '구매 촉진 요소' },
    { key: 'purchase_barrier', label: '구매 장벽' },
    { key: 'price_perception', label: '가격 인식' },
    { key: 'review_summary', label: '종합 평가' },
  ];
  let qualHtml = '';
  for (const f of qualFields) {
    const val = summary[f.key];
    if (val) qualHtml += `<div class="qual-item"><div class="qual-label">${f.label}</div><div class="qual-text">${renderSynValue(val)}</div></div>`;
  }
  if (qualHtml) {
    steps.push({ label: '정성 요약', html: `<div class="qual-section"><div class="qual-grid">${qualHtml}</div></div>` });
  }

  const avgScales = renderAvgScaleBars(summary);
  if (avgScales) steps.push({ label: '평균 정량 평가', html: avgScales });

  const distHtml = renderRecDist(summary.recommendation_distribution);
  if (distHtml) steps.push({ label: '추천 분포', html: distHtml });

  const panelReviews = summary.panel_reviews || [];
  let drillHtml = '';
  if (panelReviews.length) {
    const CHANNEL_LABELS = { overall: '공통', upper: '브랜드 인지도', mid: '고객 획득', lower: '전환 및 매출' };
    drillHtml = `
      <div class="drill-down-header" id="drill-header-${summary.persona_id}" onclick="toggleDrillDown('${summary.persona_id}')">
        📋 개별 패널 리뷰 (${panelReviews.length}건) ▶
      </div>
      <div class="drill-down-body" id="drill-${summary.persona_id}">
        ${panelReviews.map((pr, pi) => {
          const prScore = pr.appeal || 0;
          const prCls = prScore >= 4 ? 'high' : prScore >= 3 ? 'mid' : 'low';
          const prEmoji = recEmoji(pr.recommendation || '');

          // Build per-channel qual summary
          let channelHtml = '';
          for (const chKey of ['overall', 'upper', 'mid', 'lower']) {
            const funnel = window.funnelConfig?.[chKey];
            if (!funnel) continue;
            const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
            const rows = qualItems.map(item => ({ label: item.label, val: pr[item.key] })).filter(x => x.val);
            if (!rows.length) continue;
            channelHtml += `<div class="psc-channel">
              <div class="psc-channel-label">${esc(CHANNEL_LABELS[chKey] || chKey)}</div>
              <div class="psc-channel-items">
                ${rows.map(row => `<div class="psc-qual-row"><span class="psc-qual-key">${esc(row.label)}</span><span class="psc-qual-val">${esc(String(row.val))}</span></div>`).join('')}
              </div>
            </div>`;
          }

          return `<div class="panel-sub-card">
            <div class="panel-sub-header">
              <span class="emoji">${prEmoji}</span>
              <span class="panel-sub-id">${esc(pr.panel_id || `#${pi+1}`)}</span>
              <span class="score-badge ${prCls}">${prScore}/5</span>
              <span class="rec-text">${esc(pr.recommendation || '')}</span>
            </div>
            ${pr.emotional_response ? `<div class="panel-sub-comment">"${esc(pr.emotional_response)}"</div>` : ''}
            ${channelHtml ? `<div class="psc-channels">${channelHtml}</div>` : (pr.review_summary ? `<div class="panel-sub-summary">${esc(pr.review_summary)}</div>` : '')}
          </div>`;
        }).join('')}
      </div>`;
  }

  const appealDisplay = typeof appealScore === 'number' && !Number.isInteger(appealScore) ? appealScore.toFixed(1) : appealScore;
  return `<div class="persona-card" id="pc-sum-${idx}">
    <div class="persona-card-header" onclick="toggleCard('sum-${idx}')">
      <span class="emoji">${emoji}</span>
      <span class="name">${esc(summary.persona_name)}</span>
      <span class="panel-count-badge">${summary.panel_count}패널</span>
      <span class="score-badge ${appealCls}">${appealDisplay}/5</span>
      <span class="rec-text">${esc(topRec)}</span>
      <span class="chevron">▶</span>
    </div>
    <div class="persona-card-body">
      ${buildStepTrack(steps, true)}
      ${drillHtml}
    </div>
  </div>`;
}

export function renderIndividualTab(personaSummaries) {
  if (!personaSummaries || !personaSummaries.length) {
    document.getElementById('tab-individual').innerHTML = '<p>데이터가 없습니다.</p>';
    return;
  }

  let html = `<h2 style="font-size:1.15rem;margin-bottom:14px">🧑‍🤝‍🧑 페르소나별 종합 리뷰 (${personaSummaries.length}개 페르소나)</h2>`;
  html += `<div class="persona-cards">`;
  html += [...personaSummaries]
    .sort((a, b) => (b.avg_appeal || 0) - (a.avg_appeal || 0))
    .map((s, i) => renderPersonaSummaryCard(s, i))
    .join('');
  html += `</div>`;
  document.getElementById('tab-individual').innerHTML = html;
}
