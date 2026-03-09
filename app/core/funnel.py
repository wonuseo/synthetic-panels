"""funnel_config.yaml 로더 — 시트 헤더·프론트엔드 공용"""

from pathlib import Path
from functools import lru_cache

import yaml

_CONFIG_DIR = Path(__file__).parent.parent.parent / "config"

_TEAM_CONFIG_FILES = {
    "marketing": "funnel_config.yaml",
    "commerce": "commerce_funnel_config.yaml",
}

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


@lru_cache(maxsize=4)
def load_funnel_config(team: str = "marketing") -> dict:
    """YAML 로드 후 dict 반환 (팀별 캐시)"""
    filename = _TEAM_CONFIG_FILES.get(team, "funnel_config.yaml")
    config_path = _CONFIG_DIR / filename
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_overall_keys(team: str = "marketing") -> list[str]:
    """overall 섹션의 individual_items key 목록 반환."""
    cfg = load_funnel_config(team)
    overall = cfg.get("overall", {})
    items = overall.get("individual_items", {})
    keys: list[str] = []
    for item_type in _ITEM_TYPE_ORDER:
        for item in items.get(item_type, []):
            keys.append(item["key"])
    return keys


def get_individual_keys(team: str = "marketing") -> list[str]:
    """overall + 퍼널 순서대로 individual_items의 key 목록 반환."""
    cfg = load_funnel_config(team)
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


def get_quant_keys(team: str = "marketing") -> list[str]:
    """overall + 퍼널 순서대로 quantitative individual_items의 key 목록 반환."""
    cfg = load_funnel_config(team)
    keys: list[str] = []
    overall = cfg.get("overall", {})
    for item in overall.get("individual_items", {}).get("quantitative", []):
        keys.append(item["key"])
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        for item in funnel.get("individual_items", {}).get("quantitative", []):
            keys.append(item["key"])
    return keys


def get_qual_keys(team: str = "marketing") -> list[str]:
    """overall + 퍼널 순서대로 qualitative/categorical individual_items의 key 목록 반환."""
    cfg = load_funnel_config(team)
    keys: list[str] = []
    overall = cfg.get("overall", {})
    items = overall.get("individual_items", {})
    for item_type in ["qualitative", "categorical"]:
        for item in items.get(item_type, []):
            keys.append(item["key"])
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        items = funnel.get("individual_items", {})
        for item_type in ["qualitative", "categorical"]:
            for item in items.get(item_type, []):
                keys.append(item["key"])
    return keys


def get_qa_keys(team: str = "marketing") -> list[str]:
    """퍼널 순서대로 qa_items의 key 목록 반환"""
    cfg = load_funnel_config(team)
    keys: list[str] = []
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        for item in funnel.get("qa_items", []):
            keys.append(item["key"])
    return keys


def get_synthesis_keys(team: str = "marketing") -> list[str]:
    """overall + 퍼널 순서대로 synthesis_items의 key 목록 반환"""
    cfg = load_funnel_config(team)
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


def get_results_headers(team: str = "marketing") -> list[str]:
    """['run_id', 'persona_id', 'persona_name'] + individual_keys + ['error'] + qa_keys + QA_COMPUTED"""
    return (
        ["run_id", "persona_id", "persona_name", "panel_id"]
        + get_individual_keys(team)
        + ["error"]
        + get_qa_keys(team)
        + QA_COMPUTED
    )


def get_field_scales(team: str = "marketing") -> dict[str, tuple[int, int]]:
    """개별 항목별 유효 스케일 범위를 dict로 반환."""
    cfg = load_funnel_config(team)
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


def get_field_scales_cached(team: str = "marketing") -> dict[str, tuple[int, int]]:
    """get_field_scales의 캐시된 버전."""
    return _FIELD_SCALES_CACHE.get(team) or get_field_scales(team)


def get_funnel_quant_groups(team: str = "marketing") -> dict:
    """YAML에서 퍼널별 정량 그룹 정의를 로드하여 반환."""
    cfg = load_funnel_config(team)
    result: dict = {}
    for funnel_name in _FUNNEL_ORDER:
        funnel = cfg["funnels"].get(funnel_name, {})
        groups = funnel.get("quant_groups", [])
        result[funnel_name] = [
            {
                "label": g["label"],
                "keys": g["keys"],
                "sublabels": g.get("sublabels", []),
            }
            for g in groups
        ]
    return result


# 모듈 로드 시 팀별 스케일 캐시 초기화
_FIELD_SCALES_CACHE: dict[str, dict[str, tuple[int, int]]] = {}


def _init_scales_cache():
    global _FIELD_SCALES_CACHE
    for team in _TEAM_CONFIG_FILES:
        try:
            _FIELD_SCALES_CACHE[team] = get_field_scales(team)
        except Exception:
            pass


_init_scales_cache()


# ── 하위 호환성: 기존 코드가 import하는 FUNNEL_QUANT_GROUPS ──────────
FUNNEL_QUANT_GROUPS: dict = get_funnel_quant_groups("marketing")


def get_funnel_groups(team: str = "marketing") -> dict:
    """프론트엔드용: {funnel_name: {label, description, individual_items, synthesis_items, qa_items, quant_groups}} 형태
    overall 섹션도 포함."""
    cfg = load_funnel_config(team)
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
            "quant_groups": [],
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

        # quant_groups
        quant_groups_list: list[dict] = []
        for g in funnel.get("quant_groups", []):
            quant_groups_list.append({
                "label": g["label"],
                "keys": g["keys"],
                "sublabels": g.get("sublabels", []),
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
            "quant_groups": quant_groups_list,
        }
    return groups
