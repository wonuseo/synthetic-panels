from dataclasses import dataclass, field
from typing import List, Optional
from collections import Counter


# 정량 필드 목록 (Review 모델의 _INT_FIELDS와 동일)
_QUANT_FIELDS = [
    "appeal_score", "like_dislike", "favorable_unfavorable",
    "value_for_money", "price_fairness", "brand_self_congruity",
    "brand_image_fit", "message_clarity", "attention_grabbing",
    "info_sufficiency", "likelihood_high", "probability_consider_high",
    "willingness_high", "purchase_probability_juster",
]

# 정성 필드 목록 (Phase 3 LLM으로 채움)
_QUAL_FIELDS = [
    "first_impression", "key_positives", "key_concerns",
    "review_summary", "perceived_message", "emotional_response",
    "purchase_trigger_barrier", "recommendation_context",
    "competitive_preference",
]


@dataclass
class PersonaSummary:
    persona_id: str
    persona_name: str
    panel_count: int = 0

    # 정량 평균값
    avg_appeal_score: float = 0.0
    avg_like_dislike: float = 0.0
    avg_favorable_unfavorable: float = 0.0
    avg_value_for_money: float = 0.0
    avg_price_fairness: float = 0.0
    avg_brand_self_congruity: float = 0.0
    avg_brand_image_fit: float = 0.0
    avg_message_clarity: float = 0.0
    avg_attention_grabbing: float = 0.0
    avg_info_sufficiency: float = 0.0
    avg_likelihood_high: float = 0.0
    avg_probability_consider_high: float = 0.0
    avg_willingness_high: float = 0.0
    avg_purchase_probability_juster: float = 0.0

    # 추천 분포
    recommendation_distribution: dict = field(default_factory=dict)

    # 정성 필드 (Phase 3 LLM 호출로 채움)
    first_impression: str = ""
    key_positives: str = ""
    key_concerns: str = ""
    review_summary: str = ""
    perceived_message: str = ""
    emotional_response: str = ""
    purchase_trigger_barrier: str = ""
    recommendation_context: str = ""
    competitive_preference: str = ""

    # 개별 패널 리뷰 (드릴다운용)
    panel_reviews: List[dict] = field(default_factory=list)

    @classmethod
    def from_reviews(cls, persona_id: str, persona_name: str, reviews: list) -> "PersonaSummary":
        panel_count = len(reviews)
        summary = cls(persona_id=persona_id, persona_name=persona_name, panel_count=panel_count)

        # 정량 평균 계산
        for qf in _QUANT_FIELDS:
            values = [getattr(r, qf, 0) for r in reviews if getattr(r, qf, 0) > 0]
            avg = sum(values) / len(values) if values else 0.0
            setattr(summary, f"avg_{qf}", round(avg, 1))

        # 추천 분포
        recs = [r.recommendation for r in reviews if r.recommendation]
        summary.recommendation_distribution = dict(Counter(recs))

        # 패널 리뷰 저장
        summary.panel_reviews = [r.to_dict() for r in reviews]

        return summary

    def fill_qualitative(self, llm_data: dict):
        for qf in _QUAL_FIELDS:
            val = llm_data.get(qf, "")
            if isinstance(val, list):
                val = "; ".join(str(v) for v in val)
            setattr(self, qf, str(val).strip())

    def to_dict(self) -> dict:
        return {
            "persona_id": self.persona_id,
            "persona_name": self.persona_name,
            "panel_count": self.panel_count,
            **{f"avg_{qf}": getattr(self, f"avg_{qf}") for qf in _QUANT_FIELDS},
            "recommendation_distribution": self.recommendation_distribution,
            **{qf: getattr(self, qf) for qf in _QUAL_FIELDS},
            "panel_reviews": self.panel_reviews,
        }

    def to_sheet_row(self, run_id: str) -> list:
        row = [run_id, self.persona_id, self.persona_name, self.panel_count]
        for qf in _QUANT_FIELDS:
            row.append(getattr(self, f"avg_{qf}"))
        for qf in _QUAL_FIELDS:
            row.append(getattr(self, qf))
        return row

    @staticmethod
    def sheet_headers() -> list:
        headers = ["run_id", "persona_id", "persona_name", "panel_count"]
        for qf in _QUANT_FIELDS:
            headers.append(f"avg_{qf}")
        headers.extend(_QUAL_FIELDS)
        return headers
