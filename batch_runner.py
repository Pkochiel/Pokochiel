#!/usr/bin/env python3
"""
人材派遣 - 案件メール自動バッチ処理スクリプト

使い方:
  python batch_runner.py              # 通常実行（過去25時間分）
  python batch_runner.py --hours 48   # 過去48時間分を処理
  python batch_runner.py --dry-run    # スプシ保存せずに動作確認

cron設定例（毎朝8時に実行）:
  0 8 * * * cd /path/to/project && python batch_runner.py >> logs/batch.log 2>&1
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
import anthropic

from outlook_fetcher import OutlookFetcher
from batch_processor import process_emails_batch
from sheets_manager import SheetsManager

# 処理済みメールIDを記録するファイル（重複処理防止）
_PROCESSED_LOG = Path("processed_emails.json")
# ログディレクトリ
_LOG_DIR = Path("logs")


def _load_processed_ids() -> set[str]:
    if _PROCESSED_LOG.exists():
        try:
            return set(json.loads(_PROCESSED_LOG.read_text()))
        except (json.JSONDecodeError, OSError):
            return set()
    return set()


def _save_processed_ids(ids: set[str]) -> None:
    _PROCESSED_LOG.write_text(json.dumps(list(ids)))


def _write_log(message: str) -> None:
    """コンソールとログファイルに同時出力"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    _LOG_DIR.mkdir(exist_ok=True)
    log_file = _LOG_DIR / f"batch_{datetime.now():%Y%m%d}.log"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def run(since_hours: int = 25, dry_run: bool = False) -> None:
    load_dotenv()

    required_vars = [
        "ANTHROPIC_API_KEY", "GOOGLE_SHEETS_ID",
        "AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET",
        "OUTLOOK_TARGET_EMAIL",
    ]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        _write_log(f"エラー: 環境変数が未設定です: {', '.join(missing)}")
        sys.exit(1)

    # クライアント初期化
    claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    processed_folder = os.environ.get("PROCESSED_FOLDER", "案件処理済み")

    if not dry_run:
        sheets = SheetsManager(
            spreadsheet_id=os.environ["GOOGLE_SHEETS_ID"],
            service_account_file=os.environ.get(
                "GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json"
            ),
        )

    fetcher = OutlookFetcher(
        tenant_id=os.environ["AZURE_TENANT_ID"],
        client_id=os.environ["AZURE_CLIENT_ID"],
        client_secret=os.environ["AZURE_CLIENT_SECRET"],
        target_email=os.environ["OUTLOOK_TARGET_EMAIL"],
    )

    _write_log("=" * 50)
    _write_log(f"バッチ処理開始（過去{since_hours}時間分）{'[DRY-RUN]' if dry_run else ''}")

    # ── Step 1: メール取得 ────────────────────────────────────────────────
    _write_log("Outlookからメールを取得中...")
    emails = fetcher.fetch_emails(since_hours=since_hours, max_count=1000)
    _write_log(f"  取得: {len(emails)} 件")

    if not emails:
        _write_log("新着メールはありません。処理を終了します。")
        return

    # 処理済みを除外
    processed_ids = _load_processed_ids()
    new_emails = [e for e in emails if e["id"] not in processed_ids]
    skipped_dup = len(emails) - len(new_emails)
    _write_log(f"  未処理: {len(new_emails)} 件（処理済みスキップ: {skipped_dup} 件）")

    if not new_emails:
        _write_log("未処理メールはありません。処理を終了します。")
        return

    # ── Step 2: Batch APIで並列抽出 ───────────────────────────────────────
    _write_log(f"Claude Batch APIで案件情報を抽出中（{len(new_emails)} 件）...")
    results = process_emails_batch(new_emails, claude)
    _write_log(f"  抽出完了: {len(results)} 件のレスポンスを取得")

    # ── Step 3: スプレッドシートに保存 ────────────────────────────────────
    saved = 0
    skipped_no_job = 0
    errors = 0
    new_processed: set[str] = set()

    for email in new_emails:
        email_id = email["id"]
        data = results.get(email_id)
        subject = email.get("subject", "（件名なし）")
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "")

        new_processed.add(email_id)  # 結果の有無にかかわらず処理済みにする

        if not data:
            # バッチエラー（APIエラーなど）
            _write_log(f"  [SKIP/ERROR] {subject[:40]}")
            errors += 1
            continue

        if not data.get("案件あり", True):
            # 案件情報なしメール（ニュースレター・社内連絡など）
            skipped_no_job += 1
            continue

        if not data.get("案件名") and not data.get("職種"):
            # 案件名も職種も取得できなかった場合はスキップ
            skipped_no_job += 1
            continue

        # 備考にメタ情報を付記
        meta = f"[自動取込 {datetime.now():%Y-%m-%d}] 件名: {subject} / 差出人: {sender}"
        original_memo = data.get("備考", "")
        data["備考"] = f"{meta} / {original_memo}".rstrip(" /")

        if dry_run:
            _write_log(
                f"  [DRY-RUN] 登録予定: {data.get('案件名', '?')} "
                f"（{data.get('企業名', '?')}）"
            )
        else:
            try:
                job_id = sheets.add_job(data)
                _write_log(
                    f"  [登録] ID={job_id} {data.get('案件名', '?')} "
                    f"（{data.get('企業名', '?')}）"
                )
                # Outlookで処理済みフォルダに移動
                fetcher.move_to_folder(email_id, processed_folder)
            except Exception as e:
                _write_log(f"  [ERROR] 登録失敗 - {subject[:40]}: {e}")
                errors += 1
                continue

        saved += 1

    # 処理済みIDを保存（dry-runでも保存してOK）
    _save_processed_ids(processed_ids | new_processed)

    # ── 結果サマリ ────────────────────────────────────────────────────────
    _write_log("-" * 50)
    _write_log(
        f"完了: 登録={saved}件 / 案件なしスキップ={skipped_no_job}件 / "
        f"エラー={errors}件 / 重複スキップ={skipped_dup}件"
    )
    _write_log("バッチ処理終了")
    _write_log("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="案件メール自動バッチ処理")
    parser.add_argument(
        "--hours",
        type=int,
        default=int(os.environ.get("FETCH_HOURS", "25")),
        help="取得する時間範囲（デフォルト: 25時間）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="スプレッドシートに保存せずに動作確認",
    )
    args = parser.parse_args()
    run(since_hours=args.hours, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
