from pathlib import Path
from typing import List
import yaml

from app.models.persona import Persona

_config_dir = Path(__file__).parent.parent.parent / "config"


def _load_yaml(filename: str) -> dict:
    with open(_config_dir / filename, encoding="utf-8") as f:
        return yaml.safe_load(f)


_prompts = _load_yaml("synthetic_panels_prompts.yaml")
_individual = _prompts["individual_review"]
_qa_items = _individual.get("qa_items", {})

_synthesis_prompts = _load_yaml("synthesis_analysis_prompts.yaml")
_synthesis = _synthesis_prompts["synthesis"]
_persona_synthesis = _synthesis_prompts["persona_synthesis"]

_survey_q = _load_yaml("survey_questions.yaml")
_survey_sections = _survey_q["sections"]


# ── 서베이 질문 블록 빌더 ─────────────────────────────────────────────────────

def _build_survey_questions() -> str:
    """survey_questions.yaml → LLM 프롬프트용 필드 정의 블록"""
    lines = []
    for section in _survey_sections:
        lines.append(f'\n    --- {section["label"]} ---')
        for f in section["fields"]:
            lines.append(f'    "{f["key"]}": {f["spec"]}, {f["question"]}')
    return "\n".join(lines)


def _build_example_json() -> str:
    """survey_questions.yaml → Example JSON 플레이스홀더"""
    pairs = []
    for section in _survey_sections:
        for f in section["fields"]:
            if "integer" in f["spec"]:
                pairs.append(f'"{f["key"]}":3')
            else:
                pairs.append(f'"{f["key"]}":"..."')
    return "{{" + ",".join(pairs) + "}}"


_SURVEY_QUESTIONS_BLOCK = _build_survey_questions()
_EXAMPLE_JSON = _build_example_json()


# ── 개별 리뷰 프롬프트 ────────────────────────────────────────────────────────

def build_system_prompt(persona: Persona) -> str:
    return _individual["system"].format(profile=persona.to_profile_text())


def build_user_prompt(has_image: bool = True, text_content: str = "", qa_mode: str = "off") -> str:
    sources = _individual["material_sources"]
    parts = []
    if has_image:
        parts.append(sources["image"])
    if text_content:
        parts.append(f"{sources['text_prefix']}\n\n{text_content}")
    if not parts:
        parts.append(sources["default"])
    material_description = "\n\n".join(parts)

    prompt = _individual["user_base"].format(
        material_description=material_description,
        survey_questions=_SURVEY_QUESTIONS_BLOCK,
        example_json=_EXAMPLE_JSON,
    )
    if qa_mode != "off" and qa_mode in _qa_items:
        prompt += _qa_items[qa_mode]
    return prompt


# ── 종합 분석 프롬프트 ────────────────────────────────────────────────────────

SYNTHESIS_SYSTEM_PROMPT: str = _synthesis["system"]
PERSONA_SYNTHESIS_SYSTEM_PROMPT: str = _persona_synthesis["system"]


def _build_review_text_block(data: dict) -> str:
    """survey_questions.yaml 섹션 구조로 리뷰 데이터를 텍스트로 변환"""
    lines = []
    for section in _survey_sections:
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


def build_persona_synthesis_prompt(persona_name: str, reviews_data: List[dict]) -> str:
    parts = []
    for r in reviews_data:
        panel_id = r.get("panel_id", "?")
        header = (
            f"--- Panel {panel_id} "
            f"(매력도: {r.get('appeal', '-')}/5, {r.get('recommendation', '-')}) ---"
        )
        parts.append(header + _build_review_text_block(r))
    reviews_text = "\n".join(parts)
    return _persona_synthesis["user_template"].format(
        count=len(reviews_data), persona_name=persona_name, reviews_text=reviews_text
    )


def build_synthesis_prompt(reviews_data: List[dict]) -> str:
    parts = []
    for r in reviews_data:
        header = (
            f"--- {r.get('persona_name', '?')} "
            f"(매력도: {r.get('appeal', '-')}/5, {r.get('recommendation', '-')}) ---"
        )
        parts.append(header + _build_review_text_block(r))
    reviews_text = "\n".join(parts)
    return _synthesis["user_template"].format(count=len(reviews_data), reviews_text=reviews_text)
