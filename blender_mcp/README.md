# Blender MCP 連携

[Blender Lab の公式 MCP サーバー](https://www.blender.org/lab/mcp-server/) を使って、Claude Code から起動中の Blender を操作するための設定です。

構成は 2 つに分かれています。

| 部品 | 役割 | 置き場所 |
| --- | --- | --- |
| Blender アドオン (拡張機能) | Blender 内でブリッジサーバーを起動し、MCP サーバーからの命令を受け付ける | Blender 本体 |
| MCP サーバー (`blender-mcp`) | Claude Code が起動する。アドオンに接続して命令を中継する | `blender_mcp/server/` (このリポジトリ外でも可) |

> Blender とアドオンは **Blender を操作したい PC 上** で動かす必要があります。
> Claude Code もその PC (ローカル) で動かしてください。クラウドの Claude Code セッションからは手元の Blender に接続できません。

## 必要なもの

- Blender **5.1 以降**
- git
- [uv](https://docs.astral.sh/uv/) (公式インストーラーで導入。pip でのインストールは非推奨)
- Claude Code

## 手順

### 1. Blender にアドオンを入れる

1. https://www.blender.org/lab/mcp-server/ からアドオン (拡張機能) を入手します。
   ページ上のリンクを Blender のウィンドウにドラッグ&ドロップするか、
   `Edit > Preferences > Add-ons > Install from Disk...` でダウンロードした zip を指定します。
2. アドオンの設定画面でホスト / ポート (既定は `127.0.0.1:9876`) を確認し、ブリッジサーバーを起動します。

### 2. MCP サーバーを取得する

リポジトリのルートで:

```sh
./blender_mcp/setup.sh
```

`https://projects.blender.org/lab/blender_mcp` を `blender_mcp/server/` に clone し、`uv sync` で依存関係を入れます。
(Windows は Git Bash / WSL で実行するか、同じ内容を手動で実行してください。)

別の場所に置きたい場合は `./blender_mcp/setup.sh /path/to/blender_mcp` とし、
Claude Code 起動前に環境変数 `BLENDER_MCP_DIR` にそのパスを設定します。

### 3. Claude Code から使う

リポジトリ直下の `.mcp.json` に `blender` サーバーを登録済みです。

```json
{
  "mcpServers": {
    "blender": {
      "command": "uv",
      "args": ["--directory", "${BLENDER_MCP_DIR:-./blender_mcp/server}", "run", "blender-mcp"]
    }
  }
}
```

1. Blender を起動し、アドオンのブリッジサーバーが動いていることを確認します。
2. このリポジトリのディレクトリで `claude` を起動し、プロジェクトの MCP サーバー `blender` の利用を承認します。
3. `/mcp` で `blender` が connected になっていれば完了です。
   例: 「シーンに立方体を追加して、赤いマテリアルを付けて」

### Claude Desktop を使う場合

`claude_desktop_config.json` の `mcpServers` に同じ内容を、`--directory` を絶対パスにして追加します。
Claude Desktop に追加済みなら `claude mcp add-from-claude-desktop` で Claude Code に取り込むこともできます (macOS / WSL)。

## 注意 (セキュリティ)

公式ドキュメントでも警告されている通り、このアドオンは **認証なしで LLM が生成した Python コードを Blender 内で実行** します。

- 重要なデータのない PC か仮想マシンで使うことを推奨します。
- ブリッジサーバーは `127.0.0.1` のままにし、外部に公開しないでください。
- 使わないときはアドオンのサーバーを停止してください。

## トラブルシューティング

- `/mcp` で failed になる: `uv` にパスが通っているか、`BLENDER_MCP_DIR` が clone 先を指しているか確認してください。
- ツール実行時に接続エラー: Blender が起動していて、アドオンのサーバーが同じホスト / ポートで待ち受けているか確認してください。
