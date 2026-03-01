from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional
import yaml

_config_dir = Path(__file__).parent.parent.parent / "config"


def _load_persona_config() -> dict:
    with open(_config_dir / "personas.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


_persona_config = _load_persona_config()
_profile_template: str = _persona_config["profile_template"]


@dataclass
class Persona:
    persona_id: str
    persona_name: str
    panel_gender: str
    panel_sex: str
    persona_season: str
    panel_cpc: str
    panel_potential: str
    panel_room_pref: str
    panel_bed_pref: str
    panel_activity_pref_1: str
    panel_activity_pref_2: str
    panel_activity_pref_3: str
    panel_cuisine_1: str
    panel_cuisine_2: str
    persona_ksf: str
    panel_skepticism: str
    panel_competitor_pref: str
    panel_past_friction: str

    @classmethod
    def from_sheet_row(cls, row: dict) -> "Persona":
        return cls(
            persona_id=str(row.get("persona_id", "")),
            persona_name=str(row.get("persona_name", "")),
            panel_gender=str(row.get("panel_gender", "")),
            panel_sex=str(row.get("panel_sex", "")),
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
            panel_skepticism=str(row.get("panel_skepticism", "")),
            panel_competitor_pref=str(row.get("panel_competitor_pref", "")),
            panel_past_friction=str(row.get("panel_past_friction", "")),
        )

    def to_profile_text(self) -> str:
        return _profile_template.format(**asdict(self)).strip()
