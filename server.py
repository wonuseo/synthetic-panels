import asyncio
import json
import time
import uuid
from collections import defaultdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sse_starlette.sse import EventSourceResponse

from app.core import MAX_CONCURRENT_CALLS, SHEETS_URL, WORKSHEET_NAME, QA_MODE, REVIEW_PASSWORD, DAILY_REVIEW_LIMIT
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.personas import load_personas, load_panels
from app.sheets.results import save_reviews, save_synthesis, save_persona_summaries
from app.llm.claude import call_claude, synthesize_claude, synthesize_persona_claude
from app.llm.openai_client import call_openai, synthesize_openai, synthesize_persona_openai
from app.llm.parse import extract_json_or_none
from app.models.review import Review
from app.models.persona_summary import PersonaSummary
from app.models.qa import QAResult

from zoneinfo import ZoneInfo

app = FastAPI(title="Synthetic Panels")

# ── Daily review counter (KST) ──
_review_counts: dict[str, int] = {}  # {"2026-03-03": 5, ...}

def _today_kst() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")

def _get_today_count() -> int:
    return _review_counts.get(_today_kst(), 0)

def _increment_today_count():
    key = _today_kst()
    _review_counts[key] = _review_counts.get(key, 0) + 1
    # clean up old dates
    for k in list(_review_counts):
        if k != key:
            del _review_counts[k]

STATIC_DIR = Path(__file__).parent / "static"
TEMPLATES_DIR = Path(__file__).parent / "static"
def _git_info() -> tuple[str, str]:
    import subprocess
    cwd = str(Path(__file__).parent)
    try:
        version = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=cwd, text=True, stderr=subprocess.DEVNULL
        ).strip()
        raw_date = subprocess.check_output(
            ["git", "log", "-1", "--format=%ci"], cwd=cwd, text=True, stderr=subprocess.DEVNULL
        ).strip()
        last_updated = datetime.fromisoformat(raw_date).strftime("%Y-%m-%d %H:%M")
    except Exception:
        version = "dev"
        last_updated = datetime.now().strftime("%Y-%m-%d %H:%M")
    return version, last_updated

APP_VERSION, LAST_UPDATED = _git_info()

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "version": APP_VERSION, "last_updated": LAST_UPDATED})


@app.get("/api/funnel-config")
async def api_funnel_config():
    """프론트엔드용 퍼널 설정 반환"""
    from app.core.funnel import get_funnel_groups
    return {"ok": True, "funnels": get_funnel_groups()}


