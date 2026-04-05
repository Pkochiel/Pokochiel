#!/usr/bin/env python3
"""人材派遣マッチングエージェント - 担当者向けCLIツール"""

import os
import sys
from dotenv import load_dotenv
import anthropic

from sheets_manager import SheetsManager
from email_parser import parse_job_email
from matching_agent import match_personnel_to_job


def init_clients() -> tuple[anthropic.Anthropic, SheetsManager]:
    load_dotenv()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("エラー: ANTHROPIC_API_KEY が設定されていません。")
        sys.exit(1)

    sheets_id = os.environ.get("GOOGLE_SHEETS_ID")
    if not sheets_id:
        print("エラー: GOOGLE_SHEETS_ID が設定されていません。")
        sys.exit(1)

    sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    if not os.path.exists(sa_file):
        print(f"エラー: サービスアカウントファイル '{sa_file}' が見つかりません。")
        sys.exit(1)

    claude = anthropic.Anthropic(api_key=api_key)
    sheets = SheetsManager(spreadsheet_id=sheets_id, service_account_file=sa_file)
    return claude, sheets


def menu_parse_email(claude: anthropic.Anthropic, sheets: SheetsManager):
    """メール本文から案件を登録"""
    print("\n--- メール本文から案件登録 ---")
    print("Outlookのメール本文を貼り付けてください。")
    print("（入力完了後、空行で「END」と入力して Enterを押してください）\n")

    lines = []
    while True:
        line = input()
        if line.strip().upper() == "END":
            break
        lines.append(line)

    email_body = "\n".join(lines)
    if not email_body.strip():
        print("メール本文が空です。")
        return

    print("\n解析中...")
    job_data = parse_job_email(email_body, claude)

    if not job_data:
        print("案件情報の抽出に失敗しました。")
        return

    print("\n【抽出された案件情報】")
    for key, value in job_data.items():
        if value:
            print(f"  {key}: {value}")

    confirm = input("\nこの内容でスプレッドシートに登録しますか？ [y/N]: ")
    if confirm.lower() == "y":
        job_id = sheets.add_job(job_data)
        print(f"登録完了（案件ID: {job_id}）")
    else:
        print("登録をキャンセルしました。")


def menu_import_csv(sheets: SheetsManager):
    """CSVから一括インポート"""
    print("\n--- CSVから一括インポート ---")
    print("1. 案件データ")
    print("2. 人材データ")
    choice = input("選択 [1/2]: ").strip()

    csv_path = input("CSVファイルのパスを入力: ").strip()
    if not os.path.exists(csv_path):
        print(f"ファイルが見つかりません: {csv_path}")
        return

    try:
        if choice == "1":
            count = sheets.import_jobs_csv(csv_path)
            print(f"案件を {count} 件インポートしました。")
        elif choice == "2":
            count = sheets.import_personnel_csv(csv_path)
            print(f"人材を {count} 件インポートしました。")
        else:
            print("無効な選択です。")
    except Exception as e:
        print(f"インポートエラー: {e}")


def menu_register_person(sheets: SheetsManager):
    """人材を手動登録"""
    print("\n--- 人材登録 ---")
    data = {}
    fields = [
        ("氏名", True),
        ("年齢", False),
        ("経験年数", False),
        ("スキル", True),
        ("希望職種", False),
        ("希望勤務地", False),
        ("希望単価", False),
        ("稼働可能日", False),
        ("備考", False),
    ]
    for field, required in fields:
        while True:
            value = input(f"{field}{'（必須）' if required else ''}: ").strip()
            if required and not value:
                print("  ※ 必須項目です。")
                continue
            data[field] = value
            break

    person_id = sheets.add_personnel(data)
    print(f"登録完了（人材ID: {person_id}）")


def menu_run_matching(claude: anthropic.Anthropic, sheets: SheetsManager):
    """AIマッチング実行"""
    print("\n--- AIマッチング ---")
    jobs = sheets.list_jobs()
    if not jobs:
        print("案件が登録されていません。")
        return

    print("案件一覧:")
    for job in jobs:
        print(f"  [{job['ID']}] {job['案件名']} ({job['企業名']})")

    job_id = input("\nマッチングする案件IDを入力: ").strip()
    job = sheets.get_job(job_id)
    if not job:
        print(f"案件ID {job_id} が見つかりません。")
        return

    top_n_input = input("表示する上位件数 [デフォルト: 5]: ").strip()
    top_n = int(top_n_input) if top_n_input.isdigit() else 5

    personnel = sheets.list_personnel()
    if not personnel:
        print("人材が登録されていません。")
        return

    print(f"\nマッチング中（対象人材: {len(personnel)} 名）...")
    results = match_personnel_to_job(job, personnel, claude, top_n=top_n)

    if not results:
        print("マッチング結果が見つかりませんでした。")
        return

    print(f"\n【マッチング結果 TOP {len(results)}】")
    print(f"案件: {job['案件名']} ({job['企業名']})")
    print("-" * 60)
    for i, r in enumerate(results, 1):
        print(f"\n{i}位 [{r['推奨度']}] {r['氏名']}（人材ID: {r['人材ID']}）")
        print(f"  スコア: {r['スコア']}/100")
        print(f"  理由  : {r['理由']}")

    save = input("\nこの結果をスプレッドシートに保存しますか？ [y/N]: ")
    if save.lower() == "y":
        count = sheets.save_matching_results(job, results)
        print(f"{count} 件のマッチング結果を保存しました。")


def menu_list_view(sheets: SheetsManager):
    """一覧表示"""
    print("\n--- データ一覧 ---")
    print("1. 案件一覧")
    print("2. 人材一覧")
    choice = input("選択 [1/2]: ").strip()

    if choice == "1":
        jobs = sheets.list_jobs()
        if not jobs:
            print("案件がありません。")
            return
        print(f"\n案件一覧（{len(jobs)} 件）")
        print("-" * 60)
        for job in jobs:
            status = job.get("ステータス", "")
            print(f"[{job['ID']}] {job['案件名']} | {job['企業名']} | {job['職種']} | {status}")
    elif choice == "2":
        personnel = sheets.list_personnel()
        if not personnel:
            print("人材がいません。")
            return
        print(f"\n人材一覧（{len(personnel)} 名）")
        print("-" * 60)
        for p in personnel:
            status = p.get("ステータス", "")
            print(f"[{p['ID']}] {p['氏名']} | {p.get('スキル', '')[:30]} | {status}")
    else:
        print("無効な選択です。")


def main():
    print("=" * 50)
    print("  人材派遣マッチングエージェント")
    print("=" * 50)

    try:
        claude, sheets = init_clients()
    except SystemExit:
        raise
    except Exception as e:
        print(f"初期化エラー: {e}")
        sys.exit(1)

    print("接続完了。スプレッドシートに接続しました。\n")

    while True:
        print("\n【メニュー】")
        print("1. メール本文から案件を登録")
        print("2. CSVから一括インポート（案件・人材）")
        print("3. 人材を手動登録")
        print("4. AIマッチングを実行")
        print("5. データ一覧を表示")
        print("0. 終了")

        choice = input("\n選択してください: ").strip()

        if choice == "1":
            menu_parse_email(claude, sheets)
        elif choice == "2":
            menu_import_csv(sheets)
        elif choice == "3":
            menu_register_person(sheets)
        elif choice == "4":
            menu_run_matching(claude, sheets)
        elif choice == "5":
            menu_list_view(sheets)
        elif choice == "0":
            print("終了します。")
            break
        else:
            print("無効な選択です。")


if __name__ == "__main__":
    main()
