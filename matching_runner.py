#!/usr/bin/env python3
"""
有効求人（2週間以内）×稼働可能人材の全件自動マッチングスクリプト

使い方:
  python matching_runner.py                  # 過去14日の有効求人を対象
  python matching_runner.py --days 7         # 過去7日に絞る
  python matching_runner.py --top-n 3        # 案件ごとに上位3名を保存
  python matching_runner.py --min-score 50   # スコア50以上のみ保存
  python matching_runner.py --dry-run        # スプシ保存せず結果を確認

cron設定例（毎朝9時に実行）:
  0 9 * * * cd /path/to/project && python matching_runner.py >> logs/matching.log 2>&1
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
import anthropic

from sheets_manager import SheetsManager
from matching_agent import batch_match_all_jobs

_LOG_DIR = Path("logs")
_SEPARATOR = "=" * 60


def _log(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    _LOG_DIR.mkdir(exist_ok=True)
    log_file = _LOG_DIR / f"matching_{datetime.now():%Y%m%d}.log"
    with log_file.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def _print_summary(job_results: dict, top_n: int, min_score: int) -> None:
    """マッチング結果のサマリーをコンソールに出力する"""
    print()
    print(_SEPARATOR)
    print("  マッチング結果サマリー")
    print(_SEPARATOR)

    total_recommended = 0
    for job_id, (job, results) in job_results.items():
        strong = [r for r in results if r["推奨度"] == "強く推奨"]
        recommended = [r for r in results if r["推奨度"] == "推奨"]
        total_recommended += len(strong) + len(recommended)

        print(f"\n【案件ID: {job_id}】{job.get('案件名', '')} （{job.get('企業名', '')}）")
        print(f"  職種: {job.get('職種', '')} | 勤務地: {job.get('勤務地', '')}")
        print(f"  必須スキル: {job.get('必須スキル', '')}")
        print(f"  登録日: {job.get('登録日', '')} | ステータス: {job.get('ステータス', '')}")

        if not results:
            print(f"  → スコア{min_score}以上の候補なし")
            continue

        print(f"  ┌─ 上位{len(results)}名（スコア{min_score}以上）")
        for i, r in enumerate(results, 1):
            bar = "█" * (r["スコア"] // 10) + "░" * (10 - r["スコア"] // 10)
            print(
                f"  │ {i}位 [{r['推奨度']:6}] {r['氏名']}（人材ID: {r['人材ID']}）"
                f"  スコア: {r['スコア']:3}/100  {bar}"
            )
            # 理由を折り返して表示
            reason_lines = _wrap_text(r["理由"], width=50)
            print(f"  │      理由: {reason_lines[0]}")
            for line in reason_lines[1:]:
                print(f"  │            {line}")
        print("  └" + "─" * 55)

    print()
    print(_SEPARATOR)
    print(
        f"  合計: {len(job_results)} 案件を処理 / "
        f"「推奨」以上の候補 {total_recommended} 件"
    )
    print(_SEPARATOR)


def _wrap_text(text: str, width: int = 50) -> list[str]:
    """長いテキストを指定幅で折り返す"""
    words = text.replace("。", "。\n").replace("、", "、").split("\n")
    lines = []
    for sentence in words:
        if len(sentence) <= width:
            lines.append(sentence)
        else:
            for i in range(0, len(sentence), width):
                lines.append(sentence[i:i + width])
    return [l for l in lines if l.strip()] or [""]


def run(days: int = 14, top_n: int = 5, min_score: int = 40, dry_run: bool = False) -> None:
    load_dotenv()

    required_vars = ["ANTHROPIC_API_KEY", "GOOGLE_SHEETS_ID"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        _log(f"エラー: 環境変数が未設定です: {', '.join(missing)}")
        sys.exit(1)

    sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    if not os.path.exists(sa_file):
        _log(f"エラー: サービスアカウントファイルが見つかりません: {sa_file}")
        sys.exit(1)

    claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    sheets = SheetsManager(
        spreadsheet_id=os.environ["GOOGLE_SHEETS_ID"],
        service_account_file=sa_file,
    )

    _log(_SEPARATOR)
    _log(
        f"マッチング処理開始 "
        f"[有効期間={days}日 / 上位={top_n}名 / 最低スコア={min_score}]"
        f"{' [DRY-RUN]' if dry_run else ''}"
    )

    # ── Step 1: データ取得 ────────────────────────────────────────────────
    _log("スプレッドシートからデータを取得中...")
    valid_jobs = sheets.list_valid_jobs(days=days)
    active_personnel = sheets.list_active_personnel()

    _log(f"  有効求人（過去{days}日以内・募集中）: {len(valid_jobs)} 件")
    _log(f"  稼働可能人材: {len(active_personnel)} 名")

    if not valid_jobs:
        _log(f"有効求人がありません（過去{days}日以内・ステータス=募集中）。処理を終了します。")
        return
    if not active_personnel:
        _log("稼働可能な人材がいません。処理を終了します。")
        return

    total_pairs = len(valid_jobs) * len(active_personnel)
    _log(f"  評価ペア数: {len(valid_jobs)} × {len(active_personnel)} = {total_pairs} ペア")

    # ── Step 2: Batch APIでマッチング ─────────────────────────────────────
    _log("Batch APIでマッチング評価中（処理に数分〜1時間かかる場合があります）...")
    job_results = batch_match_all_jobs(
        valid_jobs=valid_jobs,
        active_personnel=active_personnel,
        client=claude,
        top_n=top_n,
        min_score=min_score,
    )
    _log(f"  評価完了: {len(job_results)} 案件のマッチング結果を取得")

    # ── Step 3: 結果出力 ──────────────────────────────────────────────────
    _print_summary(job_results, top_n, min_score)

    # ── Step 4: スプレッドシートに保存 ────────────────────────────────────
    if dry_run:
        _log("[DRY-RUN] スプレッドシートへの保存をスキップしました。")
    else:
        _log("スプレッドシートにマッチング結果を保存中...")
        saved = sheets.save_all_matching_results(job_results)
        _log(f"  保存完了: {saved} 行を「マッチング結果」シートに追記しました。")

    _log("マッチング処理終了")
    _log(_SEPARATOR)


def main():
    parser = argparse.ArgumentParser(
        description="有効求人×稼働可能人材の全件自動マッチング",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--days",
        type=int,
        default=14,
        help="有効とする案件の登録日範囲（日数）",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=5,
        help="案件ごとに保存する上位候補の人数",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=40,
        help="保存する最低スコア閾値（0〜100）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="スプレッドシートに保存せずに結果を確認する",
    )
    args = parser.parse_args()
    run(
        days=args.days,
        top_n=args.top_n,
        min_score=args.min_score,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
