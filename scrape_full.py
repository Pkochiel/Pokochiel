#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
3分間ネットワーキング スクレイパー
https://www5e.biglobe.ne.jp/aji/3min/

このスクリプトは以下を行います:
1. インデックスページから全回のURLを取得
2. 各ページのテキストを抽出（1秒インターバル付き）
3. 構造化Markdownファイル (3min_net.md) を生成
4. PDFに変換

注意: このスクリプトは制限のないインターネット環境で実行してください。
"""

import requests
from bs4 import BeautifulSoup
import time
import re
import sys
import os

BASE_URL = "https://www5e.biglobe.ne.jp/aji/3min/"
OUTPUT_MD = "3min_net.md"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def fetch_page(url, retries=3):
    """ページを取得して BeautifulSoup オブジェクトを返す"""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            # Shift-JIS など古い文字コードに対応
            resp.encoding = resp.apparent_encoding
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "html.parser")
            else:
                print(f"  HTTP {resp.status_code}: {url}")
                return None
        except Exception as e:
            print(f"  試行 {attempt+1}/{retries} 失敗: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return None


def get_lecture_urls(index_url):
    """
    インデックスページを解析して講座URLを収集する。
    古いHTMLでフレームやテーブルレイアウトの可能性あり。
    """
    soup = fetch_page(index_url)
    if soup is None:
        print("インデックスページの取得に失敗しました")
        return []

    urls = []
    seen = set()

    # <a href="..."> を全て取得
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # 相対URLを絶対URLに変換
        if href.startswith("http"):
            full_url = href
        elif href.startswith("/"):
            full_url = "https://www5e.biglobe.ne.jp" + href
        else:
            full_url = index_url.rstrip("/") + "/" + href

        # 3min/ 以下のHTMLファイルのみ対象
        if "/3min/" in full_url and (full_url.endswith(".htm") or full_url.endswith(".html")) and full_url not in seen:
            # メインページ (数字.html) だけでなくex/やss/も含める
            seen.add(full_url)
            urls.append((a.get_text(strip=True), full_url))

    print(f"インデックスから {len(urls)} 件のURLを取得")
    return urls


def extract_text_from_page(soup):
    """
    ページから本文テキストを抽出する。
    古いHTML（フレーム・テーブルレイアウト）に対応。
    """
    if soup is None:
        return ""

    # フレームセットの場合はフレームのsrcを取得（別途処理が必要）
    if soup.find("frameset"):
        frames = soup.find_all("frame", src=True)
        return f"[フレームセット: {', '.join(f['src'] for f in frames)}]"

    # scriptとstyleを除去
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()

    # bodyタグ内のテキストを取得
    body = soup.find("body") or soup
    text = body.get_text(separator="\n", strip=True)

    # 連続する空行を1行に整理
    lines = [line.strip() for line in text.splitlines()]
    cleaned = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False

    return "\n".join(cleaned)


def scrape_lecture(number, url):
    """
    1回分の講座ページをスクレイプし辞書を返す。
    """
    print(f"取得中: {number} ({url})")
    soup = fetch_page(url)
    if soup is None:
        return {
            "number": number,
            "url": url,
            "title": f"第{number}回",
            "text": "（ページ取得失敗）",
        }

    # タイトル取得
    title_tag = soup.find("title") or soup.find("h1") or soup.find("h2")
    title = title_tag.get_text(strip=True) if title_tag else f"第{number}回"

    text = extract_text_from_page(soup)
    return {"number": number, "url": url, "title": title, "text": text}


def build_markdown(lectures):
    """
    講座リストからMarkdownを生成する。
    """
    md_lines = [
        "# 3分間ネットワーキング",
        "",
        "> **出典:** https://www5e.biglobe.ne.jp/aji/3min/  ",
        "> 著者: あじ (網野衛二) — 「誰にでもよくわかるネットワーク講座」",
        "",
        "---",
        "",
        "## 目次",
        "",
    ]

    # 目次
    for lec in lectures:
        anchor = re.sub(r"[^\w\-]", "-", lec["title"].lower())
        md_lines.append(f"- [{lec['title']}](#{anchor})")

    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

    # 各回の本文
    for lec in lectures:
        md_lines.append(f"## {lec['title']}")
        md_lines.append("")
        md_lines.append(f"**URL:** {lec['url']}")
        md_lines.append("")
        md_lines.append(lec["text"])
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")

    return "\n".join(md_lines)


def main():
    print("=== 3分間ネットワーキング スクレイパー ===")
    print(f"対象: {BASE_URL}")
    print()

    # 1. URLリスト取得
    lecture_links = get_lecture_urls(BASE_URL)

    if not lecture_links:
        # フォールバック: 既知のURL形式で直接生成
        print("フォールバック: 既知のURL形式を使用")
        lecture_links = []
        # メインページ (0.html, 01.html - 81.html)
        lecture_links.append(("第0回", f"{BASE_URL}0.htm"))
        for i in range(1, 82):
            lecture_links.append((f"第{i}回", f"{BASE_URL}{i:02d}.htm"))

    # 2. 各ページをスクレイプ
    lectures = []
    for i, (label, url) in enumerate(lecture_links):
        result = scrape_lecture(label, url)
        lectures.append(result)

        # 最後のページ以外はインターバル
        if i < len(lecture_links) - 1:
            time.sleep(1.2)  # 1秒以上のインターバル

    # 3. Markdown生成・保存
    print(f"\nMarkdown生成中...")
    md_content = build_markdown(lectures)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"保存完了: {OUTPUT_MD}")

    return OUTPUT_MD


if __name__ == "__main__":
    main()
