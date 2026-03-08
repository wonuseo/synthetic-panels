import { esc, renderQA } from './helpers.js';

/* ── QA 설명 섹션 ── */
function renderQAExplainer() {
  return `
<div class="qa-explainer">
  <div class="qa-explainer-header">
    <div class="qa-explainer-icon">🔍</div>
    <div>
      <div class="qa-explainer-title">Quality Assurance (QA)</div>
      <div class="qa-explainer-subtitle">LLM이 동일 페르소나에 대해 일관되고 페르소나에 부합하는 응답을 하는지 수치로 검증합니다.</div>
    </div>
  </div>

  <div class="qa-explainer-purpose">
    <strong>목적 — LLM 응답 일관성 확보</strong>
    <p>같은 개념을 다르게 표현한 질문에도 일관된 점수를 매기는지(일관성 검증), 페르소나의 속성(예산·경쟁사 선호·회의주의)에 맞는 응답을 하는지(트랩 검증)를 확인합니다. QA 점수가 <strong>70% 미만</strong>인 응답은 페르소나가 충실하게 시뮬레이션되지 않은 것으로 판단해 <strong>QA FAIL</strong>로 표기됩니다.</p>
  </div>

  <div class="qa-mode-grid">
    <div class="qa-mode-card qa-mode-lite">
      <div class="qa-mode-badge qa-mode-badge--lite">Lite</div>
      <div class="qa-mode-card-title">기본 QA</div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">일관성 검증 (Replication) × 1</div>
        <ul class="qa-mode-list">
          <li><code>qa_rep_brand_attitude</code> ↔ <code>brand_favorability</code><br><span class="qa-mode-note">브랜드 호감도를 다른 질문 형식으로 재측정해 점수 차이 확인</span></li>
        </ul>
      </div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">트랩 항목 (Trap) × 1</div>
        <ul class="qa-mode-list">
          <li><code>qa_trap_budget_sensitivity</code><br><span class="qa-mode-note">페르소나의 지출 성향에 맞는 예산 민감도를 응답하는지 확인</span></li>
        </ul>
      </div>
      <div class="qa-mode-formula">품질 점수 = 일관성(50%) + 트랩 통과율(50%) · 합격 기준 ≥ 70%</div>
    </div>

    <div class="qa-mode-card qa-mode-full">
      <div class="qa-mode-badge qa-mode-badge--full">Full</div>
      <div class="qa-mode-card-title">전체 QA</div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">일관성 검증 (Replication) × 3</div>
        <ul class="qa-mode-list">
          <li><code>qa_rep_brand_attitude</code> ↔ <code>brand_favorability</code></li>
          <li><code>qa_rep_value_perception</code> ↔ <code>value_for_money</code></li>
          <li><code>qa_rep_purchase_intent</code> ↔ <code>purchase_likelihood</code></li>
        </ul>
      </div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">트랩 항목 (Trap) × 3</div>
        <ul class="qa-mode-list">
          <li><code>qa_trap_budget_sensitivity</code> — 지출 성향 검증</li>
          <li><code>qa_trap_competitor_loyalty</code> — 경쟁사 선호 검증</li>
          <li><code>qa_trap_skepticism_check</code> — 회의주의 성향 검증</li>
        </ul>
      </div>
      <div class="qa-mode-formula">품질 점수 = 일관성(50%) + 트랩 통과율(50%) · 합격 기준 ≥ 70%</div>
    </div>
  </div>

  <div class="qa-score-legend">
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot good"></span>
      <span><strong>일관성 점수</strong> — 재확인 항목과 핵심 항목의 차이(0~4)를 1 − diff/4로 정규화. 차이가 없으면 1.0, 클수록 낮아짐.</span>
    </div>
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot warn"></span>
      <span><strong>트랩 통과율</strong> — 페르소나 속성에서 도출한 예상 범위 내 응답 비율. 범위를 벗어나면 페르소나와 응답이 불일치함을 의미.</span>
    </div>
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot bad"></span>
      <span><strong>QA FAIL 기준</strong> — 품질 점수 70% 미만. 해당 응답은 참고용으로만 활용하고 분석 집계에서 제외를 권고.</span>
    </div>
  </div>
</div>`;
}

