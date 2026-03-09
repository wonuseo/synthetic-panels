from dataclasses import dataclass, field, asdict
from typing import Optional
import json
import re
import logging

from app.core.funnel import get_individual_keys, get_qa_keys, get_field_scales_cached, get_quant_keys
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
    # Overall (1-5) — marketing fields
    promotion_attractiveness: int = 0
    promotion_quality: int = 0
    # Brand (1-5) — marketing fields
    brand_favorability: int = 0
    brand_fit: int = 0
    message_clarity: int = 0
    attention_grabbing: int = 0
    brand_trust: int = 0
    # Demand & Acquisition (1-5) — marketing fields
    appeal: int = 0
    value_for_money: int = 0
    price_fairness: int = 0
    info_sufficiency: int = 0
    recommendation_intent: int = 0
    # Sales & Conversion (1-5) — shared fields
    purchase_likelihood: int = 0
    purchase_consideration: int = 0
    purchase_willingness: int = 0
    repurchase_intent: int = 0
    purchase_urgency: int = 0
    # Qualitative — Overall
    overall_impression: str = ""
    review_summary: str = ""
    # Qualitative — Upper — marketing fields
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
    # Dynamic fields for commerce/other teams
    data: dict = field(default_factory=dict)

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

    def __getattr__(self, name: str):
        """동적 필드 접근 — data dict에서 조회 (commerce 필드 등)."""
        # Avoid recursion during __init__
        if name == "data":
            raise AttributeError(name)
        try:
            data = object.__getattribute__(self, "data")
            if name in data:
                return data[name]
        except AttributeError:
            pass
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    @classmethod
    def from_llm_response(cls, persona_id: str, persona_name: str, response_text: str, panel_id: str = "", team: str = "marketing") -> "Review":
        try:
            data = extract_json(response_text)

            # 스케일 맵 로드
            scales = get_field_scales_cached(team)

            kwargs: dict = {
                "persona_id": persona_id,
                "persona_name": persona_name,
                "panel_id": panel_id,
                "raw_response": response_text,
            }

            if team == "marketing":
                # 기존 마케팅 필드 처리
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
                    logger.warning("[%s] 누락된 정량 필드: %s", persona_name, ", ".join(missing_int))
                if missing_str:
                    logger.warning("[%s] 누락된 정성 필드: %s", persona_name, ", ".join(missing_str))
            else:
                # 동적 팀별 필드 처리 — data dict에 저장
                quant_keys = get_quant_keys(team)
                individual_keys = get_individual_keys(team)
                dynamic_data: dict = {}
                missing_keys = []

                for key in individual_keys:
                    if key not in data:
                        missing_keys.append(key)
                    if key in quant_keys:
                        lo, hi = scales.get(key, (1, 5))
                        dynamic_data[key] = _safe_int(data.get(key), lo, hi)
                    elif key == "recommendation":
                        dynamic_data[key] = _validate_recommendation(data.get(key))
                    else:
                        dynamic_data[key] = _safe_str(data.get(key))

                if missing_keys:
                    logger.warning("[%s] 누락된 필드: %s", persona_name, ", ".join(missing_keys))

                kwargs["data"] = dynamic_data
                # Copy shared fields to named attrs for QA compatibility
                kwargs["recommendation"] = dynamic_data.get("recommendation", "보통")
                kwargs["overall_impression"] = dynamic_data.get("overall_impression", "")
                kwargs["review_summary"] = dynamic_data.get("review_summary", "")
                kwargs["key_positives"] = dynamic_data.get("key_positives", "")
                kwargs["key_concerns"] = dynamic_data.get("key_concerns", "")
                kwargs["competitive_comparison"] = dynamic_data.get("competitive_comparison", "")
                kwargs["information_gap"] = dynamic_data.get("information_gap", "")
                kwargs["purchase_trigger"] = dynamic_data.get("purchase_trigger", "")
                kwargs["purchase_barrier"] = dynamic_data.get("purchase_barrier", "")
                kwargs["price_perception"] = dynamic_data.get("price_perception", "")
                kwargs["purchase_likelihood"] = dynamic_data.get("purchase_likelihood", 0)
                kwargs["purchase_consideration"] = dynamic_data.get("purchase_consideration", 0)
                kwargs["purchase_willingness"] = dynamic_data.get("purchase_willingness", 0)
                kwargs["repurchase_intent"] = dynamic_data.get("repurchase_intent", 0)
                kwargs["purchase_urgency"] = dynamic_data.get("purchase_urgency", 0)

            # QA fields (same keys for both teams)
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
        d = asdict(self)
        # Merge dynamic data fields to top level for frontend access
        if self.data:
            d.update(self.data)
        return d

    def to_sheet_row(self, run_id: str, team: str = "marketing") -> list:
        row = [run_id, self.persona_id, self.persona_name, self.panel_id]
        for key in get_individual_keys(team):
            # Check data dict first (commerce fields), then named attrs
            val = self.data.get(key) if self.data else None
            if val is None:
                val = getattr(self, key, "")
            row.append(val)
        row.append(self.error or "")
        if self.qa_result:
            row.extend(self.qa_result.to_sheet_columns(team))
        else:
            qa_col_count = len(get_qa_keys(team)) + 5  # 5 = QA_COMPUTED fields
            row.extend([""] * qa_col_count)
        return row
