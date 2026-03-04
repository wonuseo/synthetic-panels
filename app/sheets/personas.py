import gspread
from typing import List
from app.models.persona import Persona


def load_personas(spreadsheet: gspread.Spreadsheet, worksheet_name: str = "personas") -> List[Persona]:
    worksheet = spreadsheet.worksheet(worksheet_name)
    expected_headers = worksheet.row_values(1)
    records = worksheet.get_all_records(expected_headers=expected_headers)
    return [Persona.from_sheet_row(row) for row in records]


def load_panels(spreadsheet: gspread.Spreadsheet, worksheet_name: str = "generated_panels") -> List[Persona]:
    worksheet = spreadsheet.worksheet(worksheet_name)
    expected_headers = worksheet.row_values(1)
    records = worksheet.get_all_records(expected_headers=expected_headers)
    return [Persona.from_sheet_row(row) for row in records]
