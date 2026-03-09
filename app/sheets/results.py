import gspread
from typing import List

from app.core.funnel import get_results_headers, get_synthesis_keys
from app.models.review import Review
from app.models.persona_summary import PersonaSummary

RESULTS_HEADERS = get_results_headers("marketing")

_TEAM_RESULTS_WORKSHEETS = {
    "marketing": "results",
    "commerce": "results_commerce",
}
_TEAM_SYNTHESIS_WORKSHEETS = {
    "marketing": "synthesis",
    "commerce": "synthesis_commerce",
}
_TEAM_SUMMARY_WORKSHEETS = {
    "marketing": "persona_summaries",
    "commerce": "persona_summaries_commerce",
}


def save_reviews(
    spreadsheet: gspread.Spreadsheet,
    reviews: List[Review],
    run_id: str,
    worksheet_name: str = None,
    team: str = "marketing",
) -> None:
    if worksheet_name is None:
        worksheet_name = _TEAM_RESULTS_WORKSHEETS.get(team, "results")
    headers = get_results_headers(team)
    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(headers))
        worksheet.append_row(headers)

    rows = [review.to_sheet_row(run_id, team) for review in reviews]
    worksheet.append_rows(rows)


def save_synthesis(
    spreadsheet: gspread.Spreadsheet,
    synthesis_data: dict,
    run_id: str,
    worksheet_name: str = None,
    team: str = "marketing",
) -> None:
    """synthesis 결과를 별도 워크시트에 저장."""
    if worksheet_name is None:
        worksheet_name = _TEAM_SYNTHESIS_WORKSHEETS.get(team, "synthesis")
    syn_keys = get_synthesis_keys(team)
    headers = ["run_id"] + syn_keys

    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(headers))
        worksheet.append_row(headers)

    row = [run_id]
    for key in syn_keys:
        val = synthesis_data.get(key, "")
        if isinstance(val, list):
            val = "; ".join(str(v) for v in val)
        row.append(val)
    worksheet.append_row(row)


def save_persona_summaries(
    spreadsheet: gspread.Spreadsheet,
    summaries_data: List[dict],
    run_id: str,
    worksheet_name: str = None,
    team: str = "marketing",
) -> None:
    if worksheet_name is None:
        worksheet_name = _TEAM_SUMMARY_WORKSHEETS.get(team, "persona_summaries")
    headers = PersonaSummary.sheet_headers(team)

    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(headers))
        worksheet.append_row(headers)

    from app.core.funnel import get_quant_keys, get_qual_keys
    quant_keys = get_quant_keys(team)
    qual_keys = get_qual_keys(team)

    rows = []
    for sd in summaries_data:
        row = [run_id, sd.get("persona_id", ""), sd.get("persona_name", ""), sd.get("panel_count", 0)]
        quant_avgs = sd.get("quant_averages", {})
        for qf in quant_keys:
            row.append(quant_avgs.get(qf, sd.get(f"avg_{qf}", 0)))
        qual_flds = sd.get("qual_fields", {})
        for qf in qual_keys:
            row.append(qual_flds.get(qf, sd.get(qf, "")))
        rows.append(row)
    if rows:
        worksheet.append_rows(rows)
