# refactor-plan

기준: 2026-03-05 코드베이스 스냅샷 기준으로, 코드 스플릿/DRY 위반/스키마 일관성 중심으로 정리.

## 1) Code Split (파일 책임 분리)

- [ ] `server.py`를 라우터/서비스/직렬화 레이어로 분리
  - 근거: [`server.py:171`](../server.py#L171) 이후 API 엔드포인트, 동시성 제어, 이벤트 스트리밍, 저장 직렬화가 한 파일에 결합됨.
  - 작업:
    - `app/api/review.py`, `app/api/personas.py`, `app/services/review_pipeline.py`, `app/services/review_serializer.py`로 분리
    - `event_generator()` 내부 phase별 함수 분해

- [ ] `static/js/main.js`를 UI orchestration 단위로 분리
  - 근거: [`static/js/main.js:1`](../static/js/main.js#L1) ~ [`static/js/main.js:740`](../static/js/main.js#L740) 에서 탭 상태, 업로드, SSE, PDF 인쇄까지 모두 처리.
  - 작업:
    - `tabs-controller.js`, `review-runner.js`, `persona-loader.js`, `pdf-exporter.js`로 분리

- [ ] `static/js/render/overview.js`를 차트/서술 렌더러로 분리
  - 근거: [`static/js/render/overview.js:5`](../static/js/render/overview.js#L5) ~ [`static/js/render/overview.js:847`](../static/js/render/overview.js#L847) 단일 파일이 퍼널 평균, 레이더, 카드, 심층분석까지 담당.
  - 작업:
    - `overview-metrics.js`, `overview-radar.js`, `overview-target.js`, `overview-layout.js`로 분리

- [ ] 레거시 `static/app.js` 퇴역 또는 모듈화 완료
  - 근거: [`static/demo.html:67`](../static/demo.html#L67) 에서 레거시 번들을 별도 사용, 실제 앱은 [`static/index.html:195`](../static/index.html#L195) 의 모듈 엔트리 사용.
  - 작업:
    - `demo.html`도 `static/js/main.js` + `demo.js` 경로로 통일하거나
    - 레거시 파일 삭제 전, 데모 동작을 모듈 경로로 대체

## 2) DRY 위반 (중복 코드 제거)

- [ ] OpenAI/Claude 클라이언트 공통 재시도 로직 통합
  - 근거: [`app/llm/openai_client.py:46`](../app/llm/openai_client.py#L46) ~ [`app/llm/openai_client.py:123`](../app/llm/openai_client.py#L123) 와 [`app/llm/claude.py:46`](../app/llm/claude.py#L46) ~ [`app/llm/claude.py:111`](../app/llm/claude.py#L111) 이 거의 동일.
  - 작업:
    - `app/llm/retry.py` 공통 모듈로 `_compute_wait`, `_call_with_retry` 추출

- [ ] `renderScaleBarsForFunnel`, `renderQualItemsForFunnel` 중복 제거
  - 근거:
    - [`static/js/render/funnel-tab.js:5`](../static/js/render/funnel-tab.js#L5)
    - [`static/js/render/overview.js:674`](../static/js/render/overview.js#L674)
  - 작업:
    - 공통 `render/funnel-card-parts.js` 생성
    - 카드별 옵션(`radar|bar`, `limit`)만 파라미터화

- [ ] `survey.js`와 `panel-stats.js`의 섹션 라벨 유틸 통합
  - 근거:
    - [`static/js/render/survey.js:42`](../static/js/render/survey.js#L42)
    - [`static/js/render/panel-stats.js:32`](../static/js/render/panel-stats.js#L32)
  - 작업:
    - `render/survey-common.js`로 `shortSectionLabel`, `sectionBadgeLabel` 추출

- [ ] 정량/정성 필드 목록의 단일 소스화
  - 근거:
    - [`app/models/review.py:121`](../app/models/review.py#L121) (`_INT_FIELDS`, `_STR_FIELDS`)
    - [`app/models/persona_summary.py:7`](../app/models/persona_summary.py#L7) (`_QUANT_FIELDS`, `_QUAL_FIELDS`)
  - 작업:
    - `app/models/fields.py`에 필드 정의 집합화
    - 모델/시트 저장/요약 계산이 동일 정의를 참조하도록 변경

- [ ] 추천 옵션 상수의 단일화
  - 근거:
    - [`server.py:74`](../server.py#L74)
    - [`static/js/render/survey-schema.js:5`](../static/js/render/survey-schema.js#L5)
  - 작업:
    - 백엔드 응답(`/api/survey-template`) 기반으로 프론트가 옵션 사용, 프론트 하드코딩 제거

- [ ] 서버 내 phase 처리 polling 루프 공통화
  - 근거:
    - Phase 1 루프 [`server.py:315`](../server.py#L315)
    - Phase 3 루프 [`server.py:374`](../server.py#L374)
  - 작업:
    - `async iterate_completed_futures(...)` 유틸 추출

## 3) 스키마/데이터 계약 정합성

- [ ] 레거시 데모 스키마와 현행 스키마 충돌 제거
  - 근거: 레거시 `app.js`는 `appeal_score`, `like_dislike` 등 구 필드 사용 ([`static/app.js:52`](../static/app.js#L52), [`static/app.js:30`](../static/app.js#L30)); 현행은 `appeal`, `brand_favorability` 사용 ([`config/funnel_config.yaml:60`](../config/funnel_config.yaml#L60), [`config/funnel_config.yaml:31`](../config/funnel_config.yaml#L31)).
  - 작업:
    - 데모 데이터 소스를 `DEMO_FUNNEL_CONFIG`/현행 키셋으로 통일
    - 레거시 필드 제거 또는 명시적 매핑 어댑터 추가

- [ ] 수동 딕셔너리 매핑 제거(직렬화/역직렬화 공통화)
  - 근거:
    - `showResults` 변환 매핑 [`static/js/main.js:361`](../static/js/main.js#L361)
    - `/api/save`에서 Review 복원 매핑 [`server.py:501`](../server.py#L501)
    - synthesis 입력 매핑 [`server.py:411`](../server.py#L411)
  - 작업:
    - 필드 메타데이터 기반 자동 매핑(whitelist) 유틸 도입

- [ ] 데모 퍼널 정의 중복 제거
  - 근거: 데모 퍼널 정의가 `config/funnel_config.yaml`과 별도 중복 유지 ([`static/js/demo.js:1`](../static/js/demo.js#L1)).
  - 작업:
    - `/api/funnel-config` 응답을 데모에서도 사용하거나
    - 빌드 시점에 YAML→JS 생성 스크립트 도입

## 4) 리팩토링 안전장치(선행)

- [ ] 최소 회귀 테스트 추가 후 리팩토링 착수
  - 작업:
    - `Review.from_llm_response` 필드 파싱/클램핑 테스트
    - `/api/review` SSE 이벤트 순서 및 완료 payload 구조 테스트
    - `renderOverviewTab`, `renderFunnelTab`, `renderPanelStatsTab` snapshot 테스트(핵심만)

- [ ] 단계별 체크포인트 운영
  - 작업:
    - 1차: 레거시 `app.js` 경로 정리
    - 2차: 백엔드 분리(`server.py`)
    - 3차: 렌더러 DRY 통합
    - 각 단계마다 smoke test + 샘플 run 비교

## 우선순위 제안

- P0: 레거시 `static/app.js` 정리 + 스키마 정합성 확보
- P1: `server.py` 분리 + LLM 공통 retry 모듈화
- P2: 프론트 렌더러 DRY 통합(`overview/funnel/survey/panel-stats`)
- P3: 테스트/코드헬스 자동화 고도화
