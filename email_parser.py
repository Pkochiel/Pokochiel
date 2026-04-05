"""Outlookメール本文から案件情報を自動抽出（Claude API使用）"""

import json
import anthropic

EXTRACTION_SYSTEM = """あなたは人材派遣会社の業務効率化アシスタントです。
他社から送られてきたOutlookメールの本文から、案件情報を正確に抽出してください。

抽出する項目:
- 企業名: 依頼元企業名
- 案件名: プロジェクト名や案件のタイトル
- 職種: エンジニア、デザイナー、PMなど
- 勤務地: 都市名や住所（リモート可の場合はその旨も）
- 勤務形態: 常駐、リモート、ハイブリッドなど
- 期間: 契約期間（開始〜終了日、または期間）
- 単価: 月額・日額など（記載がなければ空欄）
- 必須スキル: 必ず持っていないといけないスキル・経験
- 歓迎スキル: あれば望ましいスキル・経験
- 人数: 募集人数
- 備考: その他の特記事項

情報が読み取れない項目は空文字列にしてください。
推測で補完せず、メール本文に書かれている内容のみを使用してください。"""


def parse_job_email(email_body: str, client: anthropic.Anthropic) -> dict:
    """
    Outlookメール本文から案件情報を抽出する。

    Args:
        email_body: メール本文テキスト
        client: Anthropic クライアント

    Returns:
        案件情報の辞書。抽出失敗時は空の辞書。
    """
    from pydantic import BaseModel
    from typing import Optional

    class JobOrder(BaseModel):
        企業名: str = ""
        案件名: str = ""
        職種: str = ""
        勤務地: str = ""
        勤務形態: str = ""
        期間: str = ""
        単価: str = ""
        必須スキル: str = ""
        歓迎スキル: str = ""
        人数: str = ""
        備考: str = ""

    response = client.messages.parse(
        model="claude-opus-4-6",
        max_tokens=2048,
        thinking={"type": "adaptive"},
        system=EXTRACTION_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"以下のメール本文から案件情報を抽出してください:\n\n{email_body}",
            }
        ],
        output_format=JobOrder,
    )

    if response.parsed_output:
        return response.parsed_output.model_dump()
    return {}
