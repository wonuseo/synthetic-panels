from app.models.qa import QAResult
from app.models.review import Review


def restore_qa_result(qa_data: dict) -> QAResult:
    return QAResult(
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


def restore_review_from_dict(r: dict, team: str, qa_result) -> Review:
    if team == "commerce":
        combined = r.get("purchase_trigger_barrier", "")
        purchase_trigger = r.get("purchase_trigger") or combined
        purchase_barrier = r.get("purchase_barrier") or combined
        _SKIP = {"persona_id", "persona_name", "panel_id", "raw_response", "error", "qa_result", "data"}
        data_dict = {k: v for k, v in r.items() if k not in _SKIP}
        return Review(
            persona_id=r["persona_id"],
            persona_name=r["persona_name"],
            panel_id=r.get("panel_id", ""),
            recommendation=r.get("recommendation", "보통"),
            overall_impression=r.get("overall_impression", ""),
            review_summary=r.get("review_summary", ""),
            key_positives=r.get("key_positives", ""),
            key_concerns=r.get("key_concerns", ""),
            competitive_comparison=r.get("competitive_comparison", ""),
            information_gap=r.get("information_gap", ""),
            purchase_trigger=purchase_trigger,
            purchase_barrier=purchase_barrier,
            price_perception=r.get("price_perception", ""),
            purchase_likelihood=r.get("purchase_likelihood", 0),
            purchase_consideration=r.get("purchase_consideration", 0),
            purchase_willingness=r.get("purchase_willingness", 0),
            repurchase_intent=r.get("repurchase_intent", 0),
            purchase_urgency=r.get("purchase_urgency", 0),
            raw_response=r.get("raw_response", ""),
            error=r.get("error"),
            qa_result=qa_result,
            data=data_dict,
        )
    else:
        combined = r.get("purchase_trigger_barrier", "")
        return Review(
            persona_id=r["persona_id"],
            persona_name=r["persona_name"],
            panel_id=r.get("panel_id", ""),
            promotion_attractiveness=r.get("promotion_attractiveness", 0),
            promotion_quality=r.get("promotion_quality", 0),
            brand_favorability=r.get("brand_favorability", 0),
            brand_fit=r.get("brand_fit", 0),
            message_clarity=r.get("message_clarity", 0),
            attention_grabbing=r.get("attention_grabbing", 0),
            brand_trust=r.get("brand_trust", 0),
            appeal=r.get("appeal", 0),
            value_for_money=r.get("value_for_money", 0),
            price_fairness=r.get("price_fairness", 0),
            info_sufficiency=r.get("info_sufficiency", 0),
            recommendation_intent=r.get("recommendation_intent", 0),
            purchase_likelihood=r.get("purchase_likelihood", 0),
            purchase_consideration=r.get("purchase_consideration", 0),
            purchase_willingness=r.get("purchase_willingness", 0),
            repurchase_intent=r.get("repurchase_intent", 0),
            purchase_urgency=r.get("purchase_urgency", 0),
            overall_impression=r.get("overall_impression") or r.get("first_impression", ""),
            review_summary=r.get("review_summary", ""),
            perceived_message=r.get("perceived_message", ""),
            emotional_response=r.get("emotional_response", ""),
            brand_association=r.get("brand_association", ""),
            key_positives=r.get("key_positives", ""),
            key_concerns=r.get("key_concerns", ""),
            competitive_comparison=r.get("competitive_comparison") or r.get("competitive_preference", ""),
            information_gap=r.get("information_gap", ""),
            recommendation=r.get("recommendation") or r.get("recommendation_context", ""),
            purchase_trigger=r.get("purchase_trigger") or combined,
            purchase_barrier=r.get("purchase_barrier") or combined,
            price_perception=r.get("price_perception", ""),
            raw_response=r.get("raw_response", ""),
            error=r.get("error"),
            qa_result=qa_result,
        )
