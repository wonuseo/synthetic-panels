"""LLM 응답에서 JSON을 추출하는 공통 유틸리티."""

import json
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 코드블록 제거 패턴
_CODE_BLOCK_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)

# 가장 바깥 { ... } 매칭 (greedy)
_OUTER_BRACE_RE = re.compile(r"\{.*\}", re.DOTALL)

# trailing comma: ,(공백)\} 또는 ,(공백)\]
_TRAILING_COMMA_RE = re.compile(r",\s*([}\]])")

# 숫자 값에서 흔한 LLM 오류: 값 뒤에 슬래시+스케일 (예: 5/7, 3/10)
_FRACTION_IN_VALUE_RE = re.compile(r":\s*(\d+)\s*/\s*\d+")

# JSON 내 한 줄 주석 (// ...)
_LINE_COMMENT_RE = re.compile(r'//[^\n"]*(?=\n|$)')


def _clean_json_text(text: str) -> str:
    """LLM이 반환하는 비표준 JSON 텍스트를 정리한다."""
    # 한 줄 주석 제거
    text = _LINE_COMMENT_RE.sub("", text)
    # 분수 표기(5/7)를 앞쪽 숫자만 남기기 (JSON 값 컨텍스트에서)
    text = _FRACTION_IN_VALUE_RE.sub(r": \1", text)
    # trailing comma 제거
    text = _TRAILING_COMMA_RE.sub(r"\1", text)
    return text


def extract_json(text: str) -> dict:
    """LLM 응답 텍스트에서 JSON dict를 추출한다.

    1) 마크다운 코드블록(```json ... ```) 안에서 추출
    2) 코드블록이 없으면 가장 바깥쪽 { ... } 를 추출
    3) 비표준 JSON(trailing comma, 분수 표기 등) 자동 정리
    4) 파싱 실패 시 json.JSONDecodeError를 raise
    """
    text = text.strip()

    # 1) 코드블록 안에서 추출
    code_match = _CODE_BLOCK_RE.search(text)
    if code_match:
        candidate = code_match.group(1).strip()
    else:
        # 2) { ... } 로 직접 추출
        brace_match = _OUTER_BRACE_RE.search(text)
        if brace_match:
            candidate = brace_match.group(0)
        else:
            candidate = text

    # 3) 비표준 표기 정리 후 파싱
    cleaned = _clean_json_text(candidate)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # 정리 전 원본으로 한 번 더 시도
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 마지막 시도: 전체 텍스트에서 brace 추출 후 정리
    brace_match = _OUTER_BRACE_RE.search(text)
    if brace_match:
        last_try = _clean_json_text(brace_match.group(0))
        return json.loads(last_try)

    raise json.JSONDecodeError("No JSON object found in LLM response", text, 0)


def extract_json_or_none(text: str) -> Optional[dict]:
    """extract_json의 안전한 버전. 파싱 실패 시 None 반환."""
    if not text:
        return None
    try:
        return extract_json(text)
    except (json.JSONDecodeError, IndexError):
        logger.warning("JSON 파싱 실패: %s", text[:200])
        return None
