"""Microsoft Graph API経由でOutlookメールを自動取得"""

import re
import requests
from datetime import datetime, timedelta, timezone
from msal import ConfidentialClientApplication

GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0"
SCOPES = ["https://graph.microsoft.com/.default"]


class OutlookFetcher:
    """
    Azure ADのアプリ専用認証（Client Credentials）でOutlookメールを取得する。

    事前準備:
    - Azure portal でアプリ登録
    - API アクセス許可: Mail.Read（アプリケーション）を付与して管理者同意
    - テナント管理者の承認が必要
    """

    def __init__(self, tenant_id: str, client_id: str, client_secret: str, target_email: str):
        self.target_email = target_email
        self._app = ConfidentialClientApplication(
            client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            client_credential=client_secret,
        )

    def _get_token(self) -> str:
        result = self._app.acquire_token_silent(SCOPES, account=None)
        if not result:
            result = self._app.acquire_token_for_client(scopes=SCOPES)
        if "access_token" not in result:
            raise RuntimeError(
                f"Microsoft認証エラー: {result.get('error_description', result.get('error'))}"
            )
        return result["access_token"]

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        }

    def fetch_emails(self, since_hours: int = 25, max_count: int = 1000) -> list[dict]:
        """
        指定時間以内の受信メールを取得する。

        Args:
            since_hours: 取得する時間範囲（時間）
            max_count: 最大取得件数

        Returns:
            メールオブジェクトのリスト
        """
        since_dt = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        since_str = since_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        url = (
            f"{GRAPH_ENDPOINT}/users/{self.target_email}/messages"
            f"?$filter=receivedDateTime ge {since_str}"
            f"&$select=id,subject,body,from,receivedDateTime,isRead"
            f"&$top=999"
            f"&$orderby=receivedDateTime desc"
        )

        emails = []
        while url and len(emails) < max_count:
            resp = requests.get(url, headers=self._headers(), timeout=30)
            resp.raise_for_status()
            data = resp.json()
            emails.extend(data.get("value", []))
            url = data.get("@odata.nextLink")

        return emails[:max_count]

    def get_or_create_folder(self, folder_name: str) -> str:
        """フォルダIDを取得または作成する"""
        url = f"{GRAPH_ENDPOINT}/users/{self.target_email}/mailFolders?$top=100"
        resp = requests.get(url, headers=self._headers(), timeout=30)
        resp.raise_for_status()
        folders = resp.json().get("value", [])

        for folder in folders:
            if folder["displayName"] == folder_name:
                return folder["id"]

        # 存在しなければ作成
        create_url = f"{GRAPH_ENDPOINT}/users/{self.target_email}/mailFolders"
        resp = requests.post(
            create_url,
            headers=self._headers(),
            json={"displayName": folder_name},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def move_to_folder(self, email_id: str, folder_name: str) -> bool:
        """メールを指定フォルダに移動する（処理済みマーク用）"""
        try:
            folder_id = self.get_or_create_folder(folder_name)
            move_url = f"{GRAPH_ENDPOINT}/users/{self.target_email}/messages/{email_id}/move"
            resp = requests.post(
                move_url,
                headers=self._headers(),
                json={"destinationId": folder_id},
                timeout=30,
            )
            resp.raise_for_status()
            return True
        except Exception:
            return False


def extract_plain_text(email: dict) -> str:
    """メールオブジェクトから平文本文を取得する"""
    body = email.get("body", {})
    content = body.get("content", "")
    if body.get("contentType", "").lower() == "html":
        # HTMLタグを除去して平文化
        content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL)
        content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
        content = re.sub(r"<[^>]+>", " ", content)
        content = re.sub(r"&nbsp;", " ", content)
        content = re.sub(r"&[a-z]+;", "", content)
        content = re.sub(r"\s{3,}", "\n", content).strip()
    return content
