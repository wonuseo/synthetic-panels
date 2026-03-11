from collections import Counter, defaultdict
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from fastapi import Form

from app.core import REVIEW_PASSWORD, SHEETS_URL
from app.core.funnel import get_funnel_groups
from app.core.survey import load_survey_template
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.personas import sample_panels_for_size

router = APIRouter()


def _clean(v) -> str:
    return str(v or "").strip()


def _build_distribution(values, top_n: int = 3) -> list[dict]:
    cleaned = [_clean(v) for v in values if _clean(v)]
    if not cleaned:
        return []
    counter = Counter(cleaned)
    total = sum(counter.values())
    return [
        {"label": label, "count": count, "ratio": round((count / total) * 100, 1)}
        for label, count in counter.most_common(top_n)
    ]


@router.get("/api/funnel-config")
async def api_funnel_config(team: str = "marketing"):
    return {"ok": True, "funnels": get_funnel_groups(team)}


@router.get("/api/survey-template")
async def api_survey_template(team: str = "marketing"):
    try:
        return {"ok": True, "sections": load_survey_template(team)}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})


@router.post("/api/verify-password")
async def api_verify_password(password: Optional[str] = Form(None)):
    if REVIEW_PASSWORD:
        if not password or password != REVIEW_PASSWORD:
            return JSONResponse(status_code=403, content={"ok": False, "error": "비밀번호가 올바르지 않습니다."})
    return {"ok": True}


@router.post("/api/personas")
async def api_load_personas(
    panel_size: int = 10,
    sampling_seed: Optional[str] = None,
    team: str = "marketing",
):
    if not SHEETS_URL:
        return JSONResponse(status_code=400, content={"ok": False, "error": "SHEETS_URL 환경변수가 설정되지 않았습니다."})
    try:
        spreadsheet = open_spreadsheet_by_url(SHEETS_URL)
        panels, selected_panel_size, selected_seed = sample_panels_for_size(
            spreadsheet=spreadsheet,
            panel_size=panel_size,
            sampling_seed=sampling_seed,
            team=team,
        )

        grouped = defaultdict(list)
        for p in panels:
            grouped[p.persona_id].append(p)

        def _persona_sort_key(pid: str):
            text = str(pid)
            return (0, int(text)) if text.isdigit() else (1, text)

        personas_info = []
        for persona_id in sorted(grouped.keys(), key=_persona_sort_key):
            panel_list = grouped[persona_id]
            first = panel_list[0]
            if team == "commerce":
                panel_stats = {
                    "gender_distribution": _build_distribution([p.panel_gender for p in panel_list]),
                    "budget_distribution": _build_distribution([p.panel_cpc for p in panel_list]),
                    "visit_distribution": _build_distribution([p.panel_visited for p in panel_list]),
                    "visit_experience_distribution": _build_distribution([p.panel_visit_experience for p in panel_list]),
                    "skepticism_distribution": _build_distribution([p.panel_skepticism for p in panel_list]),
                    "shopping_freq_distribution": _build_distribution([p.extra.get("panel_shopping_freq", "") for p in panel_list]),
                    "brand_loyalty_distribution": _build_distribution([p.extra.get("panel_brand_loyalty", "") for p in panel_list]),
                }
            else:
                panel_stats = {
                    "gender_distribution": _build_distribution([p.panel_gender for p in panel_list]),
                    "season_distribution": _build_distribution([p.persona_season for p in panel_list]),
                    "budget_distribution": _build_distribution([p.panel_cpc for p in panel_list]),
                    "visit_distribution": _build_distribution([p.panel_visited for p in panel_list]),
                    "visit_experience_distribution": _build_distribution([p.panel_visit_experience for p in panel_list]),
                    "skepticism_distribution": _build_distribution([p.panel_skepticism for p in panel_list]),
                    "potential_distribution": _build_distribution([p.panel_potential for p in panel_list]),
                }
            personas_info.append({
                "persona_id": first.persona_id,
                "persona_name": first.persona_name,
                "panel_count": len(panel_list),
                "panel_stats": panel_stats,
            })

        return {
            "ok": True,
            "personas": personas_info,
            "total_panels": len(panels),
            "panel_size": selected_panel_size,
            "sampling_seed": selected_seed,
        }
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": str(e)})
