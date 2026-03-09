# refactor-plan

기준: 2026-03-10 코드베이스 스냅샷.

목적: 기술부채를 카테고리별로 분류하고, 실제 코드 위치를 연결해 이후 리팩토링 to-do list를 잘게 쪼갤 수 있게 하는 기초 자료로 사용한다.

이 문서의 1차 용도는 기능 개선 우선순위가 아니라, Claude Code / Codex가 적은 컨텍스트로 정확하게 읽고 수정할 수 있는 구조를 만드는 것이다.

정리 원칙:

- 지금 문서는 "해결안 설계"보다 "부채 인벤토리 + 근거 코드"를 우선한다.
- 우선순위는 "AI가 읽어야 하는 컨텍스트 크기", "수정 범위의 국소성", "책임 경계의 명확성", "데이터 계약 안정성", "회귀 위험" 순으로 매겼다.
- 동일한 부채가 여러 파일에 퍼져 있으면, 대표 진입점과 반복 지점을 같이 적는다.

## AI 작업 효율 기준

- 컨텍스트 압축: 한 작업을 위해 읽어야 하는 파일/라인 수를 줄일수록 토큰 낭비가 줄고, 수정 정확도가 올라간다.
- 책임 분리: 파일명만 보고 역할을 예측할 수 있어야 에이전트가 안전하게 edit locality를 확보할 수 있다.
- 수정 국소성: 한 UI/기능 수정이 특정 파일 군에만 머물러야 프롬프트와 diff가 짧아진다.
- 계약 안정성: DTO, field schema, serializer 규칙이 흔들리면 에이전트는 방어 코드와 하위호환 adapter를 과도하게 읽게 된다.
- 레거시 소음 제거: 실제 런타임에서 덜 중요한 demo/legacy 경로가 남아 있으면 검색 결과와 패치 후보가 흐려진다.

## 컨텍스트 핫스팟

잔존 핫스팟 (완료 항목은 취소선):

- ~~`static/app.css` 4,799 lines~~ → 분리 완료: `static/app.css` (17줄 entry) + `static/css/*.css` (14개 파일)
- ~~`server.py` 722 lines~~ → 분리 완료: `server.py` **86줄** + `app/api/` + `app/services/` + `app/core/survey.py`
- ~~`static/js/main.js` 801 lines~~ → 분리 완료: `main.js` **228줄** + 5개 전용 모듈
- `static/app.js` **1,079 lines** — 레거시 번들, 퇴역 미완료
- `static/js/render/overview.js` **880 lines** — 수정 금지(CLAUDE.md), 분리 보류
- `static/js/render/funnel-tab.js` **661 lines**
- ~~`static/js/demo.js`~~ → `static/js/demo/index.js` **521 lines** (격리 완료, 내용 정리 미완료)
- `app/services/review_pipeline.py` **280 lines** — server.py 분리 결과물; SSE polling 추가 공통화 가능

## 1) 컨텍스트 압축 / 토큰 효율

- [x] `static/app.css`를 feature/style-layer 단위로 분해 ✓ 2026-03-10
  - `static/app.css` → 17줄 `@import` 진입점으로 교체
  - `static/css/` 아래 14개 파일로 분리: `base.css`, `upload.css`, `controls.css`, `charts.css`, `qa.css`, `synthesis.css`, `tabs.css`, `survey.css`, `overview.css`, `layout.css`, `synthesis-card.css`, `funnel-layout.css`, `funnel-cards.css`, `team.css`
  - `overview.css`는 CLAUDE.md 규칙에 따라 내용 이동만 수행 (수정 없음)

- [ ] CSS selector ownership와 override chain을 명확하게 정리
  - 관련 코드 (CSS 분리 후 위치):
    - [`static/css/upload.css`](../static/css/upload.css) `.card`
    - [`static/css/layout.css`](../static/css/layout.css) `.section-header`
    - [`static/css/synthesis-card.css`](../static/css/synthesis-card.css) `.funnel-summary-card` (1차 정의)
    - [`static/css/funnel-cards.css`](../static/css/funnel-cards.css) `.funnel-summary-card` 재정의
  - 메모: 범용 셀렉터와 재정의 셀렉터가 다른 파일에 분산되어 있어 검색 결과만 보고 수정하면 잘못된 스타일 블록을 건드릴 가능성이 높다.
  - 리팩토링 씨앗:
    - feature namespace 도입 (`.overview-*`, `.funnel-*`, `.survey-*`, `.qa-*`)
    - 동일 selector 재정의는 한 곳으로 합치고 변형은 modifier class로 분리

