"""Google スプレッドシートへの案件・人材データ管理"""

import csv
import json
import os
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

JOB_SHEET = "案件リスト"
PERSONNEL_SHEET = "人材リスト"
MATCHING_SHEET = "マッチング結果"

JOB_HEADERS = [
    "ID", "登録日", "企業名", "案件名", "職種", "勤務地", "勤務形態",
    "期間", "単価", "必須スキル", "歓迎スキル", "人数", "備考", "ステータス",
]
PERSONNEL_HEADERS = [
    "ID", "登録日", "氏名", "年齢", "経験年数", "スキル",
    "希望職種", "希望勤務地", "希望単価", "稼働可能日", "備考", "ステータス",
]
MATCHING_HEADERS = [
    "マッチングID", "実行日", "案件ID", "案件名", "人材ID", "氏名",
    "スコア", "マッチング理由", "推奨度",
]


class SheetsManager:
    def __init__(self, spreadsheet_id: str, service_account_file: str):
        creds = Credentials.from_service_account_file(service_account_file, scopes=SCOPES)
        self.client = gspread.authorize(creds)
        self.spreadsheet = self.client.open_by_key(spreadsheet_id)
        self._ensure_sheets()

    def _ensure_sheets(self):
        """必要なシートが存在しなければ作成する"""
        existing = {ws.title for ws in self.spreadsheet.worksheets()}
        for title, headers in [
            (JOB_SHEET, JOB_HEADERS),
            (PERSONNEL_SHEET, PERSONNEL_HEADERS),
            (MATCHING_SHEET, MATCHING_HEADERS),
        ]:
            if title not in existing:
                ws = self.spreadsheet.add_worksheet(title=title, rows=1000, cols=len(headers))
                ws.append_row(headers)

    def _get_sheet(self, title: str) -> gspread.Worksheet:
        return self.spreadsheet.worksheet(title)

    def _next_id(self, sheet: gspread.Worksheet) -> str:
        rows = sheet.get_all_values()
        return str(len(rows))  # ヘッダー行含むので行数=次のID

    # ── 案件 ──────────────────────────────────────────────────────────────

    def add_job(self, data: dict) -> str:
        ws = self._get_sheet(JOB_SHEET)
        job_id = self._next_id(ws)
        row = [
            job_id,
            datetime.now().strftime("%Y-%m-%d"),
            data.get("企業名", ""),
            data.get("案件名", ""),
            data.get("職種", ""),
            data.get("勤務地", ""),
            data.get("勤務形態", ""),
            data.get("期間", ""),
            data.get("単価", ""),
            data.get("必須スキル", ""),
            data.get("歓迎スキル", ""),
            data.get("人数", ""),
            data.get("備考", ""),
            data.get("ステータス", "募集中"),
        ]
        ws.append_row(row)
        return job_id

    def list_jobs(self) -> list[dict]:
        ws = self._get_sheet(JOB_SHEET)
        records = ws.get_all_records()
        return [r for r in records if r.get("ID")]

    def get_job(self, job_id: str) -> dict | None:
        for job in self.list_jobs():
            if str(job["ID"]) == str(job_id):
                return job
        return None

    def import_jobs_csv(self, csv_path: str) -> int:
        """CSVから案件を一括インポート。追加件数を返す。"""
        count = 0
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.add_job(row)
                count += 1
        return count

    # ── 人材 ──────────────────────────────────────────────────────────────

    def add_personnel(self, data: dict) -> str:
        ws = self._get_sheet(PERSONNEL_SHEET)
        person_id = self._next_id(ws)
        row = [
            person_id,
            datetime.now().strftime("%Y-%m-%d"),
            data.get("氏名", ""),
            data.get("年齢", ""),
            data.get("経験年数", ""),
            data.get("スキル", ""),
            data.get("希望職種", ""),
            data.get("希望勤務地", ""),
            data.get("希望単価", ""),
            data.get("稼働可能日", ""),
            data.get("備考", ""),
            data.get("ステータス", "稼働可能"),
        ]
        ws.append_row(row)
        return person_id

    def list_personnel(self) -> list[dict]:
        ws = self._get_sheet(PERSONNEL_SHEET)
        records = ws.get_all_records()
        return [r for r in records if r.get("ID")]

    def import_personnel_csv(self, csv_path: str) -> int:
        """CSVから人材を一括インポート。追加件数を返す。"""
        count = 0
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.add_personnel(row)
                count += 1
        return count

    # ── マッチング結果 ────────────────────────────────────────────────────

    def save_matching_results(self, job: dict, results: list[dict]) -> int:
        ws = self._get_sheet(MATCHING_SHEET)
        base_id = len(ws.get_all_values())
        for i, r in enumerate(results):
            row = [
                str(base_id + i),
                datetime.now().strftime("%Y-%m-%d %H:%M"),
                str(job.get("ID", "")),
                job.get("案件名", ""),
                str(r.get("人材ID", "")),
                r.get("氏名", ""),
                str(r.get("スコア", "")),
                r.get("理由", ""),
                r.get("推奨度", ""),
            ]
            ws.append_row(row)
        return len(results)
