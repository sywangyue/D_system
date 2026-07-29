"""
url_utils.py — source_url 规范化

背景（AUDIT 追加发现）：
    jufair 于 2026-07 改版，详情页 URL 从 /exhibition/{id}.html 变为 /exhibition/{id}/；
    cnexpo 同时存在 /event/{id}.html 与 /event/{id} 两种写法。
    而 raw_jufair.source_url 是 UNIQUE 键、data_provenance 有 UNIQUE(brand_id, source_url)，
    两种写法会被当成两个不同展会分别收录 —— 实测已产生 161 组 jufair 重复。
    继续采集只会持续恶化，故所有写入路径统一规范化。

规则刻意保持通用：去掉结尾的 `.html` 与结尾的 `/`。
这样数字型（/exhibition/6261）与 slug 型（/exhibition/aag）、两个站点都能统一，
不需要为每种形态单独写规则。
"""
from __future__ import annotations

import re

_TRAILING = re.compile(r"(?:\.html?)?/*$", re.IGNORECASE)


def canonical_source_url(url: str | None) -> str:
    """把同一页面的不同 URL 写法归一。

    >>> canonical_source_url("https://www.jufair.com/exhibition/6261.html")
    'https://www.jufair.com/exhibition/6261'
    >>> canonical_source_url("https://www.jufair.com/exhibition/6261/")
    'https://www.jufair.com/exhibition/6261'
    >>> canonical_source_url("https://www.jufair.com/exhibition/aag/")
    'https://www.jufair.com/exhibition/aag'
    >>> canonical_source_url("https://www.cnexpo.com/event/123.html")
    'https://www.cnexpo.com/event/123'
    >>> canonical_source_url("")
    ''
    """
    if not url:
        return ""
    s = str(url).strip()
    if not s:
        return ""
    # 只处理路径尾部，查询串/锚点原样保留（当前数据里没有，但不该因此出错）
    head, sep, tail = s.partition("?")
    head = _TRAILING.sub("", head)
    return head + sep + tail