- [x] 데모/레거시 경로가 production 편집 컨텍스트를 오염시키지 않게 분리 ✓ 2026-03-10
  - `static/js/demo.js` → `static/js/demo/index.js` 이동
  - `static/js/main.js` import 경로 `'./demo/index.js'`로 갱신
  - 미완료: `static/app.js` 레거시 번들 + `static/demo.html` 모듈 기반 통일 → P2 이관

## 2) 책임 분리 / edit locality

- [x] `server.py`를 bootstrap / route / review pipeline / serializer 레이어로 분리 ✓ 2026-03-10
  - `server.py` 722줄 → 86줄 얇은 진입점으로 교체
  - `app/core/survey.py` — survey template 로딩 (`load_survey_template`, lru_cache)
  - `app/services/usage.py` — 일일 리뷰 카운터 (`get_today_count`, `increment_today_count`)
  - `app/services/review_pipeline.py` — SSE event generator (`build_event_generator`, `shutdown_active_executors`)
  - `app/services/review_serializer.py` — `/api/save` Review 복원 (`restore_review_from_dict`, `restore_qa_result`)
  - `app/api/personas.py` — GET `/api/funnel-config`, `/api/survey-template`, `/api/review-limit`, POST `/api/personas`
  - `app/api/review.py` — POST `/api/review` SSE
  - `app/api/save.py` — POST `/api/save`

- [x] `static/js/main.js`를 화면 orchestration 단위로 분리 ✓ 2026-03-10
  - `static/js/main.js` 801줄 → 228줄 얇은 진입점으로 교체
  - `static/js/tabs-controller.js` — 탭 계층 상태 관리 (`setActiveTab`, `activateGroup`, `resetTabHierarchy`, `initTabController`)
  - `static/js/persona-loader.js` — 분포 정규화 + `renderPersonaList` + `initPersonaLoader`
  - `static/js/review-runner.js` — 시간 추정 + SSE 실행 (`fmtTime`, `renderPanelSizeEstimateGuide`, `initReviewRunner`)
  - `static/js/usage-badge.js` — `refreshUsageBadge`
  - `static/js/pdf-exporter.js` — `openPdfPrintWindow`

- [ ] `static/js/render/funnel-tab.js`를 renderer bundle 단위로 분리
  - 관련 코드:
    - [`static/js/render/funnel-tab.js:1`](../static/js/render/funnel-tab.js) — funnel overview card
    - [`static/js/render/funnel-tab.js:213`](../static/js/render/funnel-tab.js) — persona radar
    - [`static/js/render/funnel-tab.js:559`](../static/js/render/funnel-tab.js) — drill-down + survey field map
  - 메모: funnel-tab은 funnel overview, persona radar, drill-down, survey field map까지 포함한다 (661줄).
  - 리팩토링 씨앗:
    - `funnel-overview-card.js`, `funnel-persona-cards.js`, `funnel-shared-radar.js`

- [ ] `static/js/render/overview.js` 분리 (CLAUDE.md 제약 준수 필요)
  - 관련 코드:
    - [`static/js/render/overview.js`](../static/js/render/overview.js) — 880줄, funnel metric + radar + integrated chart + synthesis card + persona combo 전체 포함
  - 메모: CLAUDE.md 규칙상 직접 수정 금지. 분리 필요 시 사용자 승인 필수.
  - 리팩토링 씨앗 (승인 후):
    - `overview-metrics.js`, `overview-radar.js`, `overview-synthesis.js`

