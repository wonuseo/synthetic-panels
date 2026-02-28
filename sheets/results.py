import gspread
from models.review import Review

RESULTS_HEADERS = [
    "run_id",
    "persona_id",
    "persona_name",
    "appeal_score",
    "first_impression",
    "key_positives",
    "key_concerns",
    "recommendation",
    "review_summary",
    "like_dislike",
    "positive_negative",
    "good_bad",
    "favorable_unfavorable",
    "likelihood_high",
    "probability_consider_high",
    "willingness_high",
    "purchase_probability_juster",
    "error",
]


def save_reviews(
    spreadsheet: gspread.Spreadsheet,
    reviews: list[Review],
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
