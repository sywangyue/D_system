"""
merge_engine.py — Phase 2 双源合并引擎

功能：把 raw_jufair + raw_cnexpo 两张原始表合并为
      exhibition_brand + exhibition_edition + data_provenance

假设原始数据是脏的：编码异常、超时导致字段缺失、数值格式不一致。

用法：
    python merge_engine.py --batch <crawl_batch_id>
    python merge_engine.py --batch ALL              # 合并全部批次
    python merge_engine.py --dry-run --batch ALL    # 不写库，只打印统计
    python merge_engine.py --jufair-db a.db --cnexpo-db b.db --target-db mwlab.db --batch ALL
"""
from __future__ import annotations

import argparse
import difflib
import json
import logging
import re
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent.parent
DEFAULT_JUFAIR_DB  = BASE_DIR / "data" / "jufair_2026.db"
DEFAULT_CNEXPO_DB  = BASE_DIR / "data" / "cnexpo_2026.db"
DEFAULT_TARGET_DB  = BASE_DIR / "data" / "mwlab.db"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── 数字解析 ──────────────────────────────────────────────────────────────────
_WAN = 10_000  # 万

def parse_numeric(raw: Optional[str]) -> Optional[int]:
    """
    脏字符串 → 整数（平方米 / 人数 / 家数）。

    支持格式：
      "10万平方米"  → 100000
      "10.5万平方米"→ 105000
      "100,000平方米" → 100000
      "面积:15000平方米" → 15000
      "展商:350家"  → 350
      "600,000平方米" → 600000
      None / ""   → None
    """
    if not raw:
        return None
    s = str(raw).strip()
    # 去掉前缀标签，如 "面积:15000" "展商：350"
    s = re.sub(r'^[^\d]*[:：]\s*', '', s)
    # 万 单位
    m = re.search(r'([\d,，]+\.?\d*)\s*万', s)
    if m:
        num_str = m.group(1).replace(',', '').replace('，', '')
        try:
            return round(float(num_str) * _WAN)
        except ValueError:
            return None
    # 普通数字（支持逗号分隔）
    m = re.search(r'([\d,，]+)', s)
    if m:
        try:
            return int(m.group(1).replace(',', '').replace('，', ''))
        except ValueError:
            return None
    return None


