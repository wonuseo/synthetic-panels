"""
100명 패널 생성 스크립트

10개의 기존 페르소나를 기반으로 비율에 맞춰 100명의 패널을 Google Sheets에 생성한다.
각 패널은 페르소나의 고정 속성을 유지하면서 variation 필드에 랜덤 값을 부여한다.

Usage:
    python scripts/generate_panels.py
"""

import math
import random
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core import SHEETS_URL, WORKSHEET_NAME
from app.sheets.client import open_spreadsheet_by_url
from app.sheets.personas import load_personas

# ---------------------------------------------------------------------------
# 비율 설정 (persona_id → 비율 %)
# ---------------------------------------------------------------------------
PERSONA_RATIOS = {
    "1": 5.5,
    "2": 34.1,
    "3": 19.7,
    "4": 4.6,
    "5": 3.6,
    "6": 0.9,
    "7": 21.9,
    "8": 6.8,
    "9": 0.5,
    "10": 2.5,
}

TOTAL_PANELS = 100

# ---------------------------------------------------------------------------
# Variation pools
# ---------------------------------------------------------------------------
COMPETITOR_BRANDS = [
    "시그니엘", "파라다이스시티", "롯데리조트", "한화리조트",
    "소노호텔앤리조트", "켄싱턴호텔", "대명리조트", "클럽메드",
    "반얀트리", "아난티", "메리어트", "힐튼", "하얏트",
]

PAST_FRICTIONS = [
    "체크인 대기 시간이 너무 길었음",
    "객실 청결 상태 불만족",
    "소음 문제로 수면 방해",
    "예약과 다른 객실 배정",
    "조식 품질 기대 이하",
    "직원 응대 불친절",
    "주차 공간 부족",
    "수영장/부대시설 관리 미흡",
    "와이파이 연결 불안정",
    "냉난방 시스템 고장",
    "룸서비스 응답 지연",
    "환불/취소 정책 불합리",
]

SKEPTICISM_LEVELS = ["높음", "중간", "낮음"]
SKEPTICISM_WEIGHTS = [0.25, 0.50, 0.25]


# ---------------------------------------------------------------------------
# Largest remainder method
# ---------------------------------------------------------------------------
def largest_remainder(ratios: dict[str, float], total: int, minimum: int = 1) -> dict[str, int]:
    """비율에 따라 정확히 total 명을 분배 (Largest remainder method).

    minimum: 각 페르소나에 보장할 최소 인원 (기본 1).
    """
    n = len(ratios)
    remaining = total - n * minimum  # 최소 보장분을 제외한 나머지
    raw = {pid: ratio / 100.0 * remaining for pid, ratio in ratios.items()}
    floored = {pid: minimum + math.floor(v) for pid, v in raw.items()}
    remainders = {pid: raw[pid] - math.floor(raw[pid]) for pid in raw}
    allocated = sum(floored.values())
    deficit = total - allocated

    # 나머지가 큰 순서대로 1명씩 추가
    sorted_by_remainder = sorted(remainders, key=remainders.get, reverse=True)
    for pid in sorted_by_remainder[:deficit]:
        floored[pid] += 1

    return floored


# ---------------------------------------------------------------------------
# Variation 생성
# ---------------------------------------------------------------------------
def generate_variation() -> dict:
    """패널 1명에 대한 variation 필드를 랜덤 생성."""
    visited = random.choices(["yes", "no"], weights=[0.6, 0.4], k=1)[0]

    if visited == "yes":
        experience = random.choices(
            ["pos", "neu", "neg"], weights=[0.5, 0.3, 0.2], k=1
        )[0]
    else:
        experience = ""

    past_friction = ""
    if experience == "neg":
        past_friction = random.choice(PAST_FRICTIONS)

    skepticism = random.choices(
        SKEPTICISM_LEVELS, weights=SKEPTICISM_WEIGHTS, k=1
    )[0]

    competitor_pref = random.choice(COMPETITOR_BRANDS)

    return {
        "panel_visited": visited,
        "panel_visit_experience": experience,
        "panel_past_friction": past_friction,
        "panel_skepticism": skepticism,
        "panel_competitor_pref": competitor_pref,
    }


# ---------------------------------------------------------------------------
# 고정 필드 (페르소나에서 상속)
# ---------------------------------------------------------------------------
INHERITED_FIELDS = [
    "persona_name", "panel_gender", "panel_sex", "persona_season",
    "panel_cpc", "panel_potential", "panel_room_pref", "panel_bed_pref",
    "panel_activity_pref_1", "panel_activity_pref_2", "panel_activity_pref_3",
    "panel_cuisine_1", "panel_cuisine_2", "persona_ksf",
]

