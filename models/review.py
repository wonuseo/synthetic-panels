from dataclasses import dataclass, field, asdict
from typing import Optional
import json

from models.qa import QAResult


@dataclass
class Review:
    persona_id: str
    persona_name: str
    appeal_score: int = 0
    first_impression: str = ""
    key_positives: str = ""
    key_concerns: str = ""
    recommendation: str = ""
    review_summary: str = ""
    # Brand Attitude (1-7)
    like_dislike: int = 0
    favorable_unfavorable: int = 0
    # Perceived Value (1-7)
    value_for_money: int = 0
    price_fairness: int = 0
    # Brand Fit (1-7)
    brand_self_congruity: int = 0
    brand_image_fit: int = 0
    # Ad Effectiveness (1-7)
    message_clarity: int = 0
    attention_grabbing: int = 0
    # Other quantitative
    info_sufficiency: int = 0
    competitive_preference: str = ""
    # Purchase Intention (1-7)
    likelihood_high: int = 0
    probability_consider_high: int = 0
    willingness_high: int = 0
    # Purchase Probability (0-10)
    purchase_probability_juster: int = 0
    # Qualitative Comments
    perceived_message: str = ""
    emotional_response: str = ""
    purchase_trigger_barrier: str = ""
    recommendation_context: str = ""
    raw_response: str = ""
    error: Optional[str] = None
    # QA Result
    qa_result: Optional[QAResult] = None

    @classmethod
    def from_llm_response(cls, persona_id: str, persona_name: str, response_text: str) -> "Review":
        try:
            # Try to extract JSON from the response
            text = response_text.strip()
            # Handle markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            data = json.loads(text)

            # Support both flat and nested (Korean category keys) structures
            base = data.get("기본 평가", data)
            ba   = data.get("브랜드 태도", data)
            pv   = data.get("지각된 가치", data)
            bf   = data.get("브랜드 적합성", data)
            ae   = data.get("광고 효과성", data)
            etc  = data.get("기타 정량", data)
            pi   = data.get("구매 의향", data)
            pp   = data.get("구매 확률", data)
            qc   = data.get("정성적 코멘트", data)

            positives = base.get("key_positives", [])
            if isinstance(positives, list):
                positives = "; ".join(positives)

            concerns = base.get("key_concerns", [])
            if isinstance(concerns, list):
                concerns = "; ".join(concerns)

            # Parse QA fields if present
            # Try "QA 검증" first, then "QA 검증 항목" (matches the prompt section header),
            # then fall back to the root dict for flat JSON responses.
            qa_fields = data.get("QA 검증") or data.get("QA 검증 항목") or data
            qa_result = None
            if any(qa_fields.get(f) for f in (
                "qa_rep_brand_attitude", "qa_rep_value_perception", "qa_rep_purchase_intent",
                "qa_trap_budget_sensitivity", "qa_trap_competitor_loyalty", "qa_trap_skepticism_check",
            )):
                qa_result = QAResult(
                    qa_rep_brand_attitude=int(qa_fields.get("qa_rep_brand_attitude", 0)),
                    qa_rep_value_perception=int(qa_fields.get("qa_rep_value_perception", 0)),
                    qa_rep_purchase_intent=int(qa_fields.get("qa_rep_purchase_intent", 0)),
                    qa_trap_budget_sensitivity=int(qa_fields.get("qa_trap_budget_sensitivity", 0)),
                    qa_trap_competitor_loyalty=int(qa_fields.get("qa_trap_competitor_loyalty", 0)),
                    qa_trap_skepticism_check=int(qa_fields.get("qa_trap_skepticism_check", 0)),
                )

            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                appeal_score=int(base.get("appeal_score", 0)),
                first_impression=str(base.get("first_impression", "")),
                key_positives=str(positives),
                key_concerns=str(concerns),
                recommendation=str(base.get("recommendation", "")),
                review_summary=str(base.get("review_summary", "")),
                # Brand Attitude
                like_dislike=int(ba.get("like_dislike", 0)),
                favorable_unfavorable=int(ba.get("favorable_unfavorable", 0)),
                # Perceived Value
                value_for_money=int(pv.get("value_for_money", 0)),
                price_fairness=int(pv.get("price_fairness", 0)),
                # Brand Fit
                brand_self_congruity=int(bf.get("brand_self_congruity", 0)),
                brand_image_fit=int(bf.get("brand_image_fit", 0)),
                # Ad Effectiveness
                message_clarity=int(ae.get("message_clarity", 0)),
                attention_grabbing=int(ae.get("attention_grabbing", 0)),
                # Other quantitative
                info_sufficiency=int(etc.get("info_sufficiency", 0)),
                competitive_preference=str(etc.get("competitive_preference", "")),
                # Purchase Intention
                likelihood_high=int(pi.get("likelihood_high", 0)),
                probability_consider_high=int(pi.get("probability_consider_high", 0)),
                willingness_high=int(pi.get("willingness_high", 0)),
                # Purchase Probability
                purchase_probability_juster=int(pp.get("purchase_probability_juster", 0)),
                # Qualitative Comments
                perceived_message=str(qc.get("perceived_message", "")),
                emotional_response=str(qc.get("emotional_response", "")),
                purchase_trigger_barrier=str(qc.get("purchase_trigger_barrier", "")),
                recommendation_context=str(qc.get("recommendation_context", "")),
                raw_response=response_text,
                qa_result=qa_result,
            )
        except (json.JSONDecodeError, KeyError, ValueError):
            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                review_summary=response_text[:500],
                raw_response=response_text,
                error="Failed to parse JSON response",
            )

    def to_dict(self) -> dict:
        return asdict(self)

    def to_sheet_row(self, run_id: str) -> list:
        row = [
            run_id,
            self.persona_id,
            self.persona_name,
            self.appeal_score,
            self.first_impression,
            self.key_positives,
            self.key_concerns,
            self.recommendation,
            self.review_summary,
            self.like_dislike,
            self.favorable_unfavorable,
            self.value_for_money,
            self.price_fairness,
            self.brand_self_congruity,
            self.brand_image_fit,
            self.message_clarity,
            self.attention_grabbing,
            self.info_sufficiency,
            self.competitive_preference,
            self.likelihood_high,
            self.probability_consider_high,
            self.willingness_high,
            self.purchase_probability_juster,
            self.perceived_message,
            self.emotional_response,
            self.purchase_trigger_barrier,
            self.recommendation_context,
            self.error or "",
        ]
        if self.qa_result:
            row.extend(self.qa_result.to_sheet_columns())
        else:
            row.extend([""] * 11)
        return row
