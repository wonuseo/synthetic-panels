from dataclasses import dataclass, field
from typing import List, Optional
from collections import Counter

from app.core.funnel import get_funnel_quant_groups, get_quant_keys, get_qual_keys


# Marketing-specific hardcoded lists (for backward compat with existing code)
_QUANT_FIELDS = [
    "promotion_attractiveness", "promotion_quality",
    "brand_favorability", "brand_fit", "message_clarity",
    "attention_grabbing", "brand_trust",
    "appeal", "value_for_money", "price_fairness",
    "info_sufficiency", "recommendation_intent",
    "purchase_likelihood", "purchase_consideration",
    "purchase_willingness", "repurchase_intent", "purchase_urgency",
]

_QUAL_FIELDS = [
    "overall_impression", "review_summary",
    "perceived_message", "emotional_response", "brand_association",
    "key_positives", "key_concerns", "competitive_comparison", "information_gap",
    "purchase_trigger", "purchase_barrier", "price_perception",
]


@dataclass
class PersonaSummary:
    persona_id: str
    persona_name: str
    panel_count: int = 0

    # 정량 평균값 — marketing named fields (backward compat)
    avg_promotion_attractiveness: float = 0.0
    avg_promotion_quality: float = 0.0
    avg_brand_favorability: float = 0.0
    avg_brand_fit: float = 0.0
    avg_message_clarity: float = 0.0
    avg_attention_grabbing: float = 0.0
    avg_brand_trust: float = 0.0
    avg_appeal: float = 0.0
    avg_value_for_money: float = 0.0
    avg_price_fairness: float = 0.0
    avg_info_sufficiency: float = 0.0
    avg_recommendation_intent: float = 0.0
    avg_purchase_likelihood: float = 0.0
    avg_purchase_consideration: float = 0.0
    avg_purchase_willingness: float = 0.0
    avg_repurchase_intent: float = 0.0
    avg_purchase_urgency: float = 0.0

    # 추천 분포
    recommendation_distribution: dict = field(default_factory=dict)

    # 정성 필드 (Phase 3 LLM 호출로 채움) — marketing named fields
    overall_impression: str = ""
    review_summary: str = ""
    perceived_message: str = ""
    emotional_response: str = ""
    brand_association: str = ""
    key_positives: str = ""
    key_concerns: str = ""
    competitive_comparison: str = ""
    information_gap: str = ""
    purchase_trigger: str = ""
    purchase_barrier: str = ""
    price_perception: str = ""

    # 퍼널별 정량 그룹 평균 (Python 계산)
    funnel_quant_groups: dict = field(default_factory=dict)

    # 개별 패널 리뷰 (드릴다운용)
    panel_reviews: List[dict] = field(default_factory=list)

    # 동적 필드 (commerce / 다른 팀용)
    quant_averages: dict = field(default_factory=dict)
    qual_fields: dict = field(default_factory=dict)

    @classmethod
    def from_reviews(cls, persona_id: str, persona_name: str, reviews: list, team: str = "marketing") -> "PersonaSummary":
        panel_count = len(reviews)
        summary = cls(persona_id=persona_id, persona_name=persona_name, panel_count=panel_count)

        quant_keys = get_quant_keys(team)
        quant_averages: dict = {}

        if team == "marketing":
            # 기존 방식: named fields에 직접 set
            for qf in _QUANT_FIELDS:
                values = [getattr(r, qf, 0) for r in reviews if getattr(r, qf, 0) > 0]
                avg = sum(values) / len(values) if values else 0.0
                avg_rounded = round(avg, 1)
                setattr(summary, f"avg_{qf}", avg_rounded)
                quant_averages[qf] = avg_rounded
        else:
            # 동적 방식: data dict에서 필드값 읽기
            for qf in quant_keys:
                values = []
                for r in reviews:
                    val = r.data.get(qf, 0) if r.data else getattr(r, qf, 0)
                    if val and val > 0:
                        values.append(val)
                avg = sum(values) / len(values) if values else 0.0
                quant_averages[qf] = round(avg, 1)

        summary.quant_averages = quant_averages

        # 추천 분포
        recs = [r.recommendation for r in reviews if r.recommendation]
        summary.recommendation_distribution = dict(Counter(recs))

        # 퍼널별 정량 그룹 평균 계산
        funnel_quant_groups_def = get_funnel_quant_groups(team)
        fqg: dict = {}
        for funnel_key, groups in funnel_quant_groups_def.items():
            fqg[funnel_key] = []
            for grp in groups:
                vals = [
                    quant_averages.get(k, 0)
                    for k in grp["keys"]
                    if quant_averages.get(k, 0) > 0
                ]
                avg = round(sum(vals) / len(vals), 1) if vals else 0.0
                fqg[funnel_key].append({
                    "label": grp["label"],
                    "sublabels": grp["sublabels"],
                    "avg": avg,
                    "pct": round((avg / 5) * 100),
                })
        summary.funnel_quant_groups = fqg

        # 패널 리뷰 저장
        summary.panel_reviews = [r.to_dict() for r in reviews]

        return summary

    def fill_qualitative(self, llm_data: dict, team: str = "marketing"):
        qual_keys = get_qual_keys(team)
        qual_fields: dict = {}
        for qf in qual_keys:
            val = llm_data.get(qf, "")
            if isinstance(val, list):
                val = "; ".join(str(v) for v in val)
            val = str(val).strip()
            qual_fields[qf] = val
            # Also set named attrs for marketing backward compat
            if hasattr(self, qf):
                setattr(self, qf, val)
        self.qual_fields = qual_fields

    def to_dict(self) -> dict:
        d = {
            "persona_id": self.persona_id,
            "persona_name": self.persona_name,
            "panel_count": self.panel_count,
            "recommendation_distribution": self.recommendation_distribution,
            "funnel_quant_groups": self.funnel_quant_groups,
            "panel_reviews": self.panel_reviews,
            # Dynamic dicts (always included — used by frontend for commerce)
            "quant_averages": self.quant_averages,
            "qual_fields": self.qual_fields,
        }
        # Marketing named avg_ fields (backward compat for overview.js etc.)
        for qf in _QUANT_FIELDS:
            d[f"avg_{qf}"] = getattr(self, f"avg_{qf}", 0.0)
        # Marketing named qual fields
        for qf in _QUAL_FIELDS:
            d[qf] = getattr(self, qf, "")
        # Flatten quant_averages to top level for dynamic field access
        d.update(self.quant_averages)
        # Flatten qual_fields to top level
        d.update(self.qual_fields)
        return d

    def to_sheet_row(self, run_id: str, team: str = "marketing") -> list:
        quant_keys = get_quant_keys(team)
        qual_keys = get_qual_keys(team)
        row = [run_id, self.persona_id, self.persona_name, self.panel_count]
        for qf in quant_keys:
            row.append(self.quant_averages.get(qf, getattr(self, f"avg_{qf}", 0)))
        for qf in qual_keys:
            row.append(self.qual_fields.get(qf, getattr(self, qf, "")))
        return row

    @staticmethod
    def sheet_headers(team: str = "marketing") -> list:
        quant_keys = get_quant_keys(team)
        qual_keys = get_qual_keys(team)
        headers = ["run_id", "persona_id", "persona_name", "panel_count"]
        for qf in quant_keys:
            headers.append(f"avg_{qf}")
        headers.extend(qual_keys)
        return headers
