# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server
uvicorn server:app --reload --port 8000

# Install dependencies
pip install -r requirements.txt

# Release (bumps VERSION, updates CHANGELOG, creates git tag)
./scripts/release.sh [patch|minor|major]
```

No test suite exists yet.

## Architecture

**Synthetic Panels** is a FastAPI SPA that simulates product/service reviews from synthetic personas using Claude or OpenAI LLMs.

### Entry Point
`server.py` — five routes:
- `GET /` — serves `static/index.html` via Jinja2
- `GET /api/funnel-config` — returns funnel structure for frontend
- `POST /api/personas` — loads personas from Google Sheets
- `POST /api/review` — main workflow; streams SSE progress events then a `done` event
- `POST /api/save` — persists results to Google Sheets

### Project Structure
```
server.py              # FastAPI entrypoint
app/
  core/                # Env vars (__init__.py) + funnel config loader (funnel.py)
  llm/                 # claude.py, openai_client.py, prompt.py, parse.py
  media/               # processor.py — PDF/image → base64 for LLM
  models/              # persona.py, review.py, qa.py
  sheets/              # client.py, personas.py, results.py
config/                # YAML data files only (no Python)
  funnel_config.yaml   # Upper/Mid/Lower funnel field definitions
  synthetic_panels_prompts.yaml
  synthesis_analysis_prompts.yaml
  personas.yaml        # Persona profile template
static/                # index.html, app.js, app.css
```

### Data Flow
1. User uploads material (text and/or image/PDF) and selects provider + QA mode
2. `/api/review` spawns a `ThreadPoolExecutor` (up to `MAX_CONCURRENT_CALLS`) to call the LLM once per persona in parallel
3. Each call: `media/processor.py` encodes the file → `llm/prompt.py` builds prompts using persona profile + YAML templates → LLM returns JSON → `models/review.py` parses and clamps fields
4. If `qa_mode` is `lite` or `full`, QA questions are appended to the prompt and `models/qa.py` scores the response (consistency + trap pass rate, threshold ≥ 0.7)
5. Each completed review is streamed to the frontend via SSE `progress` events
6. After all personas complete, a synthesis call aggregates reviews → `done` event
7. User saves to Google Sheets via `/api/save`

### Key Design Decisions

**Funnel structure** — all quantitative/qualitative fields belong to one of three funnels (Upper/Mid/Lower). `config/funnel_config.yaml` is the single source of truth; `app/core/funnel.py` exposes helpers (`get_funnel_groups()`, `get_field_scales()`, etc.) and is cached for performance.

**LLM abstraction** — `claude.py` and `openai_client.py` expose identical signatures: `call_*(persona, file_bytes, filename, model, text_content, qa_mode)` and `synthesize_*(reviews_data, model)`. Both apply exponential backoff with jitter (5 retries) for rate-limit and server errors.

**JSON robustness** — `app/llm/parse.py` (`extract_json_or_none`) strips code fences, trailing commas, line comments, and `5/7`-style fractions before parsing.

**Path resolution** — modules under `app/` that reference `config/` must go three levels up: `Path(__file__).parent.parent.parent / "config"`.

### External Dependencies
- **Google Sheets**: `gspread` with service account JSON (path in `GOOGLE_SERVICE_ACCOUNT_JSON` env var). Personas are read from a configurable worksheet; results and synthesis are written to separate worksheets (auto-created if missing).
- **Media**: PDFs are converted to images via `pdf2image` (150 DPI) for OpenAI; sent as document blocks for Claude.
- **Version**: `VERSION` file → displayed in UI header; `CHANGELOG.md` updated by release script.

### Environment Variables (`.env`)
```
ANTHROPIC_API_KEY
OPENAI_API_KEY
GOOGLE_SERVICE_ACCOUNT_JSON   # path to service account JSON file
SHEETS_URL                     # target Google Sheet URL
WORKSHEET_NAME                 # default: panels
MAX_CONCURRENT_CALLS           # default: 5
QA_MODE                        # default: lite  (off | lite | full)
```
