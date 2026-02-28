import asyncio
import json
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse

from config import MAX_CONCURRENT_CALLS, SHEETS_URL, WORKSHEET_NAME
from sheets.client import open_spreadsheet_by_url
from sheets.personas import load_personas
from sheets.results import save_reviews
from llm.claude import call_claude, synthesize_claude
from llm.openai_client import call_openai, synthesize_openai
from models.review import Review

app = FastAPI(title="Synthetic Panels")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


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
    model: str = Form("gpt-4o"),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
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
                return call_claude(persona, file_bytes, filename, model, text_content)
            else:
                return call_openai(persona, file_bytes, filename, model, text_content)

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
                "positive_negative": r.positive_negative,
                "good_bad": r.good_bad,
                "favorable_unfavorable": r.favorable_unfavorable,
                "likelihood_high": r.likelihood_high,
                "probability_consider_high": r.probability_consider_high,
                "willingness_high": r.willingness_high,
                "purchase_probability_juster": r.purchase_probability_juster,
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
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})
    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        data = json.loads(reviews_json)
        reviews = []
        for r in data:
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
                positive_negative=r.get("positive_negative", 0),
                good_bad=r.get("good_bad", 0),
                favorable_unfavorable=r.get("favorable_unfavorable", 0),
                likelihood_high=r.get("likelihood_high", 0),
                probability_consider_high=r.get("probability_consider_high", 0),
                willingness_high=r.get("willingness_high", 0),
                purchase_probability_juster=r.get("purchase_probability_juster", 0),
                raw_response=r.get("raw_response", ""),
                error=r.get("error"),
            ))
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        save_reviews(spreadsheet, reviews, run_id)
        return {"ok": True, "run_id": run_id, "count": len(reviews)}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


def _parse_synthesis(raw: str) -> dict | None:
    if not raw:
        return None
    try:
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return None
