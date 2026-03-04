import { esc, scaleBar, recEmoji, renderQA, buildStepTrack, _scaleCls } from './helpers.js';

function renderScaleBars(r) {
  if (!window.funnelConfig) return '';
  let html = '<div class="scale-section"><h5>📊 정량 평가</h5><div class="scale-grid">';
  let clsIdx = 0;
  for (const [, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) { clsIdx++; continue; }
    const cls = _scaleCls[clsIdx % _scaleCls.length];
    const scaleLabel = quantItems[0].scale || '1-7';
    html += `<div class="scale-group"><h6>${esc(funnel.label.split('(')[0].trim())} (${scaleLabel})</h6>`;
    for (const item of quantItems) {
      const val = r[item.key];
      if (val == null) continue;
      const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
      html += scaleBar(item.label, val, max, cls);
    }
    html += '</div>';
    clsIdx++;
  }
  html += '</div></div>';
  return html;
}

function renderAvgScaleBars(summary) {
  if (!window.funnelConfig) return '';
  // Map avg_ fields to flat obj for scaleBar
  const fakeR = {};
  if (window.funnelConfig) {
    for (const [, funnel] of Object.entries(window.funnelConfig)) {
      for (const item of funnel.individual_items.filter(i => i.type === 'quantitative')) {
        fakeR[item.key] = summary['avg_' + item.key];
      }
    }
  }

  let html = '<div class="scale-section"><h5>📊 평균 정량 평가</h5><div class="scale-grid">';
  let clsIdx = 0;
  for (const [, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) { clsIdx++; continue; }
    const cls = _scaleCls[clsIdx % _scaleCls.length];
    const scaleLabel = quantItems[0].scale || '1-7';
    html += `<div class="scale-group"><h6>${esc(funnel.label.split('(')[0].trim())} (${scaleLabel})</h6>`;
    for (const item of quantItems) {
      const val = fakeR[item.key];
      if (val == null || val === 0) continue;
      const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
      const displayVal = typeof val === 'number' ? val.toFixed(1) : val;
      const pct = max > 0 ? (val / max) * 100 : 0;
      html += `<div class="scale-item">
        <span class="scale-label">${item.label}</span>
        <div class="scale-bar"><div class="scale-fill ${cls}" style="width:${pct}%"></div></div>
        <span class="scale-val">${displayVal}/${max}</span>
      </div>`;
    }
    html += '</div>';
    clsIdx++;
  }
  html += '</div></div>';
  return html;
}

function renderQualItems(r) {
  if (!window.funnelConfig) return '';
  let items = '';
  for (const [, funnel] of Object.entries(window.funnelConfig)) {
    const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
    for (const item of qualItems) {
      const val = r[item.key];
      if (!val) continue;
      items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${esc(val)}</div></div>`;
    }
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

export function renderPersonaCard(r, idx) {
  const emoji = recEmoji(r.recommendation);
  const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns = (r.key_concerns || '').split('; ').filter(Boolean);

  const steps = [];

  if (r.first_impression) {
    steps.push({ label: '첫인상', html: `<div class="impression">"${esc(r.first_impression)}"</div>` });
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

  if (r.review_summary) {
    steps.push({ label: '종합 평가', html: `<div class="review-summary">${esc(r.review_summary)}</div>` });
  }

  return `<div class="persona-card" id="pc-ind-${idx}">
    <div class="persona-card-header" onclick="toggleCard('ind-${idx}')">
      <span class="emoji">${emoji}</span>
      <span class="name">${esc(r.persona_name)}</span>
      <span class="score-badge ${cls}">${r.appeal_score}/10</span>
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
  const appealCls = summary.avg_appeal_score >= 7 ? 'high' : summary.avg_appeal_score >= 4 ? 'mid' : 'low';
  const topRec = Object.keys(summary.recommendation_distribution || {}).reduce((a, b) =>
    (summary.recommendation_distribution[a] || 0) >= (summary.recommendation_distribution[b] || 0) ? a : b, '보통');
  const emoji = recEmoji(topRec);

  const steps = [];

  // 정성 요약
  const qualFields = [
    { key: 'first_impression', label: '대표 첫인상' },
    { key: 'key_positives', label: '공통 긍정 요소' },
    { key: 'key_concerns', label: '공통 우려 사항' },
    { key: 'perceived_message', label: '지각된 메시지' },
    { key: 'emotional_response', label: '감정 반응' },
    { key: 'purchase_trigger_barrier', label: '구매 촉진/장벽' },
    { key: 'recommendation_context', label: '추천 맥락' },
    { key: 'competitive_preference', label: '경쟁 비교' },
    { key: 'review_summary', label: '종합 평가' },
  ];
  let qualHtml = '';
  for (const f of qualFields) {
    const val = summary[f.key];
    if (val) qualHtml += `<div class="qual-item"><div class="qual-label">${f.label}</div><div class="qual-text">${esc(val)}</div></div>`;
  }
  if (qualHtml) {
    steps.push({ label: '정성 요약', html: `<div class="qual-section"><div class="qual-grid">${qualHtml}</div></div>` });
  }

  // 평균 정량 스케일바
  const avgScales = renderAvgScaleBars(summary);
  if (avgScales) steps.push({ label: '평균 정량 평가', html: avgScales });

  // 추천 분포
  const distHtml = renderRecDist(summary.recommendation_distribution);
  if (distHtml) steps.push({ label: '추천 분포', html: distHtml });

  // 드릴다운: 개별 패널 리뷰
  const panelReviews = summary.panel_reviews || [];
  let drillHtml = '';
  if (panelReviews.length) {
    drillHtml = `
      <div class="drill-down-header" id="drill-header-${summary.persona_id}" onclick="toggleDrillDown('${summary.persona_id}')">
        📋 개별 패널 리뷰 (${panelReviews.length}건) ▶
      </div>
      <div class="drill-down-body" id="drill-${summary.persona_id}">
        ${panelReviews.map((pr, pi) => {
          const prCls = (pr.appeal_score || 0) >= 7 ? 'high' : (pr.appeal_score || 0) >= 4 ? 'mid' : 'low';
          const prEmoji = recEmoji(pr.recommendation || '');
          return `<div class="panel-sub-card">
            <div class="panel-sub-header">
              <span class="emoji">${prEmoji}</span>
              <span class="panel-sub-id">${esc(pr.panel_id || `#${pi+1}`)}</span>
              <span class="score-badge ${prCls}">${pr.appeal_score || 0}/10</span>
              <span class="rec-text">${esc(pr.recommendation || '')}</span>
            </div>
            ${pr.first_impression ? `<div class="panel-sub-comment">"${esc(pr.first_impression)}"</div>` : ''}
            ${pr.review_summary ? `<div class="panel-sub-summary">${esc(pr.review_summary)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  return `<div class="persona-card" id="pc-sum-${idx}">
    <div class="persona-card-header" onclick="toggleCard('sum-${idx}')">
      <span class="emoji">${emoji}</span>
      <span class="name">${esc(summary.persona_name)}</span>
      <span class="panel-count-badge">${summary.panel_count}패널</span>
      <span class="score-badge ${appealCls}">${summary.avg_appeal_score.toFixed(1)}/10</span>
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
    .sort((a, b) => (b.avg_appeal_score || 0) - (a.avg_appeal_score || 0))
    .map((s, i) => renderPersonaSummaryCard(s, i))
    .join('');
  html += `</div>`;
  document.getElementById('tab-individual').innerHTML = html;
}
