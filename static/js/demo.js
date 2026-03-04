export const DEMO_FUNNEL_CONFIG = {
  upper: {
    label: 'Brand (브랜드 자산 구축)', desc_who: '잠재 고객', desc_goal: '브랜드를 처음 인지하고 태도·이미지를 형성하는 단계', desc_metrics: '호감도, 메시지 전달력, 감정 반응',
    individual_items: [
      { key: 'like_dislike',          label: '브랜드 호감도',  scale: '1-7', type: 'quantitative' },
      { key: 'favorable_unfavorable', label: '브랜드 호의도',  scale: '1-7', type: 'quantitative' },
      { key: 'brand_self_congruity',  label: '자기적합성',     scale: '1-7', type: 'quantitative' },
      { key: 'brand_image_fit',       label: '이미지적합성',   scale: '1-7', type: 'quantitative' },
      { key: 'message_clarity',       label: '메시지 명확성',  scale: '1-7', type: 'quantitative' },
      { key: 'attention_grabbing',    label: '주목도',          scale: '1-7', type: 'quantitative' },
      { key: 'first_impression',      label: '첫인상',                        type: 'qualitative' },
      { key: 'perceived_message',     label: '지각된 메시지',                  type: 'qualitative' },
      { key: 'emotional_response',    label: '감정 반응',                      type: 'qualitative' },
    ],
    synthesis_items: [
      { key: 'avg_brand_attitude',    label: '평균 브랜드 태도',   type: 'quantitative' },
      { key: 'avg_brand_fit',         label: '평균 브랜드 적합성', type: 'quantitative' },
      { key: 'avg_ad_effectiveness',  label: '평균 광고 효과성',   type: 'quantitative' },
      { key: 'message_gap_analysis',  label: '메시지 갭 분석',     type: 'qualitative' },
      { key: 'emotional_tone_summary',label: '감정 톤 요약',       type: 'qualitative' },
    ],
    qa_items: [{ key: 'qa_rep_brand_attitude', type: 'replication' }, { key: 'qa_trap_skepticism_check', type: 'trap' }],
  },
  mid: {
    label: 'Demand & Acquisition (수요 창출·신규 획득)', desc_who: '관심을 보인 잠재·신규 고객', desc_goal: '수요를 확보하고 신규 고객을 획득하는 단계', desc_metrics: '매력도, 가성비, 경쟁 비교, 추천 의향',
    individual_items: [
      { key: 'appeal_score',           label: '매력도',       scale: '1-10', type: 'quantitative' },
      { key: 'value_for_money',        label: '가성비',        scale: '1-7',  type: 'quantitative' },
      { key: 'price_fairness',         label: '가격 적정성',  scale: '1-7',  type: 'quantitative' },
      { key: 'info_sufficiency',       label: '정보 충분성',  scale: '1-7',  type: 'quantitative' },
      { key: 'key_positives',          label: '긍정 요소',                    type: 'qualitative' },
      { key: 'key_concerns',           label: '우려 사항',                    type: 'qualitative' },
      { key: 'competitive_preference', label: '경쟁 비교',                    type: 'qualitative' },
      { key: 'recommendation_context', label: '추천 맥락',                    type: 'qualitative' },
      { key: 'recommendation',         label: '관심도',                       type: 'categorical' },
    ],
    synthesis_items: [
      { key: 'overall_score',              label: '종합 매력도',           type: 'quantitative' },
      { key: 'avg_perceived_value',        label: '평균 지각된 가치',       type: 'quantitative' },
      { key: 'consensus_positives',        label: '공통 긍정 요소',         type: 'qualitative' },
      { key: 'consensus_concerns',         label: '공통 우려 사항',         type: 'qualitative' },
      { key: 'segment_insights',           label: '세그먼트 인사이트',      type: 'qualitative' },
      { key: 'target_segment_priority',    label: '타겟 세그먼트 우선순위', type: 'qualitative' },
    ],
    qa_items: [{ key: 'qa_rep_value_perception', type: 'replication' }, { key: 'qa_trap_budget_sensitivity', type: 'trap' }],
  },
  lower: {
    label: 'Sales & Conversion (전환·매출)', desc_who: '구매를 고려 중인 고객', desc_goal: '최종 전환과 매출로 이어지는 단계', desc_metrics: '구매 확률, 전환 장벽, 가격 민감도',
    individual_items: [
      { key: 'likelihood_high',             label: '구매 가능성',        scale: '1-7',  type: 'quantitative' },
      { key: 'probability_consider_high',   label: '고려 확률',           scale: '1-7',  type: 'quantitative' },
      { key: 'willingness_high',            label: '구매 의향',           scale: '1-7',  type: 'quantitative' },
      { key: 'purchase_probability_juster', label: '구매 확률(Juster)',   scale: '0-10', type: 'quantitative' },
      { key: 'purchase_trigger_barrier',    label: '구매 촉진/장벽',                    type: 'qualitative' },
      { key: 'review_summary',              label: '종합 평가',                         type: 'qualitative' },
    ],
    synthesis_items: [
      { key: 'avg_purchase_intention',      label: '평균 구매 의향',     type: 'quantitative' },
      { key: 'avg_purchase_probability',    label: '평균 구매 확률',     type: 'quantitative' },
      { key: 'estimated_conversion_range',  label: '예상 전환율',        type: 'quantitative' },
      { key: 'key_conversion_barriers',     label: '핵심 전환 장벽',     type: 'qualitative' },
      { key: 'actionable_recommendations',  label: '개선 제안',          type: 'qualitative' },
      { key: 'executive_summary',           label: '핵심 요약',          type: 'qualitative' },
      { key: 'go_nogo_recommendation',      label: 'Go/No-Go 의사결정',  type: 'categorical' },
    ],
    qa_items: [{ key: 'qa_rep_purchase_intent', type: 'replication' }],
  },
};

