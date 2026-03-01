import gspread
from google.oauth2.service_account import Credentials
from app.core import GOOGLE_SERVICE_ACCOUNT_JSON

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_gspread_client() -> gspread.Client:
    creds = Credentials.from_service_account_file(GOOGLE_SERVICE_ACCOUNT_JSON, scopes=SCOPES)
    return gspread.authorize(creds)


def open_spreadsheet_by_url(url: str) -> gspread.Spreadsheet:
    client = get_gspread_client()
    return client.open_by_url(url)
