from datetime import datetime
from zoneinfo import ZoneInfo

_review_counts: dict[str, int] = {}


def _today_kst() -> str:
    return datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d")


def get_today_count() -> int:
    return _review_counts.get(_today_kst(), 0)


def increment_today_count():
    key = _today_kst()
    _review_counts[key] = _review_counts.get(key, 0) + 1
    for k in list(_review_counts):
        if k != key:
            del _review_counts[k]
