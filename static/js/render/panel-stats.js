import { esc, hierHeader } from './helpers.js';
import { buildSurveySections, flattenSurveyFields, RECOMMENDATION_OPTIONS } from './survey-schema.js';

function toNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (raw == null) return NaN;
  const match = String(raw).match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function normalizeText(raw) {
  if (raw == null) return '';
  return String(raw).trim();
}

function clampScore(raw, min, max) {
  const parsed = toNumber(raw);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function isAnswered(field, rawValue) {
  if (field.type === 'quantitative') {
    const scale = field.scale || { min: 1, max: 5 };
    return clampScore(rawValue, scale.min, scale.max) != null;
  }
  return normalizeText(rawValue).length > 0;
}

function shortSectionLabel(raw) {
  const src = String(raw || '').trim();
  if (!src) return '공통';
  return src.replace(/^\[[^\]]+\]\s*/, '').trim() || src;
}

function sectionBadgeLabel(sectionId) {
  const key = String(sectionId || '').trim().toLowerCase();
  const map = {
    overall: 'OVERALL',
    upper: 'UPPER',
    mid: 'MID',
    lower: 'LOWER',
  };
  return map[key] || 'FUNNEL';
}

function buildQuantitativeStats(reviews, field) {
  const scale = field.scale || { min: 1, max: 5 };
  const bins = new Map();
  let answered = 0;
  let sum = 0;

  for (let score = scale.min; score <= scale.max; score += 1) {
    bins.set(score, 0);
  }

  reviews.forEach(review => {
    const score = clampScore(review[field.key], scale.min, scale.max);
    if (score == null) return;
    bins.set(score, (bins.get(score) || 0) + 1);
    answered += 1;
    sum += score;
  });

  const avg = answered ? (sum / answered) : 0;
  return { answered, avg, bins, scale };
}

function buildCategoricalStats(reviews, field) {
  const preferred = Array.isArray(field.options) && field.options.length ? field.options : RECOMMENDATION_OPTIONS;
  const counts = new Map(preferred.map(option => [option, 0]));
  let answered = 0;

  reviews.forEach(review => {
    const response = normalizeText(review[field.key]);
    if (!response) return;
    answered += 1;
    counts.set(response, (counts.get(response) || 0) + 1);
  });

  const rows = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  return { answered, rows };
}

function buildPersonaDistribution(reviews, personaSummaries) {
  const counts = new Map();
  if (reviews.length) {
    reviews.forEach(review => {
      const name = normalizeText(review.persona_name) || '미분류';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  } else {
    (personaSummaries || []).forEach(summary => {
      const name = normalizeText(summary.persona_name) || '미분류';
      const count = Number(summary.panel_count || 0);
      if (count > 0) counts.set(name, (counts.get(name) || 0) + count);
    });
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const rows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      ratio: total ? (count / total) * 100 : 0,
    }));
  return { total, rows };
}

function renderSummaryCards(totalPanels, validPanels, fieldCount, completionPct) {
  return `<div class="panel-stats-summary">
    <div class="panel-stats-card"><span>총 패널</span><strong>${totalPanels}</strong></div>
    <div class="panel-stats-card"><span>유효 응답</span><strong>${validPanels}</strong></div>
    <div class="panel-stats-card"><span>문항 수</span><strong>${fieldCount}</strong></div>
    <div class="panel-stats-card"><span>응답 완성도</span><strong>${completionPct}%</strong></div>
  </div>`;
}

function renderPersonaRows(rows) {
  if (!rows.length) return '<p class="panel-stats-empty">페르소나 분포 데이터가 없습니다.</p>';
  return `<div class="panel-persona-list">${
    rows.map(row => `<div class="panel-persona-row">
      <span class="panel-persona-name">${esc(row.label)}</span>
      <div class="panel-persona-track"><div class="panel-persona-fill" style="width:${row.ratio.toFixed(1)}%"></div></div>
      <span class="panel-persona-val">${row.count}명 (${row.ratio.toFixed(1)}%)</span>
    </div>`).join('')
  }</div>`;
}

