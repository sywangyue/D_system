#!/usr/bin/env python3
"""
research.py — Exhibition Competitive Research CLI
=================================================
一次性调研工具：输入展会名或行业关键词，输出竞争盘面摘要。

用法：
  python research.py --exhibition "上海劳保展"
  python research.py --industry "新能源"
  python research.py --list-industries
  python research.py --exhibition-id EXPO-0042

输出格式：纯文本，适合终端 / 企业微信展示。
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "mwlab.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ═══════════════════════════════════════════════════════════════
# 搜索
# ═══════════════════════════════════════════════════════════════

def search_exhibition(conn, name: str) -> list:
    """模糊搜索展会品牌。"""
    like = f"%{name}%"
    return conn.execute("""
        SELECT brand_id, name_cn, name_en, organizer, industry_l1, industry_l2,
               competition_relation, mds_related, strategic_relevance, competitor_group
        FROM exhibition_brand
        WHERE name_cn LIKE ? OR name_en LIKE ?
        ORDER BY
            CASE WHEN name_cn = ? THEN 0 ELSE 1 END,
            strategic_relevance DESC
        LIMIT 20
    """, (like, like, name)).fetchall()


def search_industry(conn, keyword: str) -> list:
    """按行业关键词搜索。"""
    like = f"%{keyword}%"
    return conn.execute("""
        SELECT brand_id, name_cn, organizer, industry_l1, industry_l2,
               competition_relation, strategic_relevance
        FROM exhibition_brand
        WHERE industry_l1 LIKE ? OR industry_l2 LIKE ?
           OR name_cn LIKE ?
        ORDER BY strategic_relevance DESC, industry_l1
        LIMIT 50
    """, (like, like, like)).fetchall()


def get_editions(conn, brand_id: str) -> list:
    """获取某品牌的所有届次数据。"""
    return conn.execute("""
        SELECT year, date_start, date_end, city, venue,
               area_sqm, exhibitors_count, visitors_count,
               data_source, status
        FROM exhibition_edition
        WHERE brand_id = ?
        ORDER BY year DESC
        LIMIT 10
    """, (brand_id,)).fetchall()


def get_brand_detail(conn, brand_id: str):
    """获取单个品牌详情。"""
    return conn.execute("""
        SELECT * FROM exhibition_brand WHERE brand_id = ?
    """, (brand_id,)).fetchone()


def list_industries(conn) -> list:
    """列出所有行业大类及品牌数。"""
    return conn.execute("""
        SELECT industry_l1, COUNT(*) as cnt,
               SUM(CASE WHEN competition_relation = '是' THEN 1 ELSE 0 END) as competitors,
               SUM(CASE WHEN mds_related != '无' AND mds_related != '' THEN 1 ELSE 0 END) as mds_related
        FROM exhibition_brand
        WHERE industry_l1 != ''
        GROUP BY industry_l1
        ORDER BY cnt DESC
    """).fetchall()


# ═══════════════════════════════════════════════════════════════
# 格式化输出
# ═══════════════════════════════════════════════════════════════

def fmt_num(n) -> str:
    """数字格式化：100000 → '10万'。"""
    if n is None:
        return "—"
    n = int(n)
    if n >= 100_000_000:
        return f"{n/100_000_000:.1f}亿"
    if n >= 10_000:
        return f"{n/10_000:.0f}万"
    if n >= 1_000:
        return f"{n:,}"
    return str(n)


def fmt_date(d) -> str:
    """日期格式化。"""
    if not d:
        return "—"
    return str(d)


def build_exhibition_report(conn, brand_id: str) -> str:
    """构建单个展会的详细盘面报告。"""
    brand = get_brand_detail(conn, brand_id)
    if not brand:
        return f"❌ 未找到展会: {brand_id}"

    editions = get_editions(conn, brand_id)

    lines = []
    lines.append("═" * 50)
    lines.append(f"📊 {brand['name_cn']}")
    if brand['name_en']:
        lines.append(f"   {brand['name_en']}")
    lines.append("─" * 50)

    # 基本信息
    info = []
    if brand['organizer']:
        info.append(f"主办: {brand['organizer']}")
    if brand['industry_l1']:
        l2 = f" > {brand['industry_l2']}" if brand['industry_l2'] else ""
        info.append(f"行业: {brand['industry_l1']}{l2}")
    if brand['competition_relation']:
        info.append(f"竞品: {brand['competition_relation']}")
    if brand['mds_related'] and brand['mds_related'] != '无':
        info.append(f"MDS关联: {brand['mds_related']}")
    if brand['strategic_relevance']:
        info.append(f"战略相关度: {brand['strategic_relevance']}/5")
    if brand['competitor_group']:
        info.append(f"竞争集团: {brand['competitor_group']}")
    lines.append(" | ".join(info))

    # 历届数据
    if editions:
        lines.append("")
        lines.append("📅 历届数据:")
        lines.append(f"  {'年份':<6} {'城市':<6} {'面积':>8} {'展商':>6} {'观众':>8} {'来源':>12}")
        lines.append("  " + "─" * 50)
        for e in editions:
            raw_src = e['data_source'] or '—'
            # 去重：jufair/jufair/jufair → jufair
            parts = [p for p in raw_src.split('/') if p]
            src = '/'.join(dict.fromkeys(parts)) if parts else '—'
            lines.append(
                f"  {str(e['year']):<6} "
                f"{(e['city'] or '—'):<6} "
                f"{fmt_num(e['area_sqm']):>8} "
                f"{fmt_num(e['exhibitors_count']):>6} "
                f"{fmt_num(e['visitors_count']):>8} "
                f"{src:>12}"
            )
    else:
        lines.append("\n   ⚠️ 无历届数据")

    # 同行业竞品（优先匹配 industry_l2，再 fallback 到 l1）
    if brand['industry_l1']:
        l1, l2 = brand['industry_l1'], brand['industry_l2']
        if l2:
            # 先找同 l2
            peers = conn.execute("""
                SELECT name_cn, brand_id, strategic_relevance, competition_relation, industry_l2
                FROM exhibition_brand
                WHERE industry_l2 = ? AND brand_id != ?
                ORDER BY strategic_relevance DESC
                LIMIT 15
            """, (l2, brand_id)).fetchall()
        else:
            peers = []

        if not peers:
            # fallback 到同 l1，排除已找到的
            exclude = (brand_id,)
            peers = conn.execute("""
                SELECT name_cn, brand_id, strategic_relevance, competition_relation, industry_l2
                FROM exhibition_brand
                WHERE industry_l1 = ? AND brand_id != ?
                ORDER BY strategic_relevance DESC
                LIMIT 10
            """, (l1, brand_id)).fetchall()

        if peers:
            label = f"{l1}" + (f" > {l2}" if l2 else "")
            lines.append("")
            lines.append(f"🔗 同行业 ({label}) 相关展会:")
            for p in peers:
                tag = ""
                if p['competition_relation'] == '是':
                    tag = " ⚔️竞品"
                if p['strategic_relevance'] and p['strategic_relevance'] >= 4:
                    tag += " ⭐高相关"
                lines.append(f"  • {p['name_cn']}{tag}")

    lines.append("═" * 50)
    return "\n".join(lines)


def build_industry_report(conn, keyword: str) -> str:
    """构建行业扫描报告。"""
    brands = search_industry(conn, keyword)

    if not brands:
        return f"❌ 未找到与「{keyword}」相关的展会。试试其他关键词？"

    # 按 l1 分组统计
    l1_groups = {}
    for b in brands:
        l1 = b['industry_l1'] or '未分类'
        if l1 not in l1_groups:
            l1_groups[l1] = {'brands': [], 'competitors': 0, 'total': 0}
        l1_groups[l1]['brands'].append(b)
        l1_groups[l1]['total'] += 1
        if b['competition_relation'] == '是':
            l1_groups[l1]['competitors'] += 1

    lines = []
    lines.append("═" * 50)
    lines.append(f"🔍 行业扫描: 「{keyword}」")
    lines.append(f"   共找到 {len(brands)} 个相关展会")
    lines.append("─" * 50)

    for l1, group in sorted(l1_groups.items(), key=lambda x: -x[1]['total']):
        lines.append(f"\n📂 {l1} ({group['total']}个展会, {group['competitors']}个竞品)")
        for b in group['brands'][:15]:
            rel = ""
            if b['competition_relation'] == '是':
                rel = " ⚔️"
            if b['strategic_relevance'] and b['strategic_relevance'] >= 4:
                rel += " ⭐"
            lines.append(f"  • {b['name_cn']}{rel}")
        if len(group['brands']) > 15:
            lines.append(f"  ... 还有 {len(group['brands']) - 15} 个")

    # 行业总览数字
    lines.append("")
    lines.append("─" * 50)
    total_eds = 0
    total_area = 0
    total_ex = 0
    total_vis = 0
    for b in brands:
        eds = get_editions(conn, b['brand_id'])
        if eds:
            latest = eds[0]
            total_eds += 1
            if latest['area_sqm']:
                total_area += latest['area_sqm']
            if latest['exhibitors_count']:
                total_ex += latest['exhibitors_count']
            if latest['visitors_count']:
                total_vis += latest['visitors_count']

    lines.append("📈 行业关键数字（基于最近一届数据）:")
    lines.append(f"   有数据展会: {total_eds} 个")
    lines.append(f"   总展出面积: {fmt_num(total_area)} ㎡")
    lines.append(f"   总展商规模: {fmt_num(total_ex)} 家")
    lines.append(f"   总观众规模: {fmt_num(total_vis)} 人")

    lines.append("═" * 50)
    return "\n".join(lines)


def build_industry_list_report(conn) -> str:
    """行业大类列表。"""
    industries = list_industries(conn)
    lines = []
    lines.append("═" * 50)
    lines.append("📂 行业大类总览")
    lines.append("─" * 50)
    lines.append(f"  {'行业':<20} {'品牌数':>6} {'竞品':>4} {'MDS关联':>6}")
    lines.append("  " + "─" * 42)
    for ind in industries:
        lines.append(
            f"  {ind['industry_l1']:<20} "
            f"{ind['cnt']:>6} "
            f"{ind['competitors']:>4} "
            f"{ind['mds_related']:>6}"
        )
    lines.append("═" * 50)
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="展会竞争盘面调研工具")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--exhibition", "-e", type=str, help="展会名称（模糊搜索）")
    group.add_argument("--exhibition-id", "-i", type=str, help="展会 brand_id（精确查询）")
    group.add_argument("--industry", "-d", type=str, help="行业关键词")
    group.add_argument("--list-industries", action="store_true", help="列出所有行业大类")

    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"❌ 数据库不存在: {DB_PATH}")
        print("   请先运行 merge_engine.py 生成 mwlab.db")
        sys.exit(1)

    conn = get_conn()

    try:
        if args.list_industries:
            print(build_industry_list_report(conn))

        elif args.exhibition_id:
            print(build_exhibition_report(conn, args.exhibition_id))

        elif args.exhibition:
            matches = search_exhibition(conn, args.exhibition)
            if not matches:
                print(f"❌ 未找到「{args.exhibition}」相关展会")
                sys.exit(1)

            if len(matches) == 1:
                print(build_exhibition_report(conn, matches[0]['brand_id']))
            else:
                # 多个匹配：先列出来
                print(f"🔍 「{args.exhibition}」匹配到 {len(matches)} 个展会:\n")
                for i, m in enumerate(matches[:15], 1):
                    rel = ""
                    if m['competition_relation'] == '是':
                        rel = " ⚔️"
                    if m['strategic_relevance'] and m['strategic_relevance'] >= 4:
                        rel += " ⭐"
                    org = f" | {m['organizer']}" if m['organizer'] else ""
                    print(f"  {i:2d}. {m['name_cn']}{rel}{org}")
                if len(matches) > 15:
                    print(f"  ... 还有 {len(matches) - 15} 个")
                print(f"\n💡 使用 --exhibition-id <brand_id> 查看详情")
                print(f"   例如: python research.py --exhibition-id {matches[0]['brand_id']}")

        elif args.industry:
            print(build_industry_report(conn, args.industry))

    finally:
        conn.close()


if __name__ == "__main__":
    main()
