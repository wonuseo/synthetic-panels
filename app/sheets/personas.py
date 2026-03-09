import hashlib
import math
import random
import uuid
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

import gspread

from app.models.persona import Persona

PANEL_SIZE_OPTIONS = (10, 20, 50, 100)


def load_personas(spreadsheet: gspread.Spreadsheet, worksheet_name: str = "personas") -> List[Persona]:
    worksheet = spreadsheet.worksheet(worksheet_name)
    expected_headers = worksheet.row_values(1)
    records = worksheet.get_all_records(expected_headers=expected_headers)
    return [Persona.from_sheet_row(row) for row in records]


def load_panels(spreadsheet: gspread.Spreadsheet, worksheet_name: str = "generated_panels", team: str = "marketing") -> List[Persona]:
    worksheet = spreadsheet.worksheet(worksheet_name)
    expected_headers = worksheet.row_values(1)
    records = worksheet.get_all_records(expected_headers=expected_headers)
    return [Persona.from_sheet_row(row, team) for row in records]


def validate_panel_size(panel_size: int) -> int:
    try:
        size = int(panel_size)
    except (TypeError, ValueError):
        raise ValueError("panel_size는 10, 20, 50, 100 중 하나여야 합니다.")
    if size not in PANEL_SIZE_OPTIONS:
        allowed = ", ".join(str(s) for s in PANEL_SIZE_OPTIONS)
        raise ValueError(f"panel_size는 {allowed} 중 하나여야 합니다.")
    return size