function renderQuantitativeCard(field, questionNo, stat) {
  const rows = [];
  for (let score = stat.scale.min; score <= stat.scale.max; score += 1) {
    const count = stat.bins.get(score) || 0;
    const ratio = stat.answered ? (count / stat.answered) * 100 : 0;
    rows.push(`<div class="panel-q-row">
      <span class="panel-q-label">${score}점</span>
      <div class="panel-q-track"><div class="panel-q-fill" style="width:${ratio.toFixed(1)}%"></div></div>
      <span class="panel-q-val">${count}명 (${ratio.toFixed(1)}%)</span>
    </div>`);
  }

  return `<article class="panel-question-card">
    <div class="panel-question-head">
      <span class="panel-question-no">Q${questionNo}</span>
      <span class="panel-question-type">척도형</span>
    </div>
    <h4>${esc(field.label)}</h4>
    <p>${esc(field.question || field.label)}</p>
    <div class="panel-question-meta">
      평균 <strong>${stat.avg.toFixed(2)}</strong> / ${stat.scale.max} · 응답 ${stat.answered}명
    </div>
    <div class="panel-q-rows">${rows.join('')}</div>
  </article>`;
}

function renderCategoricalCard(field, questionNo, stat) {
  const rows = stat.rows.length ? stat.rows : (field.options || []).map(option => [option, 0]);
  const rowsHtml = rows.map(([option, count]) => {
    const ratio = stat.answered ? (count / stat.answered) * 100 : 0;
    return `<div class="panel-q-row">
      <span class="panel-q-label">${esc(option)}</span>
      <div class="panel-q-track"><div class="panel-q-fill" style="width:${ratio.toFixed(1)}%"></div></div>
      <span class="panel-q-val">${count}명 (${ratio.toFixed(1)}%)</span>
    </div>`;
  }).join('');

  return `<article class="panel-question-card">
    <div class="panel-question-head">
      <span class="panel-question-no">Q${questionNo}</span>
      <span class="panel-question-type categorical">선택형</span>
    </div>
    <h4>${esc(field.label)}</h4>
    <p>${esc(field.question || field.label)}</p>
    <div class="panel-question-meta">응답 ${stat.answered}명</div>
    <div class="panel-q-rows">${rowsHtml}</div>
  </article>`;
}

function renderQualitativeCard(field, questionNo, validReviews) {
  const answers = validReviews
    .map(review => normalizeText(review[field.key]))
    .filter(Boolean);
  const answered = answers.length;
  const ratio = validReviews.length ? (answered / validReviews.length) * 100 : 0;
  const samples = answers.slice(0, 2);

  return `<article class="panel-question-card">
    <div class="panel-question-head">
      <span class="panel-question-no">Q${questionNo}</span>
      <span class="panel-question-type qualitative">서술형</span>
    </div>
    <h4>${esc(field.label)}</h4>
    <p>${esc(field.question || field.label)}</p>
    <div class="panel-question-meta">응답 ${answered}명 / ${validReviews.length}명 (${ratio.toFixed(1)}%)</div>
    <div class="panel-q-track panel-q-track--thin"><div class="panel-q-fill" style="width:${ratio.toFixed(1)}%"></div></div>
    ${samples.length ? `<div class="panel-qual-samples">${
      samples.map(sample => `<div class="panel-qual-sample">"${esc(sample)}"</div>`).join('')
    }</div>` : ''}
  </article>`;
}

function renderFieldCard(field, validReviews) {
  if (field.type === 'quantitative') {
    return renderQuantitativeCard(field, field.orderNo, buildQuantitativeStats(validReviews, field));
  }
  if (field.type === 'categorical') {
    return renderCategoricalCard(field, field.orderNo, buildCategoricalStats(validReviews, field));
  }
  return renderQualitativeCard(field, field.orderNo, validReviews);
}

function renderStatsColumn(fields, validReviews, columnType) {
  const label = columnType === 'quantitative' ? '척도형 문항' : '서술형 문항';
  const cardsHtml = fields.length
    ? fields.map(field => renderFieldCard(field, validReviews)).join('')
    : '<div class="survey-empty">해당 문항이 없습니다.</div>';

  return `<section class="survey-column">
    <div class="survey-column-tag ${columnType}">${label}</div>
    <div class="survey-column-body">${cardsHtml}</div>
  </section>`;
}

