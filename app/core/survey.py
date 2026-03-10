import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

_SCALE_SPEC_RE = re.compile(r"integer\s+(\d+)\s*-\s*(\d+)", re.IGNORECASE)
_RECOMMENDATION_OPTIONS = ["매우 관심 있음", "다소 관심 있음", "보통", "관심 없음", "전혀 관심 없음"]

_DEFINITIONS_DIR = Path(__file__).parent.parent.parent / "config" / "definitions"


def _to_question_type(field_key: str, spec: str) -> str:
    if "integer" in spec:
        return "quantitative"
    if field_key == "recommendation":
        return "categorical"
    return "qualitative"


def _parse_scale(spec: str) -> Optional[dict]:
    match = _SCALE_SPEC_RE.search(spec)
    if not match:
        return None
    lo, hi = int(match.group(1)), int(match.group(2))
    return {"min": lo, "max": hi}


@lru_cache(maxsize=4)
def load_survey_template(team: str = "marketing") -> list[dict]:
    path = _DEFINITIONS_DIR / f"{team}_survey.yaml"
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}

    sections = []
    for section in raw.get("sections", []):
        fields = []
        for field in section.get("fields", []):
            key = str(field.get("key", "")).strip()
            spec = str(field.get("spec", "")).strip()
            q_type = _to_question_type(key, spec)
            normalized = {
                "key": key,
                "label": str(field.get("label", "")).strip(),
                "question": str(field.get("question", "")).strip(),
                "spec": spec,
                "type": q_type,
            }
            scale = _parse_scale(spec)
            if scale:
                normalized["scale"] = scale
            if q_type == "categorical":
                normalized["options"] = list(_RECOMMENDATION_OPTIONS)
            fields.append(normalized)

        sections.append({
            "id": str(section.get("id", "")).strip(),
            "label": str(section.get("label", "")).strip(),
            "fields": fields,
        })

    return sections
