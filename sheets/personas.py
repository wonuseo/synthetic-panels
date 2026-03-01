import gspread
from typing import List
from models.persona import Persona


def load_personas(spreadsheet: gspread.Spreadsheet, worksheet_name: str = "personas") -> List[Persona]:
    worksheet = spreadsheet.worksheet(worksheet_name)
    records = worksheet.get_all_records()
    return [Persona.from_sheet_row(row) for row in records]
