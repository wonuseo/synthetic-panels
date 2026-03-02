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

  // Build steps: 첫인상 → 반응 분석 → 정량 평가 → 정성 코멘트 → QA → 종합 평가
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

export function renderIndividualTab(reviews) {
  let html = `<h2 style="font-size:1.15rem;margin-bottom:14px">🧑‍🤝‍🧑 개별 페르소나 리뷰</h2>`;
  html += `<div class="persona-cards">`;
  html += [...reviews].sort((a, b) => b.appeal_score - a.appeal_score).map((r, i) => renderPersonaCard(r, i)).join('');
  html += `</div>`;
  document.getElementById('tab-individual').innerHTML = html;
}
