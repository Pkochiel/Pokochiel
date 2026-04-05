"""AIによる案件・人材マッチング（Claude API使用）"""

import json
import time
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from pydantic import BaseModel

MATCHING_SYSTEM = """あなたは人材派遣会社のベテランコンサルタントです。
案件の要件と人材のプロフィールを比較し、マッチング度を評価してください。

評価基準:
1. スキルの合致度（必須スキルの充足率を重視）
2. 希望条件の合致度（勤務地・単価・職種）
3. 経験年数と案件難易度のバランス
4. 稼働可能時期と案件開始時期

出力形式:
- スコア: 0〜100の整数（100が最高マッチ）
- 理由: マッチング理由を3〜5文で具体的に説明
- 推奨度: "強く推奨" / "推奨" / "条件付き推奨" / "非推奨" のいずれか

スコアの目安:
- 80以上: 強く推奨（必須スキル充足、条件ほぼ合致）
- 60〜79: 推奨（必須スキル概ね充足）
- 40〜59: 条件付き推奨（一部スキルや条件に懸念あり）
- 39以下: 非推奨（必須スキル不足または条件大幅不一致）"""


class MatchResult(BaseModel):
    スコア: int
    理由: str
    推奨度: str


def match_personnel_to_job(
    job: dict,
    personnel_list: list[dict],
    client: anthropic.Anthropic,
    top_n: int = 5,
) -> list[dict]:
    """
    案件に対して人材をマッチングし、スコア上位N件を返す。

    Args:
        job: 案件情報の辞書
        personnel_list: 人材リスト
        client: Anthropic クライアント
        top_n: 返す上位件数

    Returns:
        マッチング結果のリスト（スコア降順）
    """
    # 稼働可能な人材のみ対象
    active_personnel = [
        p for p in personnel_list
        if p.get("ステータス", "") in ("稼働可能", "")
    ]

    if not active_personnel:
        return []

    job_summary = _format_job(job)
    results = []

    for person in active_personnel:
        person_summary = _format_person(person)

        response = client.messages.parse(
            model="claude-opus-4-6",
            max_tokens=1024,
            thinking={"type": "adaptive"},
            system=MATCHING_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"【案件情報】\n{job_summary}\n\n"
                        f"【人材プロフィール】\n{person_summary}\n\n"
                        "この人材を上記案件に推薦すべきか評価してください。"
                    ),
                }
            ],
            output_format=MatchResult,
        )

        if response.parsed_output:
            match = response.parsed_output
            results.append(
                {
                    "人材ID": person.get("ID", ""),
                    "氏名": person.get("氏名", ""),
                    "スコア": match.スコア,
                    "理由": match.理由,
                    "推奨度": match.推奨度,
                }
            )

    # スコア降順でソートし上位N件を返す
    results.sort(key=lambda x: x["スコア"], reverse=True)
    return results[:top_n]


_BATCH_SIZE = 10_000  # Batch API の1バッチ上限

_SCORE_SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {
            "スコア": {"type": "integer", "description": "0〜100のマッチングスコア"},
            "理由": {"type": "string", "description": "マッチング理由（3〜5文）"},
            "推奨度": {
                "type": "string",
                "enum": ["強く推奨", "推奨", "条件付き推奨", "非推奨"],
            },
        },
        "required": ["スコア", "理由", "推奨度"],
        "additionalProperties": False,
    },
}


