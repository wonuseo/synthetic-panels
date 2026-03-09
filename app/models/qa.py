from dataclasses import dataclass, field
from typing import List, Tuple, Optional

from app.core.funnel import get_qa_keys

# ── Replication pairs: (replication_field, core_field) ────────────
REPLICATION_PAIRS_FULL: List[Tuple[str, str]] = [
    ("qa_rep_brand_attitude", "brand_favorability"),
    ("qa_rep_value_perception", "value_for_money"),
    ("qa_rep_purchase_intent", "purchase_likelihood"),
]

REPLICATION_PAIRS_LITE: List[Tuple[str, str]] = [
    ("qa_rep_brand_attitude", "brand_favorability"),
]

# ── Trap field lists ──────────────────────────────────────────────
TRAP_ITEMS_FULL: List[str] = [
    "qa_trap_budget_sensitivity",
    "qa_trap_competitor_loyalty",
    "qa_trap_skepticism_check",
]

TRAP_ITEMS_LITE: List[str] = [
    "qa_trap_budget_sensitivity",
]


def get_trap_expected_range(trap_field: str, persona) -> Tuple[int, int]:
    """Return (low, high) expected range based on persona attributes."""
    val = ""

    if trap_field == "qa_trap_budget_sensitivity":
        val = (persona.panel_cpc or "").strip().lower()
        if val in ("low", "낮음"):
            return (4, 5)
        if val in ("medium", "중간"):
            return (2, 4)
        if val in ("high", "높음"):
            return (1, 2)
        return (1, 5)  # unknown → always pass

    if trap_field == "qa_trap_competitor_loyalty":
        val = (persona.panel_competitor_pref or "").strip()
        if val and val.lower() not in ("없음", "none", ""):
            return (1, 3)
        return (3, 5)

    if trap_field == "qa_trap_skepticism_check":
        val = (persona.panel_skepticism or "").strip().lower()
        if val in ("high", "높음"):
            return (1, 2)
        if val in ("medium", "중간"):
            return (2, 4)
        if val in ("low", "낮음"):
            return (3, 5)
        return (1, 5)

    return (1, 5)


@dataclass
class QAResult:
    # Replication raw values
    qa_rep_brand_attitude: int = 0
    qa_rep_value_perception: int = 0
    qa_rep_purchase_intent: int = 0
    # Trap raw values
    qa_trap_budget_sensitivity: int = 0
    qa_trap_competitor_loyalty: int = 0
    qa_trap_skepticism_check: int = 0
    # Computed scores
    consistency_score: float = 0.0
    trap_pass_rate: float = 0.0
    persona_quality: float = 0.0
    qa_passed: bool = False
    qa_mode: str = "off"

    def compute_scores(self, review, persona, qa_mode: str = "lite"):
        """Compute QA scores from review + persona context."""
        self.qa_mode = qa_mode

        # ── Consistency (replication pairs) ────────────────────────
        pairs = REPLICATION_PAIRS_FULL if qa_mode == "full" else REPLICATION_PAIRS_LITE
        consistency_values = []
        for rep_field, core_field in pairs:
            rep_val = getattr(self, rep_field, 0)
            core_val = getattr(review, core_field, 0)
            if rep_val and core_val:
                consistency_values.append(1 - abs(core_val - rep_val) / 4)
        self.consistency_score = (
            sum(consistency_values) / len(consistency_values)
            if consistency_values
            else 1.0
        )

        # ── Trap pass rate ────────────────────────────────────────
        traps = TRAP_ITEMS_FULL if qa_mode == "full" else TRAP_ITEMS_LITE
        passed = 0
        total = 0
        for trap_field in traps:
            val = getattr(self, trap_field, 0)
            if val == 0:
                continue
            total += 1
            lo, hi = get_trap_expected_range(trap_field, persona)
            if lo <= val <= hi:
                passed += 1
        self.trap_pass_rate = passed / total if total else 1.0

        # ── Final quality ─────────────────────────────────────────
        self.persona_quality = 0.5 * self.consistency_score + 0.5 * self.trap_pass_rate
        self.qa_passed = self.persona_quality >= 0.7

    def to_sheet_columns(self, team: str = "marketing") -> list:
        """Return flat list for appending to sheet row."""
        row = [getattr(self, key, 0) for key in get_qa_keys(team)]
        row.extend([
            round(self.consistency_score, 3),
            round(self.trap_pass_rate, 3),
            round(self.persona_quality, 3),
            self.qa_passed,
            self.qa_mode,
        ])
        return row
