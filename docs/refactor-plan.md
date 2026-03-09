# refactor-plan

기준: 2026-03-09 코드베이스 스냅샷.

목적: 기술부채를 카테고리별로 분류하고, 실제 코드 위치를 연결해 이후 리팩토링 to-do list를 잘게 쪼갤 수 있게 하는 기초 자료로 사용한다.

이 문서의 1차 용도는 기능 개선 우선순위가 아니라, Claude Code / Codex가 적은 컨텍스트로 정확하게 읽고 수정할 수 있는 구조를 만드는 것이다.

정리 원칙:

- 지금 문서는 "해결안 설계"보다 "부채 인벤토리 + 근거 코드"를 우선한다.
- 우선순위는 "AI가 읽어야 하는 컨텍스트 크기", "수정 범위의 국소성", "책임 경계의 명확성", "데이터 계약 안정성", "회귀 위험" 순으로 매겼다.
- 동일한 부채가 여러 파일에 퍼져 있으면, 대표 진입점과 반복 지점을 같이 적는다.
- 

## AI 작업 효율 기준

- 컨텍스트 압축: 한 작업을 위해 읽어야 하는 파일/라인 수를 줄일수록 토큰 낭비가 줄고, 수정 정확도가 올라간다.
- 책임 분리: 파일명만 보고 역할을 예측할 수 있어야 에이전트가 안전하게 edit locality를 확보할 수 있다.
- 수정 국소성: 한 UI/기능 수정이 특정 파일 군에만 머물러야 프롬프트와 diff가 짧아진다.
- 계약 안정성: DTO, field schema, serializer 규칙이 흔들리면 에이전트는 방어 코드와 하위호환 adapter를 과도하게 읽게 된다.
- 레거시 소음 제거: 실제 런타임에서 덜 중요한 demo/legacy 경로가 남아 있으면 검색 결과와 패치 후보가 흐려진다.

## 컨텍스트 핫스팟

- `static/app.css` 4,799 lines
- `static/app.js` 1,079 lines
- `static/js/render/overview.js` 880 lines
- `static/js/main.js` 801 lines
- `server.py` 722 lines
- `static/js/render/funnel-tab.js` 658 lines
- `static/js/demo.js` 485 lines

## 1) 컨텍스트 압축 / 토큰 효율

