import gspread
from typing import List

from config.funnel import get_results_headers, get_synthesis_keys
from models.review import Review

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
