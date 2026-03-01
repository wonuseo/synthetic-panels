/* ── State ── */
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];

let selectedFile = null;
let personasLoaded = false;
const $textContent = document.getElementById('text-content');
let lastReviews = [];
let lastSynthesis = null;
let lastSynthesisRaw = null;
window.funnelConfig = null;

/* ── Load funnel config ── */
async function loadFunnelConfig() {
  try {
    const res = await fetch('/api/funnel-config');
    const data = await res.json();
    if (data.ok) window.funnelConfig = data.funnels;
  } catch (e) {
    console.error('Failed to load funnel config:', e);
  }
}
loadFunnelConfig();

/* ── Demo mode (no server required) ── */
function loadDemo() {
  window.funnelConfig = {
    upper: {
      label: 'Brand (브랜드 자산 구축)', description: '브랜드 인지, 태도, 이미지 형성 관련 지표',
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
        { key: 'avg_brand_attitude',  label: '평균 브랜드 태도',   type: 'quantitative' },
        { key: 'avg_brand_fit',       label: '평균 브랜드 적합성', type: 'quantitative' },
        { key: 'avg_ad_effectiveness',label: '평균 광고 효과성',   type: 'quantitative' },
        { key: 'message_gap_analysis',  label: '메시지 갭 분석',  type: 'qualitative' },
        { key: 'emotional_tone_summary',label: '감정 톤 요약',    type: 'qualitative' },
      ],
      qa_items: [{ key: 'qa_rep_brand_attitude', type: 'replication' }, { key: 'qa_trap_skepticism_check', type: 'trap' }],
    },
    mid: {
      label: 'Demand & Acquisition (수요 창출·신규 획득)', description: '관심, 가치 인식, 경쟁 우위, 추천 관련 지표',
      individual_items: [
        { key: 'appeal_score',   label: '매력도',      scale: '1-10', type: 'quantitative' },
        { key: 'value_for_money',label: '가성비',       scale: '1-7',  type: 'quantitative' },
        { key: 'price_fairness', label: '가격 적정성', scale: '1-7',  type: 'quantitative' },
        { key: 'info_sufficiency',label: '정보 충분성', scale: '1-7',  type: 'quantitative' },
        { key: 'key_positives',  label: '긍정 요소',                   type: 'qualitative' },
        { key: 'key_concerns',   label: '우려 사항',                   type: 'qualitative' },
        { key: 'competitive_preference', label: '경쟁 비교',           type: 'qualitative' },
        { key: 'recommendation_context', label: '추천 맥락',           type: 'qualitative' },
        { key: 'recommendation', label: '관심도',                      type: 'categorical' },
      ],
      synthesis_items: [
        { key: 'overall_score',       label: '종합 매력도',           type: 'quantitative' },
        { key: 'avg_perceived_value', label: '평균 지각된 가치',       type: 'quantitative' },
        { key: 'consensus_positives', label: '공통 긍정 요소',         type: 'qualitative' },
        { key: 'consensus_concerns',  label: '공통 우려 사항',         type: 'qualitative' },
        { key: 'segment_insights',    label: '세그먼트 인사이트',      type: 'qualitative' },
        { key: 'target_segment_priority', label: '타겟 세그먼트 우선순위', type: 'qualitative' },
      ],
      qa_items: [{ key: 'qa_rep_value_perception', type: 'replication' }, { key: 'qa_trap_budget_sensitivity', type: 'trap' }],
    },
    lower: {
      label: 'Sales & Conversion (전환·매출)', description: '구매 의향, 전환율, 장벽, 의사결정 지원 지표',
      individual_items: [
        { key: 'likelihood_high',          label: '구매 가능성',       scale: '1-7',  type: 'quantitative' },
        { key: 'probability_consider_high',label: '고려 확률',          scale: '1-7',  type: 'quantitative' },
        { key: 'willingness_high',         label: '구매 의향',          scale: '1-7',  type: 'quantitative' },
        { key: 'purchase_probability_juster', label: '구매 확률(Juster)', scale: '0-10', type: 'quantitative' },
        { key: 'purchase_trigger_barrier', label: '구매 촉진/장벽',                   type: 'qualitative' },
        { key: 'review_summary',           label: '종합 평가',                        type: 'qualitative' },
      ],
      synthesis_items: [
        { key: 'avg_purchase_intention',   label: '평균 구매 의향',  type: 'quantitative' },
        { key: 'avg_purchase_probability', label: '평균 구매 확률',  type: 'quantitative' },
        { key: 'estimated_conversion_range', label: '예상 전환율',   type: 'quantitative' },
        { key: 'key_conversion_barriers',  label: '핵심 전환 장벽',  type: 'qualitative' },
        { key: 'actionable_recommendations', label: '개선 제안',     type: 'qualitative' },
        { key: 'executive_summary',        label: '핵심 요약',       type: 'qualitative' },
        { key: 'go_nogo_recommendation',   label: 'Go/No-Go 의사결정', type: 'categorical' },
      ],
      qa_items: [{ key: 'qa_rep_purchase_intent', type: 'replication' }],
    },
  };

  const reviews = [
    {
      persona_name: '김지수', recommendation: '매우 관심 있음', appeal_score: 8,
      like_dislike: 6, favorable_unfavorable: 6, brand_self_congruity: 5, brand_image_fit: 6, message_clarity: 6, attention_grabbing: 7,
      value_for_money: 6, price_fairness: 5, info_sufficiency: 6,
      likelihood_high: 6, probability_consider_high: 6, willingness_high: 6, purchase_probability_juster: 7,
      first_impression: '세련되고 현대적인 느낌이 강하게 전달됐어요. 첫눈에 브랜드 가치가 느껴졌습니다.',
      perceived_message: '프리미엄 라이프스타일을 추구하는 사람들을 위한 제품이라는 메시지가 명확합니다.',
      emotional_response: '설레고 기대되는 감정이 들었습니다. 당장 사용해보고 싶다는 생각이 들었어요.',
      key_positives: '디자인이 매우 세련됨; 브랜드 이미지가 고급스러움; 기능성과 심미성 모두 충족',
      key_concerns: '가격대가 다소 높을 것 같음; 내구성에 대한 정보가 부족함',
      competitive_preference: '기존 사용하던 브랜드보다 디자인 면에서 확실히 우위',
      recommendation_context: '인스타그램 피드에 올릴만한 감성이라 지인들에게 자연스럽게 공유할 것 같습니다.',
      purchase_trigger_barrier: '신제품 출시 시 얼리버드 할인이 있다면 즉시 구매할 의향 있음',
      review_summary: '전반적으로 매우 긍정적인 평가. 브랜드 아이덴티티와 개인 라이프스타일이 잘 맞아 높은 구매 전환 가능성.',
      qa_result: { qa_mode: 'lite', consistency_score: 0.92, trap_pass_rate: 0.85, persona_quality: 0.88, qa_passed: true, qa_rep_brand_attitude: 6, qa_trap_budget_sensitivity: 5 },
      raw_response: '{"appeal_score": 8, ...}',
    },
    {
      persona_name: '이민준', recommendation: '다소 관심 있음', appeal_score: 6,
      like_dislike: 5, favorable_unfavorable: 5, brand_self_congruity: 4, brand_image_fit: 5, message_clarity: 5, attention_grabbing: 5,
      value_for_money: 4, price_fairness: 4, info_sufficiency: 5,
      likelihood_high: 4, probability_consider_high: 5, willingness_high: 4, purchase_probability_juster: 5,
      first_impression: '깔끔하고 정갈한 느낌이에요. 과하지 않아서 좋은데 좀 더 임팩트가 있었으면 합니다.',
      perceived_message: '품질에 대한 자신감을 보여주는 메시지. 하지만 차별화 포인트가 더 명확했으면 좋겠습니다.',
      emotional_response: '안정적이고 신뢰감 있는 느낌. 큰 감흥은 없지만 거부감도 없습니다.',
      key_positives: '깔끔한 디자인; 신뢰감 있는 이미지; 사용하기 편해 보임',
      key_concerns: '가격 대비 차별화가 불명확; 비슷한 경쟁 제품과 구분이 어려움; 브랜드 스토리가 약함',
      competitive_preference: '현재 사용 중인 제품과 비교했을 때 가성비 면에서 비슷한 수준',
      recommendation_context: '가격이 적당하거나 할인 행사가 있을 때 추천할 것 같습니다.',
      purchase_trigger_barrier: '추가 리뷰와 사용 후기를 더 확인 후 결정할 예정',
      review_summary: '중립적 평가. 브랜드 차별화와 가격 경쟁력을 강화하면 전환율 향상 여지 있음.',
      qa_result: { qa_mode: 'lite', consistency_score: 0.78, trap_pass_rate: 0.75, persona_quality: 0.80, qa_passed: true, qa_rep_brand_attitude: 5, qa_trap_budget_sensitivity: 4 },
      raw_response: '{"appeal_score": 6, ...}',
    },
    {
      persona_name: '박소연', recommendation: '보통', appeal_score: 4,
      like_dislike: 3, favorable_unfavorable: 4, brand_self_congruity: 3, brand_image_fit: 3, message_clarity: 4, attention_grabbing: 3,
      value_for_money: 3, price_fairness: 3, info_sufficiency: 4,
      likelihood_high: 3, probability_consider_high: 3, willingness_high: 2, purchase_probability_juster: 3,
      first_impression: '무난하지만 특별히 끌리지는 않아요. 저의 취향과는 조금 다른 것 같습니다.',
      perceived_message: '어떤 메시지를 전달하려는지 명확하게 느껴지지 않았습니다.',
      emotional_response: '무감각한 편. 브랜드에 대한 특별한 감정이 생기지 않았습니다.',
      key_positives: '깔끔한 레이아웃; 정보가 이해하기 쉬움',
      key_concerns: '나의 라이프스타일과 맞지 않는 느낌; 가격이 예산을 초과할 것 같음; 필요성을 못 느낌',
      competitive_preference: '현재 사용 중인 제품으로 충분히 만족하고 있어 교체 동기가 약함',
      recommendation_context: '주변에 이런 종류의 제품을 찾는 사람이 있다면 언급할 수도 있을 것 같습니다.',
      purchase_trigger_barrier: '현재 필요성을 크게 느끼지 못해 당분간 구매 계획 없음',
      review_summary: '관심도 낮음. 타겟 페르소나와의 라이프스타일 적합성을 재검토할 필요 있음.',
      qa_result: { qa_mode: 'lite', consistency_score: 0.72, trap_pass_rate: 0.70, persona_quality: 0.74, qa_passed: true, qa_rep_brand_attitude: 3, qa_trap_budget_sensitivity: 3 },
      raw_response: '{"appeal_score": 4, ...}',
    },
    {
      persona_name: '최준혁', recommendation: '관심 없음', appeal_score: 2,
      like_dislike: 2, favorable_unfavorable: 2, brand_self_congruity: 2, brand_image_fit: 2, message_clarity: 3, attention_grabbing: 2,
      value_for_money: 2, price_fairness: 2, info_sufficiency: 3,
      likelihood_high: 2, probability_consider_high: 2, willingness_high: 1, purchase_probability_juster: 2,
      first_impression: '저와는 전혀 맞지 않는 제품 같습니다. 관심이 생기지 않았습니다.',
      perceived_message: '메시지 자체는 이해하지만 나에게는 해당되지 않는 이야기처럼 느껴집니다.',
      emotional_response: '부정적이지는 않지만 완전히 무관심합니다.',
      key_positives: '디자인이 나쁘지는 않음',
      key_concerns: '가격이 너무 비싸 보임; 내 생활에 필요 없는 제품; 브랜드를 잘 모름',
      competitive_preference: '이 카테고리 자체를 잘 사용하지 않아 비교가 어려움',
      recommendation_context: '주변에 추천할 생각이 없습니다.',
      purchase_trigger_barrier: '가격을 50% 이상 낮추거나 무료 체험 기회가 없으면 구매 없음',
      review_summary: '비타겟 고객. 제품 카테고리 자체에 대한 관심도가 낮아 전환 가능성 매우 낮음.',
      qa_result: { qa_mode: 'lite', consistency_score: 0.65, trap_pass_rate: 0.60, persona_quality: 0.68, qa_passed: false, qa_rep_brand_attitude: 2, qa_trap_budget_sensitivity: 2 },
      raw_response: '{"appeal_score": 2, ...}',
    },
  ];

  const synthesis = {
    avg_brand_attitude: 4.0, avg_brand_fit: 4.0, avg_ad_effectiveness: 4.3,
    overall_score: 6.5, avg_perceived_value: 3.8,
    avg_purchase_intention: 3.8, avg_purchase_probability: 4.3, estimated_conversion_range: 3.2,
    emotional_tone_summary: '전반적으로 브랜드에 대한 중립~긍정적 감정 반응이 나타났으며, 특히 20대 여성 세그먼트에서 강한 공감대가 형성되었습니다.',
    message_gap_analysis: '프리미엄 이미지는 전달되나 "왜 이 브랜드여야 하는가"에 대한 차별화 메시지가 부족합니다.',
    consensus_positives: '세련된 디자인과 고급스러운 이미지에 대한 긍정적 반응이 공통적으로 나타남',
    consensus_concerns: '가격 대비 가치 불명확, 경쟁 제품과의 차별화 포인트 부재',
    segment_insights: '30대 초반 직장인 여성(김지수 유형)이 핵심 타겟으로 식별됨. 가성비보다 라이프스타일 부합성을 중시하는 세그먼트.',
    target_segment_priority: '1순위: 20-30대 라이프스타일 중시형(김지수), 2순위: 실용성 중시형(이민준)',
    wom_potential: '핵심 타겟(김지수 유형)에서 SNS 구전 가능성 높음. 비타겟 고객층에서는 낮음.',
    key_conversion_barriers: '높은 가격 인식, 필요성 불명확, 경쟁 제품 대비 차별화 부족',
    actionable_recommendations: '1) 핵심 타겟 세그먼트 집중 마케팅, 2) 가격 정당화를 위한 품질 스토리텔링 강화, 3) 얼리버드/체험 이벤트 운영',
    executive_summary: '전반적으로 브랜드 이미지는 긍정적이나, 구매 전환에는 가격 정당화와 차별화 메시지 강화가 필요합니다.',
    go_nogo_recommendation: '조건부 GO — 핵심 타겟 세그먼트를 명확히 하고 가격 포지셔닝 전략 수립 후 출시 권고',
    improvement_priority: '메시지 차별화 및 가격 전략',
  };

  showResults({ reviews, synthesis, synthesis_raw: null });
}

