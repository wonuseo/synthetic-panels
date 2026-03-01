from pathlib import Path
import yaml

from models.persona import Persona

_config_dir = Path(__file__).parent.parent / "config"


def _load_prompts() -> dict:
    with open(_config_dir / "prompts.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


_prompts = _load_prompts()
_individual = _prompts["individual_review"]
_synthesis = _prompts["synthesis"]


def build_system_prompt(persona: Persona) -> str:
    return _individual["system"].format(profile=persona.to_profile_text())


def build_user_prompt(has_image: bool = True, text_content: str = "") -> str:
    sources = _individual["material_sources"]
    parts = []
    if has_image:
        parts.append(sources["image"])
    if text_content:
        parts.append(f"{sources['text_prefix']}\n\n{text_content}")
    if not parts:
        parts.append(sources["default"])
    material_description = "\n\n".join(parts)
    return _individual["user_base"].format(material_description=material_description)


SYNTHESIS_SYSTEM_PROMPT: str = _synthesis["system"]


def build_synthesis_prompt(reviews_data: list[dict]) -> str:
    _defaults = {
        "like_dislike": "-", "positive_negative": "-",
        "good_bad": "-", "favorable_unfavorable": "-",
        "likelihood_high": "-", "probability_consider_high": "-",
        "willingness_high": "-", "purchase_probability_juster": "-",
    }
    parts = []
    for r in reviews_data:
        data = {**_defaults, **r}
        parts.append(
            f"--- {data['persona_name']} (매력도: {data['appeal_score']}/10, {data['recommendation']}) ---\n"
            f"첫인상: {data['first_impression']}\n"
            f"긍정 요소: {data['key_positives']}\n"
            f"우려 사항: {data['key_concerns']}\n"
            f"종합 평가: {data['review_summary']}\n"
            f"브랜드 태도: 호감({data['like_dislike']}), 긍부정({data['positive_negative']}), 좋나쁨({data['good_bad']}), 호의({data['favorable_unfavorable']})\n"
            f"구매 의향: 가능성({data['likelihood_high']}), 고려확률({data['probability_consider_high']}), 의향({data['willingness_high']})\n"
            f"구매 확률(Juster): {data['purchase_probability_juster']}/10\n"
        )
    reviews_text = "\n".join(parts)
    return _synthesis["user_template"].format(count=len(reviews_data), reviews_text=reviews_text)
