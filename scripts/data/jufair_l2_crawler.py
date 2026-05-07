"""
jufair_l2_crawler.py — CLEAN-JUFAIR-L2 二级分类爬虫

功能：爬取 jufair.com 首页 18 个一级分类及二级子分类，
      输出 JSON 供 clean_brands.py jufair-l2 --import 使用。

适用环境：
  - --export: 需在大陆 IP（Mac Mini）运行，因 jufair.com 有地理封锁
  - --import: 在本机（开发机）运行，解析导出的 JSON 并模糊匹配到 exhibition_brand

输出 JSON 格式：
{
    "parent_categories": [
        {"name": "...", "url": "/exhibition-...", "parent_id": "..."}
    ],
    "subcategories": [
        {"name": "...", "sub_id": "...", "parent_id": "..."}
    ],
    "crawled_at": "2026-05-07T12:00:00Z"
}

依赖: requests, BeautifulSoup4（已安装在项目环境）
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

# ─── 配置 ──────────────────────────────────────────────────────────────────────

JUFAIR_BASE = "https://www.jufair.com"

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.jufair.com/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
}

MAX_RETRIES = 3
REQUEST_DELAY = 1.0  # seconds between requests

# jufair.com 首页暂未确认完整的 18 个一级分类。
# 此处留空，运行时通过 crawl_parent_categories() 动态获取；
# HARDCODED_PARENTS 作为爬取失败的回退兜底值。
HARDCODED_PARENTS: list[dict[str, str]] = []


# ─── HTTP 请求 ─────────────────────────────────────────────────────────────────

def _fetch(url: str, label: str = "") -> str | None:
    """HTTP GET + 自动重试。

    与 crawlers/jufair_crawler.py 一致的 3 次重试 + 请求间隔模式。
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=25)
            if resp.status_code == 200:
                return resp.text
            log.warning(
                "[%s] HTTP %s (attempt %d/%d)",
                label or url, resp.status_code, attempt, MAX_RETRIES,
            )
        except requests.RequestException as e:
            log.warning(
                "[%s] Exception: %s (attempt %d/%d)",
                label or url, e, attempt, MAX_RETRIES,
            )
        if attempt < MAX_RETRIES:
            time.sleep(REQUEST_DELAY * attempt)
    return None


# ─── 一级分类爬取 ──────────────────────────────────────────────────────────────

def crawl_parent_categories() -> list[dict[str, str]]:
    """从 jufair.com 首页提取一级分类。

    从首页 DOM 中查找分类导航链接，提取分类名称和 URL。

    Returns:
        list of {"name": str, "url": str, "parent_id": str}
        parent_id 从 URL 模式 /exhibition-{parentId}-... 中提取
    """
    html = _fetch(JUFAIR_BASE, label="jufair首页")
    if not html:
        log.warning("首页爬取失败，回退到 HARDCODED_PARENTS")
        if HARDCODED_PARENTS:
            return list(HARDCODED_PARENTS)
        return []

    soup = BeautifulSoup(html, "html.parser")
    parents: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    # Strategy 1: 查找分类导航区域的 <a> 标签
    # jufair 的分类导航可能在 nav, .nav, .category-menu, 或 header 中
    for a in soup.select("nav a[href*='/exhibition-'], .nav a[href*='/exhibition-'], "
                         "a[href*='/exhibition-'], .category-menu a"):
        href = a.get("href", "")
        name = a.get_text(strip=True)
        if not href or not name:
            continue
        full_url = JUFAIR_BASE + href if href.startswith("/") else href
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        # 从 URL 提取 parent_id: /exhibition-{parentId}-0-...
        pid_match = re.search(r'/exhibition-(\d+)', href)
        parent_id = pid_match.group(1) if pid_match else "0"

        parents.append({
            "name": name,
            "url": full_url,
            "parent_id": parent_id,
        })

    if parents:
        log.info("从首页提取到 %d 个一级分类", len(parents))
        return parents

    # Strategy 2: 从页面中查找分类下拉菜单
    for select in soup.select("select.category-select, select[name*='category']"):
        for option in select.select("option[value*='/exhibition-']"):
            href = option.get("value", "")
            name = option.get_text(strip=True)
            if not href or not name:
                continue
            full_url = JUFAIR_BASE + href if href.startswith("/") else href
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)
            pid_match = re.search(r'/exhibition-(\d+)', href)
            parent_id = pid_match.group(1) if pid_match else "0"
            parents.append({
                "name": name,
                "url": full_url,
                "parent_id": parent_id,
            })

    if parents:
        log.info("从下拉菜单提取到 %d 个一级分类", len(parents))
        return parents

    log.warning("未从首页提取到任何一级分类")
    if HARDCODED_PARENTS:
        return list(HARDCODED_PARENTS)
    return []


