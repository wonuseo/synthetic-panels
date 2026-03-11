from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.core import QA_MODE, REVIEW_PASSWORD, DAILY_REVIEW_LIMIT, SHEETS_URL
from app.services.review_pipeline import build_event_generator
from app.services.usage import get_today_count, increment_today_count
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.personas import sample_panels_for_size

router = APIRouter()


@router.post("/api/review")
async def api_review(
    request: Request,
    provider: str = Form("OpenAI"),
    review_model: str = Form("gpt-4o-mini"),
    summary_model: str = Form("gpt-4o-mini"),
    synthesis_model: str = Form("gpt-4o"),
    panel_size: int = Form(10),
    sampling_seed: Optional[str] = Form(None),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    qa_mode: str = Form(QA_MODE),
    password: Optional[str] = Form(None),
    team: str = Form("marketing"),
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})

    if REVIEW_PASSWORD:
        if not password or password != REVIEW_PASSWORD:
            return JSONResponse(status_code=403, content={
                "ok": False,
                "error": "비밀번호가 올바르지 않습니다.",
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
        panels, selected_panel_size, selected_seed = sample_panels_for_size(
            spreadsheet=spreadsheet,
            panel_size=panel_size,
            sampling_seed=sampling_seed,
            team=team,
        )
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})

    total_panels = len(panels)
    increment_today_count()

    generator = build_event_generator(
        request=request,
        panels=panels,
        total_panels=total_panels,
        provider=provider,
        review_model=review_model,
        summary_model=summary_model,
        synthesis_model=synthesis_model,
        text_content=text_content,
        file_bytes=file_bytes,
        filename=filename,
        qa_mode=qa_mode,
        team=team,
        selected_panel_size=selected_panel_size,
        selected_seed=selected_seed,
    )

    return EventSourceResponse(generator())
