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
    """다양한 LLM 출력 형태를 안전하게 int로 변환하고, 스케일 범위에 클램핑한다.

    지원하는 형태:
    - int/float: 그대로 변환
    - "5": 문자열 숫자
    - "5/7": 분수 표기 → 앞쪽 숫자
    - "약 4", "대략 3": 한국어 접두어 + 숫자
    - "5점", "5점 (높음)": 숫자 + 한국어 접미어
    - None, "", 비숫자 문자열: 0 반환
    """
    if value is None:
        return 0

    # 이미 숫자 타입
    if isinstance(value, (int, float)):
        n = int(round(value))
        if n == 0:
            return 0
        return max(lo, min(hi, n))

    # 문자열 처리
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

    # list 등 예상치 못한 타입
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
    # 공백 제거 후 매칭 시도 (예: "관심있음" → "관심 있음")
    s_nospace = s.replace(" ", "")
    for valid in _VALID_RECOMMENDATIONS:
        valid_nospace = valid.replace(" ", "")
        if s_nospace == valid_nospace:
            return valid
    # 부분 매칭 시도 (긴 쪽에서 짧은 쪽 포함 여부)
    for valid in _VALID_RECOMMENDATIONS:
        if len(s) >= 2 and (valid in s or s in valid):
            return valid
    return s


@dataclass
class Review:
    persona_id: str
    persona_name: str
    panel_id: str = ""
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

    # dataclass 필드별 타입 캐스터 (flat JSON → Review 필드 매핑)
    _INT_FIELDS = {
        "appeal_score", "like_dislike", "favorable_unfavorable",
        "value_for_money", "price_fairness", "brand_self_congruity",
        "brand_image_fit", "message_clarity", "attention_grabbing",
        "info_sufficiency", "likelihood_high", "probability_consider_high",
        "willingness_high", "purchase_probability_juster",
    }
    _STR_FIELDS = {
        "first_impression", "key_positives", "key_concerns",
        "recommendation", "review_summary", "competitive_preference",
        "perceived_message", "emotional_response",
        "purchase_trigger_barrier", "recommendation_context",
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
                lo, hi = scales.get(key, (0, 10))
                kwargs[key] = _safe_int(data.get(key), lo, hi)

            for key in cls._STR_FIELDS:
                if key not in data:
                    missing_str.append(key)
                if key == "recommendation":
                    kwargs[key] = _validate_recommendation(data.get(key))
                else:
                    kwargs[key] = _safe_str(data.get(key))

            # 누락 필드 경고 로깅
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
                    lo, hi = scales.get(f, (1, 7))
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