function renderCategoricalSection(fields, validReviews) {
  if (!fields.length) return '';
  return `<section class="survey-extra-section">
    <div class="survey-column-head">
      <h3>선택형 문항</h3>
      <span>${fields.length}문항</span>
    </div>
    <p class="survey-column-desc">이 퍼널에서 단일 선택으로 응답한 문항 분포입니다.</p>
    <div class="survey-column-body">
      ${fields.map(field => renderFieldCard(field, validReviews)).join('')}
    </div>
  </section>`;
}

export function renderPanelStatsTab(reviews, surveyTemplate, personaSummaries = [], funnelConfig = window.funnelConfig) {
  const target = document.getElementById('tab-panel-stats');
  if (!target) return;

  const allReviews = Array.isArray(reviews) ? reviews : [];
  const validReviews = allReviews.filter(review => !review?.error);
  if (!validReviews.length) {
    target.innerHTML = '<p style="color:#636e72">패널 응답 데이터가 없습니다.</p>';
    return;
  }

  const sections = buildSurveySections(surveyTemplate, funnelConfig);
  const allFields = flattenSurveyFields(sections);
  if (!allFields.length) {
    target.innerHTML = '<p style="color:#636e72">문항 정의를 불러오지 못해 통계를 계산할 수 없습니다.</p>';
    return;
  }

  allFields.forEach((field, idx) => {
    field.orderNo = idx + 1;
  });
  const fieldOrderMap = new Map(allFields.map(field => [field.key, field.orderNo]));

  let expectedAnswers = 0;
  let actualAnswers = 0;
  validReviews.forEach(review => {
    allFields.forEach(field => {
      expectedAnswers += 1;
      if (isAnswered(field, review[field.key])) actualAnswers += 1;
    });
  });
  const completionPct = expectedAnswers ? ((actualAnswers / expectedAnswers) * 100).toFixed(1) : '0.0';
  const personaDist = buildPersonaDistribution(validReviews, personaSummaries);

  const sectionsHtml = sections.map(section => {
    const sectionFields = (section.fields || []).map(field => ({
      ...field,
      sectionLabel: shortSectionLabel(section.label),
      orderNo: fieldOrderMap.get(field.key) || 0,
    }));
    const quantitativeFields = sectionFields.filter(field => field.type === 'quantitative');
    const qualitativeFields = sectionFields.filter(field => field.type === 'qualitative');
    const categoricalFields = sectionFields.filter(field => field.type === 'categorical');

    return `<section class="survey-funnel-section">
      ${hierHeader('l1', sectionBadgeLabel(section.id), `${shortSectionLabel(section.label)} 문항 분포`)}
      <div class="survey-funnel-meta">
        <span class="survey-meta-label">퍼널</span>
        <strong>${esc(shortSectionLabel(section.label))}</strong>
        <span class="survey-meta-dot">•</span>
        <span class="survey-meta-count">총 ${(section.fields || []).length}문항</span>
      </div>
      <div class="survey-layout-two-col">
        ${renderStatsColumn(quantitativeFields, validReviews, 'quantitative')}
        ${renderStatsColumn(qualitativeFields, validReviews, 'qualitative')}
      </div>
      ${renderCategoricalSection(categoricalFields, validReviews)}
    </section>`;
  }).join('');

  target.innerHTML = `
    <div class="panel-stats-intro">
      <h2>📈 패널 응답 통계</h2>
      <p>문항별 분포를 퍼널 단위로 구분해, 좌측 척도형·우측 서술형 구조로 정리했습니다.</p>
    </div>
    ${renderSummaryCards(allReviews.length, validReviews.length, allFields.length, completionPct)}
    <section class="panel-stats-section">
      <h3>페르소나별 응답 비중</h3>
      ${renderPersonaRows(personaDist.rows)}
    </section>
    <section class="panel-stats-section">
      <h3>문항별 분포 통계</h3>
      <div class="survey-funnel-sections">${sectionsHtml}</div>
    </section>
  `;
}
