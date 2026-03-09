"""
app/llm/retry.py — 공유 재시도/백오프 엔진

Usage:
    engine = RetryEngine(
        retryable=(RateLimitError, InternalServerError, ...),
        non_retryable=(AuthenticationError, BadRequestError),
        rate_limit_cls=RateLimitError,
        server_error_cls=InternalServerError,
        defaults=_RETRY_DEFAULTS,
    )
    engine.call_with_retry(api_fn, inflight_semaphore)
"""

import logging
import random
import threading
import time
from typing import Callable, Optional, Tuple, Type

logger = logging.getLogger(__name__)


class RetryEngine:
    """
    Per-provider retry engine.

    Encapsulates global cooldown state so each provider has independent
    rate-limit tracking, while sharing the backoff/jitter logic.
    """

    def __init__(
        self,
        *,
        retryable: Tuple[Type[Exception], ...],
        non_retryable: Tuple[Type[Exception], ...],
        rate_limit_cls: Type[Exception],
        server_error_cls: Type[Exception],
        defaults: dict,
    ):
        self._retryable = retryable
        self._non_retryable = non_retryable
        self._rate_limit_cls = rate_limit_cls
        self._server_error_cls = server_error_cls
        self._defaults = defaults
        self._rate_limited_until = 0.0
        self._rate_limit_lock = threading.Lock()

    # ── cooldown helpers ───────────────────────────────────────────

    def wait_for_cooldown(self) -> None:
        with self._rate_limit_lock:
            wait = self._rate_limited_until - time.monotonic()
        if wait > 0:
            time.sleep(wait)

    def extend_cooldown(self, wait_seconds: float) -> None:
        if wait_seconds <= 0:
            return
        with self._rate_limit_lock:
            self._rate_limited_until = max(
                self._rate_limited_until, time.monotonic() + wait_seconds
            )

    # ── wait computation ───────────────────────────────────────────

    def compute_wait(
        self,
        exc: Exception,
        attempt: int,
        base_429: float,
        base_5xx: float,
        base_other: float,
        jitter_max: float,
        max_wait: float,
    ) -> float:
        """Retry-After 파싱 + 지수 백오프 + jitter 계산"""
        if isinstance(exc, self._rate_limit_cls):
            base = base_429
        elif isinstance(exc, self._server_error_cls):
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
        return min(wait, max_wait)

    # ── main entry ─────────────────────────────────────────────────

    def call_with_retry(
        self,
        api_fn: Callable,
        inflight_semaphore: threading.BoundedSemaphore,
        *,
        max_retries: Optional[int] = None,
        **retry_kw,
    ):
        if max_retries is None:
            max_retries = int(retry_kw.get("max_retries", self._defaults["max_retries"]))

        base_429 = float(retry_kw.get("base_wait_429", self._defaults["base_wait_429"]))
        base_5xx = float(retry_kw.get("base_wait_5xx", self._defaults["base_wait_5xx"]))
        base_other = float(retry_kw.get("base_wait_other", self._defaults["base_wait_other"]))
        jitter_max = float(retry_kw.get("jitter_max", self._defaults["jitter_max"]))
        max_wait = float(retry_kw.get("max_wait", self._defaults["max_wait"]))

        for attempt in range(max_retries):
            self.wait_for_cooldown()
            try:
                with inflight_semaphore:
                    return api_fn()
            except self._non_retryable:
                raise
            except self._retryable as exc:
                if attempt >= max_retries - 1:
                    raise
                wait = self.compute_wait(exc, attempt, base_429, base_5xx, base_other, jitter_max, max_wait)
                if isinstance(exc, self._rate_limit_cls):
                    self.extend_cooldown(wait)
                logger.warning(
                    "[retry %d/%d] %s — %.1f초 후 재시도",
                    attempt + 1, max_retries, type(exc).__name__, wait,
                )
                time.sleep(wait)
