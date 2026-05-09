# Phase 05: Data Cleaning (数据清洗 — 品牌表深化) - Research

**Researched:** 2026-05-07
**Domain:** Data cleaning, Chinese-English translation, fuzzy matching, web crawling
**Confidence:** HIGH (verified against live DB state + Excel file + codebase)

## Summary

This phase normalizes the `exhibition_brand` table across four dimensions: English name completion (1,946 rows missing), industry_l1 consolidation from 116 messy values to 6 MD categories, MD (杜塞尔多夫展览) brand marking via Excel matching, and secondary industry classification via jufair.com crawling. The pipeline is four mostly-independent operations that can execute in parallel, with the jufair L2 component being the only one requiring a mainland China IP.

**Primary recommendation:** Build a single `clean_brands.py` script with four sub-commands (`name-en`, `industry`, `mds`, `jufair-l2`), each independently runnable. Use regex extraction + pattern-based generation for English names (75% coverage), with a lightweight API call for the remainder. Use difflib for fuzzy matching (already in the project's dependencies). The jufair L2 crawl must run on the Beijing Mac Mini node.

## User Constraints (from CONTEXT.md)
<!-- No CONTEXT.md exists yet for Phase 05 — this is the first planning artifact.
     Therefore no locked decisions exist. All recommendations below are research-guided. -->

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-NAME-EN | 英文名称标准化：已有英文名称保留，缺失/中文显示的按中文翻译补充，格式 "英文翻译缩写 EXPO" | Pattern: 498/1,946 rows already have English embedded in name_cn (extractable). Remaining 1,448 need pattern-based generation + API fallback. Format should match existing convention (uppercase abbreviations / short names). |
| CLEAN-INDUSTRY | 一级行业标签对齐：保留 6 个 MD 一级标签，替换 industry_l1 | 116 messy values found (format "category展会, city+展名"). Each can be mapped to one of 6 MD categories via keyword rules. ~3,989 rows with non-empty industry_l1 need remapping. |
| CLEAN-MDS | MD 自有品牌标记：检查 Excel 文件中展会是否在数据库中存在 | Excel has 71 rows with parent exhibitions (Col C) + satellite shows (Col E/F). Only 13/95 matched by simple substring; need multi-strategy matching (name_cn + name_en + fuzzy). 181 MD-related brands already identified via organizers. |
| CLEAN-JUFAIR-L2 | 二级行业分类爬取：爬取 jufair industry categories, 模糊匹配标注 industry_l1 + l2 | Jufair has 18 top-level categories with ~220+ subcategories via `/exhibition-{parentId}-{subId}-...` URL pattern. Must crawl from Beijing Mac Mini IP. Raw data already has "所属行业" field in "category展会, city+展名" format. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python 3 | 3.12+ | Runtime | Already project standard |
| SQLite3 | stdlib | Database | Already project standard |
| openpyxl | 3.1.x | Excel reading/writing | Already used by tools/export_for_tagging.py and import_tags.py |
| BeautifulSoup4 | 4.x | HTML parsing | Already used by jufair_crawler.py |
| difflib | stdlib | Fuzzy string matching | Already used by merge_engine.py (SequenceMatcher) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requests | 2.x | HTTP for jufair L2 crawl | CLEAN-JUFAIR-L2 only |
| re | stdlib | Regex extraction | CLEAN-NAME-EN extraction + CLEAN-INDUSTRY category parsing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| difflib.SequenceMatcher | rapidfuzz / fuzzywuzzy | difflib is stdlib (no install); rapidfuzz is 5-10x faster but adds dependency. For 5,935 rows, difflib is fast enough. |
| Manual keyword mapping | ML classification | 6 categories with clear keywords — no ML needed. Overkill and adds complexity. |
| Google Translate API | Local pattern-based | Pattern-based covers 75% of cases for free. API needed only for ambiguous names (~200-300 rows). |

**Installation:**
```bash
# No new dependencies needed. All libraries already in project.
# For CLEAN-JUFAIR-L2 on Mac Mini: requests + BeautifulSoup4 already installed.
```

## Architecture Patterns

### Data Flow Diagram

```
                         Phase 05 Data Cleaning Pipeline
                         ===============================

┌──────────────────────────────────────────────────────────────────────┐
│                         exhibition_brand (5,935 rows)                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐    │
│  │ name_en   │  │industry_l1│  │mds_related│  │ industry_l2  │    │
│  │ 1,946 empty│  │116 distinct│  │all empty  │  │ all empty    │    │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘    │
└────────┼──────────────┼──────────────┼───────────────┼──────────────┘
         │              │              │               │
    CLEAN-NAME-EN  CLEAN-INDUSTRY   CLEAN-MDS     CLEAN-JUFAIR-L2
         │              │              │               │
         ▼              ▼              ▼               ▼
    ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐
    │Extract   │  │Keyword-  │  │Match Excel│  │Crawl jufair.com  │
    │embedded  │  │rule map  │  │71 rows to │  │18 parent cats    │
    │English   │  │116 vals→ │  │DB brands  │  │→ ~220 subcats    │
    │from      │  │6 MD cats │  │+ fuzzy    │  │→ fuzzy match to  │
    │name_cn   │  │          │  │fallback   │  │exhibition_brand  │
    │(498 rows)│  │          │  │           │  │                   │
    └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘
         │              │              │                │
         ▼              ▼              ▼                ▼
    ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐
    │Generate  │  │UPDATE    │  │UPDATE     │  │UPDATE industry_l1│
    │standard  │  │industry_ │  │mds_related│  │+ industry_l2     │
    │abbrev    │  │l1 = 1 of │  │= 1 where  │  │based on jufair   │
    │for       │  │6 values  │  │matched    │  │category match    │
    │remaining │  │          │  │           │  │                   │
    └────┬─────┘  └──────────┘  └───────────┘  └──────────────────┘
         │
         ▼
    ┌──────────┐
    │UPDATE    │
    │name_en   │
    │in DB     │
    └──────────┘
```

**Key insight:** All four operations are independent and can run in any order. No data dependency between them. The only external dependency is CLEAN-JUFAIR-L2 requiring a mainland China IP.

### Recommended Project Structure
```
scripts/
├── clean_brands.py          # Main entry point with 4 sub-commands
└── data/
    ├── md_category_rules.py  # 6-category keyword mapping rules
    ├── name_en_patterns.py   # Regex patterns for English extraction
    └── jufair_l2_crawler.py  # Jufair category crawler (standalone)
```

### Pattern 1: Embedded English Extraction (CLEAN-NAME-EN)
**What:** Extract English text already present in Chinese name_cn fields
**When to use:** ~498 rows have English/ASCII in name_cn (e.g., "2026中国国际化工展览会 ICIF China 2026")
**Example:**
```python
import re

def extract_embedded_en(name_cn: str) -> str | None:
    """Extract English text from Chinese exhibition names."""
    if not name_cn:
        return None
    
    # Pattern 1: Trailing English after space (most common)
    m = re.search(r'[A-Z][A-Za-z\s&-]{3,}$', name_cn)
    if m:
        return m.group(0).strip()
    
    # Pattern 2: English in parentheses like "（xxx）" or "(xxx)"
    m = re.search(r'[（(]([A-Z][A-Za-z\s&-]{2,})[）)]', name_cn)
    if m:
        return m.group(1).strip()
    
    # Pattern 3: English abbreviation like "SNEC" or "ITES" as word boundary
    m = re.search(r'\b([A-Z]{2,10})\b', name_cn)
    if m:
        return m.group(1).strip()
    
    return None
```

### Pattern 2: MD 6-Category Keyword Mapping (CLEAN-INDUSTRY)
**What:** Map 116 messy industry_l1 values to 6 canonical MD categories
**When to use:** All rows with non-empty industry_l1 (~3,989 rows)
**Example:**
```python
# Classification rules (keyword-based, exhaustive mapping from research)
MD_CATEGORY_RULES = {
    "机械和设备": [
        "机械", "机床", "设备", "五金", "工业", "铸造", "冶金", "模具",
        "橡塑", "塑料", "橡胶", "包装", "印刷", "制冷", "暖通", "泵阀",
        "紧固件", "电缆", "电力", "新能源", "能源", "电动车", "汽车",
        "汽配", "车展", "摩托车", "自行车", "玻璃", "复合材料", "工业",
        "纺织工业", "纺织印花", "染料", "非开挖", "建材", "建筑",
        "五金", "分析测试仪器", "仪器", "安防", "劳保",
    ],
    "休闲": [
        "休闲", "旅游", "体育", "户外", "房车", "露营", "游艇", "船艇",
        "钓鱼", "玩具", "宠物", "花卉", "园艺", "景观", "礼品", "珠宝",
        "文具", "教育", "乐器", "文化",
    ],
    "生活方式": [
        "生活", "消费", "食品", "糖酒", "餐饮", "烘焙", "茶", "咖啡",
        "酒", "饮料", "服装", "纺织", "家纺", "家居", "家电", "家具",
        "孕婴童", "个人护理", "美容美发", "化妆品", "奢侈品", "包装",
        "品牌授权", "光学眼镜", "成人用品", "文具", "零售",
        "连锁加盟",
    ],
    "科技+": [
        "科技", "电子", "消费电子", "半导体", "显示", "AI", "人工智能",
        "互联网", "物联网", "大数据", "通信", "5G", "软件", "信息",
        "数字", "无人驾驶", "无人机", "无人系统", "灯光", "照明",
        "广告标识", "直播电商",
    ],
    "医疗和健康": [
        "医疗", "健康", "医", "药", "制药", "口腔", "牙科", "康复",
        "养老", "银发", "保健", "医疗器械", "生物",
    ],
    "零售贸易和服务": [
        "零售", "贸易", "服务", "物流", "连锁", "商业", "加盟",
        "消费品", "食品",
    ],
}

def classify_industry_l1(messy_value: str) -> str:
    """Map messy industry_l1 to one of 6 MD categories."""
    if not messy_value:
        return ""
    for category, keywords in MD_CATEGORY_RULES.items():
        for kw in keywords:
            if kw in messy_value:
                return category
    return ""  # Manual review needed
```

### Pattern 3: Fuzzy Brand Matching (CLEAN-MDS + CLEAN-JUFAIR-L2)
**What:** Match exhibition names from external sources to DB brands using multi-strategy matching
**When to use:** Matching Excel shows to DB brands, and jufair categories to exhibition_brand
**Example:**
```python
import difflib
import sqlite3

def match_brand_multistrategy(
    conn: sqlite3.Connection, 
    name_cn: str = "", 
    name_en: str = "",
    threshold: float = 0.80
) -> str | None:
    """
    Try multiple matching strategies in order.
    Returns brand_id or None.
    """
    # Strategy 1: Exact name_en match
    if name_en:
        row = conn.execute(
            "SELECT brand_id FROM exhibition_brand WHERE name_en = ?",
            (name_en,)
        ).fetchone()
        if row:
            return row[0]
    
    # Strategy 2: name_cn contains search (substring)
    if name_cn:
        # Try exact CN match
        row = conn.execute(
            "SELECT brand_id FROM exhibition_brand WHERE name_cn = ?",
            (name_cn,)
        ).fetchone()
        if row:
            return row[0]
        # Try name_cn LIKE substring
        for part in [name_cn[:15], name_cn[:10]]:
            if len(part) >= 4:
                row = conn.execute(
                    "SELECT brand_id FROM exhibition_brand WHERE name_cn LIKE ? LIMIT 1",
                    (f"%{part}%",)
                ).fetchone()
                if row:
                    return row[0]
    
    # Strategy 3: Fuzzy match on all name_cn
    rows = conn.execute(
        "SELECT brand_id, name_cn FROM exhibition_brand"
    ).fetchall()
    best_ratio, best_id = 0.0, None
    search_text = name_cn or name_en or ""
    for bid, name in rows:
        ratio = difflib.SequenceMatcher(None, search_text, name or "").ratio()
        if ratio > best_ratio:
            best_ratio, best_id = ratio, bid
    if best_ratio >= threshold:
        return best_id
    
    return None
```

### Anti-Patterns to Avoid
- **One monolithic script:** Four independent operations should be separate runnable sub-commands, not a single sequential pipeline.
- **Direct openpyxl cell iteration without understanding merged cell structure:** The MD Excel uses merged cells for parent exhibitions with continuation rows for satellite shows. Must track parent-child relationships.
- **Assume all English can be translated programmatically:** ~25% of names have embedded English; ~25% more can be generated from patterns. The remaining ~25% (about 500 names) may need manual review.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein | `difflib.SequenceMatcher` (stdlib) | Already used in merge_engine.py. 0.85 threshold established. |
| Excel reading | Manual XML parsing | `openpyxl` | Already in project. Handles merged cells, data validation. |
| SQL operations | Raw string SQL | Python `sqlite3` with parameterized queries | Already standard. Prevents injection. |
| HTTP retry logic | Custom retry | `requests` with loop (pattern from jufair_crawler.py) | Already standard. 3 retries + exponential backoff. |

**Key insight:** The project already has all the libraries needed. No new dependencies required.

## Common Pitfalls

### Pitfall 1: Merged Cell Confusion in Excel
**What goes wrong:** openpyxl returns `None` for merged cells (except the top-left cell). The MD Excel has merged parent exhibition names spanning multiple satellite rows.
**Why it happens:** Excel stores merged cell values only in the first cell of the merge range.
**How to avoid:** Track the current parent exhibition across rows. When column C is None, use the last seen value.
**Warning signs:** Getting `None` for columns that visually have values.

### Pitfall 2: False Positives in Fuzzy Matching
**What goes wrong:** `SequenceMatcher` with 0.80 threshold matches unrelated brands when names share common words (e.g., "上海" appears in many exhibition names).
**Why it happens:** Chinese geographical prefixes and common words inflate similarity ratios.
**How to avoid:** Use multi-strategy matching (exact > substring > fuzzy). Lower threshold only when no better match exists. Always require minimum string length >= 6 characters for fuzzy matching.
**Warning signs:** A single brand matching to multiple Excel entries, or matches with low confidence.

### Pitfall 3: Jufair L2 Crawl IP Restriction
**What goes wrong:** jufair.com returns HTTP 403/405 from non-China IPs.
**Why it happens:** The site uses Tengine CDN with geo-blocking.
**How to avoid:** Run the L2 crawl on the Beijing Mac Mini node. The existing crawler already handles this. Export results as JSON and transfer to development machine.
**Warning signs:** 403 errors during development.

### Pitfall 4: Over-translation of English Names
**What goes wrong:** Automated translation creates awkward or incorrect English names for exhibitions that already have established English names.
**Why it happens:** Many Chinese exhibitions have official English names not reflected in the DB.
**How to avoid:** Always check for embedded English first, then known patterns, before generating new names. The format "英文缩写 EXPO" should be reserved for cases where no other English name can be determined.

## Code Examples

### Script Architecture (clean_brands.py)
```python
#!/usr/bin/env python3
"""
clean_brands.py — Phase 05 品牌表清洗

Usage:
    python scripts/clean_brands.py name-en            # CLEAN-NAME-EN
    python scripts/clean_brands.py industry            # CLEAN-INDUSTRY
    python scripts/clean_brands.py mds                 # CLEAN-MDS
    python scripts/clean_brands.py jufair-l2           # CLEAN-JUFAIR-L2
    python scripts/clean_brands.py --dry-run name-en   # Preview changes
"""
import argparse
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "mwlab.db"

def cmd_name_en(args):
    """CLEAN-NAME-EN: Normalize English names."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    # Step 1: Fix name_en that contain Chinese characters
    if not args.dry_run:
        conn.execute("""
            UPDATE exhibition_brand 
            SET name_en = '' 
            WHERE name_en GLOB '*[一-龥]*'
        """)
    
    # Step 2: Extract embedded English from name_cn
    # Step 3: Generate names for remaining empty rows
    ...
    conn.commit() if not args.dry_run else conn.rollback()
    conn.close()

def cmd_industry(args):
    """CLEAN-INDUSTRY: Consolidate to 6 MD categories."""
    ...

def cmd_mds(args):
    """CLEAN-MDS: Mark MD-related brands from Excel."""
    ...

def cmd_jufair_l2(args):
    """CLEAN-JUFAIR-L2: Crawl jufair categories and match."""
    ...

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--dry-run", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    
    for cmd_name, func, help_text in [
        ("name-en", cmd_name_en, "Normalize English names"),
        ("industry", cmd_industry, "Consolidate industry_l1 to 6 MD categories"),
        ("mds", cmd_mds, "Mark MD-related brands from Excel"),
        ("jufair-l2", cmd_jufair_l2, "Crawl jufair categories and match L2"),
    ]:
        p = sub.add_parser(cmd_name, help=help_text)
        p.set_defaults(func=func)
    
    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
```

### MD Excel Parsing (CLEAN-MDS)
```python
import openpyxl
from pathlib import Path

def parse_md_excel(filepath: str) -> list[dict]:
    """
    Parse the MD exhibition Excel file.
    Returns list of {category, parent_cn, parent_en, sat_cn, sat_en, location, next_date}
    Handles merged cells by tracking current category and parent exhibition.
    """
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb.active
    
    records = []
    current_cat = ""
    current_parent = ""
    
    # Data starts at row 4 (rows 1-3 are headers)
    for row in range(4, ws.max_row + 1):
        cat = ws.cell(row, 2).value
        if cat and str(cat).strip():
            current_cat = str(cat).strip()
        
        parent = ws.cell(row, 3).value
        if parent and str(parent).strip():
            current_parent = str(parent).strip()
        
        sat_en = ws.cell(row, 6).value
        sat_cn = ws.cell(row, 5).value
        
        records.append({
            "category": current_cat,
            "parent_cn": current_parent,
            "sat_en": str(sat_en).strip() if sat_en else "",
            "sat_cn": str(sat_cn).strip() if sat_cn else "",
            "location": str(ws.cell(row, 7).value or "").strip(),
            "next_date": str(ws.cell(row, 8).value or "").strip(),
        })
    
    return records
```

### Name Generation Pattern (CLEAN-NAME-EN)
```python
import re

def generate_name_en(name_cn: str) -> str:
    """
    Generate standard English name from Chinese exhibition name.
    Falls back to "缩写 EXPO" format for core names.
    
    Examples:
        "2026第26届中国国际机电产品博览会暨武汉工业博览会"
          → "CIMPE EXPO"
        "第27届上海国际礼品、文创产品及家居用品展览会"
          → "Shanghai Gift Expo"
        "中国国际服务贸易交易会"
          → "CIFTIS"
    """
    # Remove year prefixes
    name = re.sub(r'^\d{4}', '', name_cn)
    name = re.sub(r'^(?:第\d+届)', '', name)
    name = re.sub(r'[\d{4}第\d+届].*?', '', name[:3])  # Be more careful
    
    # Strategy 1: If the name contains an established abbreviation in parentheses, use it
    m = re.search(r'[（(]([A-Za-z\s/]+)[）)]', name)
    if m:
        return m.group(1).strip()
    
    # Strategy 2: Extract core exhibition type (last meaningful part)
    # For most exhibition names, the core is between "国际" and "展/博览会"
    core_match = re.search(r'(?:国际|中国)?(.{2,10})(?:展览会|博览会|展|大会|峰会)', name)
    if core_match:
        core = core_match.group(1).strip()
        # Generate pinyin-based or conceptual abbreviation
        return f"{core} EXPO"
    
    # Strategy 3: Fallback — use first meaningful segment + EXPO
    segments = [s for s in re.split(r'[、，,\s]', name) if s and len(s) >= 2]
    if segments:
        return f"{segments[0]} EXPO"
    
    return ""
```

### Fuzzy Match with Confidence Report (CLEAN-JUFAIR-L2)
```python
def generate_category_report(conn: sqlite3.Connection):
    """
    Generate a report of unmatched brands for manual review.
    Outputs JSON with match quality indicators.
    """
    unmatched = []
    rows = conn.execute(
        "SELECT brand_id, name_cn, name_en FROM exhibition_brand"
    ).fetchall()
    
    # ... matching logic ...
    
    return [
        {
            "brand_id": brand_id,
            "name_cn": name_cn,
            "match_score": score,
            "suggested_cat": category,
            "needs_review": score < 0.85
        }
        for brand_id, name_cn, score, category in unmatched
    ]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| merge_engine stored jufair.industry directly into industry_l1 | industry_l1 now consolidated to 6 canonical MD categories | Phase 05 | industry_l1 values change from 116 distinct to 6 |
| mds_relation completely empty | Now populated by matching MD Excel to DB | Phase 05 | Enables dashboard MDS filter |
| industry_l2 entirely empty | Partially populated via jufair taxonomy crawl | Phase 05 | Enables industry_l2 filter in dashboard |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | difflib.SequenceMatcher at 0.80 threshold provides acceptable matching quality | Common Pitfalls | May need tuning if false positives are high |
| A2 | The 6 MD categories can be mapped from the existing ~116 industry_l1 values via keyword rules | Pattern 2 | Some exhibitions may fall into wrong categories; manual review step needed |
| A3 | Jufair L2 crawling URL pattern `/exhibition-{parentId}-{subId}-...` is stable | Standard Stack | If jufair changes URL structure, crawl breaks |
| A4 | Excel column B (类别) covers all 6 categories and is correctly assigned | Pattern 3 | Some Excel rows may have incorrect or missing category assignments |

## Open Questions

1. **CLEAN-NAME-EN: Translation quality threshold**
   - What we know: ~498 rows have extractable English; ~1,448 rows need generation
   - What's unclear: How many of the remaining need manual review vs. can be auto-generated
   - Recommendation: Run auto-generate first, output a "needs_review.csv" for names where confidence < 0.7

2. **CLEAN-JUFAIR-L2: Jufair taxonomy structure**
   - What we know: 18 top-level categories, ~220+ subcategories, URL pattern identified
   - What's unclear: The exact parentId/subId mapping (cannot fetch from this IP)
   - Recommendation: Deploy the L2 crawl script to Beijing Mac Mini, return JSON export

3. **CLEAN-MDS: Low match rate with Excel**
   - What we know: Only 13/95 matched by simple substring. 181 MD-related brands found via organizer lookup
   - What's unclear: Whether the low match means the Excel shows are not in our DB, or matching strategy needs tuning
   - Recommendation: Use multi-strategy matching (organizer, name_en, fuzzy fallback), then report truly unmatched rows

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| openpyxl | CLEAN-MDS (Excel parsing) | ✓ | (in project) | — |
| requests | CLEAN-JUFAIR-L2 (crawling) | ✓ | (in project) | — |
| BeautifulSoup4 | CLEAN-JUFAIR-L2 (parsing) | ✓ | (in project) | — |
| difflib | Fuzzy matching (all) | ✓ | stdlib | — |
| re | Pattern extraction (all) | ✓ | stdlib | — |
| sqlite3 | Database operations (all) | ✓ | stdlib | — |
| jufair.com access | CLEAN-JUFAIR-L2 | ✗ (blocked from current IP) | — | Run on Beijing Mac Mini |

**Missing dependencies with no fallback:**
- jufair.com access: Must run CLEAN-JUFAIR-L2 on Beijing Mac Mini. Script must support `--export` mode to produce JSON results for import on dev machine.

**Missing dependencies with fallback:**
- None — all Python libraries are already available in the project environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest |
| Config file | tests/ or pytest.ini |
| Quick run command | `pytest tests/ -x -q` |
| Full suite command | `pytest tests/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEAN-NAME-EN | English name extraction from Chinese strings | unit | `pytest tests/test_clean_brands.py::test_extract_embedded_en -x` | ❌ Wave 0 |
| CLEAN-NAME-EN | Name generation for Chinese exhibition names | unit | `pytest tests/test_clean_brands.py::test_generate_name_en -x` | ❌ Wave 0 |
| CLEAN-INDUSTRY | Keyword-based category mapping | unit | `pytest tests/test_clean_brands.py::test_classify_industry -x` | ❌ Wave 0 |
| CLEAN-MDS | Excel parsing with merged cells | unit | `pytest tests/test_clean_brands.py::test_parse_md_excel -x` | ❌ Wave 0 |
| CLEAN-MDS | Brand matching with multi-strategy | integration | `pytest tests/test_clean_brands.py::test_match_brand_multistrategy -x` | ❌ Wave 0 |
| CLEAN-JUFAIR-L2 | Jufair URL generation | unit | `pytest tests/test_clean_brands.py::test_jufair_urls -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_clean_brands.py -x -q`
- **Per wave merge:** `pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_clean_brands.py` — covers all 4 requirement IDs
- [ ] `tests/conftest.py` — shared fixtures for clean_brands tests
- [ ] Framework install: `pip install pytest` — if none detected

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Parameterized SQL queries (`conn.execute` with `?` placeholders) |

### Known Threat Patterns for Python + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via brand name | Tampering | Parameterized queries only (already project standard) |
| Excel macro injection | Remote Code | Use `data_only=True` in openpyxl (already standard) |

No authentication or access control changes in this phase. All operations are data-cleaning scripts operating on the local database.

## Sources

### Primary (HIGH confidence)
- [Verified] Live `mwlab.db` query — 5,935 rows, 1,946 missing name_en, 0 industry_l2, 0 mds_related
- [Verified] Live `jufair_2026.db` query — 4,046 rows, industry values in "category, city+展名" format
- [Verified] Excel file analysis — 71 rows, 6 categories in Column B, parent+satellite structure
- [Verified] jufair.com homepage fetch — 18 top-level categories, URL pattern `/exhibition-{parentId}-{subId}-...`
- [Verified] `merge_engine.py` — existing `difflib.SequenceMatcher` with 0.85 threshold
- [Verified] `schema/init_db.sql` — exhibition_brand table schema with all target columns

### Secondary (MEDIUM confidence)
- [WebFetch] jufair.com homepage — 18 parent categories identified (too large to list all ~220 subcategories from this IP)

### Tertiary (LOW confidence)
- None — all findings verified against live data or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified in existing codebase
- Architecture: HIGH — Based on verified data analysis of live DB
- Pitfalls: HIGH — Risks identified from Excel structure analysis and jufair IP constraints
- CLEAN-JUFAIR-L2 specifics: MEDIUM — URL crawl pattern identified but not tested (IP blocked from current node)

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — stable data cleaning patterns)