- [ ] 레거시 `static/app.js` 경로를 퇴역시키거나 모듈 엔트리로 통합
  - 관련 코드:
    - [`static/app.js`](../static/app.js) — 1,079줄 레거시 번들
    - [`static/demo.html`](../static/demo.html) — 레거시 `<script src="./app.js">` + 숨김 DOM stub에 의존
  - 메모: 실제 앱은 모듈 기반(`static/js/main.js`)인데, 데모 전용 페이지는 별도 레거시 번들에 의존. 검색과 수정 후보가 두 벌로 갈라져 AI 작업 효율을 떨어뜨린다.
  - 리팩토링 씨앗:
    - `demo.html`도 모듈 엔트리 기반으로 통일
    - `static/app.js` 삭제 전 기능 parity 체크리스트 작성

## 3) 전역 상태 / 암묵적 결합

- [ ] `window.funnelConfig` 의존 제거
  - 관련 코드:
    - [`static/js/api.js:3`](../static/js/api.js)
    - [`static/js/main.js`](../static/js/main.js) — `renderSurveyTabs()`, `loadDemo()` 내부
    - [`static/js/render/overview.js:5`](../static/js/render/overview.js)
    - [`static/js/render/funnel-tab.js:8`](../static/js/render/funnel-tab.js)
    - [`static/js/render/survey.js:87`](../static/js/render/survey.js)
    - [`static/js/render/panel-stats.js:243`](../static/js/render/panel-stats.js)
  - 메모: API 로더가 global config를 세팅하고, renderer들이 묵시적으로 이를 읽는다. 테스트/재사용/부분 교체가 어렵다.
  - 리팩토링 씨앗:
    - `renderContext = { funnelConfig, surveyTemplate, reviews, summaries }` 형태로 명시적 주입

- [ ] inline `onclick` + `window.toggle*` 패턴 제거
  - 관련 코드:
    - [`static/js/main.js`](../static/js/main.js) — `window.toggleCard`, `window.toggleRaw`, `window.toggleDrillDown`
    - [`static/js/render/individual.js:115`](../static/js/render/individual.js)
    - [`static/js/render/qa.js:181`](../static/js/render/qa.js)
    - [`static/js/render/funnel-tab.js:644`](../static/js/render/funnel-tab.js)
  - 메모: 렌더링 문자열 안에서 DOM id 규칙과 글로벌 함수 이름이 강결합되어 있다.
  - 리팩토링 씨앗:
    - tab/panel root에 event delegation 도입
    - `data-action` 기반 클릭 처리로 전환

- [ ] `state` 싱글턴과 DOM node bag(`$`)의 결합 축소
  - 관련 코드:
    - [`static/js/state.js`](../static/js/state.js)
    - [`static/js/ui.js:3`](../static/js/ui.js)
    - [`static/js/main.js`](../static/js/main.js) — `showResults()` 내 payload 정규화
  - 메모: 도메인 상태, 일시 UI 상태, DOM 참조가 분리되지 않아 화면 전환과 데이터 정규화 코드가 서로 얽혀 있다.
  - 리팩토링 씨앗:
    - `appState`, `viewState`, `domRefs` 분리
    - 결과 payload 정규화를 state write 이전의 별도 adapter로 이동

## 4) 데이터 계약 / 스키마 중복 / 하위호환 shim

- [ ] 필드 메타데이터를 단일 소스로 정리
  - 관련 코드:
    - [`app/core/funnel.py:51`](../app/core/funnel.py)
    - [`app/models/review.py:123`](../app/models/review.py)
    - [`app/models/persona_summary.py:9`](../app/models/persona_summary.py)
    - [`app/models/qa.py:7`](../app/models/qa.py)
  - 메모: YAML이 이미 존재하지만, review/persona_summary/qa가 별도 하드코딩 목록을 유지한다. 스키마 변경 시 누락 가능성이 높다.
  - 리팩토링 씨앗:
    - `app/models/fields.py` 또는 `app/core/schema.py`로 필드 registry 추출
    - QA pair/trap 정의도 config 또는 메타데이터 기반으로 이동

- [ ] 추천 옵션 / 문항 타입 규칙 중복 제거
  - 관련 코드:
    - [`app/core/survey.py`](../app/core/survey.py) — `_RECOMMENDATION_OPTIONS`, `_to_question_type` (구 server.py에서 이동)
    - [`static/js/render/survey-schema.js:5`](../static/js/render/survey-schema.js)
    - [`static/js/render/survey-schema.js:17`](../static/js/render/survey-schema.js)
  - 메모: recommendation options와 field type 판별 규칙이 서버/프론트에 중복되어 있다.
  - 리팩토링 씨앗:
    - `/api/survey-template`을 계약의 단일 진실원으로 사용
    - 프론트 fallback 규칙 최소화