/* ── DOM refs ── */
const $dropZone     = document.getElementById('drop-zone');
const $fileInput    = document.getElementById('file-input');
const $preview      = document.getElementById('preview');
const $btnRun       = document.getElementById('btn-run');
const $progress     = document.getElementById('progress-area');
const $progressFill = document.getElementById('progress-fill');
const $progressText = document.getElementById('progress-text');
const $btnLoad      = document.getElementById('btn-load-personas');
const $pStatus      = document.getElementById('persona-status');
const $pListWrap    = document.getElementById('persona-list-wrap');
const $provider     = document.getElementById('provider');
const $providerWarn = document.getElementById('provider-warning');
const $model        = document.getElementById('model');
const $pageUpload   = document.getElementById('page-upload');
const $pageResults  = document.getElementById('page-results');
const $btnBack      = document.getElementById('btn-back');
const $btnSave      = document.getElementById('btn-save');

/* ── Model selector ── */
function updateModels() {
  $model.innerHTML = OPENAI_MODELS.map(m => `<option value="${m}">${m}</option>`).join('');
}
$provider.addEventListener('change', () => {
  $providerWarn.classList.toggle('hidden', $provider.value !== 'Claude');
  updateModels();
});
updateModels();

/* ── File upload ── */
$dropZone.addEventListener('click', () => $fileInput.click());
$dropZone.addEventListener('dragover', e => { e.preventDefault(); $dropZone.classList.add('dragover'); });
$dropZone.addEventListener('dragleave', () => $dropZone.classList.remove('dragover'));
$dropZone.addEventListener('drop', e => {
  e.preventDefault(); $dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
$fileInput.addEventListener('change', () => { if ($fileInput.files.length) handleFile($fileInput.files[0]); });

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','png','jpg','jpeg'].includes(ext)) { alert('PDF, PNG, JPG만 지원합니다.'); return; }
  selectedFile = file;
  $preview.classList.remove('hidden');
  if (ext === 'pdf') {
    $preview.innerHTML = `<div class="pdf-tag">📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)</div>`;
  } else {
    const url = URL.createObjectURL(file);
    $preview.innerHTML = `<img src="${url}" alt="${file.name}" />`;
  }
  updateRunBtn();
}

function updateRunBtn() {
  $btnRun.disabled = !((selectedFile || $textContent.value.trim()) && personasLoaded);
}
$textContent.addEventListener('input', updateRunBtn);

/* ── Load personas ── */
$btnLoad.addEventListener('click', async () => {
  $pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">로딩 중...</div>';
  $pListWrap.classList.add('hidden');
  $pListWrap.innerHTML = '';
  try {
    const res = await fetch('/api/personas', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      personasLoaded = true;
      $pStatus.innerHTML = `<div class="persona-badge ok">✅ ${data.personas.length}명 로드 완료</div>`;
      $pListWrap.classList.remove('hidden');
      $pListWrap.innerHTML = `<div class="persona-list">${
        data.personas.map(p => `
          <div class="persona-list-item">
            <span class="p-name">${esc(p.persona_name)}</span>
            ${p.panel_gender ? `<span class="p-tag">${esc(p.panel_gender)}</span>` : ''}
            ${p.persona_season ? `<span class="p-tag">${esc(p.persona_season)}</span>` : ''}
          </div>`).join('')
      }</div>`;
    } else {
      personasLoaded = false;
      $pStatus.innerHTML = `<div class="persona-badge err">❌ ${data.error}</div>`;
    }
  } catch (e) {
    personasLoaded = false;
    $pStatus.innerHTML = `<div class="persona-badge err">❌ 네트워크 오류</div>`;
  }
  updateRunBtn();
});

/* ── Run review (SSE) ── */
$btnRun.addEventListener('click', async () => {
  const textVal = $textContent.value.trim();
  if ((!selectedFile && !textVal) || !personasLoaded) return;
  $btnRun.disabled = true;
  $progress.classList.remove('hidden');
  $progressFill.style.width = '0%';
  $progressText.textContent = '리뷰를 시작합니다...';

  const fd = new FormData();
  if (selectedFile) fd.append('file', selectedFile);
  if (textVal) fd.append('text_content', textVal);
  fd.append('provider', $provider.value);
  fd.append('model', $model.value);
  fd.append('qa_mode', document.getElementById('qa-mode').value);

  try {
    const res = await fetch('/api/review', { method: 'POST', body: fd });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (eventType === 'progress') {
              const pct = (payload.completed / payload.total) * 100;
              $progressFill.style.width = pct + '%';
              $progressText.textContent = `${payload.completed}/${payload.total} 완료 — ${payload.persona_name}`;
            } else if (eventType === 'status') {
              $progressText.textContent = payload.message;
            } else if (eventType === 'done') {
              showResults(payload);
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    alert('리뷰 실행 중 오류: ' + e.message);
  }

  $progress.classList.add('hidden');
  $btnRun.disabled = false;
});

/* ── Navigation ── */
$btnBack.addEventListener('click', () => {
  $pageResults.classList.add('hidden');
  $pageUpload.classList.remove('hidden');
});

/* ── Save ── */
$btnSave.addEventListener('click', async () => {
  if (!lastReviews.length) return;
  $btnSave.disabled = true;
  $btnSave.textContent = '저장 중...';
  const fd = new FormData();
  fd.append('reviews_json', JSON.stringify(lastReviews));
  if (lastSynthesis) fd.append('synthesis_json', JSON.stringify(lastSynthesis));
  try {
    const res = await fetch('/api/save', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) {
      $btnSave.textContent = `✅ ${data.count}건 저장 완료`;
      setTimeout(() => { $btnSave.textContent = '💾 Save to Sheets'; $btnSave.disabled = false; }, 3000);
    } else {
      alert('저장 실패: ' + data.error);
      $btnSave.textContent = '💾 Save to Sheets';
      $btnSave.disabled = false;
    }
  } catch (e) {
    alert('저장 중 오류: ' + e.message);
    $btnSave.textContent = '💾 Save to Sheets';
    $btnSave.disabled = false;
  }
});

/* ── Tab switching ── */
document.getElementById('tab-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
});

/* ══════════════════════════════
   Render results page
   ══════════════════════════════ */
function showResults(payload) {
  const { reviews, synthesis, synthesis_raw } = payload;
  lastReviews = reviews;
  lastSynthesis = synthesis;
  lastSynthesisRaw = synthesis_raw;

  $pageUpload.classList.add('hidden');
  $pageResults.classList.remove('hidden');

  // Reset to overview tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
  document.getElementById('tab-overview').classList.add('active');

  renderOverviewTab(reviews, synthesis, synthesis_raw);
  renderFunnelTab('upper');
  renderFunnelTab('mid');
  renderFunnelTab('lower');
  renderIndividualTab(reviews);
  renderQATab(reviews);
}

/* ── Overview Tab ── */
function renderOverviewTab(reviews, synthesis, synthesis_raw) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error).length;
  const interested = reviews.filter(r => r.recommendation && (
    r.recommendation.includes('관심 있음') || (r.recommendation.includes('Interested') && !r.recommendation.includes('Not'))
  )).length;

  const funnelAverages = computeFunnelAverages(valid);

  let html = '';
  html += renderMetricGroups(reviews, valid, errors, interested, funnelAverages);
  html += renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw);
  html += renderAppealChart(reviews);
  html += renderFunnelSummaries(synthesis);
  html += renderIntegratedChart(valid);
  html += renderTargetDeepDive(valid);

  document.getElementById('tab-overview').innerHTML = html;
}