# ─── 日期解析 ──────────────────────────────────────────────────────────────────
def parse_date_pair(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    各种格式的日期字符串 → (date_start, date_end)，ISO 8601（YYYY-MM-DD）。

    支持格式：
      "2026.05.01-05.05"       → ("2026-05-01", "2026-05-05")
      "2026.12.09 - 12.11"     → ("2026-12-09", "2026-12-11")
      "2026-4-24"              → ("2026-04-24", None)
      "2026.4.24"              → ("2026-04-24", None)
      "2026年5月1日-5日"        → ("2026-05-01", "2026-05-05")
      "2026年05月06日~05月08日" → ("2026-05-06", "2026-05-08")
      None / ""                → (None, None)
    """
    if not raw:
        return None, None
    s = str(raw).strip()

    # "2026.12.30 - 01.02"（跨年区间：结束月<开始月时年份+1）
    m = re.match(
        r'(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\s*[-–]\s*(\d{1,2})[.\-](\d{1,2})', s
    )
    if m:
        y, sm, sd, em, ed = m.groups()
        ey = int(y) + 1 if int(em) < int(sm) else int(y)
        return f"{y}-{int(sm):02d}-{int(sd):02d}", f"{ey}-{int(em):02d}-{int(ed):02d}"

    # "2026.05.01-05"（同月仅日范围）
    m = re.match(
        r'(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\s*[-–]\s*(\d{1,2})$', s
    )
    if m:
        y, mo, sd, ed = m.groups()
        return f"{y}-{int(mo):02d}-{int(sd):02d}", f"{y}-{int(mo):02d}-{int(ed):02d}"

    # "2026-4-24" 或 "2026.4.24"（仅开始日期）
    m = re.match(r'^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})$', s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}", None

    # "2026年5月1日~5月5日" 或 "2026年05月06日~05月08日"
    m = re.match(
        r'(\d{4})年(\d{1,2})月(\d{1,2})日[~\-–至](\d{1,2})月(\d{1,2})日', s
    )
    if m:
        y, sm, sd, em, ed = m.groups()
        return f"{y}-{int(sm):02d}-{int(sd):02d}", f"{y}-{int(em):02d}-{int(ed):02d}"

    # "2026年5月1日"（仅开始日期）
    m = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}", None

    log.debug("无法解析日期: %r", s)
    return None, None


# ─── 城市标准化 ────────────────────────────────────────────────────────────────
def normalize_city(raw: Optional[str]) -> str:
    """
    去除省份/直辖市前缀重复。
      "上海上海" → "上海"
      "湖北武汉" → "武汉"
      "北京北京" → "北京"
      "广东广州" → "广州"
      "呼和浩特" → "呼和浩特"（保持）
    """
    if not raw:
        return ''
    s = str(raw).strip()
    if len(s) == 4 and s[:2] == s[2:]:   # 直辖市：上海上海
        return s[:2]
    if len(s) == 4 and s[:2] in CN_PROVINCES:  # 省市：湖北武汉 → 武汉
        return s[2:]
    return s

CN_PROVINCES = {'内蒙古','广西','西藏','宁夏','新疆',
                '河北','山西','辽宁','吉林','黑龙江','江苏','浙江',
                '安徽','福建','江西','山东','河南','湖北','湖南',
                '广东','海南','四川','贵州','云南','陕西','甘肃','青海'}


# ─── 品牌ID生成 ────────────────────────────────────────────────────────────────
def next_brand_id(conn: sqlite3.Connection) -> str:
    """生成下一个 EXPO-XXXX 格式品牌ID（线程不安全，单进程使用）。"""
    row = conn.execute(
        "SELECT MAX(CAST(SUBSTR(brand_id,6) AS INTEGER)) "
        "FROM exhibition_brand "
        "WHERE brand_id GLOB 'EXPO-[0-9]*' "
        "  AND brand_id NOT GLOB 'EXPO-*[^0-9]*'"
    ).fetchone()
    num = (row[0] + 1) if row[0] is not None else 1
    return f"EXPO-{num:04d}"


# ─── 品牌匹配 ──────────────────────────────────────────────────────────────────
MATCH_THRESHOLD = 0.85

def match_brand(conn: sqlite3.Connection, cn_name: str) -> Optional[str]:
    """
    在 exhibition_brand 中查找与 cn_name 匹配的品牌。
    优先精确匹配，次之 SequenceMatcher 模糊匹配（双门限：≥0.90 且与次优差距 ≥0.05）。
    返回 brand_id 或 None。
    """
    if not cn_name:
        return None
    row = conn.execute(
        "SELECT brand_id FROM exhibition_brand WHERE name_cn = ?", (cn_name,)
    ).fetchone()
    if row:
        return row[0]
    rows = conn.execute(
        "SELECT brand_id, name_cn FROM exhibition_brand"
    ).fetchall()
    best_ratio, best_id, second_ratio = 0.0, None, 0.0
    for bid, name in rows:
        ratio = difflib.SequenceMatcher(None, cn_name, name or '').ratio()
        if ratio > best_ratio:
            second_ratio = best_ratio
            best_ratio, best_id = ratio, bid
        elif ratio > second_ratio:
            second_ratio = ratio
    # 双门限：必须 ≥0.90，且与次优差距 ≥0.05（或仅一个候选）
    margin = best_ratio - second_ratio if second_ratio > 0 else 1.0
    if best_ratio >= 0.90 and margin >= 0.05:
        log.debug("模糊匹配: %r → %s (%.2f, margin=%.2f)", cn_name, best_id, best_ratio, margin)
        return best_id
    if best_ratio >= MATCH_THRESHOLD:
        log.warning("[LOW-CONF] %s | %s | %.2f | margin=%.2f", cn_name, best_id, best_ratio, margin)
    return None


# ─── 行标准化 ──────────────────────────────────────────────────────────────────
def normalize_row(row: dict, source: str) -> dict:
    """
    原始爬取行 → 标准化字段字典。
    容忍任意字段缺失（None / '' / 完全不存在）。
    """
    raw_date = row.get('date_str') or row.get('date') or ''
    date_start, date_end = parse_date_pair(raw_date)

    year = row.get('year')
    if not year and date_start:
        try:
            year = int(str(date_start)[:4])
        except (ValueError, TypeError):
            year = None

    area       = parse_numeric(row.get('area_str')       or row.get('area')       or '')
    exhibitors = parse_numeric(row.get('exhibitors_str') or row.get('exhibitors') or '')
    visitors   = parse_numeric(row.get('visitors_str')   or row.get('visitors')   or '')

    city = normalize_city(row.get('city') or '')

    return {
        'cn_name':          (row.get('cn_name') or '').strip(),
        'en_name':          (row.get('en_name') or '').strip(),
        'date_str':         raw_date,
        'date_start':       date_start,
        'date_end':         date_end,
        'year':             year,
        'city':             city,
        'venue':            (row.get('venue') or '').strip(),
        'area_sqm':         area,
        'exhibitors_count': exhibitors,
        'visitors_count':   visitors,
        'organizer':        (row.get('organizer') or '').strip(),
        'frequency':        (row.get('cycle') or row.get('frequency') or '').strip(),
        'industry':         (row.get('industry') or '').strip(),
        'source_type':      (row.get('source_type') or '').strip(),
        'source_url':       (row.get('source_url') or '').strip(),
        'crawl_batch_id':   (row.get('crawl_batch_id') or '').strip(),
        'source':           source,
    }


# ─── 字段优先级合并（PRD §3.2）────────────────────────────────────────────────
def merge_two_sources(j: dict, c: dict) -> dict:
    """
    两源字段冲突处理（PRD §3.2）：
      - 名称/时间/地点  → jufair 优先
      - 面积/展商/观众  → 取较大值，记录差异到 notes
      - 主办方          → 两源保留，差异时 "jufair；cnexpo"
      - 缺失字段        → 谁有取谁
    返回合并后的标准化字典及冲突备注。
    """
    merged = {}
    conflict_notes: list[str] = []

    # jufair 优先字段
    for f in ('cn_name', 'en_name', 'date_str', 'date_start', 'date_end', 'city', 'venue'):
        merged[f] = j.get(f) or c.get(f) or ''

    # 数值取较大值
    for f in ('area_sqm', 'exhibitors_count', 'visitors_count'):
        a, b = j.get(f), c.get(f)
        if a is None and b is None:
            merged[f] = None
        elif a is None:
            merged[f] = b
        elif b is None:
            merged[f] = a
        else:
            merged[f] = max(a, b)
            if a != b:
                conflict_notes.append(f"{f}: jufair={a}, cnexpo={b}, 取{merged[f]}")

    # 主办方：两源保留
    org_j = (j.get('organizer') or '').strip()
    org_c = (c.get('organizer') or '').strip()
    if org_j and org_c and org_j != org_c:
        merged['organizer'] = f"{org_j}；{org_c}"
        conflict_notes.append(f"organizer冲突: jufair={org_j!r}, cnexpo={org_c!r}")
    else:
        merged['organizer'] = org_j or org_c

    # 其余字段：谁有取谁
    for f in ('year', 'frequency', 'industry', 'source_type'):
        merged[f] = j.get(f) or c.get(f) or ''

    merged['conflict_notes'] = '；'.join(conflict_notes)
    merged['source_urls']    = list(filter(None, [j.get('source_url'), c.get('source_url')]))
    merged['batch_ids']      = list(filter(None, [j.get('crawl_batch_id'), c.get('crawl_batch_id')]))
    return merged


# ─── 写入目标库 ────────────────────────────────────────────────────────────────
def upsert_brand(conn: sqlite3.Connection, brand_id: str, norm: dict) -> None:
    conn.execute(
        """
        INSERT INTO exhibition_brand
            (brand_id, name_cn, name_en, organizer, city, frequency,
             industry_l1, industry_l2, updated_at)
        VALUES (?,?,?,?,?,?,?,?,datetime('now','localtime'))
        ON CONFLICT(brand_id) DO UPDATE SET
            name_en    = COALESCE(NULLIF(excluded.name_en,''),    name_en),
            organizer  = COALESCE(NULLIF(excluded.organizer,''),  organizer),
            city       = COALESCE(NULLIF(excluded.city,''),       city),
            frequency  = COALESCE(NULLIF(excluded.frequency,''),  frequency),
            industry_l1= COALESCE(NULLIF(excluded.industry_l1,''),industry_l1),
            updated_at = datetime('now','localtime')
        """,
        (
            brand_id,
            norm['cn_name'],
            norm['en_name'],
            norm['organizer'],
            norm['city'],
            norm['frequency'],
            norm['industry'],   # 存到 industry_l1，l2 留人工打标
            '',
        )
    )


def upsert_edition(
    conn: sqlite3.Connection,
    brand_id: str,
    norm: dict,
    data_source: str
) -> str:
    raw_year = norm.get('year')
    year = raw_year or 0
    suffix = str(raw_year) if raw_year else (norm.get('date_start') or 'undated')
    edition_id = f"{brand_id}-{suffix}"

    # CORE-02: Python-side data_source merge & de-dup
    existing = conn.execute(
        "SELECT data_source FROM exhibition_edition WHERE edition_id = ?",
        (edition_id,)
    ).fetchone()
    if existing:
        merged_ds = '/'.join(dict.fromkeys(
            (existing[0] + '/' + data_source).split('/')
        ))
    else:
        merged_ds = data_source

    conn.execute(
        """
        INSERT INTO exhibition_edition
            (edition_id, brand_id, year, date_start, date_end,
             city, venue, area_sqm, exhibitors_count, visitors_count,
             data_source, recorded_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))
        ON CONFLICT(edition_id) DO UPDATE SET
            area_sqm         = MAX(COALESCE(excluded.area_sqm, 0),
                                   COALESCE(area_sqm, 0)),
            exhibitors_count = MAX(COALESCE(excluded.exhibitors_count, 0),
                                   COALESCE(exhibitors_count, 0)),
            visitors_count   = MAX(COALESCE(excluded.visitors_count, 0),
                                   COALESCE(visitors_count, 0)),
            date_start  = COALESCE(NULLIF(excluded.date_start,''),  date_start),
            date_end    = COALESCE(NULLIF(excluded.date_end,''),    date_end),
            venue       = COALESCE(NULLIF(excluded.venue,''),       venue),
            city        = COALESCE(NULLIF(excluded.city,''),        city),
            data_source = excluded.data_source,
            recorded_at = datetime('now','localtime')
        """,
        (
            edition_id, brand_id, year,
            norm.get('date_start'), norm.get('date_end'),
            norm['city'], norm['venue'],
            norm['area_sqm'], norm['exhibitors_count'], norm['visitors_count'],
            merged_ds,
        )
    )
    return edition_id


def insert_provenance(
    conn: sqlite3.Connection,
    brand_id: str,
    source_site: str,
    source_url: str,
    raw_row: dict,
    batch_id: str,
    notes: str = ''
) -> None:
    record_id = str(uuid.uuid4())
    safe_payload = {}
    for k, v in raw_row.items():
        try:
            json.dumps(v)
            safe_payload[k] = v
        except (TypeError, ValueError):
            safe_payload[k] = str(v)

    conn.execute(
        """
        INSERT OR IGNORE INTO data_provenance
            (record_id, brand_id, source_site, source_url, raw_payload, crawl_batch_id, notes)
        VALUES (?,?,?,?,?,?,?)
        """,
        (record_id, brand_id, source_site, source_url,
         json.dumps(safe_payload, ensure_ascii=False),
         batch_id, notes)
    )


# ─── 读原始表 ──────────────────────────────────────────────────────────────────
def _fetch_raw(conn: sqlite3.Connection, table: str, batch_id: str) -> list[dict]:
    """从 raw_jufair 或 raw_cnexpo 读取原始行，容忍表不存在。"""
    try:
        conn.row_factory = sqlite3.Row
        if batch_id == 'ALL':
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        else:
            rows = conn.execute(
                f"SELECT * FROM {table} WHERE crawl_batch_id = ?", (batch_id,)
            ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError as e:
        log.warning("读取 %s 失败（%s），跳过", table, e)
        return []


# ─── 主合并逻辑 ────────────────────────────────────────────────────────────────
def run_merge(
    jufair_db: Path,
    cnexpo_db: Path,
    target_db: Path,
    batch_id: str,
    dry_run: bool = False,
) -> dict:
    """
    核心合并流程。返回统计字典：
    {brands_created, brands_matched, editions_upserted, provenance_written, skipped}
    """
    from schema.db import init_db

    stats = dict(brands_created=0, brands_matched=0,
                 editions_upserted=0, provenance_written=0, skipped=0)

    # 打开目标库（dry-run 也连接真实库以获取匹配统计，结束时 rollback）
    target_conn = init_db(str(target_db))

    # 读两个源
    with sqlite3.connect(str(jufair_db)) as jc:
        jc.row_factory = sqlite3.Row
        jufair_rows = _fetch_raw(jc, "raw_jufair", batch_id)
    log.info("raw_jufair: 读取 %d 行 (batch=%s)", len(jufair_rows), batch_id)

    cnexpo_rows = []
    if cnexpo_db.exists():
        with sqlite3.connect(str(cnexpo_db)) as cc:
            cc.row_factory = sqlite3.Row
            cnexpo_rows = _fetch_raw(cc, "raw_cnexpo", batch_id)
    log.info("raw_cnexpo: 读取 %d 行 (batch=%s)", len(cnexpo_rows), batch_id)

    # 构建 cnexpo 索引（按 cn_name，携带原始行用于跨源 raw_payload）
    cnexpo_index: dict[str, tuple[dict, dict]] = {}
    for raw in cnexpo_rows:
        norm = normalize_row(raw, 'cnexpo')
        key = norm['cn_name']
        if key:
            cnexpo_index[key] = (norm, raw)

    # 处理 jufair 行
    for raw in jufair_rows:
        norm_j = normalize_row(raw, 'jufair')
        cn_name = norm_j['cn_name']

        if not cn_name:
            log.warning("跳过：cn_name 为空（url=%s）", raw.get('source_url', ''))
            stats['skipped'] += 1
            continue

        # 查找 cnexpo 同名记录
        norm_c_raw = cnexpo_index.get(cn_name)
        if norm_c_raw:
            norm_c, raw_c = norm_c_raw
            norm = merge_two_sources(norm_j, norm_c)
            conflict_notes = norm.pop('conflict_notes', '')
            source_urls    = norm.pop('source_urls', [])
            batch_ids      = norm.pop('batch_ids', [])
            data_source = 'jufair/cnexpo'
        else:
            norm = {**norm_j}
            conflict_notes = ''
            source_urls    = [norm_j.get('source_url', '')]
            batch_ids      = [norm_j.get('crawl_batch_id', '')]
            data_source = 'jufair'
            raw_c = None  # used only when site == 'cnexpo', unreachable here

        # 品牌匹配或创建
        brand_id = match_brand(target_conn, cn_name)
        if brand_id:
            stats['brands_matched'] += 1
        else:
            brand_id = next_brand_id(target_conn)
            stats['brands_created'] += 1

        if not dry_run:
            upsert_brand(target_conn, brand_id, norm)
            edition_id = upsert_edition(target_conn, brand_id, norm, data_source)
            stats['editions_upserted'] += 1

            for url in filter(None, source_urls):
                site = 'jufair' if 'jufair' in url else 'cnexpo'
                payload = raw if site == 'jufair' else raw_c
                insert_provenance(
                    target_conn, brand_id, site, url, payload,
                    batch_ids[0] if batch_ids else '',
                    notes=conflict_notes
                )
                stats['provenance_written'] += 1

    # 处理仅存在于 cnexpo 的记录（jufair 无对应）
    jufair_names = {normalize_row(r, 'jufair')['cn_name'] for r in jufair_rows}
    for cn_name, norm_c in cnexpo_index.items():
        if cn_name in jufair_names:
            continue  # 已在上面处理
        brand_id = match_brand(target_conn, cn_name)
        if brand_id:
            stats['brands_matched'] += 1
        else:
            brand_id = next_brand_id(target_conn)
            stats['brands_created'] += 1

        if not dry_run:
            upsert_brand(target_conn, brand_id, norm_c)
            upsert_edition(target_conn, brand_id, norm_c, 'cnexpo')
            stats['editions_upserted'] += 1
            url = norm_c.get('source_url', '')
            if url:
                insert_provenance(
                    target_conn, brand_id, 'cnexpo', url,
                    {k: v for k, v in norm_c.items()},
                    norm_c.get('crawl_batch_id', '')
                )
                stats['provenance_written'] += 1

    if not dry_run:
        target_conn.commit()
    else:
        target_conn.rollback()
    target_conn.close()

    log.info(
        "合并完成 | 新建品牌=%d 匹配品牌=%d 届次=%d 溯源=%d 跳过=%d",
        stats['brands_created'], stats['brands_matched'],
        stats['editions_upserted'], stats['provenance_written'], stats['skipped']
    )
    return stats


# ─── CLI ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="MWLAB Phase 2 双源合并引擎")
    parser.add_argument('--batch',      required=True, help="crawl_batch_id 或 ALL")
    parser.add_argument('--jufair-db',  default=str(DEFAULT_JUFAIR_DB))
    parser.add_argument('--cnexpo-db',  default=str(DEFAULT_CNEXPO_DB))
    parser.add_argument('--target-db',  default=str(DEFAULT_TARGET_DB))
    parser.add_argument('--dry-run',    action='store_true', help="不写库，仅打印统计")
    args = parser.parse_args()

    stats = run_merge(
        jufair_db  = Path(args.jufair_db),
        cnexpo_db  = Path(args.cnexpo_db),
        target_db  = Path(args.target_db),
        batch_id   = args.batch,
        dry_run    = args.dry_run,
    )
    print("\n=== 合并统计 ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    sys.exit(0 if stats['skipped'] == 0 else 1)


if __name__ == '__main__':
    main()
