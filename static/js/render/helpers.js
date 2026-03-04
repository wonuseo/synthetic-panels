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
  const display = typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value;
  return `<div class="scale-item">
    <span class="scale-label">${label}</span>
    <div class="scale-bar"><div class="scale-fill ${cls}" style="width:${pct}%"></div></div>
    <span class="scale-val">${display}/${max}</span>
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

function prettyKeyLabel(key) {
  const k = String(key || '').trim().toLowerCase();
  const map = {
    pos: '강점',
    positive: '강점',
    positives: '강점',
    pros: '강점',
    strength: '강점',
    strengths: '강점',
    neg: '우려',
    negative: '우려',
    negatives: '우려',
    concern: '우려',
    concerns: '우려',
    cons: '우려',
    risk: '리스크',
    risks: '리스크',
    weakness: '약점',
    weaknesses: '약점',
    upper: '브랜드 자산',
    mid: '수요 창출',
    lower: '전환·매출',
  };
  if (map[k]) return map[k];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function parseIfJsonLike(val) {
  if (typeof val !== 'string') return val;
  const t = val.trim();
  if (!((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')))) {
    return val;
  }
  try {
    return JSON.parse(t);
  } catch {
    return val;
  }
}

function splitTextList(value) {
  const s = String(value || '').trim();
  if (!s) return [];
  if (s.includes(';')) return s.split(/\s*;\s*/).filter(Boolean);
  if (s.includes('\n')) return s.split(/\n+/).map(v => v.trim()).filter(Boolean);
  return [s];
}

function parseLooseKeyValueText(text) {
  const s = String(text || '').trim();
  if (!s) return [];
  const parts = s.split(/\s*[;,]\s*/).filter(Boolean);
  const rows = [];
  for (const part of parts) {
    const m = part.match(/^([a-zA-Z_]+)\s*[:=]\s*(.+)$/);
    if (!m) continue;
    rows.push({ key: m[1], value: m[2] });
  }
  return rows.length >= 2 ? rows : [];
}

function renderDistBars(rows) {
  const max = Math.max(...rows.map(r => r.value), 0) || 1;
  return `<div class="sq-dist">${
    rows.map(r => {
      const pct = Math.max(0, Math.min(100, (r.value / max) * 100));
      return `<div class="sq-dist-row">
        <span class="sq-dist-label">${esc(r.label)}</span>
        <div class="sq-dist-track"><div class="sq-dist-fill" style="width:${pct}%"></div></div>
        <span class="sq-dist-val">${r.value}</span>
      </div>`;
    }).join('')
  }</div>`;
}

export function renderSynValue(val) {
  const parsed = parseIfJsonLike(val);

  if (Array.isArray(parsed)) {
    if (!parsed.length) return '';

    // [{label, count}] 형태 분포 데이터는 미니 바차트로 표시
    if (parsed.every(x => x && typeof x === 'object' && x.label != null && Number.isFinite(Number(x.count)))) {
      return renderDistBars(parsed.map(x => ({
        label: String(x.label),
        value: Number(x.count),
      })));
    }

    // ["...", "..."] 목록은 가독성 높은 불릿으로 표시
    if (parsed.every(x => typeof x === 'string' || typeof x === 'number')) {
      return `<ul class="sq-list">${parsed.map(x => `<li>${esc(String(x))}</li>`).join('')}</ul>`;
    }

    return `<ul class="sq-list">${parsed.map(x => `<li>${esc(typeof x === 'object' ? JSON.stringify(x) : String(x))}</li>`).join('')}</ul>`;
  }

  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed);
    if (!entries.length) return '';

    // {pos: 3, neg: 1} 같이 숫자형 객체는 그래프로 표시
    if (entries.every(([, v]) => Number.isFinite(Number(v)))) {
      return renderDistBars(entries.map(([k, v]) => ({
        label: prettyKeyLabel(k),
        value: Number(v),
      })));
    }

    // {pos:[...], neg:[...]} 같은 구조는 키 라벨을 변환해 섹션형으로 표시
    let html = '<div class="sq-kv">';
    for (const [k, rawV] of entries) {
      const v = parseIfJsonLike(rawV);
      let rendered = '';
      if (Array.isArray(v)) {
        rendered = `<ul class="sq-list">${v.map(x => `<li>${esc(String(x))}</li>`).join('')}</ul>`;
      } else if (typeof v === 'string') {
        const parts = splitTextList(v);
        rendered = parts.length > 1
          ? `<ul class="sq-list">${parts.map(x => `<li>${esc(String(x))}</li>`).join('')}</ul>`
          : `<div class="sq-text">${esc(v)}</div>`;
      } else if (v && typeof v === 'object') {
        rendered = renderSynValue(v);
      } else {
        rendered = `<div class="sq-text">${esc(String(v))}</div>`;
      }
      html += `<div class="sq-kv-row"><div class="sq-kv-key">${esc(prettyKeyLabel(k))}</div><div class="sq-kv-val">${rendered}</div></div>`;
    }
    html += '</div>';
    return html;
  }

  if (typeof parsed === 'string') {
    const loose = parseLooseKeyValueText(parsed);
    if (loose.length) {
      return `<div class="sq-kv">${
        loose.map(row => `<div class="sq-kv-row"><div class="sq-kv-key">${esc(prettyKeyLabel(row.key))}</div><div class="sq-kv-val"><div class="sq-text">${esc(row.value)}</div></div></div>`).join('')
      }</div>`;
    }
  }

  return `<div class="sq-text">${esc(String(parsed))}</div>`;
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
