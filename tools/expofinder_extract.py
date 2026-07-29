"""展查查详情页提取器 —— RSC 结构化 + DOM 解锁字段 两路合并。

为什么两路：
  展会名/日期/场馆/展区/产品标签/关联展会 都在 SSR 的 RSC payload 里，
  解析出来是干净 JSON。但真实展商数/观众数/面积/官网 URL/参展商名单 不在 SSR 里 ——
  它们是登录后前端再拉的，只存在于 hydration 后的 DOM。
  所以脆弱面只压在这几个字段上，其余走 RSC。

DOM 锚点用 `data-lingxi-preview-fields` / `data-expo-*` 这类语义属性，
不用 CSS module 类名（`...__dQ4SdW__xxx` 中间是构建 hash，发版就变）。

合规：robots.txt 明确 Disallow /exhibitor/ —— 参展商的名称和 id 从展会页读，
不去抓 /exhibitor/{id} 详情页。
"""
from __future__ import annotations

import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rsc_flight import parse_detail as parse_rsc  # noqa: E402


def _preview_block(soup, field):
    """按 data-lingxi-preview-fields 找语义块（属性值可能是空格分隔的多个字段名）。"""
    for node in soup.select("[data-lingxi-preview-fields]"):
        if field in (node.get("data-lingxi-preview-fields") or "").split():
            return node
    return None


def extract_unlocked(html: str) -> dict:
    """只从渲染后 DOM 取「登录才可见」的字段。"""
    soup = BeautifulSoup(html, "html.parser")
    out = {"official_website": None, "stats": {}, "exhibitors": []}

    blk = _preview_block(soup, "officialWebsite")
    if blk:
        a = blk.find("a", href=True)
        if a:
            out["official_website"] = a["href"].strip()

    blk = _preview_block(soup, "statisticsInfoList")
    if blk:
        # 每项形如 <div><div><span>438</span></div><p>参展商(家)</p></div>
        for p in blk.find_all("p"):
            item = p.parent
            span = item.find("span")
            if span:
                out["stats"][p.get_text(strip=True)] = span.get_text(strip=True)

    seen = set()
    for a in soup.select('a[href^="/exhibitor/"]'):
        name = (a.get("aria-label") or a.get_text(" ", strip=True) or "").strip()
        pid = a["href"].rsplit("/", 1)[-1]
        if name and pid not in seen:
            seen.add(pid)
            out["exhibitors"].append({"public_id": pid, "name": name})
    return out


def extract(html: str) -> dict:
    vm = parse_rsc(html)
    h = vm.get("header") or {}
    tri = (h.get("timeRangeInfo") or [{}])[0]
    rec = {
        "public_id": h.get("publicId"),
        "name_cn": h.get("name"),
        "name_en": h.get("englishName"),
        "summary": h.get("editionSummary"),
        "date_start": h.get("startDate"),
        "date_end": h.get("endDate"),
        "location": h.get("location"),
        "organizer": h.get("organizerName"),
        "tags": h.get("tags") or [],
        "logo_url": h.get("logo"),
        "hero_url": h.get("heroImage"),
        "daily_time_ranges": tri.get("dailyTimeRanges") or [],
        "zones": [{"label": i.get("label"), "tags": i.get("tags") or []}
                  for i in (vm.get("productCategories") or {}).get("items") or []],
        "related": [{k: r.get(k) for k in
                     ("publicId", "name", "city", "country", "startDate", "endDate")}
                    for r in (vm.get("relatedExhibitions") or [])],
        "series": [{"public_id": s.get("publicId"), "title": s.get("title"),
                    "date": s.get("date"), "location": s.get("location")}
                   for s in (vm.get("series") or {}).get("items") or []],
        "photos": [p.get("imageUrl") for p in (vm.get("pastReview") or {}).get("items") or []],
    }
    booth = vm.get("boothPricing") or {}
    rec["booth_pricing"] = {"has_data": bool(booth.get("hasData")),
                            "items": booth.get("items") or [],
                            "rows": booth.get("rows") or [],
                            "floor_plan": booth.get("floorPlanImage") or ""}
    rec.update(extract_unlocked(html))
    return rec