# ─── 二级分类爬取 ──────────────────────────────────────────────────────────────

def crawl_subcategories(parent_url: str, parent_id: str) -> list[dict[str, str]]:
    """爬取指定一级分类下的二级分类。

    URL 模式: /exhibition-{parentId}-{subId}-0-0-0-0-1/
    页面上的子分类列表通常以 <a> 或 <option> 形式呈现。

    Args:
        parent_url: 一级分类页面的完整 URL
        parent_id: 一级分类的 ID（用于结果标记）

    Returns:
        list of {"name": str, "sub_id": str, "parent_id": str}
    """
    html = _fetch(parent_url, label=f"parent_{parent_id}")
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    subcategories: list[dict[str, str]] = []
    seen_sub_ids: set[str] = set()

    # Strategy 1: 查找子分类链接
    # 子分类 URL 模式: /exhibition-{parentId}-{subId}-...
    for a in soup.select("a[href*='/exhibition-']"):
        href = a.get("href", "")
        name = a.get_text(strip=True)
        if not href or not name:
            continue
        # 匹配 /exhibition-{parentId}-{subId} 模式
        m = re.search(r'/exhibition-' + re.escape(parent_id) + r'-(\d+)', href)
        if not m:
            continue
        sub_id = m.group(1)
        if sub_id in seen_sub_ids:
            continue
        seen_sub_ids.add(sub_id)
        subcategories.append({
            "name": name,
            "sub_id": sub_id,
            "parent_id": parent_id,
        })

    if subcategories:
        log.info("  父分类 %s: 提取到 %d 个子分类", parent_id, len(subcategories))
        return subcategories

    # Strategy 2: 查找 <option> 下拉选择
    for option in soup.select("select option[value*='/exhibition-']"):
        href = option.get("value", "")
        name = option.get_text(strip=True)
        if not href or not name:
            continue
        m = re.search(r'/exhibition-' + re.escape(parent_id) + r'-(\d+)', href)
        if not m:
            continue
        sub_id = m.group(1)
        if sub_id in seen_sub_ids:
            continue
        seen_sub_ids.add(sub_id)
        subcategories.append({
            "name": name,
            "sub_id": sub_id,
            "parent_id": parent_id,
        })

    log.info(
        "  父分类 %s: 提取到 %d 个（下拉菜单）子分类",
        parent_id, len(subcategories),
    )
    return subcategories


# ─── 全量爬取 ──────────────────────────────────────────────────────────────────

def crawl_jufair_categories() -> dict[str, Any]:
    """全量爬取 jufair.com 分类体系。

    Returns:
        {
            "parent_categories": [...],
            "subcategories": [...],
            "crawled_at": "ISO datetime"
        }
    """
    parents = crawl_parent_categories()
    log.info("一级分类: %d 个", len(parents))

    all_subcategories: list[dict[str, str]] = []
    for p in parents:
        subs = crawl_subcategories(p["url"], p["parent_id"])
        all_subcategories.extend(subs)
        time.sleep(REQUEST_DELAY)  # polite delay between parent requests

    result: dict[str, Any] = {
        "parent_categories": parents,
        "subcategories": all_subcategories,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
    }
    log.info("共爬取: %d 个一级分类, %d 个二级分类", len(parents), len(all_subcategories))
    return result


# ─── 文件 I/O ──────────────────────────────────────────────────────────────────

def export_categories(data: dict[str, Any], filepath: str) -> None:
    """将分类数据写入 JSON 文件。"""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info("已导出 %d 个父分类 + %d 个子分类 → %s",
             len(data.get("parent_categories", [])),
             len(data.get("subcategories", [])),
             filepath)


def load_categories(filepath: str) -> dict[str, Any]:
    """从 JSON 文件读取分类数据。

    Raises:
        FileNotFoundError: 文件不存在
        json.JSONDecodeError: JSON 格式错误
    """
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    log.info("已加载 %d 个父分类 + %d 个子分类 ← %s",
             len(data.get("parent_categories", [])),
             len(data.get("subcategories", [])),
             filepath)
    return data
