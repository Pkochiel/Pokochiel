#!/usr/bin/env python3
"""
人材派遣マッチング AIエージェント

担当者が自然言語で話しかけると、Claudeが自律的にツールを選択・実行します。

使い方:
  python agent.py
"""

import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import anthropic

from sheets_manager import SheetsManager
from matching_agent import batch_match_all_jobs, match_personnel_to_job
from email_parser import parse_job_email

# ── システムプロンプト ─────────────────────────────────────────────────────

SYSTEM_PROMPT = """あなたは人材派遣会社の業務効率化AIエージェントです。
担当者の指示を理解し、適切なツールを組み合わせて業務を自律的に実行します。

【あなたが実行できる業務】
1. 案件管理  : 有効求人の一覧確認、詳細表示、キーワード検索
2. 人材管理  : 稼働可能人材の一覧確認、詳細表示、キーワード検索
3. マッチング: 全有効求人×全人材の一括マッチング、特定案件のマッチング
4. 登録      : メール本文からの案件自動登録、人材の手動登録

【行動指針】
- ツールを積極的に使い、担当者の質問に具体的な数字・名前を含めて回答する
- マッチング結果はスコアが高い順に、推奨度・理由を明確に伝える
- 不明な点があれば確認してから実行する（特に登録・保存操作）
- 回答は日本語で簡潔・具体的に

今日の日付: """ + datetime.now().strftime("%Y年%m月%d日")

# ── ツール定義 ────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_valid_jobs",
        "description": (
            "有効求人（ステータス=募集中 かつ 指定日数以内に登録）の一覧を取得する。"
            "「今週の案件は？」「有効求人を見せて」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "有効とする登録日の範囲（日数）。デフォルト14。",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_active_personnel",
        "description": (
            "稼働可能な人材（ステータス=稼働可能）の一覧を取得する。"
            "「人材リストを見せて」「誰が空いてる？」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_job_detail",
        "description": "指定した案件IDの詳細情報を取得する。",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "案件ID"}
            },
            "required": ["job_id"],
        },
    },
    {
        "name": "get_person_detail",
        "description": "指定した人材IDの詳細プロフィールを取得する。",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {"type": "string", "description": "人材ID"}
            },
            "required": ["person_id"],
        },
    },
    {
        "name": "search_jobs",
        "description": (
            "キーワードで案件を検索する（案件名・企業名・職種・スキルを横断検索）。"
            "「Pythonの案件は？」「東京の案件を探して」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "検索キーワード"},
                "valid_only": {
                    "type": "boolean",
                    "description": "true にすると有効期間内（14日以内）の案件のみ返す。デフォルト true。",
                },
            },
            "required": ["keyword"],
        },
    },
    {
        "name": "search_personnel",
        "description": (
            "キーワードで人材を検索する（氏名・スキル・希望職種・希望勤務地を横断検索）。"
            "「Reactできる人は？」「大阪在住の人材は？」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "検索キーワード"},
                "active_only": {
                    "type": "boolean",
                    "description": "true にすると稼働可能な人材のみ返す。デフォルト true。",
                },
            },
            "required": ["keyword"],
        },
    },
    {
        "name": "run_full_matching",
        "description": (
            "有効求人（N日以内）×稼働可能人材の全組み合わせをAIで評価し、"
            "案件ごとの上位候補をスプレッドシートに保存する。"
            "「マッチングして」「全件マッチングをかけて」などの問いに使う。"
            "処理時間は案件数×人材数により数分〜1時間かかる場合がある。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "有効求人の対象日数。デフォルト14。",
                },
                "top_n": {
                    "type": "integer",
                    "description": "案件ごとに保存する上位候補数。デフォルト5。",
                },
                "min_score": {
                    "type": "integer",
                    "description": "保存する最低スコア閾値（0〜100）。デフォルト40。",
                },
                "save": {
                    "type": "boolean",
                    "description": "true にするとスプシに保存する。デフォルト true。",
                },
            },
            "required": [],
        },
    },
    {
        "name": "match_single_job",
        "description": (
            "特定の1案件に対して稼働可能人材をAIでマッチングする。"
            "「案件IDが3の案件にマッチングして」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "マッチングする案件ID"},
                "top_n": {
                    "type": "integer",
                    "description": "返す上位候補数。デフォルト5。",
                },
                "min_score": {
                    "type": "integer",
                    "description": "最低スコア閾値（0〜100）。デフォルト40。",
                },
                "save": {
                    "type": "boolean",
                    "description": "true にするとスプシに保存する。デフォルト true。",
                },
            },
            "required": ["job_id"],
        },
    },
    {
        "name": "get_matching_history",
        "description": (
            "過去のマッチング結果をスプレッドシートから取得する。"
            "「マッチング結果を見せて」「案件3のマッチング結果は？」などの問いに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {
                    "type": "string",
                    "description": "絞り込む案件ID（省略すると全件）",
                },
                "limit": {
                    "type": "integer",
                    "description": "最大取得件数。デフォルト20。",
                },
            },
            "required": [],
        },
    },
    {
        "name": "parse_and_register_email",
        "description": (
            "貼り付けられたメール本文から案件情報をAIで自動抽出し、スプレッドシートに登録する。"
            "「このメールを登録して」などのときに使う。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "email_body": {
                    "type": "string",
                    "description": "Outlookメールの本文テキスト",
                }
            },
            "required": ["email_body"],
        },
    },
    {
        "name": "register_person",
        "description": "人材情報をスプレッドシートに新規登録する。",
        "input_schema": {
            "type": "object",
            "properties": {
                "氏名":      {"type": "string"},
                "年齢":      {"type": "string"},
                "経験年数":  {"type": "string"},
                "スキル":    {"type": "string", "description": "保有スキルをカンマ区切りで"},
                "希望職種":  {"type": "string"},
                "希望勤務地":{"type": "string"},
                "希望単価":  {"type": "string"},
                "稼働可能日":{"type": "string"},
                "備考":      {"type": "string"},
            },
            "required": ["氏名", "スキル"],
        },
    },
]