def _parse_ratio(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("%", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _safe_sort_persona_ids(persona_ids) -> List[str]:
    def _key(pid: str):
        text = str(pid)
        return (0, int(text)) if text.isdigit() else (1, text)

    return sorted((str(pid) for pid in persona_ids), key=_key)


def load_persona_ratios(
    spreadsheet: gspread.Spreadsheet,
    worksheet_name: str = "persona_ratios",
) -> Dict[str, float]:
    try:
        worksheet = spreadsheet.worksheet(worksheet_name)
    except gspread.WorksheetNotFound:
        return {}

    expected_headers = worksheet.row_values(1)
    records = worksheet.get_all_records(expected_headers=expected_headers)
    ratios: Dict[str, float] = {}

    for row in records:
        persona_id = str(row.get("persona_id", "")).strip()
        if not persona_id or persona_id in {"합계", "total", "TOTAL"}:
            continue

        ratio = _parse_ratio(row.get("ratio(%)", row.get("ratio", "")))
        if ratio is None or ratio < 0:
            continue
        ratios[persona_id] = ratio

    return ratios


def _seed_to_int(seed: str) -> int:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _largest_remainder(weights: Dict[str, float], total: int) -> Dict[str, int]:
    if total <= 0:
        return {pid: 0 for pid in weights}

    positive_sum = sum(max(w, 0.0) for w in weights.values())
    if positive_sum <= 0:
        positive_sum = float(len(weights))
        normalized = {pid: 1.0 for pid in weights}
    else:
        normalized = {pid: max(w, 0.0) for pid, w in weights.items()}

    raw = {pid: (normalized[pid] / positive_sum) * total for pid in weights}
    floor_alloc = {pid: math.floor(v) for pid, v in raw.items()}
    remainder = {pid: raw[pid] - floor_alloc[pid] for pid in raw}
    deficit = total - sum(floor_alloc.values())

    if deficit > 0:
        order = sorted(
            weights.keys(),
            key=lambda pid: (remainder[pid], normalized[pid], pid),
            reverse=True,
        )
        for pid in order[:deficit]:
            floor_alloc[pid] += 1

    return floor_alloc


def _allocate_counts_with_minimum(
    capacities: Dict[str, int],
    ratios: Dict[str, float],
    total: int,
    minimum: int = 1,
) -> Dict[str, int]:
    persona_ids = [pid for pid in _safe_sort_persona_ids(capacities) if capacities.get(pid, 0) > 0]
    if not persona_ids:
        return {}

    required_minimum = len(persona_ids) * minimum
    total_capacity = sum(capacities[pid] for pid in persona_ids)

    if total < required_minimum:
        raise ValueError(
            f"요청 패널 수({total})가 페르소나 수({len(persona_ids)})보다 작아 최소 1명 보장을 만족할 수 없습니다."
        )
    if total > total_capacity:
        raise ValueError(
            f"요청 패널 수({total})가 가용 패널 수({total_capacity})보다 큽니다."
        )

    counts = {pid: minimum for pid in persona_ids}
    remaining = total - required_minimum

    while remaining > 0:
        eligible = [pid for pid in persona_ids if counts[pid] < capacities[pid]]
        if not eligible:
            break

        weights = {pid: max(float(ratios.get(pid, 0.0)), 0.0) for pid in eligible}
        increments = _largest_remainder(weights, remaining)

        applied = 0
        for pid in eligible:
            spare = capacities[pid] - counts[pid]
            add = min(increments.get(pid, 0), spare)
            if add > 0:
                counts[pid] += add
                applied += add

        if applied == 0:
            # 안전장치: 분배가 정체되면 1명씩 채워 루프 탈출을 보장
            for pid in eligible:
                if remaining <= 0:
                    break
                if counts[pid] < capacities[pid]:
                    counts[pid] += 1
                    remaining -= 1
            continue

        remaining -= applied

    if remaining != 0:
        raise ValueError("패널 분배에 실패했습니다. persona_ratios와 generated_panels를 확인해주세요.")

    return counts


def sample_panels_by_ratio(
    panels: List[Persona],
    persona_ratios: Dict[str, float],
    panel_size: int,
    sampling_seed: Optional[str] = None,
) -> Tuple[List[Persona], str]:
    if not panels:
        return [], (sampling_seed or uuid.uuid4().hex)

    target_size = min(panel_size, len(panels))
    grouped: Dict[str, List[Persona]] = defaultdict(list)
    for panel in panels:
        grouped[str(panel.persona_id)].append(panel)

    capacities = {pid: len(items) for pid, items in grouped.items()}
    counts = _allocate_counts_with_minimum(
        capacities=capacities,
        ratios=persona_ratios,
        total=target_size,
        minimum=1,
    )

    seed = sampling_seed or uuid.uuid4().hex
    rng = random.Random(_seed_to_int(seed))

    sampled: List[Persona] = []
    for pid in _safe_sort_persona_ids(counts.keys()):
        candidates = grouped[pid]
        take = counts[pid]
        if take >= len(candidates):
            picked = list(candidates)
        else:
            picked = rng.sample(candidates, take)
        sampled.extend(picked)

    rng.shuffle(sampled)
    return sampled, seed


_TEAM_PANEL_WORKSHEETS = {
    "marketing": "generated_panels",
    "commerce": "generated_panels_commerce",
}


def sample_panels_for_size(
    spreadsheet: gspread.Spreadsheet,
    panel_size: int,
    sampling_seed: Optional[str] = None,
    panel_worksheet_name: Optional[str] = None,
    ratio_worksheet_name: str = "persona_ratios",
    team: str = "marketing",
) -> Tuple[List[Persona], int, str]:
    validated_size = validate_panel_size(panel_size)
    # Determine worksheet name based on team if not explicitly provided
    if panel_worksheet_name is None:
        panel_worksheet_name = _TEAM_PANEL_WORKSHEETS.get(team, "generated_panels")
    panels = load_panels(spreadsheet, worksheet_name=panel_worksheet_name, team=team)
    if not panels:
        seed = sampling_seed or uuid.uuid4().hex
        return [], 0, seed

    persona_ratios = load_persona_ratios(spreadsheet, worksheet_name=ratio_worksheet_name)
    sampled, seed = sample_panels_by_ratio(
        panels=panels,
        persona_ratios=persona_ratios,
        panel_size=validated_size,
        sampling_seed=sampling_seed,
    )
    return sampled, len(sampled), seed
