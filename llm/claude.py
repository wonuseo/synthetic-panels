import time
import random
import logging
from typing import Optional, List

import anthropic
from anthropic import (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    InternalServerError,
    AuthenticationError,
    BadRequestError,
)

from config import ANTHROPIC_API_KEY
from models.persona import Persona
from models.review import Review
from media.processor import prepare_for_claude
from llm.prompt import (
    build_system_prompt,
    build_user_prompt,
    SYNTHESIS_SYSTEM_PROMPT,
    build_synthesis_prompt,
)

logger = logging.getLogger(__name__)

# ── 싱글턴 클라이언트 (커넥션 풀 재사용) ─────────────────────────
_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(
            api_key=ANTHROPIC_API_KEY,
            timeout=60.0,
            max_retries=0,  # 자체 재시도 로직 사용
        )
    return _client


# ── 재시도 + 지수 백오프 + jitter ─────────────────────────────────
_RETRYABLE = (APIConnectionError, APITimeoutError, RateLimitError, InternalServerError)

_RETRY_DEFAULTS = {
    "max_retries": 5,
    "base_wait_429": 15,
    "base_wait_5xx": 8,
    "base_wait_other": 2,
    "jitter_max": 6,
}


def _compute_wait(
    exc: Exception,
    attempt: int,
    base_429: float,
    base_5xx: float,
    base_other: float,
    jitter_max: float,
) -> float:
    """Retry-After 파싱 + 지수 백오프 + jitter 계산"""
    if isinstance(exc, RateLimitError):
        base = base_429
    elif isinstance(exc, InternalServerError):
        base = base_5xx
    else:
        base = base_other

    wait = base * (2 ** attempt)

    retry_after = getattr(exc, "response", None)
    if retry_after is not None:
        header = retry_after.headers.get("retry-after") or retry_after.headers.get("Retry-After")
        if header:
            try:
                wait = max(float(header), wait)
            except ValueError:
                pass

    jitter = random.uniform(0, jitter_max)
    wait += jitter
    return wait


def _call_with_retry(api_fn, *, max_retries: int = 5, **retry_kw):
    base_429 = retry_kw.get("base_wait_429", _RETRY_DEFAULTS["base_wait_429"])
    base_5xx = retry_kw.get("base_wait_5xx", _RETRY_DEFAULTS["base_wait_5xx"])
    base_other = retry_kw.get("base_wait_other", _RETRY_DEFAULTS["base_wait_other"])
    jitter_max = retry_kw.get("jitter_max", _RETRY_DEFAULTS["jitter_max"])

    for attempt in range(max_retries):
        try:
            return api_fn()
        except (AuthenticationError, BadRequestError):
            raise
        except _RETRYABLE as exc:
            if attempt >= max_retries - 1:
                raise
            wait = _compute_wait(exc, attempt, base_429, base_5xx, base_other, jitter_max)
            exc_name = type(exc).__name__
            logger.warning(
                "[retry %d/%d] %s — %.1f초 후 재시도",
                attempt + 1, max_retries, exc_name, wait,
            )
            time.sleep(wait)


# ── 공개 API ──────────────────────────────────────────────────────
def call_claude(
    persona: Persona,
    file_bytes: Optional[bytes],
    filename: Optional[str],
    model: str = "claude-sonnet-4-20250514",
    text_content: str = "",
    qa_mode: str = "off",
) -> Review:
    client = _get_client()

    user_content = []
    if file_bytes and filename:
        user_content.extend(prepare_for_claude(file_bytes, filename))
    user_content.append({
        "type": "text",
        "text": build_user_prompt(has_image=bool(file_bytes), text_content=text_content, qa_mode=qa_mode),
    })

    try:
        response = _call_with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.7,
                system=build_system_prompt(persona),
                messages=[{"role": "user", "content": user_content}],
            ),
        )
        response_text = response.content[0].text
        review = Review.from_llm_response(persona.persona_id, persona.persona_name, response_text)
        if qa_mode != "off" and review.qa_result:
            review.qa_result.compute_scores(review, persona, qa_mode)
        return review
    except Exception as e:
        logger.error("call_claude 실패: %s", e)
        return Review(
            persona_id=persona.persona_id,
            persona_name=persona.persona_name,
            error=str(e),
            raw_response="",
        )


def synthesize_claude(reviews_data: List[dict], model: str = "claude-sonnet-4-20250514") -> str:
    client = _get_client()

    try:
        response = _call_with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.3,
                system=SYNTHESIS_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": build_synthesis_prompt(reviews_data)}],
            ),
        )
        return response.content[0].text
    except Exception as e:
        logger.error("synthesize_claude 실패: %s", e)
        return f'{{"error": "{e}"}}'