@app.post("/api/personas")
async def api_load_personas():
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})
    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        panels = load_panels(spreadsheet)
        # persona_id별 그룹핑
        grouped = defaultdict(list)
        for p in panels:
            grouped[p.persona_id].append(p)
        personas_info = []
        for persona_id, panel_list in grouped.items():
            first = panel_list[0]
            personas_info.append({
                "persona_id": first.persona_id,
                "persona_name": first.persona_name,
                "panel_gender": first.panel_gender,
                "persona_season": first.persona_season,
                "panel_potential": first.panel_potential,
                "panel_count": len(panel_list),
            })
        return {
            "ok": True,
            "personas": personas_info,
            "total_panels": len(panels),
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


@app.get("/api/review-limit")
async def api_review_limit():
    """오늘 리뷰 횟수와 비밀번호 필요 여부 반환"""
    count = _get_today_count()
    needs_password = REVIEW_PASSWORD and count >= DAILY_REVIEW_LIMIT
    return {"ok": True, "today_count": count, "limit": DAILY_REVIEW_LIMIT, "needs_password": needs_password}


@app.post("/api/review")
async def api_review(
    provider: str = Form("OpenAI"),
    review_model: str = Form("gpt-4o-mini"),
    summary_model: str = Form("gpt-4o-mini"),
    synthesis_model: str = Form("gpt-4o-mini"),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    qa_mode: str = Form(QA_MODE),
    password: Optional[str] = Form(None),
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})

    # Daily limit check
    if REVIEW_PASSWORD and _get_today_count() >= DAILY_REVIEW_LIMIT:
        if not password or password != REVIEW_PASSWORD:
            return JSONResponse(status_code=403, content={
                "ok": False,
                "error": f"오늘 {DAILY_REVIEW_LIMIT}회 이상 실행했습니다. 비밀번호를 입력해주세요.",
                "needs_password": True,
            })

    file_bytes = None
    filename = None
    if file:
        file_bytes = await file.read()
        filename = file.filename
    text_content = text_content or ""

    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        panels = load_panels(spreadsheet)
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})

    total_panels = len(panels)
    _increment_today_count()

    async def event_generator():
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CALLS)

        # ═══ Phase 1: 100패널 개별 LLM 호출 ═══
        phase1_start = time.time()

        def run_single(panel):
            if provider == "Claude":
                return call_claude(panel, file_bytes, filename, review_model, text_content, qa_mode=qa_mode)
            else:
                return call_openai(panel, file_bytes, filename, review_model, text_content, qa_mode=qa_mode)

        futures = {executor.submit(run_single, p): p for p in panels}
        reviews = []
        completed = 0

        while futures:
            done = []
            for f in list(futures.keys()):
                if f.done():
                    done.append(f)
            if not done:
                await asyncio.sleep(0.3)
                continue
            for f in done:
                review = f.result()
                reviews.append(review)
                completed += 1
                del futures[f]
                elapsed = time.time() - phase1_start
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "phase": "panel_review",
                        "completed": completed,
                        "total": total_panels,
                        "persona_name": review.persona_name,
                        "panel_id": review.panel_id,
                        "review": review.to_dict(),
                        "elapsed_seconds": round(elapsed, 1),
                    }),
                }

        # ═══ Phase 2: persona_id별 그룹핑 + 정량 평균 ═══
        yield {"event": "status", "data": json.dumps({"message": "페르소나별 집계 중..."})}

        grouped = defaultdict(list)
        for r in reviews:
            if not r.error:
                grouped[r.persona_id].append(r)

        persona_summaries = []
        for persona_id, persona_reviews in grouped.items():
            persona_name = persona_reviews[0].persona_name
            summary = PersonaSummary.from_reviews(persona_id, persona_name, persona_reviews)
            persona_summaries.append(summary)

        total_personas = len(persona_summaries)

        # ═══ Phase 3: 페르소나별 정성 요약 LLM 호출 ═══
        yield {"event": "status", "data": json.dumps({"message": "페르소나별 정성 요약 생성 중..."})}
        phase3_start = time.time()

        def run_persona_synthesis(summary):
            reviews_data = []
            for pr in summary.panel_reviews:
                reviews_data.append(pr)
            if provider == "Claude":
                return summary.persona_id, synthesize_persona_claude(summary.persona_name, reviews_data, summary_model)
            else:
                return summary.persona_id, synthesize_persona_openai(summary.persona_name, reviews_data, summary_model)

        p3_futures = {executor.submit(run_persona_synthesis, s): s for s in persona_summaries}
        p3_completed = 0

        while p3_futures:
            done = []
            for f in list(p3_futures.keys()):
                if f.done():
                    done.append(f)
            if not done:
                await asyncio.sleep(0.3)
                continue
            for f in done:
                persona_id, raw_result = f.result()
                p3_completed += 1
                del p3_futures[f]

                # Fill qualitative fields
                parsed = extract_json_or_none(raw_result)
                if parsed:
                    for s in persona_summaries:
                        if s.persona_id == persona_id:
                            s.fill_qualitative(parsed)
                            break

                elapsed = time.time() - phase3_start
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "phase": "persona_synthesis",
                        "completed": p3_completed,
                        "total": total_personas,
                        "persona_name": next((s.persona_name for s in persona_summaries if s.persona_id == persona_id), ""),
                        "elapsed_seconds": round(elapsed, 1),
                    }),
                }

        # ═══ Phase 4: 전체 합성 ═══
        yield {"event": "status", "data": json.dumps({"message": "통합 분석 생성 중..."})}

        # 합성 입력: 페르소나 요약 데이터
        synthesis_input = []
        for s in persona_summaries:
            synthesis_input.append({
                "persona_name": s.persona_name,
                "appeal_score": s.avg_appeal_score,
                "first_impression": s.first_impression,
                "key_positives": s.key_positives,
                "key_concerns": s.key_concerns,
                "recommendation": max(s.recommendation_distribution, key=s.recommendation_distribution.get) if s.recommendation_distribution else "보통",
                "review_summary": s.review_summary,
                "like_dislike": s.avg_like_dislike,
                "favorable_unfavorable": s.avg_favorable_unfavorable,
                "value_for_money": s.avg_value_for_money,
                "price_fairness": s.avg_price_fairness,
                "brand_self_congruity": s.avg_brand_self_congruity,
                "brand_image_fit": s.avg_brand_image_fit,
                "message_clarity": s.avg_message_clarity,
                "attention_grabbing": s.avg_attention_grabbing,
                "info_sufficiency": s.avg_info_sufficiency,
                "competitive_preference": s.competitive_preference,
                "likelihood_high": s.avg_likelihood_high,
                "probability_consider_high": s.avg_probability_consider_high,
                "willingness_high": s.avg_willingness_high,
                "purchase_probability_juster": s.avg_purchase_probability_juster,
                "perceived_message": s.perceived_message,
                "emotional_response": s.emotional_response,
                "purchase_trigger_barrier": s.purchase_trigger_barrier,
                "recommendation_context": s.recommendation_context,
            })

        synthesis_raw = ""
        if synthesis_input:
            def do_synthesize():
                if provider == "Claude":
                    return synthesize_claude(synthesis_input, synthesis_model)
                else:
                    return synthesize_openai(synthesis_input, synthesis_model)

            synthesis_raw = await loop.run_in_executor(None, do_synthesize)

        synthesis = _parse_synthesis(synthesis_raw)

        executor.shutdown(wait=False)

        yield {
            "event": "done",
            "data": json.dumps({
                "persona_summaries": [s.to_dict() for s in persona_summaries],
                "panel_reviews": [r.to_dict() for r in reviews],
                "synthesis": synthesis,
                "synthesis_raw": synthesis_raw,
            }),
        }

    return EventSourceResponse(event_generator())