# ── ツールハンドラ ────────────────────────────────────────────────────────

def _fmt_jobs(jobs: list[dict]) -> str:
    if not jobs:
        return "該当する案件はありません。"
    lines = [f"合計 {len(jobs)} 件"]
    for j in jobs:
        lines.append(
            f"  [ID:{j['ID']}] {j['案件名']} | {j['企業名']} | "
            f"{j['職種']} | {j['勤務地']} | {j.get('ステータス','')} | 登録:{j['登録日']}"
        )
    return "\n".join(lines)


def _fmt_personnel(people: list[dict]) -> str:
    if not people:
        return "該当する人材はいません。"
    lines = [f"合計 {len(people)} 名"]
    for p in people:
        lines.append(
            f"  [ID:{p['ID']}] {p['氏名']} | "
            f"スキル: {str(p.get('スキル',''))[:40]} | "
            f"希望: {p.get('希望職種','')} / {p.get('希望勤務地','')} | "
            f"{p.get('ステータス','')}"
        )
    return "\n".join(lines)


def _fmt_match_results(job_results: dict) -> str:
    lines = []
    for job_id, (job, results) in job_results.items():
        lines.append(f"\n【案件 ID:{job_id}】{job.get('案件名','')}（{job.get('企業名','')}）")
        if not results:
            lines.append("  → 候補なし（閾値以上のマッチがありませんでした）")
            continue
        for i, r in enumerate(results, 1):
            lines.append(
                f"  {i}位 [{r['推奨度']}] {r['氏名']}（人材ID:{r['人材ID']}）"
                f" スコア:{r['スコア']}/100"
            )
            lines.append(f"       理由: {r['理由']}")
    return "\n".join(lines) if lines else "マッチング結果がありません。"


