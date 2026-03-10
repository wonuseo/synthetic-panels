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
    <strong>목적</strong> — 같은 질문을 다른 형식으로 반복했을 때 점수 차이가 없는지(일관성), 페르소나 속성에 맞는 편향을 보이는지(트랩) 확인. 품질 70% 미만은 QA FAIL.
  </div>

  <div class="qa-mode-grid">
    <div class="qa-mode-card qa-mode-lite">
      <div class="qa-mode-badge qa-mode-badge--lite">Lite</div>
      <div class="qa-mode-card-title">기본 QA</div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">일관성 검증 (Replication) × 1</div>
        <ul class="qa-mode-list">
          <li>
            <div class="qa-field-row">
              <span class="qa-field-human">브랜드 호감도 재측정</span>
              <code>qa_rep_brand_attitude</code>
            </div>
            <div class="qa-field-qa-q">QA 질문: "이 프로모션에 대한 전반적인 호감도" (1–5)</div>
            <div class="qa-field-orig-q">본 설문 질문 (<code>brand_favorability</code>): "이 브랜드/프로모션에 대한 호감도 (1=매우 비호감 ~ 5=매우 호감)"</div>
            <div class="qa-field-compare">→ 두 질문은 동일한 개념(브랜드 호감도)을 다른 문구로 물음. 점수 차이가 1 이상이면 일관성 감점.</div>
          </li>
        </ul>
      </div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">트랩 항목 (Trap) × 1</div>
        <ul class="qa-mode-list">
          <li>
            <div class="qa-field-row">
              <span class="qa-field-human">예산 민감도</span>
              <code>qa_trap_budget_sensitivity</code>
            </div>
            <div class="qa-field-qa-q">질문: "가격이 나의 예산에 부담이 된다" (1=전혀 부담 없음 ~ 5=매우 부담)</div>
            <div class="qa-field-compare">→ 페르소나 지출 성향(고지출형 → 낮은 점수 기대 / 절약형 → 높은 점수 기대)으로 예측한 기대 범위 밖이면 페르소나 불일치 판정.</div>
          </li>
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
          <li>
            <div class="qa-field-row"><span class="qa-field-human">브랜드 호감도 재측정</span><code>qa_rep_brand_attitude</code></div>
            <div class="qa-field-qa-q">QA 질문: "이 프로모션에 대한 전반적인 호감도" (1–5)</div>
            <div class="qa-field-orig-q">본 설문 (<code>brand_favorability</code>): "이 브랜드/프로모션에 대한 호감도 (1=매우 비호감 ~ 5=매우 호감)"</div>
          </li>
          <li>
            <div class="qa-field-row"><span class="qa-field-human">가치 인식 재측정</span><code>qa_rep_value_perception</code></div>
            <div class="qa-field-qa-q">QA 질문: "이 프로모션의 가격 대비 만족도" (1–5)</div>
            <div class="qa-field-orig-q">본 설문 (<code>value_for_money</code>): "가격 대비 가치가 있는 정도 (1=전혀 ~ 5=매우)"</div>
          </li>
          <li>
            <div class="qa-field-row"><span class="qa-field-human">구매 의향 재측정</span><code>qa_rep_purchase_intent</code></div>
            <div class="qa-field-qa-q">QA 질문: "이 프로모션을 실제로 이용할 가능성" (1–5)</div>
            <div class="qa-field-orig-q">본 설문 (<code>purchase_likelihood</code>): "이 프로모션을 구매할 가능성 (1=전혀 ~ 5=매우 높음)"</div>
          </li>
        </ul>
        <div class="qa-field-compare" style="margin-top:6px">→ 재측정값과 본 응답값의 차이를 1 − diff/4로 정규화. 차이가 없으면 1.0, 4점 차이면 0.0.</div>
      </div>
      <div class="qa-mode-section">
        <div class="qa-mode-section-label">트랩 항목 (Trap) × 3</div>
        <ul class="qa-mode-list">
          <li>
            <div class="qa-field-row"><span class="qa-field-human">예산 민감도</span><code>qa_trap_budget_sensitivity</code></div>
            <div class="qa-field-qa-q">질문: "가격이 나의 예산에 부담이 된다" (1–5)</div>
            <div class="qa-field-compare">→ 지출 성향(고지출형: 1–2 기대 / 절약형: 4–5 기대) 기반 범위 이탈 시 실패.</div>
          </li>
          <li>
            <div class="qa-field-row"><span class="qa-field-human">경쟁사 충성도</span><code>qa_trap_competitor_loyalty</code></div>
            <div class="qa-field-qa-q">질문: "경쟁 브랜드보다 이 프로모션이 더 매력적이다" (1–5)</div>
            <div class="qa-field-compare">→ 경쟁 브랜드 강한 선호 페르소나는 낮은 점수가 기대됨. 반대면 페르소나 불일치.</div>
          </li>
          <li>
            <div class="qa-field-row"><span class="qa-field-human">회의주의 수준</span><code>qa_trap_skepticism_check</code></div>
            <div class="qa-field-qa-q">질문: "이 프로모션의 혜택이 과장되지 않고 신뢰할 수 있다" (1–5)</div>
            <div class="qa-field-compare">→ 회의주의 높은 페르소나는 낮은 점수가 기대됨. 높은 점수면 페르소나 불일치.</div>
          </li>
        </ul>
      </div>
      <div class="qa-mode-formula">품질 점수 = 일관성(50%) + 트랩 통과율(50%) · 합격 기준 ≥ 70%</div>
    </div>
  </div>

  <div class="qa-score-legend">
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot good"></span>
      <span><strong>일관성 점수</strong> — 재측정값과 본 응답값의 차이를 1 − diff/4로 정규화. 점수 차이가 없으면 1.0.</span>
    </div>
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot warn"></span>
      <span><strong>트랩 통과율</strong> — 페르소나 속성에서 도출한 예상 범위 내 응답 비율. 범위 이탈 = 페르소나 불일치.</span>
    </div>
    <div class="qa-score-legend-item">
      <span class="qa-score-legend-dot bad"></span>
      <span><strong>QA FAIL</strong> — 품질 점수 70% 미만. 해당 응답은 분석 집계 제외 권고.</span>
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

    // ── 페르소나별 그룹 ──
    const personaMap = new Map();
    withQA.forEach(r => {
      if (!personaMap.has(r.persona_name)) personaMap.set(r.persona_name, []);
      personaMap.get(r.persona_name).push(r);
    });

    html += `<h3 style="font-size:1.05rem;margin:28px 0 14px">🧑‍🤝‍🧑 페르소나별 QA 결과</h3>`;

    let pgIdx = 0;
    for (const [personaName, panels] of personaMap) {
      const avgC = avg(panels.map(r => r.qa_result.consistency_score || 0));
      const avgT = avg(panels.map(r => r.qa_result.trap_pass_rate || 0));
      const avgQ = avg(panels.map(r => r.qa_result.persona_quality || 0));
      const passN = panels.filter(r => r.qa_result.qa_passed).length;
      const mode = panels[0].qa_result.qa_mode;
      const pgId = `qa-pg-${pgIdx}`;

      html += `<div class="qa-persona-group">`;

      // 페르소나 요약 (항상 표시)
      html += `<div class="qa-persona-summary">
        <div class="qa-persona-summary-left">
          <span class="qa-persona-summary-name">${esc(personaName)}</span>
          <span class="qa-mode-badge qa-mode-badge--${mode}">${mode === 'full' ? 'Full' : 'Lite'}</span>
        </div>
        <div class="qa-summary" style="margin-top:10px">
          <div class="qa-score-card"><div class="qa-s-label">평균 일관성</div><div class="qa-s-value ${qCls(avgC)}">${(avgC * 100).toFixed(0)}%</div></div>
          <div class="qa-score-card"><div class="qa-s-label">트랩 통과율</div><div class="qa-s-value ${qCls(avgT)}">${(avgT * 100).toFixed(0)}%</div></div>
          <div class="qa-score-card"><div class="qa-s-label">페르소나 품질</div><div class="qa-s-value ${qCls(avgQ)}">${(avgQ * 100).toFixed(0)}%</div></div>
          <div class="qa-score-card"><div class="qa-s-label">PASS / 전체</div><div class="qa-s-value ${passN === panels.length ? 'good' : 'warn'}">${passN} / ${panels.length}</div></div>
        </div>
      </div>`;

      // 개별 패널 리뷰 (collapsible)
      html += `<div class="persona-card" id="pc-${pgId}">
        <div class="persona-card-header" onclick="toggleCard('${pgId}')">
          <span>📋 개별 패널 리뷰 (${panels.length}건)</span>
          <span class="chevron">▶</span>
        </div>
        <div class="persona-card-body"><div class="persona-cards">`;

      panels.forEach((r, i) => {
        const cardId = `qa-${pgIdx}-${i}`;
        const panelNum = r.panel_id ? String(r.panel_id).split('-').pop() : String(i + 1).padStart(2, '0');
        html += `<div class="persona-card" id="pc-${cardId}">
          <div class="persona-card-header" onclick="toggleCard('${cardId}')">
            <span class="name">#${panelNum}</span>
            <span class="qa-badge ${r.qa_result.qa_passed ? 'pass' : 'fail'}">${r.qa_result.qa_passed ? 'QA PASS' : 'QA FAIL'}</span>
            <span class="qa-panel-quality">품질 ${(r.qa_result.persona_quality * 100).toFixed(0)}%</span>
            <span class="chevron">▶</span>
          </div>
          <div class="persona-card-body">${renderQA(r.qa_result)}</div>
        </div>`;
      });

      html += `</div></div></div>`; // persona-cards, persona-card-body, persona-card
      html += `</div>`; // qa-persona-group

      pgIdx++;
    }
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
