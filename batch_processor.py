"""Anthropic Batch APIを使った大量メールの並列案件抽出（50%コスト削減）"""

import json
import time

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from email_parser import EXTRACTION_SYSTEM
from outlook_fetcher import extract_plain_text

# Batch APIの1バッチ上限
_BATCH_SIZE = 10_000

# 構造化出力スキーマ（Batch APIはmessages.parseが使えないため直接指定）
_OUTPUT_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "案件あり": {
                "type": "boolean",
                "description": "メールに案件・求人情報が含まれている場合 true",
            },
            "企業名": {"type": "string"},
            "案件名": {"type": "string"},
            "職種": {"type": "string"},
            "勤務地": {"type": "string"},
            "勤務形態": {"type": "string"},
            "期間": {"type": "string"},
            "単価": {"type": "string"},
            "必須スキル": {"type": "string"},
            "歓迎スキル": {"type": "string"},
            "人数": {"type": "string"},
            "備考": {"type": "string"},
        },
        "required": [
            "案件あり", "企業名", "案件名", "職種", "勤務地",
            "勤務形態", "期間", "単価", "必須スキル", "歓迎スキル",
            "人数", "備考",
        ],
        "additionalProperties": False,
    },
}

_BATCH_SYSTEM = (
    EXTRACTION_SYSTEM
    + "\n\nメールに案件・求人情報が含まれていない場合（社内連絡・ニュースレター・広告等）は "
    "「案件あり」を false に設定し、他の項目は空文字列にしてください。"
)


def _build_request(email: dict) -> Request:
    """メールオブジェクトからBatch APIリクエストを構築する"""
    body_text = extract_plain_text(email)
    sender = email.get("from", {}).get("emailAddress", {}).get("address", "")
    subject = email.get("subject", "")

    user_content = (
        f"件名: {subject}\n"
        f"差出人: {sender}\n"
        f"受信日時: {email.get('receivedDateTime', '')}\n\n"
        f"本文:\n{body_text[:4000]}"  # 本文は4000文字まで（トークン節約）
    )

    return Request(
        custom_id=email["id"],
        params=MessageCreateParamsNonStreaming(
            model="claude-opus-4-6",
            max_tokens=512,
            system=_BATCH_SYSTEM,
            messages=[{"role": "user", "content": user_content}],
            output_config={"format": _OUTPUT_SCHEMA},
        ),
    )


def _run_single_batch(
    requests_list: list[Request],
    client: anthropic.Anthropic,
    batch_index: int,
    total_batches: int,
) -> dict[str, dict]:
    """1バッチを送信してポーリングし、結果を返す"""
    print(
        f"  [{batch_index}/{total_batches}] バッチ送信中（{len(requests_list)} 件）..."
    )
    batch = client.messages.batches.create(requests=requests_list)
    print(f"  バッチID: {batch.id}")

    poll_interval = 15  # 秒
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        counts = batch.request_counts
        total = len(requests_list)
        done = counts.succeeded + counts.errored + counts.canceled + counts.expired
        print(
            f"  処理中... {done}/{total} 件完了"
            f"（成功: {counts.succeeded}, エラー: {counts.errored}）   ",
            end="\r",
        )
        if batch.processing_status == "ended":
            break
        time.sleep(poll_interval)

    print(f"\n  完了 → 成功: {batch.request_counts.succeeded} 件 / "
          f"エラー: {batch.request_counts.errored} 件")

    results: dict[str, dict] = {}
    for result in client.messages.batches.results(batch.id):
        if result.result.type != "succeeded":
            continue
        text = next(
            (b.text for b in result.result.message.content if b.type == "text"),
            None,
        )
        if not text:
            continue
        try:
            results[result.custom_id] = json.loads(text)
        except json.JSONDecodeError:
            pass  # パース失敗はスキップ

    return results


def process_emails_batch(
    emails: list[dict], client: anthropic.Anthropic
) -> dict[str, dict]:
    """
    Batch APIを使って大量メールから案件情報を並列抽出する。

    1000件を約1時間で処理、通常APIの50%コスト。

    Args:
        emails: Graph APIから取得したメールオブジェクトのリスト
        client: Anthropic クライアント

    Returns:
        {email_id: 抽出された案件データ} の辞書
        ※ 案件情報なしメール（案件あり=false）も含まれるので呼び出し側でフィルタすること
    """
    if not emails:
        return {}

    requests_list = [_build_request(e) for e in emails]
    total_batches = (len(requests_list) + _BATCH_SIZE - 1) // _BATCH_SIZE

    all_results: dict[str, dict] = {}
    for i, chunk_start in enumerate(range(0, len(requests_list), _BATCH_SIZE), 1):
        chunk = requests_list[chunk_start : chunk_start + _BATCH_SIZE]
        chunk_results = _run_single_batch(chunk, client, i, total_batches)
        all_results.update(chunk_results)

    return all_results
