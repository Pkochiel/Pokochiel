#!/usr/bin/env bash
# 公式 Blender Lab MCP サーバー (https://www.blender.org/lab/mcp-server/) を取得して依存関係を準備する。
# 使い方: ./blender_mcp/setup.sh [取得先ディレクトリ]
set -euo pipefail

DEST="${1:-$(dirname "$0")/server}"
REPO_URL="https://projects.blender.org/lab/blender_mcp.git"

command -v git >/dev/null || { echo "git が必要です" >&2; exit 1; }
command -v uv >/dev/null || {
  echo "uv が必要です。公式インストーラーで入れてください (pip は非推奨):" >&2
  echo "  macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  echo "  Windows:     powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\"" >&2
  exit 1
}

if [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull --ff-only
else
  git clone "$REPO_URL" "$DEST"
fi

uv --directory "$DEST" sync

echo
echo "MCP サーバーの準備ができました: $DEST"
echo "このディレクトリ以外に置いた場合は BLENDER_MCP_DIR=$DEST を設定してから claude を起動してください。"