/* ── 데모 패널 생성 헬퍼 ── */
// 결정론적 jitter: 인덱스 기반 사인파
function _j(i, amp) { return Math.round(Math.sin(i * 1.3 + amp) * amp); }
function _c(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function _mkPanels(prefix, name, base, recs, impressions, summaries) {
  return Array.from({ length: 25 }, (_, i) => ({
    panel_id:                    `${prefix}-${String(i + 1).padStart(2, '0')}`,
    persona_name:                name,
    appeal_score:                _c(base.ap  + _j(i,    1), 1, 10),
    like_dislike:                _c(base.ld  + _j(i+1,  1), 1, 7),
    favorable_unfavorable:       _c(base.fu  + _j(i+2,  1), 1, 7),
    brand_self_congruity:        _c(base.bsc + _j(i+3,  1), 1, 7),
    brand_image_fit:             _c(base.bif + _j(i+4,  1), 1, 7),
    message_clarity:             _c(base.mc  + _j(i+5,  1), 1, 7),
    attention_grabbing:          _c(base.ag  + _j(i+6,  1), 1, 7),
    value_for_money:             _c(base.vfm + _j(i+7,  1), 1, 7),
    price_fairness:              _c(base.pf  + _j(i+8,  1), 1, 7),
    info_sufficiency:            _c(base.is_ + _j(i+9,  1), 1, 7),
    likelihood_high:             _c(base.lh  + _j(i+10, 1), 1, 7),
    probability_consider_high:   _c(base.pch + _j(i+11, 1), 1, 7),
    willingness_high:            _c(base.wh  + _j(i+12, 1), 1, 7),
    purchase_probability_juster: _c(base.ppj + _j(i+13, 1), 0, 10),
    recommendation:              recs[i % recs.length],
    first_impression:            impressions[i % impressions.length],
    review_summary:              summaries[i % summaries.length],
    raw_response: '{"demo": true}',
    qa_result: { qa_mode: 'off' },
  }));
}

const _QUANT_KEYS = [
  'appeal_score', 'like_dislike', 'favorable_unfavorable', 'brand_self_congruity',
  'brand_image_fit', 'message_clarity', 'attention_grabbing', 'value_for_money',
  'price_fairness', 'info_sufficiency', 'likelihood_high', 'probability_consider_high',
  'willingness_high', 'purchase_probability_juster',
];

function _mkSummary(personaId, panels, qual) {
  const avg = {};
  for (const f of _QUANT_KEYS) {
    avg['avg_' + f] = Math.round(panels.reduce((s, p) => s + (p[f] || 0), 0) / panels.length * 10) / 10;
  }
  const dist = {};
  for (const p of panels) dist[p.recommendation] = (dist[p.recommendation] || 0) + 1;
  return {
    persona_id: personaId, persona_name: panels[0].persona_name,
    panel_count: panels.length, ...avg,
    recommendation_distribution: dist, ...qual,
    panel_reviews: panels,
  };
}

/* ── 페르소나 1: 트렌드세터 MZ세대 ── */
const _mzPanels = _mkPanels('MZ', '트렌드세터 MZ세대',
  { ap: 8, ld: 6, fu: 6, bsc: 6, bif: 7, mc: 6, ag: 7, vfm: 5, pf: 5, is_: 6, lh: 6, pch: 6, wh: 6, ppj: 7 },
  ['매우 관심 있음', '매우 관심 있음', '매우 관심 있음', '다소 관심 있음', '다소 관심 있음',
   '매우 관심 있음', '매우 관심 있음', '다소 관심 있음', '매우 관심 있음', '매우 관심 있음'],
  [
    '인스타에 바로 올리고 싶은 감성이에요. 브랜드 비주얼이 정말 세련됐습니다.',
    '요즘 트렌드와 딱 맞는 느낌. 친구들한테 자랑하고 싶어요.',
    '콘텐츠로 소비하고 싶은 브랜드예요. 스토리텔링이 너무 매력적입니다.',
    '이런 브랜드를 기다리고 있었어요. 제 라이프스타일과 완벽하게 맞아요.',
    '비주얼 퀄리티가 높아서 SNS에 공유하기 딱 좋은 콘텐츠네요.',
  ],
  [
    '핵심 타겟 페르소나. SNS 바이럴 가능성이 매우 높으며 브랜드 앰배서더 역할 기대.',
    '강한 브랜드 동일시. 얼리어답터로서 커뮤니티 내 구전 효과 크게 기대됨.',
    '브랜드 감성에 적극 공감. 구매 후 콘텐츠 생산까지 이어질 가능성 높음.',
    '가격보다 경험과 감성을 중시하는 세그먼트로 프리미엄 전략에 부합.',
    '즉각적인 구매 의향 표출. 적절한 런칭 이벤트 시 전환율 극대화 기대.',
  ],
);

/* ── 페르소나 2: 실용주의 워킹맘 ── */
const _wmPanels = _mkPanels('WM', '실용주의 워킹맘',
  { ap: 6, ld: 5, fu: 5, bsc: 4, bif: 5, mc: 5, ag: 5, vfm: 5, pf: 4, is_: 5, lh: 4, pch: 5, wh: 4, ppj: 5 },
  ['다소 관심 있음', '보통', '다소 관심 있음', '보통', '다소 관심 있음',
   '보통', '다소 관심 있음', '관심 없음', '보통', '다소 관심 있음'],
  [
    '실용적이고 깔끔한 느낌이에요. 시간이 없는 엄마로서 간편함이 중요한데 그 점은 마음에 들어요.',
    '아이 키우면서 쓸 만한 제품인지 먼저 봤는데, 어느 정도는 맞는 것 같아요.',
    '가성비를 더 따져봐야 할 것 같아요. 기능은 좋은데 가격이 고민입니다.',
    '직장과 육아를 병행하다 보니 시간 절약되는 제품을 선호하는데, 이건 그 기준에 부합해요.',
    '세련된 건 알겠는데 우리 아이한테도 맞을지 잘 모르겠어요.',
  ],
  [
    '실용성 검증 후 구매 전환 가능. 가격 프로모션이 결정적 트리거.',
    '육아 편의성 측면에서 부가 가치가 명확히 전달되면 구매 가능성 상승.',
    '효율과 실용성 중심의 판단 기준. 브랜드 스토리보다 사용 경험 후기에 의존.',
    '가격 저항감 있으나 장기적 가치를 납득시키면 전환 가능한 세그먼트.',
    '중립적 입장. 주변 워킹맘 커뮤니티 반응을 보고 결정하는 경향.',
  ],
);

/* ── 페르소나 3: 깐깐한 절약형 주부 ── */
const _fhPanels = _mkPanels('FH', '깐깐한 절약형 주부',
  { ap: 3, ld: 3, fu: 3, bsc: 2, bif: 3, mc: 3, ag: 3, vfm: 2, pf: 2, is_: 3, lh: 2, pch: 3, wh: 2, ppj: 2 },
  ['관심 없음', '보통', '관심 없음', '전혀 관심 없음', '보통',
   '관심 없음', '보통', '전혀 관심 없음', '관심 없음', '보통'],
  [
    '비싸 보이는데 왜 사야 하는지 모르겠어요. 같은 돈으로 더 실속 있는 걸 살 수 있어요.',
    '디자인은 예쁜데 가격 생각하면 손이 안 가요. 주부 입장에서 지출 우선순위가 아닙니다.',
    '광고처럼 실제로 좋은지 의심스러워요. 검증된 브랜드를 더 선호합니다.',
    '이런 거 살 돈으로 애들 학원비 내는 게 낫죠. 솔직히 필요성을 못 느끼겠어요.',
    '가격이 반이라도 됐으면 생각해봤겠지만 현재로선 완전히 사치품이에요.',
  ],
  [
    '비타겟 고객군. 가격 민감도 최고 수준으로 대폭 할인 없이는 전환 불가.',
    '기존 소비 패턴이 확고하여 신규 브랜드 진입 장벽 매우 높음.',
    '필요성 자체를 인식하지 못하는 단계. 카테고리 교육이 선행되어야 함.',
    '가격 저항감 극복 불가 수준. 이 세그먼트는 마케팅 비용 대비 ROI 낮음.',
    '경쟁 브랜드나 저렴한 대안으로 이미 니즈 충족. 전환 유인 부재.',
  ],
);

/* ── 페르소나 4: 파이어족 미니멀리스트 ── */
const _frPanels = _mkPanels('FR', '파이어족 미니멀리스트',
  { ap: 5, ld: 4, fu: 4, bsc: 3, bif: 4, mc: 4, ag: 4, vfm: 4, pf: 3, is_: 4, lh: 3, pch: 4, wh: 3, ppj: 4 },
  ['보통', '다소 관심 있음', '보통', '관심 없음', '보통',
   '다소 관심 있음', '보통', '관심 없음', '보통', '보통'],
  [
    '미니멀한 삶을 추구하는 입장에서 정말 필요한가 먼저 따져봅니다. 솔직히 없어도 될 것 같아요.',
    '브랜드 자체는 좋아 보이는데 파이어 달성 목표 때문에 불필요한 소비는 자제합니다.',
    '퀄리티는 인정하는데 이걸 사면 몇 년치 투자 복리를 포기하는 셈이에요.',
    '제가 원하는 것보다 필요한 것 위주로 소비하는데, 이 제품이 꼭 필요한지 모르겠어요.',
    '심플하고 기능적인 면은 좋은데, 소비 자체를 줄이는 게 목표라서요.',
  ],
  [
    '소비 억제 철학이 강한 세그먼트. ROI 명확성과 장기적 가치 입증이 유일한 설득 경로.',
    '필수재 여부 판단이 핵심. 이 제품이 삶의 질을 구체적으로 개선함을 증명해야 구매 가능.',
    '브랜드 가치는 인정하나 소비 철학과 충돌. 구독/공유 모델 제시 시 전환 가능성 상승.',
    '미니멀리즘 가치관으로 인해 구매 허들 높음. 장기 내구성·다용도성 강조 전략 필요.',
    '감성보다 논리적 설득이 효과적인 세그먼트. 비용 절감 효과 데이터 제시가 관건.',
  ],
);

export const DEMO_PERSONA_SUMMARIES = [
  _mkSummary('mz', _mzPanels, {
    first_impression: '인스타에 바로 올리고 싶은 감성이에요. 브랜드 비주얼이 정말 세련됐습니다.',
    key_positives: '세련된 비주얼과 높은 SNS 공유 욕구; 강한 브랜드 동일시; 즉각적 구매 의향',
    key_concerns: '가격 정당화 필요; 트렌드 변화에 따른 지속 관심 불확실',
    perceived_message: '나만의 라이프스타일을 완성해주는 감성 브랜드',
    emotional_response: '설레고 흥분됨. 당장 공유하고 싶은 브랜드 경험.',
    purchase_trigger_barrier: '얼리버드 한정 오퍼 또는 인플루언서 추천이 즉각적 전환 트리거',
    recommendation_context: 'SNS 피드 공유 및 친구 추천 의향 매우 높음. 바이럴 마케팅 핵심 세그먼트',
    competitive_preference: '기존 브랜드 대비 비주얼 감성과 스토리텔링에서 명확한 우위 인식',
    review_summary: '핵심 타겟 페르소나. 높은 브랜드 공감도와 즉각적 구매 의향으로 전환율 극대화 예상.',
  }),
  _mkSummary('wm', _wmPanels, {
    first_impression: '실용적이고 깔끔한 느낌이에요. 시간이 없는 엄마로서 간편함이 중요한데 그 점은 마음에 들어요.',
    key_positives: '실용성과 편의성 인정; 깔끔한 디자인; 시간 절약 가능성',
    key_concerns: '가격 대비 가치 불명확; 육아 적합성 검증 필요; 결정에 시간 필요',
    perceived_message: '바쁜 현대인을 위한 효율적 솔루션 브랜드',
    emotional_response: '긍정적이나 신중함. 실용적 이점이 감정보다 앞서는 판단 방식.',
    purchase_trigger_barrier: '가격 할인 또는 무료 체험 제공이 결정적 전환 트리거. 주변 추천 의견도 중요.',
    recommendation_context: '육아 커뮤니티 검증 후 추천 가능. 신뢰할 수 있는 후기가 선행되어야 함.',
    competitive_preference: '기존 사용 브랜드와 가성비 비교가 주된 기준. 우위 입증 필요.',
    review_summary: '실용성 검증 후 전환 가능한 세그먼트. 가격 프로모션과 사용 후기가 핵심 전환 요소.',
  }),
  _mkSummary('fh', _fhPanels, {
    first_impression: '비싸 보이는데 왜 사야 하는지 모르겠어요. 같은 돈으로 더 실속 있는 걸 살 수 있어요.',
    key_positives: '디자인 자체는 나쁘지 않음; 일부 기능성 인정',
    key_concerns: '매우 높은 가격 저항감; 필요성 미인식; 기존 대안으로 충분히 만족',
    perceived_message: '고가 사치품 이미지로 인식. 실속 있는 가치 메시지가 전달되지 않음.',
    emotional_response: '부정적 또는 무관심. 소비 욕구 자체가 발생하지 않음.',
    purchase_trigger_barrier: '가격 50% 이상 할인이 최소 조건. 현재 가격대에서는 구매 불가.',
    recommendation_context: '주변에 추천 의향 없음. 오히려 비싸다고 말릴 가능성 있음.',
    competitive_preference: '이미 저렴한 대안으로 만족. 신규 브랜드 진입 가치 인식 없음.',
    review_summary: '비타겟 고객군. 마케팅 비용 투자 대비 ROI 낮음. 이 세그먼트는 제외 권고.',
  }),
  _mkSummary('fr', _frPanels, {
    first_impression: '미니멀한 삶을 추구하는 입장에서 정말 필요한가 먼저 따져봅니다.',
    key_positives: '브랜드 퀄리티 자체는 인정; 미니멀한 디자인 방향성에 공감',
    key_concerns: '소비 철학과 충돌; 파이어 목표와 상충; 필수재 여부 불명확',
    perceived_message: '불필요한 소비를 자극하는 브랜드로 인식될 위험 있음.',
    emotional_response: '이성적이고 냉정한 평가. 감성보다 ROI 계산이 우선.',
    purchase_trigger_barrier: '장기 비용 절감 데이터 또는 구독 모델이 유일한 설득 경로.',
    recommendation_context: '파이어족 커뮤니티 내에서 "불필요한 소비"로 분류될 가능성 높음.',
    competitive_preference: '소비 자체를 줄이는 것이 목표. 경쟁 비교보다 구매 필요성이 선행 과제.',
    review_summary: '소비 억제 철학으로 인해 전환 허들 높음. 장기적 가치 및 ROI 입증 전략 필요.',
  }),
];

export const DEMO_PANEL_REVIEWS = [..._mzPanels, ..._wmPanels, ..._fhPanels, ..._frPanels];

export const DEMO_SYNTHESIS = {
  avg_brand_attitude: 4.5, avg_brand_fit: 4.2, avg_ad_effectiveness: 4.6,
  overall_score: 6.0, avg_perceived_value: 3.8,
  avg_purchase_intention: 3.8, avg_purchase_probability: 4.5, estimated_conversion_range: 3.4,
  emotional_tone_summary: '세그먼트별 감정 반응이 극명하게 갈림. MZ세대에서 강한 흥분·공유 욕구, 절약형 주부에서 무관심·저항감, 워킹맘·파이어족은 중립.',
  message_gap_analysis: '트렌드·감성 메시지는 MZ세대에 효과적이나 실용·절약 지향 세그먼트에는 전혀 전달되지 않음. 세그먼트별 메시지 분리 전략 필요.',
  consensus_positives: '세련된 비주얼 디자인에 대한 공통 긍정 반응. MZ세대와 워킹맘에서 실용적 가치 부분 인정.',
  consensus_concerns: '가격 대비 가치 불명확(전 세그먼트 공통). 필요성 인식 부족(절약형·파이어족). 차별화 메시지 부재.',
  segment_insights: 'MZ세대(트렌드세터) → 즉각 전환 가능. 워킹맘 → 실용성 입증 후 전환 가능. 절약형 주부·파이어족 → 가격/철학 장벽으로 전환 난이도 높음.',
  target_segment_priority: '1순위: 트렌드세터 MZ세대 (고전환·바이럴), 2순위: 실용주의 워킹맘 (중전환·볼륨), 3순위: 파이어족 (조건부), 제외: 깐깐한 절약형 주부',
  key_conversion_barriers: '절약형 주부: 가격 저항 절대적. 파이어족: 소비 철학 충돌. 워킹맘: 가성비 입증 미흡.',
  actionable_recommendations: '1) MZ세대 인플루언서 마케팅 우선 집행, 2) 워킹맘 타겟 실용적 사용 사례 콘텐츠 제작, 3) 얼리버드 할인으로 초기 전환 극대화',
  executive_summary: 'MZ세대 중심의 트렌드 마케팅이 핵심 전략. 전체 100패널 중 약 30%가 즉각 구매 의향 보유. 워킹맘 세그먼트 추가 공략 시 전환율 추가 상승 기대.',
  go_nogo_recommendation: 'GO — MZ세대·워킹맘 세그먼트 집중 전략으로 출시 권고. 전체 시장 공략은 2차 단계로 분리.',
};
