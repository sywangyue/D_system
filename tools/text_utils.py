"""
text_utils.py — 抓取文本的规范化

背景（2026-07-29 打标导出时发现）：
    jufair 详情页里「印度新德里」这类词被 HTML 标签从中间切开，
    BeautifulSoup 的 get_text() 在标签边界补了一个空格，于是入库成「印 度新德里」。
    全库 539 个字段值受影响（brand.city 263 · edition.city 263 · name_cn 9 · organizer 4），
    在打标 Excel 里直接暴露给人看。

规则刻意只处理「两个汉字之间的空白」—— 英文名里的空格必须保留
（如 "United States Minnesota"），中文里的则一律是抓取噪声。
"""
from __future__ import annotations

import re

_CJK_GAP = re.compile(r"(?<=[一-鿿])\s+(?=[一-鿿])")


def normalize_cjk_spaces(text: str | None) -> str:
    """删掉夹在两个汉字之间的空白，并去除首尾空白。

    >>> normalize_cjk_spaces("印 度新德里")
    '印度新德里'
    >>> normalize_cjk_spaces("中国机电产 品进出口商会 ")
    '中国机电产品进出口商会'
    >>> normalize_cjk_spaces("United States Minnesota")
    'United States Minnesota'
    >>> normalize_cjk_spaces("2024上海国际暖通空调 与舒适系统展览会")
    '2024上海国际暖通空调与舒适系统展览会'
    >>> normalize_cjk_spaces("")
    ''
    """
    if not text:
        return ""
    return _CJK_GAP.sub("", str(text)).strip()
