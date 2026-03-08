"""funnel_config.yaml 로더 — 시트 헤더·프론트엔드 공용"""

from pathlib import Path
from functools import lru_cache

import yaml

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "funnel_config.yaml"

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


def get_overall_keys() -> list[str]:
    """overall 섹션의 individual_items key 목록 반환."""
    cfg = load_funnel_config()
    overall = cfg.get("overall", {})
    items = overall.get("individual_items", {})
    keys: list[str] = []
    for item_type in _ITEM_TYPE_ORDER:
        for item in items.get(item_type, []):
            keys.append(item["key"])
    return keys


def get_individual_keys() -> list[str]:
    """overall + 퍼널 순서대로 individual_items의 key 목록 반환."""
    cfg = load_funnel_config()
    keys: list[str] = []

    # Overall items first
    overall = cfg.get("overall", {})
    items = overall.get("individual_items", {})
    for item_type in _ITEM_TYPE_ORDER:
        for item in items.get(item_type, []):
            keys.append(item["key"])

    # Funnel items
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
    """overall + 퍼널 순서대로 synthesis_items의 key 목록 반환"""
    cfg = load_funnel_config()
    keys: list[str] = []
    # Overall synthesis items
    overall = cfg.get("overall", {})
    for item_type in _ITEM_TYPE_ORDER:
        for item in overall.get("synthesis_items", {}).get(item_type, []):
            keys.append(item["key"])
    # Funnel synthesis items
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
        ["run_id", "persona_id", "persona_name", "panel_id"]
        + get_individual_keys()
        + ["error"]
        + get_qa_keys()
        + QA_COMPUTED
    )


def get_field_scales() -> dict[str, tuple[int, int]]:
    """개별 항목별 유효 스케일 범위를 dict로 반환.

    반환 형태: {"brand_favorability": (1, 5), "appeal": (1, 5), ...}
    scale이 없는(정성적) 항목은 제외된다.
    """
    cfg = load_funnel_config()
    scales: dict[str, tuple[int, int]] = {}

    # Overall items
    overall = cfg.get("overall", {})
    overall_items = overall.get("individual_items", {})
    for item in overall_items.get("quantitative", []):
        scale_str = item.get("scale", "")
        if scale_str and "-" in scale_str:
            lo, hi = scale_str.split("-", 1)
            scales[item["key"]] = (int(lo), int(hi))

    # Funnel items
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        items = funnel.get("individual_items", {})
        for item in items.get("quantitative", []):
            scale_str = item.get("scale", "")
            if scale_str and "-" in scale_str:
                lo, hi = scale_str.split("-", 1)
                scales[item["key"]] = (int(lo), int(hi))
        # QA 항목 (모두 1-5)
        for item in funnel.get("qa_items", []):
            scales[item["key"]] = (1, 5)
    return scales


def get_field_scales_cached() -> dict[str, tuple[int, int]]:
    """get_field_scales의 캐시된 버전."""
    return _FIELD_SCALES_CACHE


# 모듈 로드 시 한 번만 계산
_FIELD_SCALES_CACHE: dict[str, tuple[int, int]] = {}


def _init_scales_cache():
    global _FIELD_SCALES_CACHE
    _FIELD_SCALES_CACHE = get_field_scales()


_init_scales_cache()


FUNNEL_QUANT_GROUPS: dict = {
    "upper": [
        {"label": "브랜드 인지·태도", "keys": ["brand_favorability", "brand_trust", "brand_fit"],    "sublabels": ["브랜드 호감도", "브랜드 신뢰도", "브랜드 적합성"]},
        {"label": "광고 효과성",     "keys": ["message_clarity", "attention_grabbing"],              "sublabels": ["메시지 명확성", "주목도"]},
    ],
    "mid": [
        {"label": "가치 인식",  "keys": ["appeal", "value_for_money", "price_fairness"],            "sublabels": ["매력도", "가성비", "가격 적정성"]},
        {"label": "구전·정보", "keys": ["info_sufficiency", "recommendation_intent"],              "sublabels": ["정보 충분성", "추천 의향"]},
    ],
    "lower": [
        {"label": "구매 의향",    "keys": ["purchase_likelihood", "purchase_consideration", "purchase_willingness"], "sublabels": ["구매 가능성", "고려 확률", "구매 의향"]},
        {"label": "재구매·시급성", "keys": ["repurchase_intent", "purchase_urgency"],               "sublabels": ["재구매 의향", "구매 시급성"]},
    ],
}


def get_funnel_groups() -> dict:
    """프론트엔드용: {funnel_name: {label, description, individual_items, synthesis_items, qa_items}} 형태
    overall 섹션도 포함."""
    cfg = load_funnel_config()
    groups: dict = {}

    # Overall section
    overall = cfg.get("overall", {})
    if overall:
        individual_list: list[dict] = []
        ind = overall.get("individual_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in ind.get(item_type, []):
                individual_list.append({
                    "key": item["key"],
                    "label": item["label"],
                    "scale": item.get("scale", ""),
                    "type": item_type,
                })
        synthesis_list_overall: list[dict] = []
        syn_overall = overall.get("synthesis_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in syn_overall.get(item_type, []):
                synthesis_list_overall.append({
                    "key": item["key"],
                    "label": item["label"],
                    "type": item_type,
                })
        groups["overall"] = {
            "label": overall.get("label", "Overall"),
            "description": overall.get("description", ""),
            "desc_who": overall.get("desc_who", ""),
            "desc_goal": overall.get("desc_goal", ""),
            "desc_metrics": overall.get("desc_metrics", ""),
            "individual_items": individual_list,
            "synthesis_items": synthesis_list_overall,
            "qa_items": [],
        }

    # Funnel sections
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})

        # individual_items
        individual_list: list[dict] = []
        ind = funnel.get("individual_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in ind.get(item_type, []):
                individual_list.append({
                    "key": item["key"],
                    "label": item["label"],
                    "scale": item.get("scale", ""),
                    "type": item_type,
                })

        # synthesis_items
        synthesis_list: list[dict] = []
        syn = funnel.get("synthesis_items", {})
        for item_type in _ITEM_TYPE_ORDER:
            for item in syn.get(item_type, []):
                synthesis_list.append({
                    "key": item["key"],
                    "label": item["label"],
                    "type": item_type,
                })

        # qa_items
        qa_list: list[dict] = []
        for item in funnel.get("qa_items", []):
            qa_list.append({
                "key": item["key"],
                "type": item.get("type", ""),
            })

        groups[funnel_name] = {
            "label": funnel.get("label", funnel_name),
            "description": funnel.get("description", ""),
            "desc_who": funnel.get("desc_who", ""),
            "desc_goal": funnel.get("desc_goal", ""),
            "desc_metrics": funnel.get("desc_metrics", ""),
            "individual_items": individual_list,
            "synthesis_items": synthesis_list,
            "qa_items": qa_list,
        }
    return groups