def handle_tool(
    tool_name: str,
    tool_input: dict,
    sheets: SheetsManager,
    claude: anthropic.Anthropic,
) -> str:
    """ツール名と入力を受け取り、実行結果を文字列で返す"""

    if tool_name == "get_valid_jobs":
        days = tool_input.get("days", 14)
        jobs = sheets.list_valid_jobs(days=days)
        return f"有効求人（過去{days}日以内）:\n{_fmt_jobs(jobs)}"

    elif tool_name == "get_active_personnel":
        people = sheets.list_active_personnel()
        return f"稼働可能人材:\n{_fmt_personnel(people)}"

    elif tool_name == "get_job_detail":
        job = sheets.get_job(tool_input["job_id"])
        if not job:
            return f"案件ID {tool_input['job_id']} は見つかりませんでした。"
        detail = "\n".join(f"  {k}: {v}" for k, v in job.items() if v)
        return f"案件詳細:\n{detail}"

    elif tool_name == "get_person_detail":
        people = sheets.list_personnel()
        person = next((p for p in people if str(p["ID"]) == str(tool_input["person_id"])), None)
        if not person:
            return f"人材ID {tool_input['person_id']} は見つかりませんでした。"
        detail = "\n".join(f"  {k}: {v}" for k, v in person.items() if v)
        return f"人材詳細:\n{detail}"

    elif tool_name == "search_jobs":
        keyword = tool_input["keyword"].lower()
        valid_only = tool_input.get("valid_only", True)
        jobs = sheets.list_valid_jobs() if valid_only else sheets.list_jobs()
        search_keys = ["案件名", "企業名", "職種", "勤務地", "必須スキル", "歓迎スキル", "備考"]
        matched = [
            j for j in jobs
            if any(keyword in str(j.get(k, "")).lower() for k in search_keys)
        ]
        scope = "有効求人" if valid_only else "全案件"
        return f"「{tool_input['keyword']}」の検索結果（{scope}）:\n{_fmt_jobs(matched)}"

    elif tool_name == "search_personnel":
        keyword = tool_input["keyword"].lower()
        active_only = tool_input.get("active_only", True)
        people = sheets.list_active_personnel() if active_only else sheets.list_personnel()
        search_keys = ["氏名", "スキル", "希望職種", "希望勤務地", "備考"]
        matched = [
            p for p in people
            if any(keyword in str(p.get(k, "")).lower() for k in search_keys)
        ]
        scope = "稼働可能人材" if active_only else "全人材"
        return f"「{tool_input['keyword']}」の検索結果（{scope}）:\n{_fmt_personnel(matched)}"

    elif tool_name == "run_full_matching":
        days     = tool_input.get("days", 14)
        top_n    = tool_input.get("top_n", 5)
        min_score= tool_input.get("min_score", 40)
        save     = tool_input.get("save", True)

        valid_jobs = sheets.list_valid_jobs(days=days)
        active_ppl = sheets.list_active_personnel()

        if not valid_jobs:
            return f"有効求人がありません（過去{days}日以内・募集中）。"
        if not active_ppl:
            return "稼働可能な人材がいません。"

        total = len(valid_jobs) * len(active_ppl)
        print(
            f"\n  ▶ {len(valid_jobs)} 案件 × {len(active_ppl)} 名 = {total} ペアを評価します...",
            flush=True,
        )

        job_results = batch_match_all_jobs(
            valid_jobs=valid_jobs,
            active_personnel=active_ppl,
            client=claude,
            top_n=top_n,
            min_score=min_score,
        )

        saved_count = 0
        if save:
            saved_count = sheets.save_all_matching_results(job_results)

        summary = _fmt_match_results(job_results)
        save_msg = f"\n\nスプレッドシートに {saved_count} 件保存しました。" if save else ""
        return (
            f"マッチング完了（{len(valid_jobs)} 案件 / {len(active_ppl)} 名）{save_msg}\n"
            + summary
        )

    elif tool_name == "match_single_job":
        job_id   = tool_input["job_id"]
        top_n    = tool_input.get("top_n", 5)
        min_score= tool_input.get("min_score", 40)
        save     = tool_input.get("save", True)

        job = sheets.get_job(job_id)
        if not job:
            return f"案件ID {job_id} は見つかりませんでした。"

        active_ppl = sheets.list_active_personnel()
        if not active_ppl:
            return "稼働可能な人材がいません。"

        print(f"\n  ▶ 案件「{job.get('案件名','')}」×{len(active_ppl)} 名を評価します...", flush=True)

        job_results = batch_match_all_jobs(
            valid_jobs=[job],
            active_personnel=active_ppl,
            client=claude,
            top_n=top_n,
            min_score=min_score,
        )

        saved_count = 0
        if save:
            saved_count = sheets.save_all_matching_results(job_results)

        summary = _fmt_match_results(job_results)
        save_msg = f"\nスプレッドシートに {saved_count} 件保存しました。" if save else ""
        return summary + save_msg

    elif tool_name == "get_matching_history":
        job_id = tool_input.get("job_id")
        limit  = tool_input.get("limit", 20)
        ws = sheets._get_sheet("マッチング結果")
        records = ws.get_all_records()
        if job_id:
            records = [r for r in records if str(r.get("案件ID", "")) == str(job_id)]
        records = records[-limit:]  # 直近N件
        if not records:
            return "マッチング履歴はありません。"
        lines = [f"マッチング履歴（直近{len(records)}件）:"]
        for r in records:
            lines.append(
                f"  [{r.get('実行日','')}] 案件:{r.get('案件名','')} | "
                f"{r.get('氏名','')} | スコア:{r.get('スコア','')} | {r.get('推奨度','')}"
            )
        return "\n".join(lines)

    elif tool_name == "parse_and_register_email":
        print("\n  ▶ メール本文を解析中...", flush=True)
        job_data = parse_job_email(tool_input["email_body"], claude)
        if not job_data:
            return "案件情報の抽出に失敗しました。メール本文を確認してください。"
        job_id = sheets.add_job(job_data)
        extracted = "\n".join(f"  {k}: {v}" for k, v in job_data.items() if v)
        return f"案件を登録しました（ID: {job_id}）\n{extracted}"

    elif tool_name == "register_person":
        person_id = sheets.add_personnel(tool_input)
        return (
            f"人材を登録しました（ID: {person_id}）\n"
            + "\n".join(f"  {k}: {v}" for k, v in tool_input.items() if v)
        )

    else:
        return f"未知のツール: {tool_name}"


