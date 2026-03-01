import asyncio
import json
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sse_starlette.sse import EventSourceResponse

from app.core import MAX_CONCURRENT_CALLS, SHEETS_URL, WORKSHEET_NAME, QA_MODE
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.personas import load_personas
from app.sheets.results import save_reviews, save_synthesis
from app.llm.claude import call_claude, synthesize_claude
from app.llm.openai_client import call_openai, synthesize_openai
from app.llm.parse import extract_json_or_none
from app.models.review import Review
from app.models.qa import QAResult

app = FastAPI(title="Synthetic Panels")

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
        personas = load_personas(spreadsheet, WORKSHEET_NAME)
        return {
            "ok": True,
            "personas": [
                {
                    "persona_id": p.persona_id,
                    "persona_name": p.persona_name,
                    "panel_gender": p.panel_gender,
                    "persona_season": p.persona_season,
                    "panel_potential": p.panel_potential,
                }
                for p in personas
            ],
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


@app.post("/api/review")
async def api_review(
    provider: str = Form("OpenAI"),
    model: str = Form("gpt-4o-mini"),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    qa_mode: str = Form(QA_MODE),
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})

    file_bytes = None
    filename = None
    if file:
        file_bytes = await file.read()
        filename = file.filename
    text_content = text_content or ""

    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        personas = load_personas(spreadsheet, WORKSHEET_NAME)
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})

    total = len(personas)

    async def event_generator():
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CALLS)

        def run_single(persona):
            if provider == "Claude":
                return call_claude(persona, file_bytes, filename, model, text_content, qa_mode=qa_mode)
            else:
                return call_openai(persona, file_bytes, filename, model, text_content, qa_mode=qa_mode)

        futures = {executor.submit(run_single, p): p for p in personas}
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
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "completed": completed,
                        "total": total,
                        "persona_name": review.persona_name,
                        "review": review.to_dict(),
                    }),
                }

        executor.shutdown(wait=False)

        # Synthesize
        yield {"event": "status", "data": json.dumps({"message": "통합 분석 생성 중..."})}

        reviews_data = [
            {
                "persona_name": r.persona_name,
                "appeal_score": r.appeal_score,
                "first_impression": r.first_impression,
                "key_positives": r.key_positives,
                "key_concerns": r.key_concerns,
                "recommendation": r.recommendation,
                "review_summary": r.review_summary,
                "like_dislike": r.like_dislike,
                "favorable_unfavorable": r.favorable_unfavorable,
                "value_for_money": r.value_for_money,
                "price_fairness": r.price_fairness,
                "brand_self_congruity": r.brand_self_congruity,
                "brand_image_fit": r.brand_image_fit,
                "message_clarity": r.message_clarity,
                "attention_grabbing": r.attention_grabbing,
                "info_sufficiency": r.info_sufficiency,
                "competitive_preference": r.competitive_preference,
                "likelihood_high": r.likelihood_high,
                "probability_consider_high": r.probability_consider_high,
                "willingness_high": r.willingness_high,
                "purchase_probability_juster": r.purchase_probability_juster,
                "perceived_message": r.perceived_message,
                "emotional_response": r.emotional_response,
                "purchase_trigger_barrier": r.purchase_trigger_barrier,
                "recommendation_context": r.recommendation_context,
            }
            for r in reviews
            if not r.error
        ]

        synthesis_raw = ""
        if reviews_data:

            def do_synthesize():
                if provider == "Claude":
                    return synthesize_claude(reviews_data, model)
                else:
                    return synthesize_openai(reviews_data, model)

            synthesis_raw = await loop.run_in_executor(None, do_synthesize)

        synthesis = _parse_synthesis(synthesis_raw)

        yield {
            "event": "done",
            "data": json.dumps({
                "reviews": [r.to_dict() for r in reviews],
                "synthesis": synthesis,
                "synthesis_raw": synthesis_raw,
            }),
        }

    return EventSourceResponse(event_generator())


@app.post("/api/save")
async def api_save(
    reviews_json: str = Form(...),
    synthesis_json: Optional[str] = Form(None),
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
        return {"ok": True, "run_id": run_id, "count": len(reviews)}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


def _parse_synthesis(raw: str) -> Optional[dict]:
    return extract_json_or_none(raw)
