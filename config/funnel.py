"""funnel_config.yaml 로더 — 시트 헤더·프론트엔드 공용"""

from pathlib import Path
from functools import lru_cache

import yaml

_CONFIG_PATH = Path(__file__).parent / "funnel_config.yaml"

# Funnel ordering: upper → mid → lower
_FUNNEL_ORDER = ["upper", "mid", "lower"]

# Individual item type ordering within each funnel
_ITEM_TYPE_ORDER = ["quantitative", "qualitative", "categorical"]

QA_COMPUTED = [
    "qa_consistency_score",
    "qa_trap_pass_rate",
    "qa_persona_quality",
    "qa_passed",
    "qa_mode",
]


@lru_cache(maxsize=1)
def load_funnel_config() -> dict:
    """YAML 로드 후 dict 반환"""
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_individual_keys() -> list[str]:
    """퍼널 순서대로 individual_items의 key 목록 반환.

    Upper quant → Upper qual → Mid quant → Mid qual → Mid categorical
    → Lower quant → Lower qual
    """
    cfg = load_funnel_config()
    keys: list[str] = []
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        items = funnel.get("individual_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in items.get(item_type, []):
                keys.append(item["key"])
    return keys


def get_qa_keys() -> list[str]:
    """퍼널 순서대로 qa_items의 key 목록 반환"""
    cfg = load_funnel_config()
    keys: list[str] = []
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        for item in funnel.get("qa_items", []):
            keys.append(item["key"])
    return keys


def get_synthesis_keys() -> list[str]:
    """퍼널 순서대로 synthesis_items의 key 목록 반환"""
    cfg = load_funnel_config()
    keys: list[str] = []
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        items = funnel.get("synthesis_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in items.get(item_type, []):
                keys.append(item["key"])
    return keys


def get_results_headers() -> list[str]:
    """['run_id', 'persona_id', 'persona_name'] + individual_keys + ['error'] + qa_keys + QA_COMPUTED"""
    return (
        ["run_id", "persona_id", "persona_name"]
        + get_individual_keys()
        + ["error"]
        + get_qa_keys()
        + QA_COMPUTED
    )


def get_funnel_groups() -> dict:
    """프론트엔드용: {funnel_name: {label, items: [{key, label, scale, type}]}} 형태"""
    cfg = load_funnel_config()
    groups: dict = {}
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        items_list: list[dict] = []
        ind = funnel.get("individual_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in ind.get(item_type, []):
                items_list.append({
                    "key": item["key"],
                    "label": item["label"],
                    "scale": item.get("scale", ""),
                    "type": item_type,
                })
        groups[funnel_name] = {
            "label": funnel.get("label", funnel_name),
            "items": items_list,
        }
    return groups