/* ── computeFunnelAverages — shared util ── */
function computeFunnelAverages(valid) {
  const result = {};
  if (!window.funnelConfig) return result;
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const vals = [];
    for (const item of quantItems) {
      const scores = valid.map(r => r[item.key]).filter(v => v > 0);
      if (scores.length) {
        const max = item.scale === '0-10' || item.scale === '1-10' ? 10 : 7;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        vals.push({ avg, max });
      }
    }
    if (vals.length) {
      const funnelAvg = vals.reduce((a, v) => a + v.avg, 0) / vals.length;
      result[key] = {
        avg: funnelAvg.toFixed(1),
        max: vals[0].max,
        label: funnel.label,
        normalized: funnelAvg / vals[0].max,
      };
    }
  }
  return result;
}

/* ── Section 1: mini panel status + funnel diagram ── */
function renderMetricGroups(reviews, valid, errors, interested, funnelAverages) {
  let html = '<div class="panel-status-mini">';
  html += `<span class="mini-stat">총 패널 <strong>${reviews.length}명</strong></span>`;
  html += `<span class="mini-stat">유효 응답 <strong>${valid.length}명</strong>${errors ? ` · 오류 <strong>${errors}건</strong>` : ''}</span>`;
  html += `<span class="mini-stat">관심 표명 <strong>${interested}명</strong></span>`;
  html += '</div>';
  if (Object.keys(funnelAverages).length) html += renderFunnelDiagram(funnelAverages);
  return html;
}

