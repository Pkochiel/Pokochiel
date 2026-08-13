# legacy

Knowledge OS 構築前からリポジトリルートに存在していたファイルの退避先。
Vault の知識体系とは無関係だが、**削除せず**ここに保管する。

| ファイル | 内容 | 備考 |
| --- | --- | --- |
| `scrape_3min_networking.py` | 「3分間ネットワーキング」全82回のスクレイパ | requests + BeautifulSoup |
| `scrape_to_pdf.py` | 同サイトの PDF 化スクリプト | reportlab 使用 |
| `3min_networking.txt` | 上記の出力先 | **中身は空**（実行環境のプロキシ制限により取得失敗） |

- 移動日: 2026-08-13（`git mv` により履歴を保持）
- 元の場所: リポジトリルート
- 再利用する場合は、実行環境のネットワーク制限を確認すること
