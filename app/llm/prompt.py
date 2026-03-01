from pathlib import Path
from typing import List
import yaml

from app.models.persona import Persona

_config_dir = Path(__file__).parent.parent.parent / "config"


def _load_prompts() -> dict:
    with open(_config_dir / "synthetic_panels_prompts.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_synthesis_prompts() -> dict:
    with open(_config_dir / "synthesis_analysis_prompts.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


_prompts = _load_prompts()
_individual = _prompts["individual_review"]
_qa_items = _individual.get("qa_items", {})
_synthesis = _load_synthesis_prompts()["synthesis"]


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
    prompt = _individual["user_base"].format(material_description=material_description)
    if qa_mode != "off" and qa_mode in _qa_items:
        prompt += _qa_items[qa_mode]
    return prompt


SYNTHESIS_SYSTEM_PROMPT: str = _synthesis["system"]


def build_synthesis_prompt(reviews_data: List[dict]) -> str:
    _defaults = {
        "like_dislike": "-", "favorable_unfavorable": "-",
        "value_for_money": "-", "price_fairness": "-",
        "brand_self_congruity": "-", "brand_image_fit": "-",
        "message_clarity": "-", "attention_grabbing": "-",
        "info_sufficiency": "-", "competitive_preference": "-",
        "likelihood_high": "-", "probability_consider_high": "-",
        "willingness_high": "-", "purchase_probability_juster": "-",
        "perceived_message": "-", "emotional_response": "-",
        "purchase_trigger_barrier": "-", "recommendation_context": "-",
    }
    parts = []
    for r in reviews_data:
        data = {**_defaults, **r}
        parts.append(
            f"--- {data['persona_name']} (매력도: {data['appeal_score']}/10, {data['recommendation']}) ---\n"
            f"\n[Upper Funnel] 브랜드 자산\n"
            f"브랜드 태도: 호감({data['like_dislike']}), 호의({data['favorable_unfavorable']})\n"
            f"브랜드 적합성: 자기적합({data['brand_self_congruity']}), 이미지적합({data['brand_image_fit']})\n"
            f"광고 효과: 명확성({data['message_clarity']}), 주목도({data['attention_grabbing']})\n"
            f"첫인상: {data['first_impression']}\n"
            f"지각된 메시지: {data['perceived_message']}\n"
            f"감정 반응: {data['emotional_response']}\n"
            f"\n[Mid Funnel] 수요 창출\n"
            f"지각된 가치: 가성비({data['value_for_money']}), 가격적정성({data['price_fairness']})\n"
            f"정보 충분성: {data['info_sufficiency']}\n"
            f"긍정 요소: {data['key_positives']}\n"
            f"우려 사항: {data['key_concerns']}\n"
            f"경쟁비교: {data['competitive_preference']}\n"
            f"추천 맥락: {data['recommendation_context']}\n"
            f"\n[Lower Funnel] 전환·매출\n"
            f"구매 의향: 가능성({data['likelihood_high']}), 고려확률({data['probability_consider_high']}), 의향({data['willingness_high']})\n"
            f"구매 확률(Juster): {data['purchase_probability_juster']}/10\n"
            f"구매 촉진/장벽: {data['purchase_trigger_barrier']}\n"
            f"종합 평가: {data['review_summary']}\n"
        )
    reviews_text = "\n".join(parts)
    return _synthesis["user_template"].format(count=len(reviews_data), reviews_text=reviews_text)
