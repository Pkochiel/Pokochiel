"""AIによる案件・人材マッチング（Claude API使用）"""

import json
import anthropic
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