PANEL_HEADERS = [
    "panel_id", "persona_id", "persona_name", "panel_gender", "panel_sex",
    "persona_season", "panel_cpc", "panel_potential", "panel_room_pref",
    "panel_bed_pref", "panel_activity_pref_1", "panel_activity_pref_2",
    "panel_activity_pref_3", "panel_cuisine_1", "panel_cuisine_2",
    "persona_ksf", "panel_visited", "panel_visit_experience",
    "panel_past_friction", "panel_skepticism", "panel_competitor_pref",
]


# ---------------------------------------------------------------------------
# 워크시트 생성 헬퍼
# ---------------------------------------------------------------------------
def get_or_create_worksheet(spreadsheet, title: str, rows: int = 1, cols: int = 1):
    """워크시트가 있으면 clear, 없으면 생성."""
    try:
        ws = spreadsheet.worksheet(title)
        ws.clear()
        return ws
    except Exception:
        return spreadsheet.add_worksheet(title=title, rows=rows, cols=cols)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not SHEETS_URL:
        print("ERROR: SHEETS_URL 환경 변수가 설정되지 않았습니다.")
        sys.exit(1)

    print(f"Google Sheets 연결 중... ({SHEETS_URL[:50]}...)")
    spreadsheet = open_spreadsheet_by_url(SHEETS_URL)

    # 1. 기존 페르소나 로드
    print(f"'{WORKSHEET_NAME}' 워크시트에서 페르소나 로드 중...")
    personas = load_personas(spreadsheet, WORKSHEET_NAME)
    print(f"  → {len(personas)}개 페르소나 로드 완료")

    persona_map = {p.persona_id: p for p in personas}

    # 2. 비율 분배
    counts = largest_remainder(PERSONA_RATIOS, TOTAL_PANELS)
    total_check = sum(counts.values())
    print(f"패널 분배: 총 {total_check}명")
    for pid in sorted(counts, key=lambda x: int(x)):
        name = persona_map.get(pid)
        name_str = name.persona_name if name else "?"
        print(f"  페르소나 {pid} ({name_str}): {counts[pid]}명")

    # 3. 패널 생성
    print("패널 생성 중...")
    panels = []
    for pid in sorted(counts, key=lambda x: int(x)):
        persona = persona_map.get(pid)
        if not persona:
            print(f"  WARNING: 페르소나 ID {pid}를 찾을 수 없습니다. 건너뜁니다.")
            continue

        for seq in range(1, counts[pid] + 1):
            panel_id = f"{pid}-{seq:03d}"
            variation = generate_variation()

            row = {"panel_id": panel_id, "persona_id": pid}
            for field in INHERITED_FIELDS:
                row[field] = getattr(persona, field)
            row.update(variation)

            panels.append(row)

    print(f"  → {len(panels)}개 패널 생성 완료")

    # 4. 워크시트 1: variation_rules
    print("'variation_rules' 워크시트 작성 중...")
    ws_rules = get_or_create_worksheet(spreadsheet, "variation_rules", rows=10, cols=3)
    rules_data = [
        ["필드명", "옵션", "비율"],
        ["panel_visited", "yes / no", "60% / 40%"],
        ["panel_visit_experience", "pos / neu / neg", "50% / 30% / 20% (visited=yes일 때)"],
        ["panel_past_friction", "(불만 사항 풀에서 랜덤)", "experience=neg일 때만"],
        ["panel_skepticism", "높음 / 중간 / 낮음", "25% / 50% / 25%"],
        ["panel_competitor_pref", "(경쟁 브랜드 풀에서 랜덤)", "균등 분배"],
    ]
    ws_rules.update(rules_data)
    print("  → 완료")

    # 5. 워크시트 2: persona_ratios
    print("'persona_ratios' 워크시트 작성 중...")
    ws_ratios = get_or_create_worksheet(spreadsheet, "persona_ratios", rows=15, cols=4)
    ratios_data = [["persona_id", "persona_name", "ratio(%)", "panel_count"]]
    for pid in sorted(PERSONA_RATIOS, key=lambda x: int(x)):
        persona = persona_map.get(pid)
        name_str = persona.persona_name if persona else ""
        ratios_data.append([pid, name_str, PERSONA_RATIOS[pid], counts[pid]])
    ratios_data.append(["합계", "", 100.0, TOTAL_PANELS])
    ws_ratios.update(ratios_data)
    print("  → 완료")

    # 6. 워크시트 3: generated_panels
    print("'generated_panels' 워크시트 작성 중...")
    ws_panels = get_or_create_worksheet(
        spreadsheet, "generated_panels", rows=len(panels) + 1, cols=len(PANEL_HEADERS)
    )
    panel_rows = [PANEL_HEADERS]
    for panel in panels:
        panel_rows.append([panel.get(h, "") for h in PANEL_HEADERS])
    ws_panels.update(panel_rows)
    print("  → 완료")

    print(f"\n완료! Google Sheets에 {len(panels)}명의 패널이 생성되었습니다.")
    print("생성된 워크시트: variation_rules, persona_ratios, generated_panels")


if __name__ == "__main__":
    main()