export function renderQATab(reviews) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error);
  const withQA = valid.filter(r => r.qa_result && r.qa_result.qa_mode !== 'off');
  let html = renderQAExplainer();

  if (withQA.length) {
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const qCls = v => v >= 0.7 ? 'good' : v >= 0.5 ? 'warn' : 'bad';
    const avgConsistency = avg(withQA.map(r => r.qa_result.consistency_score || 0));
    const avgTrap = avg(withQA.map(r => r.qa_result.trap_pass_rate || 0));
    const avgQuality = avg(withQA.map(r => r.qa_result.persona_quality || 0));
    const passCount = withQA.filter(r => r.qa_result.qa_passed).length;

    html += `<div class="synthesis"><h3>🔍 QA 통합 현황</h3><div class="qa-summary" style="margin-top:14px">`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 일관성</div><div class="qa-s-value ${qCls(avgConsistency)}">${(avgConsistency * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 트랩 통과율</div><div class="qa-s-value ${qCls(avgTrap)}">${(avgTrap * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 페르소나 품질</div><div class="qa-s-value ${qCls(avgQuality)}">${(avgQuality * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">PASS / 전체</div><div class="qa-s-value ${passCount === withQA.length ? 'good' : 'warn'}">${passCount} / ${withQA.length}</div></div>`;
    html += `</div>`;

    if (window.funnelConfig) {
      html += `<div class="qa-detail" style="margin-top:16px">`;
      for (const [, funnel] of Object.entries(window.funnelConfig)) {
        if (!funnel.qa_items.length) continue;
        html += `<div class="qa-detail-group"><h6>${esc(funnel.label.split('(')[0].trim())} QA</h6>`;
        for (const qaItem of funnel.qa_items) {
          const vals = withQA.map(r => r.qa_result[qaItem.key] || r[qaItem.key]).filter(v => v != null && v > 0);
          const avgVal = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '-';
          const typeLabel = qaItem.type === 'replication' ? '(일관성)' : '(트랩)';
          html += `<div class="qa-pair"><span class="qp-label">${esc(qaItem.key)} ${typeLabel}</span><span class="qp-val">${avgVal}</span></div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    html += `<h3 style="font-size:1.05rem;margin:20px 0 12px">🧑‍🤝‍🧑 개별 QA 결과</h3><div class="persona-cards">`;
    withQA.forEach((r, i) => {
      const idx = `qa-${i}`;
      html += `<div class="persona-card" id="pc-${idx}">
        <div class="persona-card-header" onclick="toggleCard('${idx}')">
          <span class="name">${esc(r.persona_name)}</span>
          <span class="qa-badge ${r.qa_result.qa_passed ? 'pass' : 'fail'}">${r.qa_result.qa_passed ? 'QA PASS' : 'QA FAIL'}</span>
          <span class="chevron">▶</span>
        </div>
        <div class="persona-card-body">${renderQA(r.qa_result)}</div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<p style="color:#636e72">QA 데이터가 없습니다 (QA mode가 off이거나 유효 응답이 없습니다).</p>`;
  }

  if (errors.length) {
    html += `<h3 style="font-size:1.05rem;margin:24px 0 12px;color:#d63031">⚠️ 오류 목록 (${errors.length}건)</h3>`;
    html += `<div class="persona-cards">`;
    errors.forEach(r => {
      html += `<div class="persona-card" style="border-left:4px solid #d63031">
        <div class="persona-card-header">
          <span class="emoji">🔴</span>
          <span class="name">${esc(r.persona_name)}</span>
          <span style="color:#d63031;font-size:.85rem">${esc(r.error)}</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  document.getElementById('tab-qa').innerHTML = html;
}