# ── アジェンティックループ ────────────────────────────────────────────────

def run_agent(sheets: SheetsManager, claude: anthropic.Anthropic) -> None:
    """ストリーミング対応のアジェンティックチャットループ"""
    messages: list[dict] = []

    print("\n" + "=" * 55)
    print("  人材派遣マッチング AIエージェント")
    print("  ※ 「終了」または Ctrl+C で終了")
    print("=" * 55)
    print("\n使用例:")
    print("  「今日の有効求人を見せて」")
    print("  「Pythonエンジニアの案件はある？」")
    print("  「全件マッチングをかけて」")
    print("  「案件ID=3を田中さんにマッチングして」\n")

    while True:
        try:
            user_input = input("あなた: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n終了します。")
            break

        if not user_input:
            continue
        if user_input.lower() in ("終了", "exit", "quit", "q"):
            print("終了します。")
            break

        messages.append({"role": "user", "content": user_input})

        # ── ツール実行ループ ──────────────────────────────────────────────
        while True:
            print("\nエージェント: ", end="", flush=True)

            with claude.messages.stream(
                model="claude-opus-4-6",
                max_tokens=4096,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=messages,
            ) as stream:
                for event in stream:
                    # テキストブロックのみリアルタイム表示（thinkingは非表示）
                    if (
                        event.type == "content_block_delta"
                        and hasattr(event.delta, "type")
                        and event.delta.type == "text_delta"
                    ):
                        print(event.delta.text, end="", flush=True)

                response = stream.get_final_message()

            messages.append({"role": "assistant", "content": response.content})

            # ツール呼び出しがなければユーザー入力に戻る
            if response.stop_reason != "tool_use":
                print("\n")
                break

            # ── ツールを実行 ──────────────────────────────────────────────
            print()  # 改行
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                print(f"  🔧 [{block.name}] を実行中...", flush=True)
                result_text = handle_tool(block.name, block.input, sheets, claude)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_text,
                })

            messages.append({"role": "user", "content": tool_results})


# ── エントリポイント ──────────────────────────────────────────────────────

def main() -> None:
    load_dotenv()

    missing = [
        v for v in ["ANTHROPIC_API_KEY", "GOOGLE_SHEETS_ID"]
        if not os.environ.get(v)
    ]
    if missing:
        print(f"エラー: 環境変数が未設定です: {', '.join(missing)}")
        sys.exit(1)

    sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    if not os.path.exists(sa_file):
        print(f"エラー: サービスアカウントファイルが見つかりません: {sa_file}")
        sys.exit(1)

    claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    sheets = SheetsManager(
        spreadsheet_id=os.environ["GOOGLE_SHEETS_ID"],
        service_account_file=sa_file,
    )

    run_agent(sheets, claude)


if __name__ == "__main__":
    main()