- [ ] review / summary 직렬화의 하위호환 flattening 제거
  - 관련 코드:
    - [`app/models/review.py:262`](../app/models/review.py)
    - [`app/models/persona_summary.py:151`](../app/models/persona_summary.py)
    - [`static/js/main.js`](../static/js/main.js) — `showResults()` 내 `avg_*` strip 로직
  - 메모: `data`, `quant_averages`, `qual_fields`, `avg_*`를 여러 층에서 top-level로 다시 펼친다. 현재 렌더러는 과거/현재 계약을 동시에 받아내기 위해 adapter를 중첩해서 갖고 있다.
  - 리팩토링 씨앗:
    - `ReviewDTO`, `PersonaSummaryDTO` 명세 고정
    - renderer가 `quant_averages`, `qual_fields`를 직접 읽도록 이행

- [ ] `/api/save`의 수동 복원 매핑 제거
  - 관련 코드:
    - [`app/services/review_serializer.py`](../app/services/review_serializer.py) — `restore_review_from_dict()` marketing/commerce 분기 + legacy key fallback
  - 메모: marketing/commerce/legacy key fallback이 serializer 내부에서 수동으로 유지된다 (구 server.py에서 이동).
  - 리팩토링 씨앗:
    - schema-driven serializer/deserializer 도입
    - legacy key mapping은 별도 migration adapter로 격리

- [ ] team 분기와 backward-compat adapter를 도메인 계층으로 이동
  - 관련 코드:
    - [`app/models/persona.py:52`](../app/models/persona.py)
    - [`app/models/review.py:172`](../app/models/review.py)
    - [`app/models/persona_summary.py:87`](../app/models/persona_summary.py)
    - [`app/api/personas.py`](../app/api/personas.py) — commerce/marketing 분기 panel_stats 빌드
    - [`app/services/review_serializer.py`](../app/services/review_serializer.py) — team별 복원 분기
  - 메모: team마다 다른 데이터를 쓰는 로직이 api/model/serializer 전반에 흩어져 있다.
  - 리팩토링 씨앗:
    - `team adapters` 또는 `team schema handlers` 도입
    - route/serializer는 team-specific 분기 대신 adapter 호출만 수행

- [ ] 데모 스키마 중복 및 레거시 키셋 제거
  - 관련 코드:
    - [`static/js/demo/index.js`](../static/js/demo/index.js) — 현행 키셋을 하드코딩으로 복제
    - [`static/app.js`](../static/app.js) — `appeal_score`, `competitive_preference`, `purchase_trigger_barrier` 등 구 필드 유지
    - [`config/funnel_config.yaml`](../config/funnel_config.yaml)
  - 메모: `demo/index.js`는 현행 키셋을 복제하고, `static/app.js`는 구 필드를 유지한다.
  - 리팩토링 씨앗:
    - 데모도 `/api/funnel-config` 또는 YAML generated artifact를 사용
    - 구 필드는 제거하거나 명시적 migration map으로 분리

## 5) 렌더러 / 프론트 유틸 중복

- [ ] radar label wrapping helper 통합
  - 관련 코드:
    - [`static/js/render/overview.js:176`](../static/js/render/overview.js) (수정 금지)
    - [`static/js/render/funnel-tab.js:129`](../static/js/render/funnel-tab.js)
  - 메모: 동일한 문자열 줄바꿈 로직이 거의 그대로 중복되어 있다.
  - 리팩토링 씨앗:
    - `render/radar-label.js` 또는 `render/chart-labels.js` 추출

- [x] survey / panel-stats 섹션 유틸 통합 ✓ 2026-03-09
  - `shortSectionLabel`, `sectionBadgeLabel` → `helpers.js`로 이동; 두 파일 import 갱신