def batch_match_all_jobs(
    valid_jobs: list[dict],
    active_personnel: list[dict],
    client: anthropic.Anthropic,
    top_n: int = 5,
    min_score: int = 0,
) -> dict[str, tuple[dict, list[dict]]]:
    """
    有効求人×稼働可能人材の全組み合わせをBatch APIで並列評価する。

    Args:
        valid_jobs: 有効求人リスト（list_valid_jobs の結果）
        active_personnel: 稼働可能人材リスト（list_active_personnel の結果）
        client: Anthropic クライアント
        top_n: 案件ごとに保存する上位件数
        min_score: この閾値以上のみ結果に含める

    Returns:
        {job_id: (job_dict, sorted_results)} の辞書
    """
    if not valid_jobs or not active_personnel:
        return {}

    total_pairs = len(valid_jobs) * len(active_personnel)
    print(f"  評価対象: {len(valid_jobs)} 案件 × {len(active_personnel)} 名 = {total_pairs} ペア")

    # ── リクエストを構築 ──────────────────────────────────────────────────
    requests_list: list[Request] = []
    for job in valid_jobs:
        job_text = _format_job(job)
        for person in active_personnel:
            person_text = _format_person(person)
            custom_id = f"{job['ID']}::{person['ID']}"
            requests_list.append(
                Request(
                    custom_id=custom_id,
                    params=MessageCreateParamsNonStreaming(
                        model="claude-opus-4-6",
                        max_tokens=512,
                        system=MATCHING_SYSTEM,
                        messages=[{
                            "role": "user",
                            "content": (
                                f"【案件情報】\n{job_text}\n\n"
                                f"【人材プロフィール】\n{person_text}\n\n"
                                "この人材を上記案件に推薦すべきか評価してください。"
                            ),
                        }],
                        output_config={"format": _SCORE_SCHEMA},
                    ),
                )
            )

    # ── バッチ送信（10000件ずつ分割） ─────────────────────────────────────
    raw_results: dict[str, dict] = {}
    total_batches = (len(requests_list) + _BATCH_SIZE - 1) // _BATCH_SIZE

    for batch_num, chunk_start in enumerate(range(0, len(requests_list), _BATCH_SIZE), 1):
        chunk = requests_list[chunk_start: chunk_start + _BATCH_SIZE]
        print(f"  バッチ {batch_num}/{total_batches} を送信中（{len(chunk)} ペア）...")

        batch = client.messages.batches.create(requests=chunk)
        print(f"  バッチID: {batch.id}")

        while True:
            batch = client.messages.batches.retrieve(batch.id)
            counts = batch.request_counts
            done = counts.succeeded + counts.errored + counts.canceled + counts.expired
            print(
                f"  処理中... {done}/{len(chunk)} 完了"
                f"（成功: {counts.succeeded}, エラー: {counts.errored}）   ",
                end="\r",
            )
            if batch.processing_status == "ended":
                break
            time.sleep(15)

        print(f"\n  バッチ {batch_num} 完了 → 成功: {batch.request_counts.succeeded} 件")

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
                raw_results[result.custom_id] = json.loads(text)
            except json.JSONDecodeError:
                pass

    # ── 結果を案件ごとに集約・ソート ─────────────────────────────────────
    person_map = {str(p["ID"]): p for p in active_personnel}
    job_map = {str(j["ID"]): j for j in valid_jobs}

    # {job_id: [(score, result_dict), ...]}
    grouped: dict[str, list] = {str(j["ID"]): [] for j in valid_jobs}

    for custom_id, data in raw_results.items():
        job_id, person_id = custom_id.split("::", 1)
        score = int(data.get("スコア", 0))
        if score < min_score:
            continue
        person = person_map.get(person_id, {})
        grouped[job_id].append({
            "人材ID": person_id,
            "氏名": person.get("氏名", ""),
            "スコア": score,
            "理由": data.get("理由", ""),
            "推奨度": data.get("推奨度", ""),
        })

    output: dict[str, tuple[dict, list[dict]]] = {}
    for job_id, results in grouped.items():
        results.sort(key=lambda x: x["スコア"], reverse=True)
        output[job_id] = (job_map[job_id], results[:top_n])

    return output


def _format_job(job: dict) -> str:
    lines = []
    for key in ["案件名", "企業名", "職種", "勤務地", "勤務形態", "期間", "単価",
                "必須スキル", "歓迎スキル", "人数", "備考"]:
        value = job.get(key, "")
        if value:
            lines.append(f"{key}: {value}")
    return "\n".join(lines)


def _format_person(person: dict) -> str:
    lines = []
    for key in ["氏名", "年齢", "経験年数", "スキル", "希望職種", "希望勤務地",
                "希望単価", "稼働可能日", "備考"]:
        value = person.get(key, "")
        if value:
            lines.append(f"{key}: {value}")
    return "\n".join(lines)
