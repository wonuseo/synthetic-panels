export const DEMO_FUNNEL_CONFIG = {
  overall: {
    label: 'Overall (프로모션 종합)', desc_who: '전체 평가 대상', desc_goal: '프로모션의 전반적인 매력도와 퀄리티를 종합 평가', desc_metrics: '매력도, 퀄리티',
    individual_items: [
      { key: 'promotion_attractiveness', label: '프로모션 매력도', scale: '1-5', type: 'quantitative' },
      { key: 'promotion_quality',        label: '프로모션 퀄리티', scale: '1-5', type: 'quantitative' },
      { key: 'overall_impression',       label: '종합 첫인상',                   type: 'qualitative' },
      { key: 'review_summary',           label: '종합 평가',                     type: 'qualitative' },
    ],
    synthesis_items: [
      { key: 'executive_summary',          label: '핵심 요약',              type: 'qualitative' },
      { key: 'go_nogo_recommendation',     label: 'Go/No-Go 의사결정',      type: 'qualitative' },
      { key: 'improvement_priority',       label: '최우선 개선 영역',       type: 'qualitative' },
      { key: 'actionable_recommendations', label: '프로모션 개선 제안',     type: 'qualitative' },
      { key: 'usage_strategy',             label: '활용 방안 제안',         type: 'qualitative' },
      { key: 'segment_insights',           label: '세그먼트 인사이트',      type: 'qualitative' },
      { key: 'target_segment_priority',    label: '타겟 세그먼트 우선순위', type: 'qualitative' },
    ],
    qa_items: [],
  },
  upper: {
    label: 'Brand (브랜드 자산)', desc_who: '잠재 고객', desc_goal: '브랜드를 처음 인지하고 태도·이미지를 형성하는 단계', desc_metrics: '호감도, 적합성, 명확성, 주목도, 신뢰도',
    individual_items: [
      { key: 'brand_favorability', label: '브랜드 호감도', scale: '1-5', type: 'quantitative' },
      { key: 'brand_fit',          label: '브랜드 적합성', scale: '1-5', type: 'quantitative' },
      { key: 'message_clarity',    label: '메시지 명확성', scale: '1-5', type: 'quantitative' },
      { key: 'attention_grabbing', label: '주목도',         scale: '1-5', type: 'quantitative' },
      { key: 'brand_trust',        label: '브랜드 신뢰도', scale: '1-5', type: 'quantitative' },
      { key: 'perceived_message',  label: '지각된 메시지',                type: 'qualitative' },
      { key: 'emotional_response', label: '감정적 반응',                  type: 'qualitative' },
      { key: 'brand_association',  label: '브랜드 연상',                  type: 'qualitative' },
    ],
    synthesis_items: [
      { key: 'avg_brand_attitude',    label: '평균 브랜드 태도',   type: 'quantitative' },
      { key: 'avg_brand_fit',         label: '평균 브랜드 적합성', type: 'quantitative' },
      { key: 'avg_ad_effectiveness',  label: '평균 광고 효과성',   type: 'quantitative' },
      { key: 'message_gap_analysis',      label: '메시지 갭 분석',   type: 'qualitative' },
      { key: 'emotional_tone_summary',    label: '감정 톤 요약',     type: 'qualitative' },
      { key: 'brand_association_summary', label: '브랜드 연상 종합', type: 'qualitative' },
    ],
    qa_items: [{ key: 'qa_rep_brand_attitude', type: 'replication' }, { key: 'qa_trap_skepticism_check', type: 'trap' }],
  },
  mid: {
    label: 'Demand & Acquisition (수요 창출)', desc_who: '관심을 보인 잠재·신규 고객', desc_goal: '수요를 확보하고 신규 고객을 획득하는 단계', desc_metrics: '매력도, 가성비, 가격 적정성, 정보 충분성, 추천 의향',
    individual_items: [
      { key: 'appeal',                label: '매력도',         scale: '1-5', type: 'quantitative' },
      { key: 'value_for_money',       label: '가성비',         scale: '1-5', type: 'quantitative' },
      { key: 'price_fairness',        label: '가격 적정성',    scale: '1-5', type: 'quantitative' },
      { key: 'info_sufficiency',      label: '정보 충분성',    scale: '1-5', type: 'quantitative' },
      { key: 'recommendation_intent', label: '추천 의향',      scale: '1-5', type: 'quantitative' },
      { key: 'key_positives',         label: '긍정 요소',                    type: 'qualitative' },
      { key: 'key_concerns',          label: '우려 사항',                    type: 'qualitative' },
      { key: 'competitive_comparison',label: '경쟁 대안 비교',               type: 'qualitative' },
      { key: 'information_gap',       label: '정보 부족 사항',               type: 'qualitative' },
      { key: 'recommendation',        label: '관심도',                       type: 'categorical' },
    ],
    synthesis_items: [
      { key: 'overall_score',              label: '종합 매력도',           type: 'quantitative' },
      { key: 'avg_perceived_value',        label: '평균 지각된 가치',       type: 'quantitative' },
      { key: 'demand_trigger_summary',      label: '수요 발생 요인',         type: 'qualitative' },
      { key: 'consideration_barrier_summary', label: '고려 단계 장벽',      type: 'qualitative' },
      { key: 'wom_potential',              label: '구전 잠재력',            type: 'qualitative' },
    ],
    qa_items: [{ key: 'qa_rep_value_perception', type: 'replication' }, { key: 'qa_trap_budget_sensitivity', type: 'trap' }],
  },
  lower: {
    label: 'Sales & Conversion (전환·매출)', desc_who: '구매를 고려 중인 고객', desc_goal: '최종 전환과 매출로 이어지는 단계', desc_metrics: '구매 가능성, 고려 확률, 구매 의향, 재구매 의향, 구매 시급성',
    individual_items: [
      { key: 'purchase_likelihood',    label: '구매 가능성', scale: '1-5', type: 'quantitative' },
      { key: 'purchase_consideration', label: '고려 확률',    scale: '1-5', type: 'quantitative' },
      { key: 'purchase_willingness',   label: '구매 의향',    scale: '1-5', type: 'quantitative' },
      { key: 'repurchase_intent',      label: '재구매 의향',  scale: '1-5', type: 'quantitative' },
      { key: 'purchase_urgency',       label: '구매 시급성',  scale: '1-5', type: 'quantitative' },
      { key: 'purchase_trigger',       label: '구매 촉진 요소',              type: 'qualitative' },
      { key: 'purchase_barrier',       label: '구매 장벽',                   type: 'qualitative' },
      { key: 'price_perception',       label: '가격 인식',                   type: 'qualitative' },
    ],
    synthesis_items: [
      { key: 'avg_purchase_intention',      label: '평균 구매 의향',       type: 'quantitative' },
      { key: 'avg_purchase_probability',    label: '평균 구매 확률',       type: 'quantitative' },
      { key: 'estimated_conversion_range',  label: '예상 전환율',          type: 'quantitative' },
      { key: 'key_conversion_barriers',     label: '핵심 전환 장벽',       type: 'qualitative' },
      { key: 'conversion_driver_analysis',  label: '전환 촉진 요소 분석',  type: 'qualitative' },
      { key: 'price_perception_summary',    label: '가격 인식 종합',        type: 'qualitative' },
    ],
    qa_items: [{ key: 'qa_rep_purchase_intent', type: 'replication' }],
  },
};

