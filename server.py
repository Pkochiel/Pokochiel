#!/usr/bin/env python3
"""
人材派遣マッチング AIエージェント - Web サーバー

起動方法:
  uvicorn server:app --reload --host 0.0.0.0 --port 8000

ブラウザで http://localhost:8000 を開いてください。
"""

import asyncio
import json
import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from anthropic import AsyncAnthropic, Anthropic

from sheets_manager import SheetsManager
from agent import SYSTEM_PROMPT, TOOLS, handle_tool

# ── 起動時の初期化 ────────────────────────────────────────────────────────

load_dotenv()

_REQUIRED = ["ANTHROPIC_API_KEY", "GOOGLE_SHEETS_ID"]
_missing = [v for v in _REQUIRED if not os.environ.get(v)]
if _missing:
    print(f"エラー: 環境変数が未設定です: {', '.join(_missing)}", file=sys.stderr)
    sys.exit(1)

_sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
if not os.path.exists(_sa_file):
    print(f"エラー: サービスアカウントファイルが見つかりません: {_sa_file}", file=sys.stderr)
    sys.exit(1)

# 同期クライアント（ツール実行スレッド用）
_sync_claude = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
# 非同期クライアント（ストリーミング用）
_async_claude = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
# スプレッドシート（全接続で共有）
_sheets = SheetsManager(
    spreadsheet_id=os.environ["GOOGLE_SHEETS_ID"],
    service_account_file=_sa_file,
)

# ── FastAPI アプリ ─────────────────────────────────────────────────────────

app = FastAPI(title="人材派遣マッチングエージェント")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


# ── WebSocket エンドポイント ───────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # 接続ごとに会話履歴を保持
    messages: list[dict] = []
    loop = asyncio.get_event_loop()

    async def send(data: dict):
        await websocket.send_text(json.dumps(data, ensure_ascii=False))

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            user_text = payload.get("message", "").strip()
            if not user_text:
                continue

            messages.append({"role": "user", "content": user_text})

            # ── アジェンティックループ ────────────────────────────────────
            while True:
                await send({"type": "agent_start"})

                # Claude にストリーミングで問い合わせ
                async with _async_claude.messages.stream(
                    model="claude-opus-4-6",
                    max_tokens=4096,
                    thinking={"type": "adaptive"},
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages,
                ) as stream:
                    async for event in stream:
                        # テキストのみリアルタイム送信（思考ブロックは除外）
                        if (
                            event.type == "content_block_delta"
                            and hasattr(event.delta, "type")
                            and event.delta.type == "text_delta"
                        ):
                            await send({"type": "text", "content": event.delta.text})

                    response = await stream.get_final_message()

                messages.append({"role": "assistant", "content": response.content})

                # ツール呼び出しがなければユーザー入力待ちに戻る
                if response.stop_reason != "tool_use":
                    await send({"type": "done"})
                    break

                # ── ツールを実行 ──────────────────────────────────────────
                tool_results = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue

                    await send({
                        "type": "tool_start",
                        "name": block.name,
                        "input": block.input,
                    })

                    # ブロッキング処理をスレッドプールで実行（イベントループを止めない）
                    result = await loop.run_in_executor(
                        None,
                        handle_tool,
                        block.name,
                        block.input,
                        _sheets,
                        _sync_claude,
                    )

                    await send({"type": "tool_end", "name": block.name})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

                messages.append({"role": "user", "content": tool_results})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await send({"type": "error", "content": f"エラーが発生しました: {e}"})
        except Exception:
            pass