- [x] funnel qualitative renderer 통합 ✓ 2026-03-09
  - `renderQualGrid(qualItems, r, title?)` → `helpers.js` 추출
  - `renderQualItemsForFunnel` (funnel-tab.js) + `renderQualItems` (individual.js) 가 이를 사용
  - overview.js는 수정 금지(CLAUDE.md)이므로 overview 쪽은 미완료

- [ ] radar / score card SVG renderer 공통화
  - 관련 코드:
    - [`static/js/render/overview.js:91`](../static/js/render/overview.js) (수정 금지)
    - [`static/js/render/overview.js:674`](../static/js/render/overview.js) (수정 금지)
    - [`static/js/render/funnel-tab.js:55`](../static/js/render/funnel-tab.js)
  - 메모: 축 계산, label placement, polygon/dot 생성이 세 군데에서 반복된다.
  - 리팩토링 씨앗:
    - `buildRadarSvg({ items, values, color, labelFormatter })` 추출

- [x] 개별/평균 정량 bar renderer 통합 ✓ 2026-03-09
  - `_renderScaleGroups(title, getValue, skip?)` 내부 함수 추출
  - `renderScaleBars` + `renderAvgScaleBars` 가 이를 사용; `renderAvgScaleBars`도 `scaleBar` 헬퍼 경유

## 6) 백엔드 오케스트레이션 / 동시성 / provider abstraction

- [x] OpenAI / Claude 재시도 로직 공통 모듈화 ✓ 2026-03-09
  - `app/llm/retry.py` — `RetryEngine` 클래스 추출
  - `claude.py`·`openai_client.py` 각자 `_retry_engine = RetryEngine(...)` 인스턴스화
  - `_call_with_retry` 함수는 한 줄 delegate로 축소

- [ ] SSE phase polling loop 공통화
  - 관련 코드:
    - [`app/services/review_pipeline.py`](../app/services/review_pipeline.py) — Phase 1 future polling loop (약 L60~L100)
    - [`app/services/review_pipeline.py`](../app/services/review_pipeline.py) — Phase 3 future polling loop (약 L120~L165), Phase 1과 거의 동일한 패턴
  - 메모: phase 1, phase 3가 거의 동일한 future polling / disconnect handling / progress event 패턴을 반복한다 (구 server.py에서 이동했으나 중복 미해소).
  - 리팩토링 씨앗:
    - `async iterate_futures(...)` 공통 헬퍼 추출
    - `emit_progress(...)` 유틸 추출

- [ ] provider dispatch 분기 제거
  - 관련 코드:
    - [`app/services/review_pipeline.py`](../app/services/review_pipeline.py) — `run_single()`, `run_persona_synthesis()`, `do_synthesize()` 내 `if provider == "Claude"` 반복
  - 메모: review, persona synthesis, overall synthesis마다 동일한 분기가 반복된다.
  - 리팩토링 씨앗:
    - `provider_client = get_provider(provider)` 패턴 도입
    - provider interface: `review`, `summarize_persona`, `synthesize`

- [ ] route 내부 집계 helper를 서비스로 이동
  - 관련 코드:
    - [`app/api/personas.py`](../app/api/personas.py) — `_build_distribution()`, `_persona_sort_key()` 인라인 헬퍼
    - [`app/services/review_pipeline.py`](../app/services/review_pipeline.py) — `_compute_cross_persona_quant_groups()` (pipeline 내부에 위치)
  - 메모: panel distribution, persona grouping, synthesis input flattening helper가 pipeline/api 파일 안에 중첩되어 있다.
  - 리팩토링 씨앗:
    - `app/services/persona_stats.py`
    - `app/services/synthesis_payload.py`

## 7) 오류 처리 / 관측성 / 운영 안정성

- [ ] broad exception → HTTP 400 일괄 반환을 정리
  - 관련 코드:
    - [`app/api/personas.py`](../app/api/personas.py) — `except Exception as e: JSONResponse(400, ...)`
    - [`app/api/review.py`](../app/api/review.py) — `except Exception as e: JSONResponse(400, ...)`
    - [`app/api/save.py`](../app/api/save.py) — `except Exception as e: JSONResponse(400, ...)`
  - 메모: 설정 오류, 외부 API 실패, 데이터 파싱 실패가 모두 400으로 수렴한다. 운영 중 원인 구분이 어렵다.
  - 리팩토링 씨앗:
    - typed exception 도입
    - 4xx / 5xx / dependency error 구분

