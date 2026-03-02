export const _scaleCls = ['ba', 'pv', 'bf', 'ae', 'is', 'pi', 'pp'];
export const _funnelClsMap = { upper: 0, mid: 1, lower: 2 };

export function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function scaleBar(label, value, max, cls) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `<div class="scale-item">
    <span class="scale-label">${label}</span>
    <div class="scale-bar"><div class="scale-fill ${cls}" style="width:${pct}%"></div></div>
    <span class="scale-val">${value}/${max}</span>
  </div>`;
}

export function recEmoji(rec) {
  const m = {
    'Strongly Interested': '🟢', 'Somewhat Interested': '🔵', 'Neutral': '🟡', 'Not Interested': '🟠', 'Strongly Not Interested': '🔴',
    '매우 관심 있음': '🟢', '다소 관심 있음': '🔵', '보통': '🟡', '관심 없음': '🟠', '전혀 관심 없음': '🔴'
  };
  return m[rec] || '⚪';
}

export function synMetric(label, value, suffix) {
  const v = value != null ? value : '-';
  return `<div class="syn-metric"><div class="syn-m-label">${label}</div><div class="syn-m-value">${v}${value != null ? suffix : ''}</div></div>`;
}

export function metricCard(label, value) {
  return `<div class="metric-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

export function renderSynValue(val) {
  if (Array.isArray(val)) {
    return `<ul style="padding-left:18px;margin-top:4px">${val.map(x => `<li>${esc(typeof x === 'object' ? JSON.stringify(x) : String(x))}</li>`).join('')}</ul>`;
  }
  if (val && typeof val === 'object') {
    let html = '<div style="margin-top:4px">';
    for (const [k, v] of Object.entries(val))
      html += `<div style="margin-bottom:4px"><span style="font-weight:600;color:#636e72">${esc(k)}:</span> ${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</div>`;
    return html + '</div>';
  }
  return `<div class="sq-text">${esc(String(val))}</div>`;
}

export function renderQA(qa) {
  if (!qa || qa.qa_mode === 'off') return '';
  const isLite = qa.qa_mode === 'lite';
  const qCls = v => v >= 0.7 ? 'good' : v >= 0.5 ? 'warn' : 'bad';

  let html = `<div class="qa-section"><h5>🔍 QA 검증 결과 (${isLite ? 'Lite' : 'Full'} Mode)</h5>`;
  html += `<div class="qa-summary">`;
  html += `<div class="qa-score-card"><div class="qa-s-label">응답 일관성</div><div class="qa-s-value ${qCls(qa.consistency_score)}">${(qa.consistency_score * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">트랩 통과율</div><div class="qa-s-value ${qCls(qa.trap_pass_rate)}">${(qa.trap_pass_rate * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">페르소나 품질</div><div class="qa-s-value ${qCls(qa.persona_quality)}">${(qa.persona_quality * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">판정</div><div class="qa-s-value ${qa.qa_passed ? 'good' : 'bad'}">${qa.qa_passed ? 'PASS' : 'FAIL'}</div></div>`;
  html += `</div><div class="qa-detail">`;
  html += `<div class="qa-detail-group"><h6>일관성 검증 (Core vs Replication)</h6>`;
  html += `<div class="qa-pair"><span class="qp-label">브랜드 호감도 (Rep)</span><span class="qp-val">${qa.qa_rep_brand_attitude || '-'}</span></div>`;
  if (!isLite) {
    html += `<div class="qa-pair"><span class="qp-label">가치 인식 (Rep)</span><span class="qp-val">${qa.qa_rep_value_perception || '-'}</span></div>`;
    html += `<div class="qa-pair"><span class="qp-label">구매 의향 (Rep)</span><span class="qp-val">${qa.qa_rep_purchase_intent || '-'}</span></div>`;
  }
  html += `</div><div class="qa-detail-group"><h6>트랩 항목 (페르소나 적합성)</h6>`;
  html += `<div class="qa-pair"><span class="qp-label">예산 민감도</span><span class="qp-val">${qa.qa_trap_budget_sensitivity || '-'}</span></div>`;
  if (!isLite) {
    html += `<div class="qa-pair"><span class="qp-label">경쟁사 충성도</span><span class="qp-val">${qa.qa_trap_competitor_loyalty || '-'}</span></div>`;
    html += `<div class="qa-pair"><span class="qp-label">회의감 체크</span><span class="qp-val">${qa.qa_trap_skepticism_check || '-'}</span></div>`;
  }
  html += `</div></div></div>`;
  return html;
}

export function hierHeader(lvl, label, title) {
  return `<div class="section-header ${lvl}"><span class="section-level ${lvl}">${label}</span><span class="section-title-text">${title}</span><div class="section-line"></div></div>`;
}

export function hierConnector(label) {
  return `<div class="level-connector"><div class="connector-line"></div><div class="connector-pill"><span class="connector-arrow-icon">▼</span>${label ? `<span class="connector-label">${label}</span>` : ''}</div></div>`;
}

/**
 * Builds an inner step-rail track within an L-layer.
 * @param {Array<{label: string, html: string}>} steps
 * @param {boolean} [compact] - use compact sizing (for inside cards)
 */
export function buildStepTrack(steps, compact = false) {
  const cls = compact ? 'step-track step-track--compact' : 'step-track';
  let out = `<div class="${cls}">`;
  steps.forEach(({ label, html }, i) => {
    const num = String(i + 1).padStart(2, '0');
    out += `<div class="step-item">
      <div class="step-rail">
        <div class="step-num">${num}</div>
        <div class="step-line"></div>
      </div>
      <div class="step-content">
        ${label ? `<div class="step-tag">${label}</div>` : ''}
        ${html}
      </div>
    </div>`;
  });
  out += '</div>';
  return out;
}