/* ── Funnel visual diagram (trapezoid clip-path) ── */
function renderFunnelDiagram(funnelAverages) {
  const entries = Object.entries(funnelAverages);
  const colors = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' };
  // Each stage: clip-path trapezoid coords [tl,tr,br,bl] + inner content padding
  const stageConfigs = [
    { clip: 'polygon(0% 0%, 100% 0%, 91% 100%, 9% 100%)',  pad: '0 13%' },
    { clip: 'polygon(9% 0%, 91% 0%, 82% 100%, 18% 100%)',  pad: '0 22%' },
    { clip: 'polygon(18% 0%, 82% 0%, 73% 100%, 27% 100%)', pad: '0 30%' },
  ];

  let html = '<div class="card funnel-visual"><h2>📊 퍼널 점수</h2><div class="funnel-diagram-wrap">';
  entries.forEach(([key, fa], i) => {
    const color = colors[key] || '#6c5ce7';
    const normPct = Math.round(fa.normalized * 100);
    const shortLabel = fa.label.split('(')[0].trim();
    const cfg = stageConfigs[i] || stageConfigs[2];
    html += `<div class="funnel-stage" style="clip-path:${cfg.clip};background:${color}15">`;
    html += `<div class="funnel-score-fill" style="width:${normPct}%;background:${color}40"></div>`;
    html += `<div class="funnel-stage-content" style="padding:${cfg.pad}">`;
    html += `<span class="funnel-stage-label">${esc(shortLabel)}</span>`;
    html += `<span class="funnel-stage-score" style="color:${color}">${fa.avg} / ${fa.max}</span>`;
    html += `</div></div>`;
  });
  html += '</div></div>';
  return html;
}