- [ ] 조용히 삼키는 예외를 줄이고 로그 컨텍스트를 구조화
  - 관련 코드:
    - [`app/services/review_pipeline.py`](../app/services/review_pipeline.py) — `except Exception: pass` (SSE error yield 실패 시)
    - [`app/core/funnel.py:207`](../app/core/funnel.py)
    - [`static/js/review-runner.js`](../static/js/review-runner.js) — `try { ... } catch {}` (limit check)
    - [`static/js/usage-badge.js`](../static/js/usage-badge.js) — `} catch {}`
    - [`static/js/api.js:65`](../static/js/api.js)
  - 메모: fallback은 있지만 진단에 필요한 context가 남지 않는 지점이 많다.
  - 리팩토링 씨앗:
    - `run_id`, `team`, `provider`, `phase`를 로그 context에 추가
    - empty catch 제거 또는 최소 console/reporting 추가

- [ ] 브라우저 `alert/prompt` 의존을 상태 기반 피드백으로 교체
  - 관련 코드:
    - [`static/js/ui.js:38`](../static/js/ui.js)
    - [`static/js/review-runner.js`](../static/js/review-runner.js) — `prompt(...)` (비밀번호 입력), `alert(...)` (오류)
    - [`static/js/main.js`](../static/js/main.js) — `alert(...)` (팝업 차단 안내)
  - 메모: 사용자 피드백 채널이 동기 브라우저 API에 묶여 있어 UX 흐름과 테스트가 모두 불안정하다.
  - 리팩토링 씨앗:
    - toast / inline banner / modal 상태로 전환

- [ ] LLM 실패 응답을 구조화
  - 관련 코드:
    - [`app/llm/openai_client.py:195`](../app/llm/openai_client.py)
    - [`app/llm/openai_client.py:223`](../app/llm/openai_client.py)
    - [`app/llm/openai_client.py:245`](../app/llm/openai_client.py)
    - [`app/llm/claude.py:180`](../app/llm/claude.py)
    - [`app/llm/claude.py:205`](../app/llm/claude.py)
    - [`app/llm/claude.py:224`](../app/llm/claude.py)
  - 메모: 일부는 `Review(error=...)`, 일부는 JSON 문자열(`{"error": ...}`)로 반환되어 실패 계약이 일관되지 않다.
  - 리팩토링 씨앗:
    - `LLMCallResult` 또는 공통 error envelope 도입

## 8) 테스트 안전장치 부재

- [ ] 최소 회귀 테스트 세트를 추가한 뒤 본격 리팩토링 착수
  - 메모: 현재 저장소에 `tests/`, `test_*.py`, `*_test.py` 패턴의 테스트 파일이 없다.
  - 우선 대상 코드:
    - [`app/models/review.py`](../app/models/review.py) — `Review.from_llm_response`
    - [`app/models/persona_summary.py`](../app/models/persona_summary.py) — `PersonaSummary.from_reviews`
    - [`app/api/review.py`](../app/api/review.py) — `/api/review` SSE contract
    - [`static/js/api.js:52`](../static/js/api.js) — SSE parser
    - [`static/js/render/funnel-tab.js:55`](../static/js/render/funnel-tab.js) — 주요 renderer helper
  - 리팩토링 씨앗:
    - parser/serializer unit test
    - SSE event order + done payload integration test
    - renderer snapshot 또는 DOM smoke test

## 우선순위 제안 (Claude 기준)

> 판단 기준: 한 작업에 읽어야 하는 파일·라인 수 감소 → 수정 국소성 확보 → 계약 안정성 → 레거시 소음 제거 → 운영 품질 순.

### P0 — 작업 1회당 읽는 컨텍스트를 직접 줄이는 것 ✅ 완료

