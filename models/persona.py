from dataclasses import dataclass, field
from typing import Optional


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
        )

    def to_profile_text(self) -> str:
        return (
            f"Name: {self.persona_name}\n"
            f"Gender: {self.panel_gender}\n"
            f"Sex: {self.panel_sex}\n"
            f"Preferred Season: {self.persona_season}\n"
            f"Cost Per Click (Budget Tier): {self.panel_cpc}\n"
            f"Potential Value: {self.panel_potential}\n"
            f"Room Preference: {self.panel_room_pref}\n"
            f"Bed Preference: {self.panel_bed_pref}\n"
            f"Activity Preferences: {self.panel_activity_pref_1}, {self.panel_activity_pref_2}, {self.panel_activity_pref_3}\n"
            f"Cuisine Preferences: {self.panel_cuisine_1}, {self.panel_cuisine_2}\n"
            f"Key Success Factors: {self.persona_ksf}"
        )
