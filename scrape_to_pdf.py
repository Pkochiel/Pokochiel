import requests
from bs4 import BeautifulSoup
import time
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.pagesizes import A4

# 日本語フォント登録
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))

BASE_URL = "https://www5e.biglobe.ne.jp/aji/3min/{:02d}.html"
OUTPUT_PDF = "3min_networking.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 40
FONT_NAME = "HeiseiMin-W3"
TITLE_SIZE = 16
BODY_SIZE = 11
LINE_HEIGHT_TITLE = 24
LINE_HEIGHT_BODY = 16


def fetch_text(url):
    response = requests.get(url, timeout=15)
    response.encoding = response.apparent_encoding
    soup = BeautifulSoup(response.text, "html.parser")
    return soup.get_text(separator='\n', strip=True)


def draw_page_content(c, title, lines):
    """1回分のコンテンツをPDFに描画。複数ページにまたがる場合は自動改ページ。"""
    x = MARGIN
    y = PAGE_HEIGHT - MARGIN

    # タイトル
    c.setFont(FONT_NAME, TITLE_SIZE)
    c.drawString(x, y, title)
    y -= LINE_HEIGHT_TITLE
    c.line(x, y + 4, PAGE_WIDTH - MARGIN, y + 4)
    y -= 10

    # 本文
    c.setFont(FONT_NAME, BODY_SIZE)
    for line in lines:
        # 長い行は折り返す
        max_chars = int((PAGE_WIDTH - 2 * MARGIN) / (BODY_SIZE * 0.6))
        while len(line) > max_chars:
            c.drawString(x, y, line[:max_chars])
            line = line[max_chars:]
            y -= LINE_HEIGHT_BODY
            if y < MARGIN:
                c.showPage()
                c.setFont(FONT_NAME, BODY_SIZE)
                y = PAGE_HEIGHT - MARGIN
        c.drawString(x, y, line)
        y -= LINE_HEIGHT_BODY
        if y < MARGIN:
            c.showPage()
            c.setFont(FONT_NAME, BODY_SIZE)
            y = PAGE_HEIGHT - MARGIN

    return y


def main():
    c = canvas.Canvas(OUTPUT_PDF, pagesize=A4)

    for i in range(82):
        url = BASE_URL.format(i)
        print(f"取得中: 第{i}回 ({url})")
        try:
            text = fetch_text(url)
            lines = [l for l in text.split('\n') if l.strip()]
        except Exception as e:
            print(f"  エラー: {e}")
            lines = [f"取得失敗: {e}"]

        title = f"第{i}回"
        draw_page_content(c, title, lines)
        c.showPage()  # 各回を新ページ開始

        if i < 81:
            time.sleep(1)

    c.save()
    print(f"\n完了: {OUTPUT_PDF} を出力しました")


if __name__ == "__main__":
    main()
