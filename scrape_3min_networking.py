import requests
from bs4 import BeautifulSoup
import time

# 3分間ネットワーキングの第0回〜第81回までを取得
base_url = "https://www5e.biglobe.ne.jp/aji/3min/{:02d}.html"

with open("3min_networking.txt", "w", encoding="utf-8") as f:
    for i in range(82):
        url = base_url.format(i)
        try:
            response = requests.get(url)
            # 古いサイト特有の文字化け（Shift-JISなど）を防止
            response.encoding = response.apparent_encoding

            soup = BeautifulSoup(response.text, "html.parser")

            # 本文テキストを抽出
            text = soup.get_text(separator='\n', strip=True)
            f.write(f"\n\n=== 第{i}回 ===\n\n")
            f.write(text)

            print(f"第{i}回を取得しました")
            time.sleep(1)  # サーバーへの負荷軽減のためのインターバル
        except Exception as e:
            print(f"第{i}回でエラーが発生しました: {e}")

print("全ページのテキスト化が完了しました！")