/* ── Section 2: 전략적 권고 내러티브 ── */
function renderStrategicNarrative(funnelAverages, valid, synthesis, synthesis_raw) {
  let strongestFunnel = null, strongestNorm = 0;
  for (const [key, fa] of Object.entries(funnelAverages)) {
    if (fa.normalized > strongestNorm) { strongestNorm = fa.normalized; strongestFunnel = { key, ...fa }; }
  }
  const topPersona = valid.length ? [...valid].sort((a, b) => b.appeal_score - a.appeal_score)[0] : null;

  let html = '<div class="card storyline"><h2>🎯 전략적 권고</h2>';

  let mainText = '';
  if (strongestFunnel && topPersona) {
    mainText = `현재의 프로모션은 <strong>${esc(strongestFunnel.label.split('(')[0].trim())}</strong>에서 유효하며, <strong>${esc(topPersona.persona_name)}</strong> 세그먼트에서 가장 반응이 좋았습니다.`;
  } else if (strongestFunnel) {
    mainText = `현재의 프로모션은 <strong>${esc(strongestFunnel.label.split('(')[0].trim())}</strong>에서 가장 유효합니다.`;
  } else if (topPersona) {
    mainText = `<strong>${esc(topPersona.persona_name)}</strong> 세그먼트에서 가장 반응이 좋았습니다.`;
  }
  if (mainText) html += `<div class="narrative-main">${mainText}</div>`;

  if (valid.length && window.funnelConfig) {
    html += '<div class="funnel-layer-list">';
    for (const [funnelKey, funnel] of Object.entries(window.funnelConfig)) {
      const shortLabel = funnel.label.split('(')[0].trim();
      const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
      const max = quantItems.length && (quantItems[0].scale === '0-10' || quantItems[0].scale === '1-10') ? 10 : 7;
      const scored = valid.map(r => {
        const scores = quantItems.map(item => r[item.key]).filter(v => v > 0);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { r, norm: avg / max };
      }).filter(x => x.norm > 0).sort((a, b) => b.norm - a.norm);
      if (!scored.length) continue;

      const mostPos = scored[0].r;
      const mostNeg = scored[scored.length - 1].r;
      const posComment = funnelKey === 'upper'
        ? (mostPos.first_impression || (mostPos.key_positives || '').split('; ')[0])
        : funnelKey === 'mid'
          ? (mostPos.key_positives || '').split('; ')[0]
          : (mostPos.purchase_trigger_barrier || (mostPos.key_positives || '').split('; ')[0]);
      const negComment = funnelKey === 'lower'
        ? (mostNeg.purchase_trigger_barrier || (mostNeg.key_concerns || '').split('; ')[0])
        : (mostNeg.key_concerns || '').split('; ')[0];

      const posScore = (scored[0].norm * max).toFixed(1);
      const negScore = (scored[scored.length - 1].norm * max).toFixed(1);
      const posPct = Math.round(scored[0].norm * 100);
      const negPct = Math.round(scored[scored.length - 1].norm * 100);
      const color = { upper: '#6c5ce7', mid: '#0984e3', lower: '#00b894' }[funnelKey] || '#6c5ce7';

      html += `<div class="funnel-layer-section">`;
      html += `<div class="funnel-layer-header"><span class="funnel-tag ${funnelKey}">${esc(shortLabel)}</span></div>`;
      html += `<div class="persona-layer layer-pos">`;
      html += `<div class="layer-persona-info"><span class="layer-badge pos">▲ 최고 반응</span><span class="layer-persona-name">${esc(mostPos.persona_name)}</span><div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${posPct}%;background:${color}"></div></div><span class="layer-score-val" style="color:${color}">${posScore} / ${max}</span></div>`;
      html += `<div class="layer-comment">${posComment ? esc(String(posComment).substring(0, 130)) : ''}</div>`;
      html += `</div>`;
      if (scored.length > 1) {
        html += `<div class="persona-layer layer-neg">`;
        html += `<div class="layer-persona-info"><span class="layer-badge neg">▼ 최저 반응</span><span class="layer-persona-name">${esc(mostNeg.persona_name)}</span><div class="layer-score-bar-wrap"><div class="layer-score-fill-bar" style="width:${negPct}%;background:#d63031"></div></div><span class="layer-score-val" style="color:#d63031">${negScore} / ${max}</span></div>`;
        html += `<div class="layer-comment">${negComment ? esc(String(negComment).substring(0, 130)) : ''}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* ── Section 3: 매력도 점수 분포 ── */
function renderAppealChart(reviews) {
  const scored = reviews.filter(r => r.appeal_score > 0).sort((a, b) => b.appeal_score - a.appeal_score);
  if (!scored.length) return '';
  let html = `<div class="card chart-area"><h2>📈 매력도 점수 분포</h2><div>`;
  html += scored.map(r => {
    const pct = r.appeal_score * 10;
    const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
    return `<div class="bar-row"><div class="name">${esc(r.persona_name)}</div><div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%">${r.appeal_score}</div></div></div>`;
  }).join('');
  html += '</div></div>';
  return html;
}

/* ── Section 4: 퍼널별 핵심 지표 카드 ── */
function renderFunnelSummaries(synthesis) {
  if (!synthesis || synthesis.error || !window.funnelConfig) return '';
  let html = '<div class="card"><h2>📊 퍼널별 핵심 지표</h2><div class="funnel-summaries">';
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    html += renderFunnelSummaryCard(key, funnel, synthesis);
  }
  html += '</div></div>';
  return html;
}