@app.post("/api/save")
async def api_save(
    reviews_json: str = Form(...),
    synthesis_json: Optional[str] = Form(None),
    persona_summaries_json: Optional[str] = Form(None),
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})
    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        data = json.loads(reviews_json)
        reviews = []
        for r in data:
            # Restore QA result if present
            qa_data = r.get("qa_result")
            qa_result = None
            if qa_data and isinstance(qa_data, dict):
                qa_result = QAResult(
                    qa_rep_brand_attitude=int(qa_data.get("qa_rep_brand_attitude", 0)),
                    qa_rep_value_perception=int(qa_data.get("qa_rep_value_perception", 0)),
                    qa_rep_purchase_intent=int(qa_data.get("qa_rep_purchase_intent", 0)),
                    qa_trap_budget_sensitivity=int(qa_data.get("qa_trap_budget_sensitivity", 0)),
                    qa_trap_competitor_loyalty=int(qa_data.get("qa_trap_competitor_loyalty", 0)),
                    qa_trap_skepticism_check=int(qa_data.get("qa_trap_skepticism_check", 0)),
                    consistency_score=float(qa_data.get("consistency_score", 0)),
                    trap_pass_rate=float(qa_data.get("trap_pass_rate", 0)),
                    persona_quality=float(qa_data.get("persona_quality", 0)),
                    qa_passed=bool(qa_data.get("qa_passed", False)),
                    qa_mode=str(qa_data.get("qa_mode", "off")),
                )

            reviews.append(Review(
                persona_id=r["persona_id"],
                persona_name=r["persona_name"],
                panel_id=r.get("panel_id", ""),
                appeal_score=r.get("appeal_score", 0),
                first_impression=r.get("first_impression", ""),
                key_positives=r.get("key_positives", ""),
                key_concerns=r.get("key_concerns", ""),
                recommendation=r.get("recommendation", ""),
                review_summary=r.get("review_summary", ""),
                like_dislike=r.get("like_dislike", 0),
                favorable_unfavorable=r.get("favorable_unfavorable", 0),
                value_for_money=r.get("value_for_money", 0),
                price_fairness=r.get("price_fairness", 0),
                brand_self_congruity=r.get("brand_self_congruity", 0),
                brand_image_fit=r.get("brand_image_fit", 0),
                message_clarity=r.get("message_clarity", 0),
                attention_grabbing=r.get("attention_grabbing", 0),
                info_sufficiency=r.get("info_sufficiency", 0),
                competitive_preference=r.get("competitive_preference", ""),
                likelihood_high=r.get("likelihood_high", 0),
                probability_consider_high=r.get("probability_consider_high", 0),
                willingness_high=r.get("willingness_high", 0),
                purchase_probability_juster=r.get("purchase_probability_juster", 0),
                perceived_message=r.get("perceived_message", ""),
                emotional_response=r.get("emotional_response", ""),
                purchase_trigger_barrier=r.get("purchase_trigger_barrier", ""),
                recommendation_context=r.get("recommendation_context", ""),
                raw_response=r.get("raw_response", ""),
                error=r.get("error"),
                qa_result=qa_result,
            ))
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        save_reviews(spreadsheet, reviews, run_id)
        if synthesis_json:
            synthesis_data = json.loads(synthesis_json)
            if synthesis_data and isinstance(synthesis_data, dict):
                save_synthesis(spreadsheet, synthesis_data, run_id)
        if persona_summaries_json:
            summaries_data = json.loads(persona_summaries_json)
            if summaries_data and isinstance(summaries_data, list):
                save_persona_summaries(spreadsheet, summaries_data, run_id)
        return {"ok": True, "run_id": run_id, "count": len(reviews)}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


def _parse_synthesis(raw: str) -> Optional[dict]:
    return extract_json_or_none(raw)
