#!/usr/bin/env python3
"""予定アプリのアイコンを生成するスクリプト。
HTMLのデザイン（オレンジのアクセント + チェックリスト）に合わせている。
依存: Pillow。 実行: python3 make_icons.py
"""
from PIL import Image, ImageDraw
import os

ACCENT = (212, 98, 42)      # --accent
PAPER = (245, 243, 238)     # --paper
INK = (26, 29, 41)          # --ink
DONE = (168, 196, 162)      # --done

SS = 4  # スーパーサンプリング倍率（アンチエイリアス用）
OUT = os.path.join(os.path.dirname(__file__), "icons")


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def render(size, maskable=False):
    """1枚のアイコンを描画して返す。"""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 背景（フルブリード）。maskable はセーフゾーンを意識して中央に寄せる。
    d.rounded_rectangle([0, 0, s, s], radius=int(s * 0.22), fill=ACCENT)

    # コンテンツ領域
    pad = s * (0.26 if maskable else 0.20)
    left = pad
    top = pad
    width = s - pad * 2
    rows = 3
    gap = width * 0.10
    row_h = (width - gap * (rows - 1)) * 0.42
    # 行間を縦に配置
    total_h = row_h * rows + gap * (rows - 1)
    start_y = (s - total_h) / 2

    circle_d = row_h
    for i in range(rows):
        y = start_y + i * (row_h + gap)
        # チェック丸
        cx0, cy0 = left, y
        cx1, cy1 = left + circle_d, y + circle_d
        if i == 0:
            # 完了済み（塗り + チェック）
            d.ellipse([cx0, cy0, cx1, cy1], fill=DONE)
            cw = circle_d * 0.13
            d.line(
                [
                    (cx0 + circle_d * 0.26, cy0 + circle_d * 0.52),
                    (cx0 + circle_d * 0.44, cy0 + circle_d * 0.70),
                    (cx0 + circle_d * 0.76, cy0 + circle_d * 0.32),
                ],
                fill=(255, 255, 255), width=int(cw), joint="curve",
            )
        else:
            d.ellipse(
                [cx0, cy0, cx1, cy1], outline=(255, 255, 255),
                width=int(circle_d * 0.11),
            )

        # タスクの帯
        bx0 = left + circle_d + gap
        bx1 = left + width
        if i == rows - 1:
            bx1 = left + width * 0.72  # 最後は少し短く
        bar_h = row_h * 0.62
        by0 = y + (circle_d - bar_h) / 2
        by1 = by0 + bar_h
        col = (255, 255, 255) if i != 0 else (255, 255, 255, 150)
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=bar_h / 2, fill=col)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    specs = [
        ("icon-180.png", 180, False),   # apple-touch-icon
        ("icon-192.png", 192, False),   # manifest
        ("icon-512.png", 512, False),   # manifest
        ("icon-512-maskable.png", 512, True),
        ("icon-1024.png", 1024, False),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in specs:
        render(size, maskable).save(os.path.join(OUT, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
