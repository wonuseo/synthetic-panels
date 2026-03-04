import gspread
from typing import List

from app.core.funnel import get_results_headers, get_synthesis_keys
from app.models.review import Review
from app.models.persona_summary import PersonaSummary

RESULTS_HEADERS = get_results_headers()


def save_reviews(
    spreadsheet: gspread.Spreadsheet,
    reviews: List[Review],
    run_id: str,
    worksheet_name: str = "results",
) -> None:
    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(RESULTS_HEADERS))
        worksheet.append_row(RESULTS_HEADERS)

    rows = [review.to_sheet_row(run_id) for review in reviews]
    worksheet.append_rows(rows)


def save_synthesis(
    spreadsheet: gspread.Spreadsheet,
    synthesis_data: dict,
    run_id: str,
    worksheet_name: str = "synthesis",
) -> None:
    """synthesis 결과를 별도 'synthesis' 워크시트에 저장."""
    syn_keys = get_synthesis_keys()
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
    worksheet_name: str = "persona_summaries",
) -> None:
    headers = PersonaSummary.sheet_headers()

    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(headers))
        worksheet.append_row(headers)

    rows = []
    for sd in summaries_data:
        row = [run_id, sd.get("persona_id", ""), sd.get("persona_name", ""), sd.get("panel_count", 0)]
        from app.models.persona_summary import _QUANT_FIELDS, _QUAL_FIELDS
        for qf in _QUANT_FIELDS:
            row.append(sd.get(f"avg_{qf}", 0))
        for qf in _QUAL_FIELDS:
            row.append(sd.get(qf, ""))
        rows.append(row)
    if rows:
        worksheet.append_rows(rows)
