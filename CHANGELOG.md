# Changelog

All notable changes to **Synthetic Panels** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).

> **Versioning policy (pre-1.0)**:
> MINOR increments (`0.x.0`) for new feature sets. PATCH (`0.x.y`) for fixes and small improvements.
> `1.0.0` will be tagged when the schema and API contract stabilise for production use.

---

## [Unreleased]

---

## [0.4.0] — 2026-03-01

### Added
- **QA Validation System** — Replication questions (Core) and Trap questions verify persona fidelity and LLM output consistency.
  - Full mode: 3 replication items + 3 trap items; Lite mode: 1 replication + 1 trap.
  - Computed scores: `consistency_score`, `trap_pass_rate`, `persona_quality` (pass threshold ≥ 0.7).
- **QA display per persona card** — PASS/FAIL badge in card header; score summary cards and detailed replication/trap breakdowns rendered in the UI.
- **Comprehensive frontend sync** — All new quantitative categories (Perceived Value, Brand Fit, Ad Effectiveness, Info Sufficiency) and 4 qualitative comment fields now rendered in persona cards and the synthesis report.
- **Enhanced synthesis report** — Average metrics dashboard (7 metrics), decision support section (Go/No-Go, target segments, improvement priorities, estimated conversion range), and qualitative analysis section (message gap, emotional tone, conversion barriers, WoM potential).
- **Version badge in UI header** — Version and release date surfaced on first page via Jinja2 template variable.

### Changed
- Removed deprecated `positive_negative` and `good_bad` fields from Brand Attitude calculation and scale bars.
- Brand Attitude average corrected from 4-item to 2-item (`like_dislike`, `favorable_unfavorable`).
- Metrics row layout expanded: row 2 shows 4 category averages; row 3 shows purchase intention, purchase probability, valid responses, info sufficiency.

---

## [0.3.0] — 2026-02-xx

### Added
- **Extended marketing questionnaire** — 8 quantitative scales (Brand Attitude, Perceived Value, Brand Fit, Ad Effectiveness, Purchase Intention, Purchase Probability, Info Sufficiency, Competitive Preference) and 4 qualitative comment fields (Perceived Message, Emotional Response, Purchase Trigger/Barrier, Recommendation Context).
- `purchase_probability_juster` using the Juster Scale (0–10).
- `competitive_preference` free-text comparison field.

### Removed
- `positive_negative` and `good_bad` fields (superseded by expanded Brand Attitude scale).

---

## [0.2.0] — 2025-xx-xx

### Added
- **Render deployment** configuration (`render.yaml`).
- Support for local development server runtime.
- `gpt-4o-mini` as the default primary model.
- Improved LLM persona profiles with new preference columns in Google Sheets.

### Fixed
- Nested JSON response parsing for Korean category key structure.

---

## [0.1.0] — 2025-xx-xx

### Added
- Initial release of the Synthetic Panels system.
- FastAPI server with SSE-based streaming review progress.
- Persona loading from Google Sheets via `gspread`.
- Individual review generation using OpenAI and Anthropic Claude.
- Synthesis analysis aggregating all persona reviews.
- Basic frontend (vanilla JS SPA) with persona cards, metrics, and synthesis report.
- Google Sheets export (`results` worksheet with `run_id`).
- Jinja2 templating for the frontend.

---

[Unreleased]: https://github.com/your-org/synthetic-panels/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/your-org/synthetic-panels/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/your-org/synthetic-panels/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/your-org/synthetic-panels/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/synthetic-panels/releases/tag/v0.1.0
