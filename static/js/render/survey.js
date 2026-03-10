import { esc, hierHeader, shortSectionLabel, sectionBadgeLabel } from './helpers.js';
import { buildSurveySections, flattenSurveyFields } from './survey-schema.js';

function typeBadgeLabel(type) {
  if (type === 'quantitative') return '척도형';
  if (type === 'categorical') return '선택형';
  return '서술형';
}

function renderQuantitativeInput(field) {
  const scale = field.scale || { min: 1, max: 5 };
  const choices = [];
  const midpoint = Math.round((scale.min + scale.max) / 2);
  for (let score = scale.min; score <= scale.max; score += 1) {
    choices.push(`<label class="survey-choice">
      <input type="radio" disabled ${score === midpoint ? 'checked' : ''} />
      <span>${score}</span>
    </label>`);
  }
  return `<div class="survey-answer-box">
    <div class="survey-choice-row">${choices.join('')}</div>
    <div class="survey-help-text">${scale.min}점(낮음) ~ ${scale.max}점(높음)</div>
  </div>`;
}

function renderCategoricalInput(field) {
  const options = Array.isArray(field.options) ? field.options : [];
  return `<div class="survey-answer-box survey-answer-box--options">${
    options.map((option, idx) => `<label class="survey-option-row">
      <input type="radio" name="${esc(field.key)}-preview" disabled ${idx === 2 ? 'checked' : ''} />
      <span>${esc(option)}</span>
    </label>`).join('')
  }</div>`;
}

function renderQualitativeInput() {
  return `<div class="survey-answer-box">
    <textarea class="survey-textarea-preview" rows="3" disabled placeholder="응답자가 자유롭게 답변을 작성합니다."></textarea>
  </div>`;
}


function renderQuestionCard(field, questionIndex) {
  let inputHtml = renderQualitativeInput();
  if (field.type === 'quantitative') inputHtml = renderQuantitativeInput(field);
  if (field.type === 'categorical') inputHtml = renderCategoricalInput(field);

  return `<article class="survey-question-card">
    <div class="survey-q-head">
      <span class="survey-q-number">Q${questionIndex}</span>
      <span class="survey-q-type ${field.type}">${typeBadgeLabel(field.type)}</span>
    </div>
    <h4 class="survey-q-label">${esc(field.label)}</h4>
    <p class="survey-q-text">${esc(field.question || field.label)}</p>
    ${inputHtml}
  </article>`;
}

function renderColumn(fields, columnType) {
  const label = columnType === 'quantitative' ? '척도형 문항' : '서술형 문항';
  return `<section class="survey-column">
    <div class="survey-column-tag ${columnType}">${label}</div>
    <div class="survey-column-body">${
      fields.length
        ? fields.map(field => renderQuestionCard(field, field.orderNo)).join('')
        : '<div class="survey-empty">해당 문항이 없습니다.</div>'
    }</div>
  </section>`;
}

export function renderSurveyTab(surveyTemplate, funnelConfig = window.funnelConfig) {
  const target = document.getElementById('tab-survey');
  if (!target) return;

  const sections = buildSurveySections(surveyTemplate, funnelConfig);
  const allFields = flattenSurveyFields(sections);
  if (!allFields.length) {
    target.innerHTML = '<p style="color:#636e72">설문 템플릿을 불러오지 못했습니다.</p>';
    return;
  }

  allFields.forEach((field, idx) => {
    field.orderNo = idx + 1;
  });

  const fieldOrderMap = new Map(allFields.map(field => [field.key, field.orderNo]));

  const sectionsHtml = sections.map(section => {
    const sectionFields = (section.fields || []).map(field => ({
      ...field,
      sectionLabel: shortSectionLabel(section.label),
      orderNo: fieldOrderMap.get(field.key) || 0,
    }));

    const quantitativeFields = sectionFields.filter(field => field.type === 'quantitative');
    const qualitativeFields = sectionFields.filter(field => field.type === 'qualitative');
    const categoricalFields = sectionFields.filter(field => field.type === 'categorical');

    const categoricalHtml = categoricalFields.length
      ? `<section class="survey-extra-section">
        <div class="survey-column-head">
          <h3>선택형 문항</h3>
          <span>${categoricalFields.length}문항</span>
        </div>
        <p class="survey-column-desc">이 퍼널에서 단일 선택으로 응답하는 문항입니다.</p>
        <div class="survey-column-body">
          ${categoricalFields.map(field => renderQuestionCard(field, field.orderNo)).join('')}
        </div>
      </section>`
      : '';

    const sectionTitle = `${shortSectionLabel(section.label)} 문항 구성`;
    const badgeLabel = sectionBadgeLabel(section.id);
    return `<section class="survey-funnel-section">
      ${hierHeader('l1', badgeLabel, sectionTitle)}
      <div class="survey-funnel-meta">
        <span class="survey-meta-label">퍼널</span>
        <strong>${esc(shortSectionLabel(section.label))}</strong>
        <span class="survey-meta-dot">•</span>
        <span class="survey-meta-count">총 ${(section.fields || []).length}문항</span>
      </div>
      <div class="survey-layout-two-col">
        ${renderColumn(quantitativeFields, 'quantitative')}
        ${renderColumn(qualitativeFields, 'qualitative')}
      </div>
      ${categoricalHtml}
    </section>`;
  }).join('');

  const demoConfigs = window._demoFunnelConfigs;
  const demoTeamToggleHtml = demoConfigs ? (() => {
    const cur = window._currentDemoSurveyTeam || 'marketing';
    return `<div class="survey-demo-team-toggle">
      <div class="team-toggle">
        <button class="team-btn${cur === 'marketing' ? ' active' : ''}" onclick="switchDemoSurveyTeam('marketing')">마케팅팀</button>
        <button class="team-btn${cur === 'commerce' ? ' active' : ''}" onclick="switchDemoSurveyTeam('commerce')">커머스비즈니스팀</button>
      </div>
    </div>`;
  })() : '';

  target.innerHTML = `
    <div class="survey-tab-intro">
      <div class="survey-tab-intro-header">
        <h2>📝 설문지 미리보기</h2>
        ${demoTeamToggleHtml}
      </div>
      <p>총 <strong>${allFields.length}문항</strong>을 퍼널 섹션으로 구분해 보여줍니다. 각 섹션 내부는 좌측 척도형, 우측 서술형 구조입니다.</p>
    </div>
    <div class="survey-funnel-sections">${sectionsHtml}</div>
  `;
}
