import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse

from app.core import SHEETS_URL
from app.services.review_serializer import restore_qa_result, restore_review_from_dict
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.results import save_persona_summaries, save_reviews, save_synthesis

router = APIRouter()


@router.post("/api/save")
async def api_save(
    reviews_json: str = Form(...),
    synthesis_json: Optional[str] = Form(None),
    persona_summaries_json: Optional[str] = Form(None),
    team: str = Form("marketing"),
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})
    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        data = json.loads(reviews_json)
        reviews = []
        for r in data:
            qa_data = r.get("qa_result")
            qa_result = restore_qa_result(qa_data) if qa_data and isinstance(qa_data, dict) else None
            reviews.append(restore_review_from_dict(r, team, qa_result))

        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        save_reviews(spreadsheet, reviews, run_id, team=team)
        if synthesis_json:
            synthesis_data = json.loads(synthesis_json)
            if synthesis_data and isinstance(synthesis_data, dict):
                save_synthesis(spreadsheet, synthesis_data, run_id, team=team)
        if persona_summaries_json:
            summaries_data = json.loads(persona_summaries_json)
            if summaries_data and isinstance(summaries_data, list):
                save_persona_summaries(spreadsheet, summaries_data, run_id, team=team)
        return {"ok": True, "run_id": run_id, "count": len(reviews)}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})
