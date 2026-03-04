const SECTION_ORDER = ['overall', 'upper', 'mid', 'lower'];
const TYPE_ORDER = ['quantitative', 'qualitative', 'categorical'];
const SCALE_RE = /(\d+)\s*-\s*(\d+)/;

export const RECOMMENDATION_OPTIONS = ['매우 관심 있음', '다소 관심 있음', '보통', '관심 없음', '전혀 관심 없음'];

function toScale(input, fallback = null) {
  const src = String(input || '').trim();
  const match = SCALE_RE.exec(src);
  if (!match) return fallback;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return fallback;
  return { min, max };
}

function normalizeType(field) {
  const key = String(field?.key || '').trim();
  const spec = String(field?.spec || '').toLowerCase();
  const explicit = String(field?.type || '').toLowerCase();

  if (explicit === 'quantitative' || explicit === 'qualitative' || explicit === 'categorical') {
    return explicit;
  }
  if (spec.includes('integer')) return 'quantitative';
  if (key === 'recommendation') return 'categorical';
  return 'qualitative';
}

function normalizeField(rawField) {
  const key = String(rawField?.key || '').trim();
  if (!key) return null;

  const type = normalizeType(rawField);
  const normalized = {
    key,
    label: String(rawField?.label || key).trim(),
    question: String(rawField?.question || '').trim(),
    spec: String(rawField?.spec || '').trim(),
    type,
  };

  if (type === 'quantitative') {
    normalized.scale = rawField?.scale || toScale(rawField?.spec, { min: 1, max: 5 });
  } else if (type === 'categorical') {
    const options = Array.isArray(rawField?.options) ? rawField.options.filter(Boolean).map(String) : [];
    normalized.options = options.length ? options : RECOMMENDATION_OPTIONS;
  }

  return normalized;
}

function buildSectionsFromTemplate(surveyTemplate) {
  if (!Array.isArray(surveyTemplate) || !surveyTemplate.length) return [];
  return surveyTemplate.map(section => ({
    id: String(section?.id || '').trim(),
    label: String(section?.label || '').trim(),
    fields: (section?.fields || [])
      .map(normalizeField)
      .filter(Boolean),
  })).filter(section => section.fields.length);
}

function buildSectionsFromFunnelConfig(funnelConfig) {
  if (!funnelConfig) return [];
  return SECTION_ORDER.map(sectionKey => {
    const section = funnelConfig[sectionKey];
    if (!section) return null;

    const fields = [];
    TYPE_ORDER.forEach(type => {
      (section.individual_items || []).forEach(item => {
        if (item.type !== type) return;
        const scale = type === 'quantitative' ? toScale(item.scale, { min: 1, max: 5 }) : null;
        const fallbackQuestion = type === 'quantitative'
          ? `${item.label}를 ${scale?.min || 1}-${scale?.max || 5}점 척도로 평가해 주세요.`
          : type === 'categorical'
            ? `${item.label}에 해당하는 선택지를 골라 주세요.`
            : `${item.label}에 대해 자유롭게 답변해 주세요.`;

        fields.push(normalizeField({
          key: item.key,
          label: item.label,
          question: fallbackQuestion,
          type,
          scale,
          options: item.key === 'recommendation' ? RECOMMENDATION_OPTIONS : [],
        }));
      });
    });

    if (!fields.length) return null;
    return {
      id: sectionKey,
      label: String(section.label || sectionKey),
      fields,
    };
  }).filter(Boolean);
}

export function buildSurveySections(surveyTemplate, funnelConfig = window.funnelConfig) {
  const fromTemplate = buildSectionsFromTemplate(surveyTemplate);
  if (fromTemplate.length) return fromTemplate;
  return buildSectionsFromFunnelConfig(funnelConfig);
}

export function flattenSurveyFields(sections) {
  const rows = [];
  (sections || []).forEach(section => {
    (section.fields || []).forEach(field => {
      rows.push({
        ...field,
        sectionId: section.id,
        sectionLabel: section.label,
      });
    });
  });
  return rows;
}