/* ── 데모 패널 생성 헬퍼 ── */
function _j(i, amp) { return Math.round(Math.sin(i * 1.3 + amp) * amp); }
function _c(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/* ── QA 결과 생성 헬퍼 ── */
// seed 기반 결정론적 jitter (기존 _j와 다른 주파수 사용)
function _qj(i, seed, amp) { return Math.round(Math.sin(i * 2.1 + seed) * amp); }

/**
 * QA 결과 생성
 * @param {'lite'|'full'} mode
 * @param {number} i - 패널 인덱스
 * @param {object} panel - 패널 데이터
 * @param {object} cfg - 페르소나 QA 설정
 *   cfg.budgetLo/Hi  : 예산 민감도 예상 범위
 *   cfg.competitorLo/Hi : 경쟁사 충성도 예상 범위  (full only)
 *   cfg.skepticismLo/Hi : 회의감 체크 예상 범위    (full only)
 *   cfg.repNoise     : 재확인 항목 노이즈 진폭 (0.5=정밀, 1=±1, 1.3=불안정)
 */
function _mkQAResult(mode, i, panel, cfg) {
  // 일관성 검증 (Replication): core 값에 noise 추가
  const repBA = _c(panel.brand_favorability + _qj(i, 37, cfg.repNoise), 1, 5);
  const repVP = mode === 'full' ? _c(panel.value_for_money   + _qj(i, 41, cfg.repNoise), 1, 5) : null;
  const repPI = mode === 'full' ? _c(panel.purchase_likelihood + _qj(i, 43, cfg.repNoise), 1, 5) : null;

  // 일관성 점수: 재확인-핵심 차이의 평균을 최대 차이(4)로 정규화
  const pairs = [[repBA, panel.brand_favorability]];
  if (repVP !== null) pairs.push([repVP, panel.value_for_money]);
  if (repPI !== null) pairs.push([repPI, panel.purchase_likelihood]);
  const totalDiff = pairs.reduce((s, [a, b]) => s + Math.abs(a - b), 0);
  const consistency_score = Math.round(Math.max(0, 1 - totalDiff / (pairs.length * 4)) * 100) / 100;

  // 트랩 항목: 예상 범위 내 값 생성 (mid ± noise)
  const _trap = (lo, hi, seed) => {
    const mid = (lo + hi) / 2;
    const v = _c(Math.round(mid + _qj(i, seed, 0.9)), 1, 5);
    return { val: v, pass: v >= lo && v <= hi };
  };

  const bt = _trap(cfg.budgetLo, cfg.budgetHi, 47);
  const ct = mode === 'full' ? _trap(cfg.competitorLo, cfg.competitorHi, 53) : null;
  const sk = mode === 'full' ? _trap(cfg.skepticismLo, cfg.skepticismHi, 59) : null;

  const trapsAll = [bt, ct, sk].filter(Boolean);
  const trap_pass_rate = Math.round(trapsAll.filter(t => t.pass).length / trapsAll.length * 100) / 100;
  const persona_quality = Math.round((0.5 * consistency_score + 0.5 * trap_pass_rate) * 100) / 100;

  return {
    qa_mode: mode,
    qa_rep_brand_attitude:    repBA,
    qa_rep_value_perception:  repVP,
    qa_rep_purchase_intent:   repPI,
    qa_trap_budget_sensitivity:   bt.val,
    qa_trap_competitor_loyalty:   ct?.val ?? null,
    qa_trap_skepticism_check:     sk?.val ?? null,
    consistency_score,
    trap_pass_rate,
    persona_quality,
    qa_passed: persona_quality >= 0.7,
  };
}

function _addQA(panels, mode, cfg) {
  return panels.map((panel, i) => ({ ...panel, qa_result: _mkQAResult(mode, i, panel, cfg) }));
}

function _mkPanels(prefix, name, base, recs, emotionalResponses, overallImpressions, reviewSummaries) {
  return Array.from({ length: 25 }, (_, i) => ({
    panel_id:                prefix + '-' + String(i + 1).padStart(2, '0'),
    persona_name:            name,
    promotion_attractiveness: _c(base.pa  + _j(i,    1), 1, 5),
    promotion_quality:       _c(base.pq  + _j(i+1,  1), 1, 5),
    brand_favorability:      _c(base.bf  + _j(i+2,  1), 1, 5),
    brand_fit:               _c(base.bft + _j(i+3,  1), 1, 5),
    message_clarity:         _c(base.mc  + _j(i+4,  1), 1, 5),
    attention_grabbing:      _c(base.ag  + _j(i+5,  1), 1, 5),
    brand_trust:             _c(base.bt  + _j(i+6,  1), 1, 5),
    appeal:                  _c(base.ap  + _j(i+7,  1), 1, 5),
    value_for_money:         _c(base.vfm + _j(i+8,  1), 1, 5),
    price_fairness:          _c(base.pf  + _j(i+9,  1), 1, 5),
    info_sufficiency:        _c(base.is_ + _j(i+10, 1), 1, 5),
    recommendation_intent:   _c(base.ri  + _j(i+11, 1), 1, 5),
    purchase_likelihood:     _c(base.pl  + _j(i+12, 1), 1, 5),
    purchase_consideration:  _c(base.pc  + _j(i+13, 1), 1, 5),
    purchase_willingness:    _c(base.pw  + _j(i+14, 1), 1, 5),
    repurchase_intent:       _c(base.rpi + _j(i+15, 1), 1, 5),
    purchase_urgency:        _c(base.pu  + _j(i+16, 1), 1, 5),
    recommendation:          recs[i % recs.length],
    emotional_response:      emotionalResponses[i % emotionalResponses.length],
    overall_impression:      overallImpressions[i % overallImpressions.length],
    review_summary:          reviewSummaries[i % reviewSummaries.length],
    raw_response: '{"demo": true}',
    qa_result: { qa_mode: 'off' },
  }));
}

const _QUANT_KEYS = [
  'promotion_attractiveness', 'promotion_quality',
  'brand_favorability', 'brand_fit', 'message_clarity',
  'attention_grabbing', 'brand_trust',
  'appeal', 'value_for_money', 'price_fairness',
  'info_sufficiency', 'recommendation_intent',
  'purchase_likelihood', 'purchase_consideration',
  'purchase_willingness', 'repurchase_intent', 'purchase_urgency',
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
  { pa: 5, pq: 4, bf: 4, bft: 5, mc: 4, ag: 5, bt: 4, ap: 5, vfm: 4, pf: 3, is_: 4, ri: 5, pl: 4, pc: 4, pw: 4, rpi: 4, pu: 4 },
  ['매우 관심 있음', '매우 관심 있음', '매우 관심 있음', '다소 관심 있음', '다소 관심 있음',
   '매우 관심 있음', '매우 관심 있음', '다소 관심 있음', '매우 관심 있음', '매우 관심 있음'],
  [
    '인스타에 바로 올리고 싶은 설렘이 느껴져요. 트렌디하고 나답다는 감정이 바로 들었어요.',
    '두근거리는 느낌이에요. 이 브랜드가 나를 위한 것 같다는 확신이 드네요.',
    '세련되고 쿨하다는 감정. 친구들한테 바로 공유하고 싶어요.',
    '소유욕이 생기는 감각적인 첫인상이에요. 놓치면 후회할 것 같아요.',
    '감성이 완전히 취저입니다. 볼수록 매력적인 브랜드예요.',
  ],
  [
    '인스타에 바로 올리고 싶은 감성. 트렌디하고 세련된 브랜드 비주얼이 인상적입니다.',
    '요즘 트렌드와 딱 맞는 느낌으로 친구들에게 자랑하고 싶어요.',
    '콘텐츠로 소비하고 싶은 브랜드예요. 스토리텔링이 너무 매력적입니다.',
    '이런 브랜드를 기다리고 있었어요. 라이프스타일과 완벽하게 맞아요.',
    '비주얼 퀄리티가 높아서 SNS 공유용 콘텐츠로 딱이에요.',
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
  { pa: 3, pq: 3, bf: 3, bft: 3, mc: 3, ag: 3, bt: 3, ap: 3, vfm: 3, pf: 3, is_: 3, ri: 3, pl: 3, pc: 3, pw: 3, rpi: 2, pu: 2 },
  ['다소 관심 있음', '보통', '다소 관심 있음', '보통', '다소 관심 있음',
   '보통', '다소 관심 있음', '관심 없음', '보통', '다소 관심 있음'],
  [
    '실용적이고 깔끔한 느낌이에요. 바쁜 엄마로서 이런 간편함이 마음에 들어요.',
    '안정감 있는 느낌이지만 확신이 서지 않아요. 더 알아봐야 할 것 같아요.',
    '관심은 가는데 가격을 생각하면 망설여져요. 가성비를 더 확인해야겠어요.',
    '직장과 육아를 병행하는 입장에서 시간 절약 가능성에 먼저 눈이 갔어요.',
    '세련된 건 알겠는데 우리 아이에게도 맞을지 걱정이 앞서요.',
  ],
  [
    '실용적이고 깔끔한 종합 인상. 시간 없는 엄마로서 간편함이 중요한데 그 점은 인정해요.',
    '아이 키우면서 쓸 만한지 먼저 봤는데 어느 정도 맞는 것 같아요.',
    '가성비를 더 따져봐야 할 것 같아요. 기능은 좋은데 가격이 고민입니다.',
    '시간 절약되는 제품을 선호하는데 이건 그 기준에 부합해요.',
    '세련된 건 알겠는데 현실적인 필요와는 거리감이 있어요.',
  ],
  [
    '실용성 검증 후 전환 가능. 가격 프로모션이 결정적 트리거.',
    '육아 편의성 측면 부가 가치가 명확히 전달되면 구매 가능성 상승.',
    '효율과 실용성 중심의 판단 기준. 브랜드 스토리보다 사용 경험 후기에 의존.',
    '가격 저항감 있으나 장기적 가치를 납득시키면 전환 가능한 세그먼트.',
    '중립적 입장. 주변 워킹맘 커뮤니티 반응을 보고 결정하는 경향.',
  ],
);

/* ── 페르소나 3: 깐깐한 절약형 주부 ── */
const _fhPanels = _mkPanels('FH', '깐깐한 절약형 주부',
  { pa: 2, pq: 2, bf: 2, bft: 2, mc: 2, ag: 2, bt: 2, ap: 2, vfm: 1, pf: 1, is_: 2, ri: 1, pl: 1, pc: 2, pw: 1, rpi: 1, pu: 1 },
  ['관심 없음', '보통', '관심 없음', '전혀 관심 없음', '보통',
   '관심 없음', '보통', '전혀 관심 없음', '관심 없음', '보통'],
  [
    '비싼데 굳이 왜 사야 하나 하는 거부감이 먼저 들어요.',
    '디자인은 예쁘지만 가격 생각하면 손이 안 가요. 불필요한 사치라는 느낌.',
    '광고처럼 실제로 좋은지 의심스러워요. 마케팅에 속는 게 아닌지 걱정돼요.',
    '이런 거 살 돈으로 다른 걸 사는 게 낫죠. 답답함을 느꼈어요.',
    '가격이 반이라도 됐으면 생각해봤겠지만 지금은 완전히 사치품이에요.',
  ],
  [
    '비싸 보이는데 왜 사야 하는지 모르겠어요. 같은 돈으로 더 실속 있는 걸 살 수 있어요.',
    '디자인은 예쁜데 가격 생각하면 손이 안 가요. 주부 입장에서 우선순위가 아닙니다.',
    '광고처럼 실제로 좋은지 의심스러워요. 검증된 브랜드를 더 선호합니다.',
    '이런 거 살 돈으로 애들 학원비 내는 게 낫죠. 필요성을 못 느끼겠어요.',
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
  { pa: 3, pq: 3, bf: 3, bft: 3, mc: 3, ag: 3, bt: 3, ap: 3, vfm: 3, pf: 2, is_: 3, ri: 2, pl: 2, pc: 3, pw: 2, rpi: 2, pu: 2 },
  ['보통', '다소 관심 있음', '보통', '관심 없음', '보통',
   '다소 관심 있음', '보통', '관심 없음', '보통', '보통'],
  [
    '정말 필요한가 하는 냉정한 의문이 먼저 들었어요. 소비 충동을 자극하는 느낌.',
    '브랜드 자체는 좋아 보이는데 파이어 달성 목표 때문에 구매 욕구를 억누르게 돼요.',
    '퀄리티는 인정하지만 이걸 사면 몇 년치 투자 복리를 포기하는 셈이에요.',
    '원하는 것보다 필요한 것 위주로 소비하는데 이 제품이 꼭 필요한지 모르겠어요.',
    '심플하고 기능적인 면은 좋은데 소비 자체를 줄이는 게 목표라서요.',
  ],
  [
    '미니멀한 삶을 추구하는 입장에서 정말 필요한가 먼저 따져봅니다. 솔직히 없어도 될 것 같아요.',
    '브랜드 자체는 좋아 보이는데 불필요한 소비는 자제합니다.',
    '퀄리티는 인정하는데 이걸 사면 몇 년치 투자 복리를 포기하는 셈이에요.',
    '필요한 것 위주로 소비하는데, 이 제품이 꼭 필요한지 모르겠어요.',
    '심플하고 기능적인 면은 좋은데, 소비 자체를 줄이는 게 목표라서요.',
  ],
  [
    '소비 억제 철학이 강한 세그먼트. ROI 명확성과 장기적 가치 입증이 유일한 설득 경로.',
    '필수재 여부 판단이 핵심. 삶의 질을 구체적으로 개선함을 증명해야 구매 가능.',
    '브랜드 가치는 인정하나 소비 철학과 충돌. 구독/공유 모델 제시 시 전환 가능성 상승.',
    '미니멀리즘 가치관으로 인해 구매 허들 높음. 장기 내구성·다용도성 강조 전략 필요.',
    '감성보다 논리적 설득이 효과적인 세그먼트. 비용 절감 효과 데이터 제시가 관건.',
  ],
);

/* ── QA 설정: 페르소나별 예상 범위 ── */
// 트렌드세터 MZ: 가격 무감각(고지출), 경쟁사 선호 없음, 회의주의 낮음 → Full mode
const _MZ_QA = { budgetLo: 4, budgetHi: 5, competitorLo: 3, competitorHi: 5, skepticismLo: 3, skepticismHi: 5, repNoise: 0.5 };
// 실용주의 워킹맘: 중간 가격민감도, 일부 경쟁사 선호, 중간 회의주의 → Full mode
const _WM_QA = { budgetLo: 2, budgetHi: 4, competitorLo: 1, competitorHi: 3, skepticismLo: 2, skepticismHi: 4, repNoise: 1 };
// 절약형 주부: 높은 가격민감도, 경쟁사 강한 선호, 높은 회의주의 → Lite mode
const _FH_QA = { budgetLo: 1, budgetHi: 2, competitorLo: 1, competitorHi: 2, skepticismLo: 1, skepticismHi: 2, repNoise: 1 };
// 파이어족: 높은 가격민감도, 경쟁사 없음(미니멀), 높은 회의주의 → Lite mode
const _FR_QA = { budgetLo: 1, budgetHi: 2, competitorLo: 3, competitorHi: 5, skepticismLo: 1, skepticismHi: 2, repNoise: 1.3 };

const _mzQA = _addQA(_mzPanels, 'full', _MZ_QA);
const _wmQA = _addQA(_wmPanels, 'full', _WM_QA);
const _fhQA = _addQA(_fhPanels, 'lite', _FH_QA);
const _frQA = _addQA(_frPanels, 'lite', _FR_QA);

export const DEMO_PERSONA_SUMMARIES = [
  _mkSummary('mz', _mzQA, {
    overall_impression: '인스타에 바로 올리고 싶은 감성. 트렌디하고 세련된 브랜드 비주얼이 인상적입니다.',
    emotional_response: '두근거리는 설렘과 소유욕. "이 브랜드는 나를 위한 것"이라는 강한 동일시.',
    perceived_message: '나만의 라이프스타일을 완성해주는 감성 브랜드',
    brand_association: '세련됨, 트렌디함, MZ세대를 대표하는 라이프스타일 아이콘',
    key_positives: '세련된 비주얼과 높은 SNS 공유 욕구; 강한 브랜드 동일시; 즉각적 구매 의향',
    key_concerns: '가격 정당화 필요; 트렌드 변화에 따른 지속 관심 불확실',
    competitive_comparison: '경쟁 브랜드보다 감성과 비주얼 면에서 뚜렷이 우위. 단, 가격 경쟁력은 비슷한 수준.',
    information_gap: '실제 사용 후기와 인플루언서 리뷰, 한정 에디션 여부 등 추가 정보 필요.',
    purchase_trigger: '얼리버드 한정 오퍼 또는 인플루언서 추천이 즉각적 전환 트리거',
    purchase_barrier: '가격 정당화와 트렌드 지속성에 대한 불확실성',
    price_perception: '감성 대비 합리적이라고 느끼나 좀 더 저렴하면 망설임 없이 구매.',
    review_summary: '핵심 타겟 페르소나. 높은 브랜드 공감도와 즉각적 구매 의향으로 전환율 극대화 예상.',
  }),
  _mkSummary('wm', _wmQA, {
    overall_impression: '실용적이고 깔끔한 종합 인상. 바쁜 워킹맘 입장에서 간편함이 눈에 띄어요.',
    emotional_response: '실용성에 대한 기대와 가격에 대한 망설임이 공존하는 중립적 감정.',
    perceived_message: '바쁜 현대인을 위한 효율적 솔루션 브랜드',
    brand_association: '실용적이고 깔끔함. 바쁜 현대인의 편의를 고려한 브랜드.',
    key_positives: '실용성과 편의성 인정; 깔끔한 디자인; 시간 절약 가능성',
    key_concerns: '가격 대비 가치 불명확; 육아 적합성 검증 필요; 결정에 시간 필요',
    competitive_comparison: '비슷한 가격대의 다른 브랜드들과 비교했을 때 디자인은 우위지만 가성비가 불분명.',
    information_gap: '실제 워킹맘 사용 후기, 내구성 정보, 할인 프로모션 여부가 필요.',
    purchase_trigger: '가격 할인 또는 무료 체험 제공이 결정적 전환 트리거',
    purchase_barrier: '가격 대비 가치 불명확. 주변 추천 없이는 결정하기 어려움.',
    price_perception: '가격이 약간 높다고 느낌. 할인 혜택이 있으면 구매 고려 가능.',
    review_summary: '실용성 검증 후 전환 가능한 세그먼트. 가격 프로모션과 사용 후기가 핵심 전환 요소.',
  }),
  _mkSummary('fh', _fhQA, {
    overall_impression: '비싸 보이는데 왜 사야 하는지 모르겠어요. 같은 돈으로 더 실속 있는 걸 살 수 있어요.',
    emotional_response: '거부감과 불필요함. 마케팅에 속는 것 같다는 불쾌함.',
    perceived_message: '고가 사치품 이미지로 인식. 실속 있는 가치 메시지가 전달되지 않음.',
    brand_association: '사치스럽고 비실용적인 브랜드. 없어도 되는 과소비 아이템.',
    key_positives: '디자인 자체는 나쁘지 않음; 일부 기능성 인정',
    key_concerns: '매우 높은 가격 저항감; 필요성 미인식; 기존 대안으로 충분히 만족',
    competitive_comparison: '현재 사용 중인 저렴한 대안으로 충분히 만족. 이 브랜드만의 차별점이 없음.',
    information_gap: '가격 인하 계획이나 대폭 할인 프로모션 여부만 관심 있음.',
    purchase_trigger: '50% 이상 대폭 할인이 유일한 구매 트리거',
    purchase_barrier: '현재 가격대에서는 절대 구매 불가. 필요성 자체를 못 느낌.',
    price_perception: '완전히 과대 책정된 가격. 현재 가격의 절반이어도 망설일 것 같음.',
    review_summary: '비타겟 고객군. 마케팅 비용 투자 대비 ROI 낮음. 이 세그먼트는 제외 권고.',
  }),
  _mkSummary('fr', _frQA, {
    overall_impression: '미니멀한 삶을 추구하는 입장에서 정말 필요한가 먼저 따져봅니다.',
    emotional_response: '냉정한 이성적 판단과 약간의 소비 충동 사이의 갈등. 결국 억제 쪽으로.',
    perceived_message: '불필요한 소비를 자극하는 브랜드로 인식될 위험 있음.',
    brand_association: '고품질이지만 불필요한 소비를 조장하는 브랜드.',
    key_positives: '브랜드 퀄리티 자체는 인정; 미니멀한 디자인 방향성에 공감',
    key_concerns: '소비 철학과 충돌; 파이어 목표와 상충; 필수재 여부 불명확',
    competitive_comparison: '브랜드 퀄리티는 인정하나 소비 자체를 최소화하는 게 목표라 비교 의미 없음.',
    information_gap: '장기 내구성 데이터, 비용 절감 효과 수치, 구독/공유 모델 여부.',
    purchase_trigger: '장기 비용 절감 데이터 또는 구독 모델이 유일한 설득 경로',
    purchase_barrier: '소비 억제 철학 자체가 근본적 장벽. 파이어 목표와 상충.',
    price_perception: '품질 대비 가격은 납득 가능하나 구매 자체가 소비 철학에 위배됨.',
    review_summary: '소비 억제 철학으로 인해 전환 허들 높음. 장기적 가치 및 ROI 입증 전략 필요.',
  }),
];

export const DEMO_PANEL_REVIEWS = [..._mzQA, ..._wmQA, ..._fhQA, ..._frQA];

export const DEMO_SYNTHESIS = {
  // Overall
  executive_summary: '감성 소구가 일부 세그먼트에는 강한 구매 동기로, 나머지에는 거부 반응으로 작동해 반응이 극단적으로 양극화됐다.',
  go_nogo_recommendation: '조건부 추천 — Brand 퍼널에서 트렌드세터 MZ세대만 유효한 반응을 보였으며, 나머지 세그먼트는 인식 단계부터 실패했다. MZ세대 집중 조건 하에 제한적 출시 권고.',
  improvement_priority: '메시지 — 소재가 감성 소구에만 집중되어 있어 가치 증거가 부재하다. 구체적 사용 가치를 카피·비주얼로 명시해야 한다.',
  actionable_recommendations: [
    '소재 상단에 핵심 사용 가치 수치 카피 추가 (예: "하루 XX분 절약") — 가치 불명확 반응 해소',
    '실사용 Before/After 비주얼 삽입 — "마케팅에 속는 것 같다"는 불신 반응 대응',
    '가격을 일 단위 환산 표기로 변경 (예: "하루 XX원") — 가격 저항 완화',
  ],
  usage_strategy: [
    'MZ세대 대상 SNS 인플루언서 채널 1차 집행 — "인플루언서 추천"이 즉각 전환 트리거로 확인됨',
    '워킹맘 대상 육아 커뮤니티·후기 플랫폼 시딩 병행 — "주변 추천"이 결정적 조건으로 확인됨',
    '가치관 충돌 세그먼트는 ROI 증거 기반 별도 캠페인으로 분리 — 현재 소재로 전환 불가',
  ],
  // Upper
  avg_brand_attitude: 3.2, avg_brand_fit: 3.0, avg_ad_effectiveness: 3.3,
  emotional_tone_summary: '브랜드 동일시 여부에 따라 설렘·소유욕 vs 거부감·불쾌함으로 양극화됐다. 감성 소구가 가치관 충돌 소비자에게는 역효과를 내는 구조다.',
  message_gap_analysis: '"라이프스타일 감성" 메시지는 감성 지향 패널에만 의도대로 수신됐고, 나머지는 "효율적 솔루션" 또는 "사치품 조장"으로 왜곡 지각했다. 단일 메시지 전략의 구조적 한계가 확인됐다.',
  brand_association_summary: '동일 소재가 "라이프스타일 아이콘"과 "과소비 조장"이라는 정반대 연상을 동시에 생성하고 있다. 브랜드 신뢰를 높이는 방향과 낮추는 방향이 공존하는 양날의 구조다.',
  // Mid
  overall_score: 3.2, avg_perceived_value: 2.8,
  demand_trigger_summary: '수요 발생 조건은 "감성 공명"과 "기능적 가치 증거" 두 가지인데, 현재 소재는 감성 공명만 충족한다. 기능 가치 우선 패널은 추가 조건(할인·체험) 없이는 관심으로 이어지지 않는다.',
  consideration_barrier_summary: '"가격 대비 가치 불명확"·"사회적 증거 부재"는 소재 보완으로 해소 가능하지만, "필요성 미인식"·"소비 철학 거부"는 소재 수정으로 해결 불가한 구조적 장벽이다.',
  wom_potential: '자발적 공유 의향은 브랜드 동일시 패널에서만 확인됐다. WOM 전략은 전체 타겟이 아닌 동일시 세그먼트에 집중해야 효율적이다.',
  segment_insights: [
    '브랜드 동일시 여부가 퍼널 전 단계를 결정하는 단일 핵심 변수',
    '감성 소구가 가치관 충돌 패널에는 역효과 — 단일 소재의 양극화 리스크',
    '전환 가능·불가 패널이 명확히 분리 — 단일 캠페인 전체 커버는 비효율적',
  ],
  target_segment_priority: [
    '1순위: 브랜드 동일시 세그먼트 — 현재 소재로 즉각 전환 가능',
    '2순위: 기능 가치 우선 세그먼트 — 가치 증거 보완 시 전환 가능',
    '3순위: 가치관 충돌 세그먼트 — 현재 접근으로 전환 불가, 별도 전략 필요',
  ],
  // Lower
  avg_purchase_intention: 2.5, avg_purchase_probability: 2.3, estimated_conversion_range: '3-5%',
  key_conversion_barriers: [
    '가치 증거 부재 — 감성만으로 가격 지불 근거를 제시하지 못함',
    '사회적 증거 부재 — 후기·추천 없이는 최종 결정이 어려운 패턴',
    '철학적 소비 충돌 — 가격·가치가 아닌 소비 자체를 거부하는 구조적 장벽',
  ],
  conversion_driver_analysis: '전환 트리거가 즉각 공명(소수)과 조건 충족 후 전환(다수)으로 이원화됐다. 전환 효율을 높이려면 체험·할인·후기 등 조건 충족 장치가 병행되어야 한다.',
  price_perception_summary: '가격 저항은 "가치 인식 문제"(소재 보완 가능), "가격 수준 문제"(할인으로 완화 가능), "소비 철학 문제"(해소 불가) 세 유형으로 나뉜다. 가격 인하만으로 전환율을 끌어올리는 데는 구조적 한계가 있다.',
};