function renderFunnelSummaryCard(key, funnel, synthesis) {
  const synQuant = [], synQual = [];
  for (const item of funnel.synthesis_items) {
    const val = synthesis[item.key];
    if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
    if (item.type === 'quantitative' && typeof val === 'number') {
      const suffix = item.key.includes('probability') || item.key.includes('conversion') || item.key === 'overall_score' ? '/10' : '/7';
      synQuant.push({ label: item.label, val, suffix });
    } else if (item.type !== 'categorical') {
      synQual.push({ label: item.label, val });
    }
  }

  let html = `<div class="funnel-summary-card">`;
  html += `<div class="funnel-summary-header"><span class="funnel-dot ${key}"></span><span class="funnel-summary-title">${esc(funnel.label.split('(')[0].trim())}</span></div>`;
  if (synQuant.length) {
    html += `<div class="syn-metrics" style="margin-top:12px">`;
    for (const m of synQuant.slice(0, 3)) html += synMetric(m.label, m.val, m.suffix);
    html += '</div>';
  }
  if (synQual.length) {
    html += '<div class="syn-qual-compact">';
    for (const item of synQual.slice(0, 2)) {
      const raw = Array.isArray(item.val) ? item.val.slice(0, 2).join(', ') : String(item.val);
      const text = raw.substring(0, 120);
      html += `<div class="qual-compact-item"><div class="qual-compact-label">${esc(item.label)}</div><div class="qual-text" style="font-size:.83rem">${esc(text)}${raw.length > 120 ? '…' : ''}</div></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/* ── Section 5: 전체 퍼널 정량 통합 차트 ── */
function renderIntegratedChart(valid) {
  if (!valid.length || !window.funnelConfig) return '';
  const fillCls = { upper: 'upper-fill', mid: 'mid-fill', lower: 'lower-fill' };

  let html = '<div class="card chart-area"><h2>📐 퍼널별 정량 지표 통합</h2>';
  for (const [key, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) continue;
    const cls = fillCls[key] || 'upper-fill';
    html += `<div class="chart-funnel-group"><div class="chart-funnel-label"><span class="funnel-dot ${key}"></span><span>${esc(funnel.label.split('(')[0].trim())}</span></div>`;
    for (const item of quantItems) {
      const scores = valid.map(r => r[item.key]).filter(v => v > 0);
      if (!scores.length) continue;
      const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const pct = (parseFloat(avg) / max) * 100;
      html += `<div class="bar-row"><div class="name">${esc(item.label)}</div><div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%">${avg}/${max}</div></div></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/* ── Section 6: 타겟 세그먼트 심층 분석 ── */
function renderTargetDeepDive(valid) {
  if (!valid.length) return '';
  const r = [...valid].sort((a, b) => b.appeal_score - a.appeal_score)[0];
  const emoji = recEmoji(r.recommendation);
  const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns  = (r.key_concerns  || '').split('; ').filter(Boolean);

  let html = '<div class="card target-deep-dive"><h2>🔍 타겟 세그먼트 심층 분석</h2>';
  html += `<div class="target-persona-header"><span style="font-size:1.4rem">${emoji}</span><span style="font-size:1.05rem;font-weight:700">${esc(r.persona_name)}</span><span class="score-badge ${cls}">${r.appeal_score}/10</span><span class="rec-text">핵심 타겟 세그먼트 · 최고 관심도</span></div>`;
  if (r.first_impression) html += `<div class="impression" style="margin:14px 0 12px">"${esc(r.first_impression)}"</div>`;
  if (positives.length || concerns.length) {
    html += `<div class="pos-neg" style="margin-bottom:14px"><div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
  }
  if (window.funnelConfig) {
    for (const [funnelKey, funnel] of Object.entries(window.funnelConfig)) {
      const quantSection = renderScaleBarsForFunnel(r, funnelKey);
      const qualSection = renderQualItemsForFunnel(r, funnelKey);
      if (!quantSection && !qualSection) continue;
      html += `<div class="funnel-deep-section">`;
      html += `<div class="funnel-deep-header"><span class="funnel-dot ${funnelKey}"></span><span>${esc(funnel.label.split('(')[0].trim())}</span></div>`;
      html += `<div class="deep-two-col"><div class="deep-quant">${quantSection}</div><div class="deep-qual">${qualSection}</div></div>`;
      html += `</div>`;
    }
  }
  if (r.review_summary) html += `<div class="review-summary" style="margin-top:12px"><strong>종합 평가:</strong> ${esc(r.review_summary)}</div>`;
  html += '</div>';
  return html;
}

/* ── Funnel Tab (upper/mid/lower) ── */
function renderFunnelTab(funnelKey) {
  const $panel = document.getElementById('tab-' + funnelKey);
  if (!window.funnelConfig || !window.funnelConfig[funnelKey]) {
    $panel.innerHTML = '<p>퍼널 설정을 불러올 수 없습니다.</p>';
    return;
  }
  const funnel = window.funnelConfig[funnelKey];
  const valid = lastReviews.filter(r => !r.error);
  let html = '';

  html += `<h2 style="font-size:1.15rem;margin-bottom:6px">${esc(funnel.label)}</h2>`;
  if (funnel.description) {
    html += `<p style="color:#636e72;font-size:.9rem;margin-bottom:18px">${esc(funnel.description)}</p>`;
  }

  if (lastSynthesis && !lastSynthesis.error) {
    const synQuant = [], synQual = [], synCat = [];
    for (const item of funnel.synthesis_items) {
      const val = lastSynthesis[item.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      if (item.type === 'quantitative' && typeof val === 'number') {
        const suffix = item.key.includes('probability') || item.key.includes('conversion') || item.key === 'overall_score' ? '/10' : '/7';
        synQuant.push({ label: item.label, val, suffix });
      } else if (item.type === 'categorical') {
        synCat.push({ label: item.label, val });
      } else {
        synQual.push({ label: item.label, val });
      }
    }
    if (synQuant.length || synQual.length || synCat.length) {
      html += `<div class="synthesis"><h3>📊 통합 분석</h3>`;
      if (synQuant.length) {
        html += `<div class="syn-metrics">`;
        for (const m of synQuant) html += synMetric(m.label, m.val, m.suffix);
        html += `</div>`;
      }
      if (synQual.length) {
        html += `<div class="syn-qual"><h4>💬 정성적 분석</h4>`;
        for (const item of synQual)
          html += `<div class="syn-qual-item"><div class="sq-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        html += `</div>`;
      }
      if (synCat.length) {
        html += `<div class="syn-decision"><h4>📋 의사결정 지원</h4>`;
        for (const item of synCat)
          html += `<div class="syn-decision-item"><div class="d-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  }

  html += `<h3 style="font-size:1.05rem;margin:20px 0 12px">🧑‍🤝‍🧑 개별 페르소나 (${esc(funnel.label.split('(')[0].trim())})</h3>`;
  html += `<div class="persona-cards">`;
  [...lastReviews].sort((a,b) => b.appeal_score - a.appeal_score).forEach((r, i) => {
    const idx = `${funnelKey}-${i}`;
    const emoji = recEmoji(r.recommendation);
    const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
    html += `<div class="persona-card" id="pc-${idx}">
      <div class="persona-card-header" onclick="toggleCard('${idx}')">
        <span class="emoji">${emoji}</span>
        <span class="name">${esc(r.persona_name)}</span>
        <span class="score-badge ${cls}">${r.appeal_score}/10</span>
        <span class="chevron">▶</span>
      </div>
      <div class="persona-card-body">
        ${renderScaleBarsForFunnel(r, funnelKey)}
        ${renderQualItemsForFunnel(r, funnelKey)}
      </div>
    </div>`;
  });
  html += `</div>`;
  $panel.innerHTML = html;
}

/* ── Scale bars for a single funnel ── */
const _scaleCls = ['ba', 'pv', 'bf', 'ae', 'is', 'pi', 'pp'];
const _funnelClsMap = { upper: 0, mid: 1, lower: 2 };

function renderScaleBarsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (!quantItems.length) return '';
  const cls = _scaleCls[(_funnelClsMap[funnelKey] || 0) % _scaleCls.length];
  const scaleLabel = quantItems[0].scale || '1-7';
  let html = `<div class="scale-section"><h5>📊 정량 평가 (${scaleLabel})</h5><div class="scale-grid"><div class="scale-group">`;
  for (const item of quantItems) {
    const val = r[item.key];
    if (val == null) continue;
    const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
    html += scaleBar(item.label, val, max, cls);
  }
  html += `</div></div></div>`;
  return html;
}

/* ── Qual items for a single funnel ── */
function renderQualItemsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  let items = '';
  for (const item of qualItems) {
    const val = r[item.key];
    if (!val) continue;
    items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${esc(val)}</div></div>`;
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

/* ── Individual Tab ── */
function renderIndividualTab(reviews) {
  let html = `<h2 style="font-size:1.15rem;margin-bottom:14px">🧑‍🤝‍🧑 개별 페르소나 리뷰</h2>`;
  html += `<div class="persona-cards">`;
  html += [...reviews].sort((a,b) => b.appeal_score - a.appeal_score).map((r, i) => renderPersonaCard(r, i)).join('');
  html += `</div>`;
  document.getElementById('tab-individual').innerHTML = html;
}

/* ── QA Tab ── */
function renderQATab(reviews) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error);
  const withQA = valid.filter(r => r.qa_result && r.qa_result.qa_mode !== 'off');
  let html = '';

  if (withQA.length) {
    const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
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
          const avgVal = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '-';
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

/* ── Shared rendering helpers ── */
function metricCard(label, value) {
  return `<div class="metric-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderSynValue(val) {
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

function synMetric(label, value, suffix) {
  const v = value != null ? value : '-';
  return `<div class="syn-metric"><div class="syn-m-label">${label}</div><div class="syn-m-value">${v}${value != null ? suffix : ''}</div></div>`;
}

function renderQA(qa) {
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

function renderPersonaCard(r, idx) {
  const emoji = recEmoji(r.recommendation);
  const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns = (r.key_concerns || '').split('; ').filter(Boolean);

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
      <div class="impression">"${esc(r.first_impression)}"</div>
      <div class="pos-neg">
        <div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      ${renderScaleBars(r)}
      ${renderQualItems(r)}
      ${renderQA(r.qa_result)}
      <div class="review-summary"><strong>종합 평가:</strong> ${esc(r.review_summary)}</div>
      <button class="raw-toggle" onclick="toggleRaw('ind-${idx}')">Raw Response 보기</button>
      <pre class="raw-content" id="raw-ind-${idx}">${esc(r.raw_response)}</pre>
    </div>
  </div>`;
}

/* ── Scale bars (all funnels — used in Individual tab) ── */
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

/* ── Qual items (all funnels — used in Individual tab) ── */
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

function toggleCard(idx) { document.getElementById('pc-' + idx).classList.toggle('open'); }
function toggleRaw(idx)  { document.getElementById('raw-' + idx).classList.toggle('show'); }

function scaleBar(label, value, max, cls) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `<div class="scale-item">
    <span class="scale-label">${label}</span>
    <div class="scale-bar"><div class="scale-fill ${cls}" style="width:${pct}%"></div></div>
    <span class="scale-val">${value}/${max}</span>
  </div>`;
}

function recEmoji(rec) {
  const m = {
    'Strongly Interested':'🟢', 'Somewhat Interested':'🔵', 'Neutral':'🟡', 'Not Interested':'🟠', 'Strongly Not Interested':'🔴',
    '매우 관심 있음':'🟢', '다소 관심 있음':'🔵', '보통':'🟡', '관심 없음':'🟠', '전혀 관심 없음':'🔴'
  };
  return m[rec] || '⚪';
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
