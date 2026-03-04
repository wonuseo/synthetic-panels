from dataclasses import dataclass, field, asdict
from typing import Optional
import json
import re
import logging

from app.core.funnel import get_individual_keys, get_qa_keys, get_field_scales_cached
from app.llm.parse import extract_json
from app.models.qa import QAResult

logger = logging.getLogger(__name__)

# 숫자 추출용 정규식: 텍스트에서 첫 번째 숫자(정수 또는 소수) 추출
_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")

# 허용되는 recommendation 값
_VALID_RECOMMENDATIONS = {"매우 관심 있음", "다소 관심 있음", "보통", "관심 없음", "전혀 관심 없음"}


def _safe_int(value, lo: int = 0, hi: int = 10) -> int:
    """다양한 LLM 출력 형태를 안전하게 int로 변환하고, 스케일 범위에 클램핑한다."""
    if value is None:
        return 0

    if isinstance(value, (int, float)):
        n = int(round(value))
        if n == 0:
            return 0
        return max(lo, min(hi, n))

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return 0
        match = _NUM_RE.search(value)
        if match:
            n = int(round(float(match.group())))
            if n == 0:
                return 0
            return max(lo, min(hi, n))
        return 0

    return 0


def _safe_str(value) -> str:
    """다양한 LLM 출력 형태를 안전하게 str로 변환한다."""
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value).strip()


def _validate_recommendation(value) -> str:
    """recommendation 필드를 유효한 값으로 정규화한다."""
    s = _safe_str(value)
    if not s:
        return "보통"
    if s in _VALID_RECOMMENDATIONS:
        return s
    s_nospace = s.replace(" ", "")
    for valid in _VALID_RECOMMENDATIONS:
        valid_nospace = valid.replace(" ", "")
        if s_nospace == valid_nospace:
            return valid
    for valid in _VALID_RECOMMENDATIONS:
        if len(s) >= 2 and (valid in s or s in valid):
            return valid
    return s


@dataclass
class Review:
    persona_id: str
    persona_name: str
    panel_id: str = ""
    # Overall (1-5)
    promotion_attractiveness: int = 0
    promotion_quality: int = 0
    # Brand (1-5)
    brand_favorability: int = 0
    brand_fit: int = 0
    message_clarity: int = 0
    attention_grabbing: int = 0
    brand_trust: int = 0
    # Demand & Acquisition (1-5)
    appeal: int = 0
    value_for_money: int = 0
    price_fairness: int = 0
    info_sufficiency: int = 0
    recommendation_intent: int = 0
    # Sales & Conversion (1-5)
    purchase_likelihood: int = 0
    purchase_consideration: int = 0
    purchase_willingness: int = 0
    repurchase_intent: int = 0
    purchase_urgency: int = 0
    # Qualitative — Overall
    overall_impression: str = ""
    review_summary: str = ""
    # Qualitative — Upper
    perceived_message: str = ""
    emotional_response: str = ""
    brand_association: str = ""
    # Qualitative — Mid
    key_positives: str = ""
    key_concerns: str = ""
    competitive_comparison: str = ""
    information_gap: str = ""
    recommendation: str = ""
    # Qualitative — Lower
    purchase_trigger: str = ""
    purchase_barrier: str = ""
    price_perception: str = ""
    raw_response: str = ""
    error: Optional[str] = None
    # QA Result
    qa_result: Optional[QAResult] = None

    _INT_FIELDS = {
        "promotion_attractiveness", "promotion_quality",
        "brand_favorability", "brand_fit", "message_clarity",
        "attention_grabbing", "brand_trust",
        "appeal", "value_for_money", "price_fairness",
        "info_sufficiency", "recommendation_intent",
        "purchase_likelihood", "purchase_consideration",
        "purchase_willingness", "repurchase_intent", "purchase_urgency",
    }
    _STR_FIELDS = {
        "overall_impression", "review_summary",
        "perceived_message", "emotional_response", "brand_association",
        "key_positives", "key_concerns", "competitive_comparison", "information_gap",
        "recommendation",
        "purchase_trigger", "purchase_barrier", "price_perception",
    }
    _QA_FIELDS = {
        "qa_rep_brand_attitude", "qa_rep_value_perception", "qa_rep_purchase_intent",
        "qa_trap_budget_sensitivity", "qa_trap_competitor_loyalty", "qa_trap_skepticism_check",
    }

    @classmethod
    def from_llm_response(cls, persona_id: str, persona_name: str, response_text: str, panel_id: str = "") -> "Review":
        try:
            data = extract_json(response_text)

            # 스케일 맵 로드
            scales = get_field_scales_cached()

            kwargs: dict = {"persona_id": persona_id, "persona_name": persona_name, "panel_id": panel_id, "raw_response": response_text}

            # 필드 존재 여부 추적
            missing_int = []
            missing_str = []

            for key in cls._INT_FIELDS:
                if key not in data:
                    missing_int.append(key)
                lo, hi = scales.get(key, (1, 5))
                kwargs[key] = _safe_int(data.get(key), lo, hi)

            for key in cls._STR_FIELDS:
                if key not in data:
                    missing_str.append(key)
                if key == "recommendation":
                    kwargs[key] = _validate_recommendation(data.get(key))
                else:
                    kwargs[key] = _safe_str(data.get(key))

            if missing_int:
                logger.warning(
                    "[%s] 누락된 정량 필드: %s", persona_name, ", ".join(missing_int)
                )
            if missing_str:
                logger.warning(
                    "[%s] 누락된 정성 필드: %s", persona_name, ", ".join(missing_str)
                )

            # QA fields
            if any(data.get(f) for f in cls._QA_FIELDS):
                qa_kwargs = {}
                for f in cls._QA_FIELDS:
                    lo, hi = scales.get(f, (1, 5))
                    qa_kwargs[f] = _safe_int(data.get(f), lo, hi)
                kwargs["qa_result"] = QAResult(**qa_kwargs)

            return cls(**kwargs)
        except json.JSONDecodeError as e:
            logger.error("[%s] JSON 파싱 실패: %s", persona_name, e)
            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                review_summary=response_text[:500],
                raw_response=response_text,
                error="Failed to parse JSON response",
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.error("[%s] 데이터 변환 실패: %s", persona_name, e)
            return cls(
                persona_id=persona_id,
                persona_name=persona_name,
                review_summary=response_text[:500],
                raw_response=response_text,
                error=f"Data conversion error: {e}",
            )

    def to_dict(self) -> dict:
        return asdict(self)

    def to_sheet_row(self, run_id: str) -> list:
        row = [run_id, self.persona_id, self.persona_name, self.panel_id]
        for key in get_individual_keys():
            row.append(getattr(self, key, ""))
        row.append(self.error or "")
        if self.qa_result:
            row.extend(self.qa_result.to_sheet_columns())
        else:
            qa_col_count = len(get_qa_keys()) + 5  # 5 = QA_COMPUTED fields
            row.extend([""] * qa_col_count)
        return row