| 항목 | 상태 |
|------|------|
| ~~`static/app.css` 분할~~ | ✓ 2026-03-10 |
| ~~`server.py` route / service / pipeline 분리~~ | ✓ 2026-03-10 (722줄 → 86줄, 7개 파일) |
| ~~`static/js/main.js` 화면 orchestration 분리~~ | ✓ 2026-03-10 (801줄 → 228줄, 5개 모듈) |
| ~~데모 fixture 격리 (`demo.js` → `demo/index.js`)~~ | ✓ 2026-03-10 |
| `static/app.js` + `demo.html` 레거시 번들 퇴역 | 미완료 → P2 이관 |

### P1 — 암묵적 결합 제거로 수정 범위를 국소화하는 것

| 항목 | 근거 |
|------|------|
| `window.funnelConfig` → 명시적 주입 | 전역 세팅이 어디서 읽히는지 확인하려면 6개 파일을 순회해야 함 |
| `ReviewDTO` / `PersonaSummaryDTO` 계약 고정 + flattening 제거 | adapter 중첩 때문에 렌더러 수정 시 직렬화 계층까지 따라 읽게 됨 |
| field metadata 단일 소스 (`app/core/schema.py`) | 스키마 변경 시 YAML·review·persona_summary·qa 4곳을 동기화해야 함 |
| `inline onclick` / `window.toggle*` → event delegation | 렌더링 문자열과 전역 함수명이 강결합 — DOM id 규칙 추적이 필요함 |

### P2 — 중복 제거로 패치 대상을 단일화하는 것

| 항목 | 근거 |
|------|------|
| `funnel-tab.js` renderer 번들 분리 | 661줄 — funnel 카드 하나 수정해도 전체를 읽어야 함 |
| radar SVG / score card renderer 공통화 | 축 계산·polygon 생성이 3곳에 중복 — 한 곳 수정 시 나머지를 놓칠 수 있음 |
| provider dispatch 분기 제거 (`get_provider()` 패턴) | `review_pipeline.py` 내 3개 phase에 `if provider == "Claude"` 반복 |
| SSE phase polling loop 공통화 | `review_pipeline.py` 내 phase 1·3이 동일한 future polling 패턴 반복 |
| `static/app.js` + `demo.html` 레거시 번들 퇴역 | 검색 결과에 구 필드·레거시 loadDemo가 여전히 섞임 |

### P3 — 운영·안전 품질 (기능에는 영향 없음)

| 항목 | 근거 |
|------|------|
| 최소 회귀 테스트 추가 (parser·SSE·renderer) | 현재 테스트 없음 — 대규모 리팩토링 전 안전망 확보 필요 |
| typed exception 도입 + HTTP 4xx/5xx 분리 | 현재 모든 오류가 400으로 수렴 — 원인 추적이 어려움 |
| 구조화 로그 컨텍스트 추가 (`run_id`, `team`, `provider`, `phase`) | 빈 catch가 많아 실패 재현에 필요한 context가 남지 않음 |
| LLM 실패 응답 envelope 통일 | `Review(error=...)` vs `{"error":...}` JSON 혼용 |
| 브라우저 `alert/prompt` → 상태 기반 피드백 교체 | UX 개선 — Claude 작업 효율과 무관 |

## to-do list로 쪼갤 때의 권장 단위

1. **컨텍스트 압축** (P0) ✅ 완료
   - ~~`app.css` feature/style-layer 분리~~ ✓ 2026-03-10
   - ~~`server.py` route / service / pipeline 분리~~ ✓ 2026-03-10
   - ~~`main.js` controller 분할~~ ✓ 2026-03-10
   - ~~demo fixture `demo/index.js`로 격리~~ ✓ 2026-03-10
2. **암묵적 결합 제거** (P1)
   - `window.funnelConfig` 명시적 주입
   - `ReviewDTO` / `PersonaSummaryDTO` 계약 고정 + flattening 제거
   - field metadata 단일 소스 (`app/core/schema.py`)
   - `inline onclick` / `window.toggle*` → event delegation
3. **중복 단일화** (P2)
   - renderer 번들 분리 (`funnel-tab`)
   - radar SVG / score card renderer 공통화
   - provider dispatch / SSE polling 공통화 (`review_pipeline.py` 내)
   - `static/app.js` + `demo.html` 레거시 퇴역
4. **안전망 확보** (P3)
   - parser / SSE / renderer 최소 회귀 테스트
   - typed exception + 구조화 로그
   - LLM error envelope 통일
