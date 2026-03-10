from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Optional
import yaml

_definitions_dir = Path(__file__).parent.parent.parent / "config" / "definitions"

_persona_config_cache: dict[str, dict] = {}


def _load_persona_config(team: str = "marketing") -> dict:
    if team not in _persona_config_cache:
        with open(_definitions_dir / f"{team}_personas.yaml", encoding="utf-8") as f:
            _persona_config_cache[team] = yaml.safe_load(f)
    return _persona_config_cache[team]


@dataclass
class Persona:
    persona_id: str
    persona_name: str
    panel_gender: str
    panel_age: str
    # Marketing-specific fields (kept for backward compat; empty for commerce)
    persona_season: str = ""
    panel_cpc: str = ""
    panel_potential: str = ""
    panel_room_pref: str = ""
    panel_bed_pref: str = ""
    panel_activity_pref_1: str = ""
    panel_activity_pref_2: str = ""
    panel_activity_pref_3: str = ""
    panel_cuisine_1: str = ""
    panel_cuisine_2: str = ""
    persona_ksf: str = ""
    panel_visited: str = ""
    panel_visit_experience: str = ""
    panel_skepticism: str = ""
    panel_competitor_pref: str = ""
    panel_past_friction: str = ""
    panel_id: str = ""
    # Extra fields for any team-specific data (commerce uses this)
    extra: dict = field(default_factory=dict)

    @classmethod
    def from_sheet_row(cls, row: dict, team: str = "marketing") -> "Persona":
        if team == "commerce":
            return cls._from_sheet_row_commerce(row)
        return cls._from_sheet_row_marketing(row)

    @classmethod
    def _from_sheet_row_marketing(cls, row: dict) -> "Persona":
        return cls(
            persona_id=str(row.get("persona_id", "")),
            persona_name=str(row.get("persona_name", "")),
            panel_gender=str(row.get("panel_gender", "")),
            panel_age=str(row.get("panel_age", "")),
            persona_season=str(row.get("persona_season", "")),
            panel_cpc=str(row.get("panel_cpc", "")),
            panel_potential=str(row.get("panel_potential", "")),
            panel_room_pref=str(row.get("panel_room_pref", "")),
            panel_bed_pref=str(row.get("panel_bed_pref", "")),
            panel_activity_pref_1=str(row.get("panel_activity_pref_1", "")),
            panel_activity_pref_2=str(row.get("panel_activity_pref_2", "")),
            panel_activity_pref_3=str(row.get("panel_activity_pref_3", "")),
            panel_cuisine_1=str(row.get("panel_cuisine_1", "")),
            panel_cuisine_2=str(row.get("panel_cuisine_2", "")),
            persona_ksf=str(row.get("persona_ksf", "")),
            panel_visited=str(row.get("panel_visited", "")),
            panel_visit_experience=str(row.get("panel_visit_experience", "")),
            panel_skepticism=str(row.get("panel_skepticism", "")),
            panel_competitor_pref=str(row.get("panel_competitor_pref", "")),
            panel_past_friction=str(row.get("panel_past_friction", "")),
            panel_id=str(row.get("panel_id", "")),
        )

    @classmethod
    def _from_sheet_row_commerce(cls, row: dict) -> "Persona":
        # Map commerce fields; reuse shared QA fields on named attrs for QA compatibility
        extra = {
            "panel_shopping_freq": str(row.get("panel_shopping_freq", "")),
            "panel_gift_tendency": str(row.get("panel_gift_tendency", "")),
            "panel_brand_loyalty": str(row.get("panel_brand_loyalty", "")),
            "panel_online_pref": str(row.get("panel_online_pref", "")),
            "panel_product_category_pref_1": str(row.get("panel_product_category_pref_1", "")),
            "panel_product_category_pref_2": str(row.get("panel_product_category_pref_2", "")),
            "panel_quality_priority": str(row.get("panel_quality_priority", "")),
        }
        return cls(
            persona_id=str(row.get("persona_id", "")),
            persona_name=str(row.get("persona_name", "")),
            panel_gender=str(row.get("panel_gender", "")),
            panel_age=str(row.get("panel_age", "")),
            # Map commerce price sensitivity → panel_cpc for QA compatibility
            panel_cpc=str(row.get("panel_price_sensitivity", "")),
            persona_ksf=str(row.get("persona_ksf", "")),
            panel_visited=str(row.get("panel_visited", "")),
            panel_visit_experience=str(row.get("panel_visit_experience", "")),
            panel_skepticism=str(row.get("panel_skepticism", "")),
            panel_competitor_pref=str(row.get("panel_competitor_pref", "")),
            panel_past_friction=str(row.get("panel_past_friction", "")),
            panel_id=str(row.get("panel_id", "")),
            extra=extra,
        )

    def to_profile_text(self, team: str = "marketing") -> str:
        cfg = _load_persona_config(team)
        template: str = cfg["profile_template"]
        # Build format dict: named fields + extra fields
        d = asdict(self)
        d.update(self.extra)
        return template.format(**d).strip()
