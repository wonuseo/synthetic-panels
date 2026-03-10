from pathlib import Path
from typing import List, Optional
import yaml

from app.models.persona import Persona

_config_dir = Path(__file__).parent.parent.parent / "config"

_TEAM_PROMPT_FILES = {
    "marketing": ("synthetic_panels_prompts.yaml", "synthesis_analysis_prompts.yaml", "survey_questions.yaml"),
    "commerce": ("commerce_synthetic_panels_prompts.yaml", "commerce_synthesis_analysis_prompts.yaml", "commerce_survey_questions.yaml"),
}

# Lazy cache: team -> loaded config dicts
_prompt_cache: dict[str, dict] = {}
_synthesis_cache: dict[str, dict] = {}
_survey_cache: dict[str, dict] = {}


def _load_yaml(filename: str) -> dict:
    with open(_config_dir / filename, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_prompt_config(team: str = "marketing") -> dict:
    if team not in _prompt_cache:
        files = _TEAM_PROMPT_FILES.get(team, _TEAM_PROMPT_FILES["marketing"])
        _prompt_cache[team] = _load_yaml(files[0])
    return _prompt_cache[team]


def _get_synthesis_config(team: str = "marketing") -> dict:
    if team not in _synthesis_cache:
        files = _TEAM_PROMPT_FILES.get(team, _TEAM_PROMPT_FILES["marketing"])
        _synthesis_cache[team] = _load_yaml(files[1])
    return _synthesis_cache[team]


def _get_survey_config(team: str = "marketing") -> dict:
    if team not in _survey_cache:
        files = _TEAM_PROMPT_FILES.get(team, _TEAM_PROMPT_FILES["marketing"])
        _survey_cache[team] = _load_yaml(files[2])
    return _survey_cache[team]


# ── 서베이 질문 블록 빌더 (팀별 캐시) ────────────────────────────────
_survey_questions_block_cache: dict[str, str] = {}
_example_json_cache: dict[str, str] = {}


def _build_survey_questions(team: str = "marketing") -> str:
    """survey_questions.yaml → LLM 프롬프트용 필드 정의 블록"""
    sections = _get_survey_config(team)["sections"]
    lines = []
    for section in sections:
        lines.append(f'\n    --- {section["label"]} ---')
        for f in section["fields"]:
            lines.append(f'    "{f["key"]}": {f["spec"]}, {f["question"]}')
    return "\n".join(lines)


def _build_example_json(team: str = "marketing") -> str:
    """survey_questions.yaml → Example JSON 플레이스홀더"""
    sections = _get_survey_config(team)["sections"]
    pairs = []
    for section in sections:
        for f in section["fields"]:
            if "integer" in f["spec"]:
                pairs.append(f'"{f["key"]}":3')
            else:
                pairs.append(f'"{f["key"]}":"..."')
    return "{{" + ",".join(pairs) + "}}"


def _get_survey_questions_block(team: str = "marketing") -> str:
    if team not in _survey_questions_block_cache:
        _survey_questions_block_cache[team] = _build_survey_questions(team)
    return _survey_questions_block_cache[team]


def _get_example_json(team: str = "marketing") -> str:
    if team not in _example_json_cache:
        _example_json_cache[team] = _build_example_json(team)
    return _example_json_cache[team]


# ── 개별 리뷰 프롬프트 ────────────────────────────────────────────────────────

def build_system_prompt(persona: Persona, team: str = "marketing") -> str:
    individual = _get_prompt_config(team)["individual_review"]
    return individual["system"].format(profile=persona.to_profile_text(team))


def build_user_prompt(has_image: bool = True, text_content: str = "", qa_mode: str = "off", team: str = "marketing") -> str:
    individual = _get_prompt_config(team)["individual_review"]
    qa_items = individual.get("qa_items", {})
    sources = individual["material_sources"]
    parts = []
    if has_image:
        parts.append(sources["image"])
    if text_content:
        parts.append(f"{sources['text_prefix']}\n\n{text_content}")
    if not parts:
        parts.append(sources["default"])
    material_description = "\n\n".join(parts)

    prompt = individual["user_base"].format(
        material_description=material_description,
        survey_questions=_get_survey_questions_block(team),
        example_json=_get_example_json(team),
    )
    if qa_mode != "off" and qa_mode in qa_items:
        prompt += qa_items[qa_mode]
    return prompt


# ── 종합 분석 프롬프트 ────────────────────────────────────────────────────────

def get_synthesis_system_prompt(team: str = "marketing") -> str:
    return _get_synthesis_config(team)["synthesis"]["system"]


def get_persona_synthesis_system_prompt(team: str = "marketing") -> str:
    return _get_synthesis_config(team)["persona_synthesis"]["system"]


# Backward compat module-level constants (marketing only)
SYNTHESIS_SYSTEM_PROMPT: str = get_synthesis_system_prompt("marketing")
PERSONA_SYNTHESIS_SYSTEM_PROMPT: str = get_persona_synthesis_system_prompt("marketing")


def _build_review_text_block(data: dict, team: str = "marketing") -> str:
    """survey_questions.yaml 섹션 구조로 리뷰 데이터를 텍스트로 변환"""
    sections = _get_survey_config(team)["sections"]
    lines = []
    for section in sections:
        quant_parts = []
        qual_lines = []
        for f in section["fields"]:
            val = data.get(f["key"], "-")
            if not val or val == "-":
                continue
            if "integer" in f["spec"]:
                quant_parts.append(f'{f["label"]}({val})')
            else:
                qual_lines.append(f'{f["label"]}: {val}')
        if quant_parts or qual_lines:
            lines.append(f'\n{section["label"]}')
            if quant_parts:
                lines.append("  " + ", ".join(quant_parts))
            lines.extend(f"  {ql}" for ql in qual_lines)
    return "\n".join(lines)


def _get_appeal_field(team: str = "marketing") -> str:
    """팀별 핵심 매력도 필드명 반환 (synthesis 헤더용)"""
    if team == "commerce":
        return "price_value"
    return "appeal"


def build_persona_synthesis_prompt(persona_name: str, reviews_data: List[dict], team: str = "marketing") -> str:
    synthesis_cfg = _get_synthesis_config(team)
    appeal_field = _get_appeal_field(team)
    parts = []
    for r in reviews_data:
        panel_id = r.get("panel_id", "?")
        header = (
            f"--- Panel {panel_id} "
            f"(매력도: {r.get(appeal_field, '-')}/5, {r.get('recommendation', '-')}) ---"
        )
        parts.append(header + _build_review_text_block(r, team))
    reviews_text = "\n".join(parts)
    return synthesis_cfg["persona_synthesis"]["user_template"].format(
        count=len(reviews_data), persona_name=persona_name, reviews_text=reviews_text
    )


_FUNNEL_LABEL_MAP = {
    "upper": "Brand Funnel",
    "mid": "Demand & Acquisition Funnel",
    "lower": "Sales & Conversion Funnel",
}


def _build_group_stats_block(funnel_group_stats: dict) -> str:
    """퍼널별 quant group 평균 → LLM 프롬프트 컨텍스트 블록."""
    lines = []
    for funnel_key in ["upper", "mid", "lower"]:
        groups = funnel_group_stats.get(funnel_key, [])
        if not groups:
            continue
        lines.append(f"\n{_FUNNEL_LABEL_MAP.get(funnel_key, funnel_key)}:")
        for i, grp in enumerate(groups):
            avg = grp.get("avg", 0)
            pct = grp.get("pct", 0)
            lines.append(f"  Group {i + 1}. {grp['label']}: 평균 {avg}/5 ({pct}%)")
    return "\n".join(lines)


def build_synthesis_prompt(reviews_data: List[dict], team: str = "marketing", funnel_group_stats: Optional[dict] = None) -> str:
    synthesis_cfg = _get_synthesis_config(team)
    appeal_field = _get_appeal_field(team)
    parts = []
    for r in reviews_data:
        header = (
            f"--- {r.get('persona_name', '?')} "
            f"(매력도: {r.get(appeal_field, '-')}/5, {r.get('recommendation', '-')}) ---"
        )
        parts.append(header + _build_review_text_block(r, team))
    reviews_text = "\n".join(parts)
    prompt = synthesis_cfg["synthesis"]["user_template"].format(count=len(reviews_data), reviews_text=reviews_text)

    if funnel_group_stats:
        stats_block = _build_group_stats_block(funnel_group_stats)
        if stats_block:
            prompt += f"""

--- [퍼널 단계별 그룹 지표 — 그룹 인사이트 생성용] ---
다음은 퍼널별 정량 그룹의 사전 계산된 평균 점수입니다. 위 패널 응답의 정성 코멘트를 근거로 각 그룹이 이 점수를 기록한 원인을 해석해 주세요.
{stats_block}

위 그룹 순서에 맞춰 다음 필드도 JSON에 반드시 포함하세요 (기존 필드에 추가):
- "upper_group_insights": Brand Funnel 그룹 순서대로 각 그룹 점수의 원인을 해석한 문자열 배열. 각 항목은 2-3문장 한국어. 그룹 내 지표 간 편차가 크면(특이하게 높거나 낮은 지표 있으면) 그 원인을 패널 코멘트 기반으로 설명. 지표들이 고른 경우 전체 점수 수준의 이유를 설명.
- "mid_group_insights": Demand & Acquisition Funnel 그룹 순서대로, 동일 형식.
- "lower_group_insights": Sales & Conversion Funnel 그룹 순서대로, 동일 형식.
"""
    return prompt
