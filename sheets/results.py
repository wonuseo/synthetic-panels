import gspread
from typing import List
from models.review import Review

QA_HEADERS = [
    "qa_rep_brand_attitude",
    "qa_rep_value_perception",
    "qa_rep_purchase_intent",
    "qa_trap_budget_sensitivity",
    "qa_trap_competitor_loyalty",
    "qa_trap_skepticism_check",
    "qa_consistency_score",
    "qa_trap_pass_rate",
    "qa_persona_quality",
    "qa_passed",
    "qa_mode",
]

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
    "favorable_unfavorable",
    "value_for_money",
    "price_fairness",
    "brand_self_congruity",
    "brand_image_fit",
    "message_clarity",
    "attention_grabbing",
    "info_sufficiency",
    "competitive_preference",
    "likelihood_high",
    "probability_consider_high",
    "willingness_high",
    "purchase_probability_juster",
    "perceived_message",
    "emotional_response",
    "purchase_trigger_barrier",
    "recommendation_context",
    "error",
] + QA_HEADERS


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