- [ ] `static/app.css`를 feature/style-layer 단위로 분해
  - 관련 코드:
    - [`static/app.css:7`](../static/app.css#L7) variables / base tokens
    - [`static/app.css:1535`](../static/app.css#L1535) persona cards
    - [`static/app.css:1750`](../static/app.css#L1750) survey tab
    - [`static/app.css:1989`](../static/app.css#L1989) panel stats tab
    - [`static/app.css:2708`](../static/app.css#L2708) hierarchical report structure
    - [`static/app.css:3335`](../static/app.css#L3335) inner step track
    - [`static/app.css:3763`](../static/app.css#L3763) funnel tab redesign
    - [`static/app.css:4772`](../static/app.css#L4772) team toggle
  - 메모: 하나의 스타일시트가 base/layout/upload/results/qa/survey/panel-stats/persona/funnel report를 모두 담고 있다. 에이전트가 survey 스타일 하나를 수정할 때도 unrelated CSS를 같이 읽게 된다.
  - 리팩토링 씨앗:
    - `static/styles/base.css`, `static/styles/layout.css`, `static/styles/components/*.css`, `static/styles/features/*.css`
    - 최소한 `survey`, `panel-stats`, `qa`, `persona`, `overview`, `funnel` 단위로 분리

- [ ] CSS selector ownership와 override chain을 명확하게 정리
  - 관련 코드:
    - [`static/app.css:254`](../static/app.css#L254) `.card`
    - [`static/app.css:2717`](../static/app.css#L2717) `.section-header`
    - [`static/app.css:2256`](../static/app.css#L2256) `.funnel-summary-card`
    - [`static/app.css:3768`](../static/app.css#L3768) `.funnel-summary-card` 재정의
  - 메모: 범용 셀렉터와 재정의 셀렉터가 섞여 있어 검색 결과만 보고 수정하면 잘못된 스타일 블록을 건드릴 가능성이 높다.
  - 리팩토링 씨앗:
    - feature namespace 도입 (`.overview-*`, `.funnel-*`, `.survey-*`, `.qa-*`)
    - 동일 selector 재정의는 한 곳으로 합치고 변형은 modifier class로 분리

- [ ] 데모/레거시 경로가 production 편집 컨텍스트를 오염시키지 않게 분리
  - 관련 코드:
    - [`static/js/demo.js:1`](../static/js/demo.js#L1) demo config + fixture data
    - [`static/js/demo.js:380`](../static/js/demo.js#L380) persona summaries fixture
    - [`static/js/demo.js:439`](../static/js/demo.js#L439) panel reviews fixture
    - [`static/js/main.js:2`](../static/js/main.js#L2) main entry에서 demo fixture import
    - [`static/app.js:25`](../static/app.js#L25) legacy `loadDemo()`
    - [`static/demo.html:68`](../static/demo.html#L68) demo bootstrap
  - 메모: demo용 config/fixture/legacy 진입점이 runtime 코드 검색 결과에 섞여, 에이전트가 실제 수정 대상과 샘플 코드를 함께 읽게 만든다.
  - 리팩토링 씨앗:
    - demo fixture를 `static/js/demo/` 아래로 격리
    - runtime entry와 demo entry의 import graph 분리

## 2) 책임 분리 / edit locality

- [ ] `server.py`를 bootstrap / route / review pipeline / serializer 레이어로 분리
  - 관련 코드:
    - [`server.py:177`](../server.py#L177) HTTP middleware
    - [`server.py:236`](../server.py#L236) persona loading endpoint
    - [`server.py:331`](../server.py#L331) review SSE endpoint
    - [`server.py:379`](../server.py#L379) phase orchestration + thread pool lifecycle
    - [`server.py:598`](../server.py#L598) save endpoint + review restore mapping
  - 메모: FastAPI 앱 초기화, survey template 로딩, 일일 사용량 제어, persona 샘플링, LLM phase 실행, synthesis, 저장 복원이 한 파일에 누적되어 있다.
  - 리팩토링 씨앗:
    - `app/api/*.py`, `app/services/review_pipeline.py`, `app/services/review_serializer.py` 분리
    - `event_generator()` phase별 함수 분리

- [ ] `static/js/main.js`를 화면 orchestration 단위로 분리
  - 관련 코드:
    - [`static/js/main.js:23`](../static/js/main.js#L23) 설문/통계 탭 렌더 orchestration
    - [`static/js/main.js:381`](../static/js/main.js#L381) 결과 payload 정규화
    - [`static/js/main.js:448`](../static/js/main.js#L448) 사용량 badge
    - [`static/js/main.js:475`](../static/js/main.js#L475) team toggle
    - [`static/js/main.js:561`](../static/js/main.js#L561) persona load
    - [`static/js/main.js:585`](../static/js/main.js#L585) review SSE 실행
    - [`static/js/main.js:675`](../static/js/main.js#L675) PDF export
  - 메모: 탭 상태, 입력 상태, API orchestration, 진행률 표시, PDF 인쇄까지 한 엔트리 파일에 결합되어 있다.
  - 리팩토링 씨앗:
    - `tabs-controller.js`, `review-runner.js`, `persona-loader.js`, `usage-badge.js`, `pdf-exporter.js`로 분리

- [ ] `static/js/render/overview.js`, `static/js/render/funnel-tab.js`를 renderer bundle 단위로 분리
  - 관련 코드:
    - [`static/js/render/overview.js:1`](../static/js/render/overview.js#L1)
    - [`static/js/render/overview.js:641`](../static/js/render/overview.js#L641)
    - [`static/js/render/overview.js:674`](../static/js/render/overview.js#L674)
    - [`static/js/render/funnel-tab.js:1`](../static/js/render/funnel-tab.js#L1)
    - [`static/js/render/funnel-tab.js:213`](../static/js/render/funnel-tab.js#L213)
    - [`static/js/render/funnel-tab.js:559`](../static/js/render/funnel-tab.js#L559)
  - 메모: overview는 funnel metric, radar, integrated chart, synthesis card, persona combo를 모두 포함하고, funnel-tab은 funnel overview, persona radar, drill-down, survey field map까지 포함한다.
  - 리팩토링 씨앗:
    - `overview-metrics.js`, `overview-radar.js`, `overview-synthesis.js`
    - `funnel-overview-card.js`, `funnel-persona-cards.js`, `funnel-shared-radar.js`

- [ ] 레거시 `static/app.js` 경로를 퇴역시키거나 모듈 엔트리로 통합
  - 관련 코드:
    - [`static/app.js:1`](../static/app.js#L1)
    - [`static/demo.html:46`](../static/demo.html#L46)
    - [`static/demo.html:67`](../static/demo.html#L67)
  - 메모: 현재 실제 앱은 모듈 기반(`static/js/main.js`)인데, 데모 전용 페이지는 별도 레거시 번들 + 숨김 DOM stub에 의존한다. 검색과 수정 후보가 두 벌로 갈라져 AI 작업 효율을 떨어뜨린다.
  - 리팩토링 씨앗:
    - `demo.html`도 모듈 엔트리 기반으로 통일
    - `static/app.js` 삭제 전 기능 parity 체크리스트 작성

## 3) 전역 상태 / 암묵적 결합

- [ ] `window.funnelConfig` 의존 제거
  - 관련 코드:
    - [`static/js/api.js:3`](../static/js/api.js#L3)
    - [`static/js/main.js:23`](../static/js/main.js#L23)
    - [`static/js/render/overview.js:5`](../static/js/render/overview.js#L5)
    - [`static/js/render/funnel-tab.js:8`](../static/js/render/funnel-tab.js#L8)
    - [`static/js/render/survey.js:87`](../static/js/render/survey.js#L87)
    - [`static/js/render/panel-stats.js:243`](../static/js/render/panel-stats.js#L243)
  - 메모: API 로더가 global config를 세팅하고, renderer들이 묵시적으로 이를 읽는다. 테스트/재사용/부분 교체가 어렵다.
  - 리팩토링 씨앗:
    - `renderContext = { funnelConfig, surveyTemplate, reviews, summaries }` 형태로 명시적 주입

- [ ] inline `onclick` + `window.toggle*` 패턴 제거
  - 관련 코드:
    - [`static/js/main.js:99`](../static/js/main.js#L99)
    - [`static/js/main.js:112`](../static/js/main.js#L112)
    - [`static/js/render/individual.js:115`](../static/js/render/individual.js#L115)
    - [`static/js/render/qa.js:181`](../static/js/render/qa.js#L181)
    - [`static/js/render/funnel-tab.js:644`](../static/js/render/funnel-tab.js#L644)
  - 메모: 렌더링 문자열 안에서 DOM id 규칙과 글로벌 함수 이름이 강결합되어 있다.
  - 리팩토링 씨앗:
    - tab/panel root에 event delegation 도입
    - `data-action` 기반 클릭 처리로 전환

- [ ] `state` 싱글턴과 DOM node bag(`$`)의 결합 축소
  - 관련 코드:
    - [`static/js/state.js:1`](../static/js/state.js#L1)
    - [`static/js/ui.js:3`](../static/js/ui.js#L3)
    - [`static/js/main.js:384`](../static/js/main.js#L384)
    - [`static/js/main.js:491`](../static/js/main.js#L491)
  - 메모: 도메인 상태, 일시 UI 상태, DOM 참조가 분리되지 않아 화면 전환과 데이터 정규화 코드가 서로 얽혀 있다.
  - 리팩토링 씨앗:
    - `appState`, `viewState`, `domRefs` 분리
    - 결과 payload 정규화를 state write 이전의 별도 adapter로 이동

## 4) 데이터 계약 / 스키마 중복 / 하위호환 shim

- [ ] 필드 메타데이터를 단일 소스로 정리
  - 관련 코드:
    - [`app/core/funnel.py:51`](../app/core/funnel.py#L51)
    - [`app/models/review.py:123`](../app/models/review.py#L123)
    - [`app/models/persona_summary.py:9`](../app/models/persona_summary.py#L9)
    - [`app/models/qa.py:7`](../app/models/qa.py#L7)
  - 메모: YAML이 이미 존재하지만, review/persona_summary/qa가 별도 하드코딩 목록을 유지한다. 스키마 변경 시 누락 가능성이 높다.
  - 리팩토링 씨앗:
    - `app/models/fields.py` 또는 `app/core/schema.py`로 필드 registry 추출
    - QA pair/trap 정의도 config 또는 메타데이터 기반으로 이동

- [ ] 추천 옵션 / 문항 타입 규칙 중복 제거
  - 관련 코드:
    - [`server.py:116`](../server.py#L116)
    - [`server.py:125`](../server.py#L125)
    - [`static/js/render/survey-schema.js:5`](../static/js/render/survey-schema.js#L5)
    - [`static/js/render/survey-schema.js:17`](../static/js/render/survey-schema.js#L17)
  - 메모: recommendation options와 field type 판별 규칙이 서버/프론트에 중복되어 있다.
  - 리팩토링 씨앗:
    - `/api/survey-template`을 계약의 단일 진실원으로 사용
    - 프론트 fallback 규칙 최소화

- [ ] review / summary 직렬화의 하위호환 flattening 제거
  - 관련 코드:
    - [`app/models/review.py:262`](../app/models/review.py#L262)
    - [`app/models/persona_summary.py:151`](../app/models/persona_summary.py#L151)
    - [`static/js/main.js:390`](../static/js/main.js#L390)
  - 메모: `data`, `quant_averages`, `qual_fields`, `avg_*`를 여러 층에서 top-level로 다시 펼친다. 현재 렌더러는 과거/현재 계약을 동시에 받아내기 위해 adapter를 중첩해서 갖고 있다.
  - 리팩토링 씨앗:
    - `ReviewDTO`, `PersonaSummaryDTO` 명세 고정
    - renderer가 `quant_averages`, `qual_fields`를 직접 읽도록 이행

- [ ] `/api/save`의 수동 복원 매핑 제거
  - 관련 코드:
    - [`server.py:616`](../server.py#L616)
    - [`server.py:630`](../server.py#L630)
    - [`server.py:661`](../server.py#L661)
  - 메모: marketing/commerce/legacy key fallback이 route 내부에서 수동으로 유지된다.
  - 리팩토링 씨앗:
    - schema-driven serializer/deserializer 도입
    - legacy key mapping은 별도 migration adapter로 격리

- [ ] team 분기와 backward-compat adapter를 도메인 계층으로 이동
  - 관련 코드:
    - [`app/models/persona.py:52`](../app/models/persona.py#L52)
    - [`app/models/review.py:172`](../app/models/review.py#L172)
    - [`app/models/persona_summary.py:87`](../app/models/persona_summary.py#L87)
    - [`server.py:286`](../server.py#L286)
    - [`server.py:630`](../server.py#L630)
  - 메모: team마다 다른 데이터를 쓰는 로직이 route/model/serializer 전반에 흩어져 있다.
  - 리팩토링 씨앗:
    - `team adapters` 또는 `team schema handlers` 도입
    - route는 team-specific 분기 대신 adapter 호출만 수행

- [ ] 데모 스키마 중복 및 레거시 키셋 제거
  - 관련 코드:
    - [`static/js/demo.js:1`](../static/js/demo.js#L1)
    - [`static/app.js:26`](../static/app.js#L26)
    - [`static/app.js:52`](../static/app.js#L52)
    - [`config/funnel_config.yaml:1`](../config/funnel_config.yaml#L1)
  - 메모: `demo.js`는 현행 키셋을 복제하고, `static/app.js`는 `appeal_score`, `competitive_preference`, `purchase_trigger_barrier` 같은 구 필드를 유지한다.
  - 리팩토링 씨앗:
    - 데모도 `/api/funnel-config` 또는 YAML generated artifact를 사용
    - 구 필드는 제거하거나 명시적 migration map으로 분리

## 5) 렌더러 / 프론트 유틸 중복

- [ ] radar label wrapping helper 통합
  - 관련 코드:
    - [`static/js/render/overview.js:176`](../static/js/render/overview.js#L176)
    - [`static/js/render/funnel-tab.js:129`](../static/js/render/funnel-tab.js#L129)
  - 메모: 동일한 문자열 줄바꿈 로직이 거의 그대로 중복되어 있다.
  - 리팩토링 씨앗:
    - `render/radar-label.js` 또는 `render/chart-labels.js` 추출

- [ ] survey / panel-stats 섹션 유틸 통합
  - 관련 코드:
    - [`static/js/render/survey.js:42`](../static/js/render/survey.js#L42)
    - [`static/js/render/survey.js:48`](../static/js/render/survey.js#L48)
    - [`static/js/render/panel-stats.js:32`](../static/js/render/panel-stats.js#L32)
    - [`static/js/render/panel-stats.js:38`](../static/js/render/panel-stats.js#L38)
  - 메모: section label / badge 규칙이 두 파일에 복제되어 있다.
  - 리팩토링 씨앗:
    - `render/survey-common.js` 추출

- [ ] funnel qualitative renderer 통합
  - 관련 코드:
    - [`static/js/render/overview.js:750`](../static/js/render/overview.js#L750)
    - [`static/js/render/funnel-tab.js:158`](../static/js/render/funnel-tab.js#L158)
    - [`static/js/render/individual.js:66`](../static/js/render/individual.js#L66)
  - 메모: 정성 item 반복 렌더링이 overview / funnel / individual에서 각각 약간씩 다르게 중복된다.
  - 리팩토링 씨앗:
    - `render/qual-items.js` 공통화
    - `limit`, `layout`, `sectionTitle`만 옵션으로 분리

- [ ] radar / score card SVG renderer 공통화
  - 관련 코드:
    - [`static/js/render/overview.js:91`](../static/js/render/overview.js#L91)
    - [`static/js/render/overview.js:674`](../static/js/render/overview.js#L674)
    - [`static/js/render/funnel-tab.js:55`](../static/js/render/funnel-tab.js#L55)
  - 메모: 축 계산, label placement, polygon/dot 생성이 세 군데에서 반복된다.
  - 리팩토링 씨앗:
    - `buildRadarSvg({ items, values, color, labelFormatter })` 추출

- [ ] 개별/평균 정량 bar renderer 통합
  - 관련 코드:
    - [`static/js/render/individual.js:5`](../static/js/render/individual.js#L5)
    - [`static/js/render/individual.js:28`](../static/js/render/individual.js#L28)
  - 메모: 동일한 stage loop를 돌면서 입력 데이터만 다른 renderer가 두 개 있다.
  - 리팩토링 씨앗:
    - `renderScaleGroups(source, valueSelector)` 패턴으로 통합

## 6) 백엔드 오케스트레이션 / 동시성 / provider abstraction

- [ ] OpenAI / Claude 재시도 로직 공통 모듈화
  - 관련 코드:
    - [`app/llm/openai_client.py:66`](../app/llm/openai_client.py#L66)
    - [`app/llm/openai_client.py:119`](../app/llm/openai_client.py#L119)
    - [`app/llm/claude.py:66`](../app/llm/claude.py#L66)
    - [`app/llm/claude.py:114`](../app/llm/claude.py#L114)
  - 메모: backoff, jitter, global cooldown, retryable 예외 처리 구조가 사실상 복제돼 있다.
  - 리팩토링 씨앗:
    - `app/llm/retry.py`
    - provider별 차이는 client invoke 함수만 남기기

- [ ] SSE phase polling loop 공통화
  - 관련 코드:
    - [`server.py:400`](../server.py#L400)
    - [`server.py:403`](../server.py#L403)
    - [`server.py:476`](../server.py#L476)
    - [`server.py:479`](../server.py#L479)
  - 메모: phase 1, phase 3가 거의 동일한 future polling / disconnect handling / progress event 패턴을 반복한다.
  - 리팩토링 씨앗:
    - `async iterate_futures(...)`
    - `emit_progress(...)` 유틸 추출

- [ ] provider dispatch 분기 제거
  - 관련 코드:
    - [`server.py:395`](../server.py#L395)
    - [`server.py:470`](../server.py#L470)
    - [`server.py:554`](../server.py#L554)
  - 메모: review, persona synthesis, overall synthesis마다 `if provider == "Claude"` 분기가 반복된다.
  - 리팩토링 씨앗:
    - `provider_client = get_provider(provider)` 패턴 도입
    - provider interface: `review`, `summarize_persona`, `synthesize`

- [ ] route 내부 집계 helper를 서비스로 이동
  - 관련 코드:
    - [`server.py:245`](../server.py#L245)
    - [`server.py:248`](../server.py#L248)
    - [`server.py:454`](../server.py#L454)
    - [`server.py:537`](../server.py#L537)
  - 메모: route 함수 안에 panel distribution, persona grouping, synthesis input flattening helper가 중첩되어 있다.
  - 리팩토링 씨앗:
    - `app/services/persona_stats.py`
    - `app/services/synthesis_payload.py`

## 7) 오류 처리 / 관측성 / 운영 안정성

- [ ] broad exception → HTTP 400 일괄 반환을 정리
  - 관련 코드:
    - [`server.py:232`](../server.py#L232)
    - [`server.py:319`](../server.py#L319)
    - [`server.py:374`](../server.py#L374)
    - [`server.py:717`](../server.py#L717)
  - 메모: 설정 오류, 외부 API 실패, 데이터 파싱 실패가 모두 400으로 수렴한다. 운영 중 원인 구분이 어렵다.
  - 리팩토링 씨앗:
    - typed exception 도입
    - 4xx / 5xx / dependency error 구분

- [ ] 조용히 삼키는 예외를 줄이고 로그 컨텍스트를 구조화
  - 관련 코드:
    - [`server.py:96`](../server.py#L96)
    - [`server.py:588`](../server.py#L588)
    - [`app/core/funnel.py:207`](../app/core/funnel.py#L207)
    - [`static/js/main.js:462`](../static/js/main.js#L462)
    - [`static/js/main.js:597`](../static/js/main.js#L597)
    - [`static/js/api.js:65`](../static/js/api.js#L65)
  - 메모: fallback은 있지만 진단에 필요한 context가 남지 않는 지점이 많다.
  - 리팩토링 씨앗:
    - `run_id`, `team`, `provider`, `phase`를 로그 context에 추가
    - empty catch 제거 또는 최소 console/reporting 추가

- [ ] 브라우저 `alert/prompt` 의존을 상태 기반 피드백으로 교체
  - 관련 코드:
    - [`static/js/ui.js:38`](../static/js/ui.js#L38)
    - [`static/js/main.js:594`](../static/js/main.js#L594)
    - [`static/js/main.js:657`](../static/js/main.js#L657)
    - [`static/js/main.js:773`](../static/js/main.js#L773)
  - 메모: 사용자 피드백 채널이 동기 브라우저 API에 묶여 있어 UX 흐름과 테스트가 모두 불안정하다.
  - 리팩토링 씨앗:
    - toast / inline banner / modal 상태로 전환

- [ ] LLM 실패 응답을 구조화
  - 관련 코드:
    - [`app/llm/openai_client.py:195`](../app/llm/openai_client.py#L195)
    - [`app/llm/openai_client.py:223`](../app/llm/openai_client.py#L223)
    - [`app/llm/openai_client.py:245`](../app/llm/openai_client.py#L245)
    - [`app/llm/claude.py:180`](../app/llm/claude.py#L180)
    - [`app/llm/claude.py:205`](../app/llm/claude.py#L205)
    - [`app/llm/claude.py:224`](../app/llm/claude.py#L224)
  - 메모: 일부는 `Review(error=...)`, 일부는 JSON 문자열(`{"error": ...}`)로 반환되어 실패 계약이 일관되지 않다.
  - 리팩토링 씨앗:
    - `LLMCallResult` 또는 공통 error envelope 도입

## 8) 테스트 안전장치 부재

- [ ] 최소 회귀 테스트 세트를 추가한 뒤 본격 리팩토링 착수
  - 메모: 현재 저장소에 `tests/`, `test_*.py`, `*_test.py` 패턴의 테스트 파일이 없다.
  - 우선 대상 코드:
    - [`app/models/review.py:157`](../app/models/review.py#L157) `Review.from_llm_response`
    - [`app/models/persona_summary.py:79`](../app/models/persona_summary.py#L79) `PersonaSummary.from_reviews`
    - [`server.py:331`](../server.py#L331) `/api/review` SSE contract
    - [`static/js/api.js:52`](../static/js/api.js#L52) SSE parser
    - [`static/js/render/overview.js:91`](../static/js/render/overview.js#L91) / [`static/js/render/funnel-tab.js:55`](../static/js/render/funnel-tab.js#L55) 주요 renderer helper
  - 리팩토링 씨앗:
    - parser/serializer unit test
    - SSE event order + done payload integration test
    - renderer snapshot 또는 DOM smoke test

## 우선순위 제안

- P0: 컨텍스트 핫스팟 분할 (`static/app.css`, `static/js/main.js`, `static/js/render/overview.js`, `server.py`)
- P0: 데모/레거시 경로 정리 (`static/app.js`, `static/js/demo.js`, `static/demo.html`)
- P1: 책임 분리와 edit locality 확보 (`funnel-tab`, `overview`, `review pipeline`)
- P1: 데이터 계약 정리 (`field metadata`, save/restore serializer, demo/legacy schema 제거)
- P1: 최소 회귀 테스트 추가
- P2: `window.funnelConfig` 제거 + UI global handler 제거
- P2: 렌더러/유틸 중복 통합
- P3: 오류 처리 / observability / 사용자 피드백 채널 정리

## to-do list로 쪼갤 때의 권장 단위

1. 계약 안정화
   - field registry
   - serializer/deserializer
   - summary/review DTO 고정
2. 컨텍스트 압축
   - `app.css` feature/style-layer 분리
   - `main.js`, `overview.js`, `server.py` 역할별 분리
   - demo/legacy import graph 격리
3. 안전장치 확보
   - parser / SSE / renderer 테스트 추가
4. 레거시 제거
   - `static/app.js`, `demo.html`, 구 필드 매핑 정리
5. 서버 분리
   - route/service/provider adapter/retry 공통화
6. 프론트 분리
   - `main.js` controller 분할
   - renderer helper 공통화
