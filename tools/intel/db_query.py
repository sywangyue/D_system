#!/usr/bin/env python3
"""
tools/intel/db_query.py — Skill DB 数据注入脚本

供 Claude Code skill 的 !`command` 调用，输出格式化文本。
用法:
  python3 tools/intel/db_query.py brand-research "EXPO-0001"
  python3 tools/intel/db_query.py brand-research "中国国际机床展览会"
  python3 tools/intel/db_query.py industry-research "机械和设备"
  python3 tools/intel/db_query.py industry-research "机械和设备" --l2 "机床"
  python3 tools/intel/db_query.py company-history "上海浦东展览馆"
  python3 tools/intel/db_query.py edition-detail "EXPO-0001-2024"
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = _REPO_ROOT / "data" / "mwlab.db"

# ── 查询上限（防止输出过大撑满 LLM 上下文）
MAX_EDITIONS = 10
MAX_INDUSTRY_BRANDS = 50
MAX_RELATIONS = 20


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def brand_research(identifier: str) -> str:
    """查询单一品牌完整信息（历史届次 + 竞争关系）"""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM exhibition_brand WHERE brand_id = ? OR name_cn LIKE ?",
        (identifier, f"%{identifier}%")
    ).fetchall()

    if not rows:
        conn.close()
        return f"错误: 未找到品牌 '{identifier}'"

    # 多命中消歧：精确匹配优先，再按 scale_score DESC
    exact = [r for r in rows if r["brand_id"] == identifier or r["name_cn"] == identifier]
    if exact:
        rows = sorted(exact, key=lambda r: r["scale_score"] or 0, reverse=True)
    else:
        rows = sorted(rows, key=lambda r: r["scale_score"] or 0, reverse=True)

    row = rows[0]
    brand_id = row["brand_id"]

    # 输出多命中提示
    extra_hits = []
    if len(rows) > 1:
        for r in rows[1:6]:
            extra_hits.append(f"  - {r['name_cn']} ({r['brand_id']}) 规模={r['scale_score'] or 'N/A'}")

    editions = conn.execute(
        "SELECT year, area_sqm, exhibitors_count, visitors_count, "
        "       city, venue, status, yoy_trend "
        "FROM exhibition_edition "
        "WHERE brand_id = ? ORDER BY year DESC LIMIT ?",
        (brand_id, MAX_EDITIONS)
    ).fetchall()

    # 竞争关系查询（exhibition_relation 当前为空，实现 fallback）
    relations = conn.execute(
        "SELECT b.name_cn, b.brand_id, r.relation_type, r.notes "
        "FROM exhibition_relation r "
        "JOIN exhibition_brand b ON b.brand_id = r.to_brand_id "
        "WHERE r.from_brand_id = ? LIMIT ?",
        (brand_id, MAX_RELATIONS)
    ).fetchall()

    relation_section: list[str] = []
    if relations:
        relation_section.append("### 竞争关系网络（来自 exhibition_relation 表）")
        for r in relations:
            relation_section.append(
                f"- [{r['relation_type']}] {r['name_cn']} ({r['brand_id']}): {r['notes'] or ''}"
            )
    else:
        relation_section.append(
            "### 同行业展会（exhibition_relation 表当前无数据，fallback 到同行业聚合）"
        )
        peers = conn.execute(
            "SELECT brand_id, name_cn, scale_score, ma_potential "
            "FROM exhibition_brand "
            "WHERE industry_l1 = ? AND brand_id != ? "
            "ORDER BY scale_score DESC LIMIT 20",
            (row["industry_l1"], brand_id)
        ).fetchall()
        for p in peers:
            relation_section.append(
                f"- {p['name_cn']} ({p['brand_id']}) "
                f"规模={p['scale_score'] or 'N/A'} MA潜力={p['ma_potential'] or 'N/A'}"
            )

    conn.close()

    output = [
        "### 品牌基本信息",
        f"- brand_id: {row['brand_id']}",
        f"- 中文名: {row['name_cn']}",
        f"- 英文名: {row['name_en'] or ''}",
        f"- 主办方: {row['organizer'] or '未知'}",
        f"- 行业 L1: {row['industry_l1']} / L2: {row['industry_l2']}",
        f"- MA潜力评分: {row['ma_potential'] or '未评分'}（满分5）",
        f"- 战略相关性: {row['strategic_relevance'] or '未评分'}（满分5）",
        f"- 规模评分: {row['scale_score'] or '未评分'}（满分10）",
        f"- UFI认证: {'是' if row['is_ufi_certified'] else '否'}",
        f"- 国际化: {'是' if row['is_international'] else '否'}",
        f"- 竞品关系: {row['competition_relation'] or '未标注'}",
        f"- MDS关联: {row['mds_related'] or '无'}",
        "",
        f"### 历史届次数据（最近 {MAX_EDITIONS} 届）",
    ]
    if editions:
        for e in editions:
            output.append(
                f"- {e['year']}: 面积={e['area_sqm'] or 'N/A'}m², "
                f"展商={e['exhibitors_count'] or 'N/A'}, "
                f"观众={e['visitors_count'] or 'N/A'}, "
                f"城市={e['city'] or 'N/A'}, "
                f"趋势={e['yoy_trend'] or 'N/A'}"
            )
    else:
        output.append("（暂无历史届次数据）")

    if extra_hits:
        output.append("")
        output.append(f"### 另有 {len(rows) - 1} 条匹配（仅显示前 5）")
        output.extend(extra_hits)

    output.append("")
    output.extend(relation_section)

    return "\n".join(output)


def industry_research(industry_l1: str, industry_l2: str | None = None) -> str:
    """聚合行业展会地图"""
    conn = _connect()

    sql = (
        "SELECT brand_id, name_cn, organizer, city, scale_score, "
        "       ma_potential, strategic_relevance, is_ufi_certified, "
        "       is_international, frequency "
        "FROM exhibition_brand "
        "WHERE industry_l1 = ? "
    )
    params: list = [industry_l1]
    if industry_l2:
        sql += "AND industry_l2 = ? "
        params.append(industry_l2)
    sql += "ORDER BY scale_score DESC LIMIT ?"
    params.append(MAX_INDUSTRY_BRANDS)

    rows = conn.execute(sql, params).fetchall()

    if not rows:
        conn.close()
        label = f"{industry_l1}" + (f" / {industry_l2}" if industry_l2 else "")
        return f"该行业暂无数据: {label}"

    total_params: list[str | int] = [industry_l1]
    total_sql = "SELECT COUNT(*) as cnt FROM exhibition_brand WHERE industry_l1 = ?"
    if industry_l2:
        total_sql += " AND industry_l2 = ?"
        total_params.append(industry_l2)
    total = conn.execute(total_sql, total_params).fetchone()["cnt"]

    ufi_count = sum(1 for r in rows if r["is_ufi_certified"])
    intl_count = sum(1 for r in rows if r["is_international"])
    city_dist: dict[str, int] = {}
    for r in rows:
        city = r["city"] or "未知"
        city_dist[city] = city_dist.get(city, 0) + 1

    conn.close()

    output = [
        f"### 行业概览: {industry_l1}" + (f" / {industry_l2}" if industry_l2 else ""),
        f"- 总品牌数: {total}（本次展示前 {min(len(rows), MAX_INDUSTRY_BRANDS)} 条，按规模排序）",
        f"- UFI认证展会: {ufi_count} 个",
        f"- 国际化展会: {intl_count} 个",
        f"- 主要城市分布: {', '.join(f'{c}({n})' for c, n in sorted(city_dist.items(), key=lambda x: -x[1])[:5])}",
        "",
        f"### 展会品牌列表（规模从高到低，前 {len(rows)} 条）",
    ]
    for r in rows:
        output.append(
            f"- {r['name_cn']} ({r['brand_id']}) | "
            f"规模={r['scale_score'] or 'N/A'} | "
            f"MA={r['ma_potential'] or 'N/A'} | "
            f"城市={r['city'] or 'N/A'} | "
            f"主办方={r['organizer'] or 'N/A'}"
        )

    return "\n".join(output)


def company_history(company_name: str) -> str:
    """查询公司名称关联的所有参展记录（跨展会、跨年份）"""
    conn = _connect()
    rows = conn.execute(
        "SELECT b.brand_id, b.name_cn, b.organizer, b.industry_l1, "
        "       e.year, e.area_sqm, e.exhibitors_count, e.city, e.status "
        "FROM exhibition_edition e "
        "JOIN exhibition_brand b ON b.brand_id = e.brand_id "
        "WHERE b.organizer LIKE ? OR b.name_cn LIKE ? "
        "ORDER BY e.year DESC LIMIT 30",
        (f"%{company_name}%", f"%{company_name}%")
    ).fetchall()

    conn.close()

    if not rows:
        return f"未找到与 '{company_name}' 相关的参展记录"

    output = [
        f"### '{company_name}' 展会关联记录（主办/冠名维度，共 {len(rows)} 条，最多显示30条）",
    ]
    for r in rows:
        output.append(
            f"- {r['year']} | {r['name_cn']} ({r['brand_id']}) | "
            f"行业={r['industry_l1']} | "
            f"面积={r['area_sqm'] or 'N/A'}m² | 城市={r['city'] or 'N/A'}"
        )

    return "\n".join(output)


def edition_detail(edition_id: str) -> str:
    """查询单届详情"""
    conn = _connect()
    row = conn.execute(
        "SELECT e.*, b.name_cn, b.industry_l1 "
        "FROM exhibition_edition e "
        "JOIN exhibition_brand b ON b.brand_id = e.brand_id "
        "WHERE e.edition_id = ?",
        (edition_id,)
    ).fetchone()
    conn.close()

    if not row:
        return f"错误: 未找到届次 '{edition_id}'"

    return "\n".join([
        f"### 届次详情: {row['edition_id']}",
        f"- 展会: {row['name_cn']}",
        f"- 年份: {row['year']}",
        f"- 时间: {row['date_start'] or 'N/A'} ~ {row['date_end'] or 'N/A'}",
        f"- 城市/场馆: {row['city'] or 'N/A'} / {row['venue'] or 'N/A'}",
        f"- 面积: {row['area_sqm'] or 'N/A'}m²",
        f"- 展商数: {row['exhibitors_count'] or 'N/A'}",
        f"- 观众数: {row['visitors_count'] or 'N/A'}",
        f"- 状态: {row['status'] or 'N/A'}",
        f"- 数据来源: {row['data_source'] or 'N/A'}",
    ])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="DB 数据注入脚本（供 Claude Code Skill !命令调用）"
    )
    parser.add_argument(
        "query_type",
        choices=["brand-research", "industry-research", "company-history", "edition-detail"],
        help="查询类型"
    )
    parser.add_argument("identifier", help="查询标识符（brand_id/品牌名/行业名/公司名/edition_id）")
    parser.add_argument("--l2", help="industry-research 时可选 L2 子类过滤", default=None)
    args = parser.parse_args()

    if args.query_type == "brand-research":
        print(brand_research(args.identifier))
    elif args.query_type == "industry-research":
        # 支持 "机械和设备/机床" 斜杠语法自动分割 l1/l2
        l1 = args.identifier
        l2 = args.l2
        if "/" in args.identifier and not args.l2:
            parts = args.identifier.split("/", 1)
            l1 = parts[0].strip()
            l2 = parts[1].strip()
        print(industry_research(l1, l2))
    elif args.query_type == "company-history":
        print(company_history(args.identifier))
    elif args.query_type == "edition-detail":
        print(edition_detail(args.identifier))


if __name__ == "__main__":
    main()
