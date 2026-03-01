# Quickstart

## 1. 환경 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 값을 채웁니다.

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
SHEETS_URL=https://docs.google.com/spreadsheets/d/...
WORKSHEET_NAME=panels
MAX_CONCURRENT_CALLS=5
```

## 2. 의존성 설치

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. 로컬 서버

### 시작

```bash
source .venv/bin/activate
uvicorn server:app --reload --port 8000
```

브라우저에서 http://127.0.0.1:8000 접속

### 종료

```bash
# 포트 8000을 점유한 프로세스 종료
kill $(lsof -ti :8000)
```

### 재시작

```bash
kill $(lsof -ti :8000); sleep 1; uvicorn server:app --reload --port 8000
```

## 4. 프로젝트 구조

```
synthetic-panels/
├── server.py              # FastAPI 앱 진입점
├── config.py              # 환경변수 로드
├── config/
│   ├── prompts.yaml       # LLM 프롬프트 템플릿
│   └── personas.yaml      # 페르소나 필드 정의 & 프로필 템플릿
├── models/
│   ├── persona.py         # Persona 데이터클래스
│   └── review.py          # Review 데이터클래스
├── sheets/
│   ├── client.py          # Google Sheets 연결
│   ├── personas.py        # 페르소나 로드
│   └── results.py         # 리뷰 결과 저장
├── llm/
│   ├── claude.py          # Claude API 호출
│   └── openai_client.py   # OpenAI API 호출
├── frontend/              # 정적 파일 (JS, CSS)
└── templates/             # Jinja2 HTML 템플릿
```

## 5. 버전 관리 & 릴리스

버전 정보는 `VERSION` 파일이 단일 소스이며, 서버 시작 시 읽어 UI 헤더에 표시됩니다.
변경 이력은 `CHANGELOG.md`에 기록합니다.

### 릴리스 도구 설치 (최초 1회)

```bash
pip install bump-my-version
```

### 릴리스 절차

```
1. CHANGELOG.md 의 [Unreleased] 섹션에 이번 변경 내용 기록
2. ./scripts/release.sh [patch|minor|major]
3. git push && git push --tags
```

| 명령어 | 사용 시점 |
|--------|-----------|
| `./scripts/release.sh patch` | 버그 수정, 작은 개선 (0.4.0 → 0.4.1) |
| `./scripts/release.sh minor` | 새 기능 추가 (0.4.0 → 0.5.0) |
| `./scripts/release.sh major` | 하위 호환 불가 변경 (0.4.0 → 1.0.0) |

스크립트가 자동으로 처리하는 것:
- `VERSION` 파일 숫자 업데이트
- `CHANGELOG.md` `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` 변환
- `git commit -m "chore: release vX.Y.Z"` + `git tag vX.Y.Z` 생성

> **수동으로 할 경우**
> ```bash
> echo "0.5.0" > VERSION
> # CHANGELOG.md 직접 편집 후:
> git add VERSION CHANGELOG.md
> git commit -m "chore: release v0.5.0"
> git tag v0.5.0
> git push && git push --tags
> ```

## 6. 사용 흐름

1. 서버 시작 후 http://127.0.0.1:8000 접속
2. 프로모션 자료(텍스트 또는 이미지/PDF) 입력
3. LLM provider 및 모델 선택 (OpenAI / Claude)
4. **리뷰 실행** → 10명의 페르소나가 병렬로 평가
5. 결과 확인 후 Google Sheets에 저장
