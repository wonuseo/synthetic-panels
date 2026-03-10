import logging
import os
import threading
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

from app.core import ANTHROPIC_API_KEY
from app.llm.retry import RetryEngine
from app.models.persona import Persona
from app.models.review import Review
from app.media.processor import prepare_for_claude
from app.llm.prompt import (
    build_system_prompt,
    build_user_prompt,
    get_synthesis_system_prompt,
    build_synthesis_prompt,
    get_persona_synthesis_system_prompt,
    build_persona_synthesis_prompt,
)

logger = logging.getLogger(__name__)

_MAX_INFLIGHT_REQUESTS = max(1, int(os.getenv("ANTHROPIC_MAX_INFLIGHT", "2")))
_inflight_semaphore = threading.BoundedSemaphore(_MAX_INFLIGHT_REQUESTS)

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


# ── 재시도 엔진 ────────────────────────────────────────────────────
_retry_engine = RetryEngine(
    retryable=(APIConnectionError, APITimeoutError, RateLimitError, InternalServerError),
    non_retryable=(AuthenticationError, BadRequestError),
    rate_limit_cls=RateLimitError,
    server_error_cls=InternalServerError,
    defaults={
        "max_retries": int(os.getenv("ANTHROPIC_MAX_RETRIES", "4")),
        "base_wait_429": float(os.getenv("ANTHROPIC_BASE_WAIT_429", "8")),
        "base_wait_5xx": float(os.getenv("ANTHROPIC_BASE_WAIT_5XX", "4")),
        "base_wait_other": float(os.getenv("ANTHROPIC_BASE_WAIT_OTHER", "1.5")),
        "jitter_max": float(os.getenv("ANTHROPIC_RETRY_JITTER_MAX", "3")),
        "max_wait": float(os.getenv("ANTHROPIC_RETRY_MAX_WAIT", "45")),
    },
)


def _call_with_retry(api_fn, *, max_retries: Optional[int] = None, **retry_kw):
    return _retry_engine.call_with_retry(api_fn, _inflight_semaphore, max_retries=max_retries, **retry_kw)


# ── 공개 API ──────────────────────────────────────────────────────
def call_claude(
    persona: Persona,
    file_bytes: Optional[bytes],
    filename: Optional[str],
    model: str = "claude-sonnet-4-20250514",
    text_content: str = "",
    qa_mode: str = "off",
    team: str = "marketing",
) -> Review:
    client = _get_client()

    user_content = []
    if file_bytes and filename:
        user_content.extend(prepare_for_claude(file_bytes, filename))
    user_content.append({
        "type": "text",
        "text": build_user_prompt(has_image=bool(file_bytes), text_content=text_content, qa_mode=qa_mode, team=team),
    })

    try:
        response = _call_with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.7,
                system=build_system_prompt(persona, team),
                messages=[{"role": "user", "content": user_content}],
            ),
        )
        response_text = response.content[0].text
        review = Review.from_llm_response(persona.persona_id, persona.persona_name, response_text, panel_id=persona.panel_id, team=team)
        if qa_mode != "off" and review.qa_result:
            review.qa_result.compute_scores(review, persona, qa_mode)
        return review
    except Exception as e:
        logger.error("call_claude 실패: %s", e)
        return Review(
            persona_id=persona.persona_id,
            persona_name=persona.persona_name,
            panel_id=persona.panel_id,
            error=str(e),
            raw_response="",
        )


def synthesize_persona_claude(persona_name: str, reviews_data: List[dict], model: str = "claude-sonnet-4-20250514", team: str = "marketing") -> str:
    client = _get_client()

    try:
        response = _call_with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=0.3,
                system=get_persona_synthesis_system_prompt(team),
                messages=[{"role": "user", "content": build_persona_synthesis_prompt(persona_name, reviews_data, team)}],
            ),
        )
        return response.content[0].text
    except Exception as e:
        logger.error("synthesize_persona_claude 실패 [%s]: %s", persona_name, e)
        return f'{{"error": "{e}"}}'


def synthesize_claude(reviews_data: List[dict], model: str = "claude-sonnet-4-20250514", team: str = "marketing", funnel_group_stats: Optional[dict] = None, funnel_item_stats: Optional[dict] = None) -> str:
    client = _get_client()

    try:
        response = _call_with_retry(
            lambda: client.messages.create(
                model=model,
                max_tokens=3000,
                temperature=0.3,
                system=get_synthesis_system_prompt(team),
                messages=[{"role": "user", "content": build_synthesis_prompt(reviews_data, team, funnel_group_stats=funnel_group_stats, funnel_item_stats=funnel_item_stats)}],
            ),
        )
        return response.content[0].text
    except Exception as e:
        logger.error("synthesize_claude 실패: %s", e)
        return f'{{"error": "{e}"}}'
