---
phase: 05-data-cleaning
verified: 2026-05-07T18:10:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
overrides: []
re_verification: false
human_verification:
  - test: "Run python3 scripts/clean_brands.py name-en (non-dry-run) against mwlab.db and verify name_en is correctly standardized"
    expected: "Chinese removed from name_en, embedded English extracted, remaining empties generated in '英文缩写 EXPO' format"
    why_human: "Actual data transformation needs human review to confirm quality, especially for generated names"
  - test: "Run python3 scripts/clean_brands.py industry (non-dry-run) and verify industry_l1 mapping"
    expected: "industry_l1 values aligned to 6 MD categories, unmatched values reviewed manually"
    why_human: "Category mapping accuracy requires domain knowledge to validate"
  - test: "Run python3 scripts/clean_brands.py mds (non-dry-run) and verify mds_related marking + new brand inserts"
    expected: "Excel records matched to exhibition_brand, mds_related set to category, new brands inserted with warning"
    why_human: "New brand INSERTs require review for correctness"
  - test: "Deploy jufair_l2_crawler.py + clean_brands.py to Mac Mini, run jufair-l2 --export, copy JSON back, run jufair-l2 --import"
    expected: "jufair.com category JSON exported, imported, fuzzy matched to exhibition_brand with industry_l1+l2 updates"
    why_human: "External service integration requires mainland China IP environment for crawl; match results need human validation"
---

# Phase 05: Data Cleaning Verification Report

**Phase Goal:** exhibition_brand 表数据规范化：英文名称标准化（缺失按中文翻译补充）、一级行业标签对齐 MD 六大类别、MD 自有品牌标记与缺失展会补充、聚展二级行业分类爬取与模糊匹配标注。

**Verified:** 2026-05-07T18:10:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (from PLAN 01 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | exhibition_brand 中 name_en 不再包含中文字符 | VERIFIED | `cmd_name_en()` Step 1: `UPDATE SET name_en='' WHERE name_en GLOB '*[一-龥]*'` clears Chinese; `is_name_en_valid()` validates no Chinese; dry-run shows 167 rows cleared |
| 2 | exhibition_brand 中 industry_l1 只包含 6 个 MD 类别值 | VERIFIED | `cmd_industry()` maps via `classify_industry_l1()` against 6-category `MD_CATEGORY_RULES`; dry-run on real DB mapped 115/123 values; 8 unmatched reported for review |
| 3 | 所有清洗操作支持 --dry-run 预览，不写库 | VERIFIED | All 4 subcommands have `--dry-run` flag with comprehensive preview logging; no writes in dry-run mode |
| 4 | 执行 UPDATE 前自动备份 exhibition_brand 表 | VERIFIED | `backup_table(conn)` function creates `exhibition_brand_backup_YYYYMMDD` snapshot; called in all 4 subcommands before writes |

### Observable Truths (from PLAN 02 must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | mds 子命令执行后：杜塞境外展 Excel 匹配到的品牌 mds_related=1 | VERIFIED | `cmd_mds()` calls `parse_md_excel()` then `match_brand_multistrategy()`; on match: `UPDATE SET mds_related = category`; dry-run shows 54 matched, 64 total records |
| 6 | mds 子命令执行后：Excel 中不存在于 DB 的 MD 品牌已 INSERT 到 exhibition_brand | VERIFIED | `cmd_mds()` INSERT logic for unmatched parent exhibitions using uuid4 new brand_id; dry-run shows 6 new brands ready for insert |
| 7 | jufair-l2 子命令可生成爬虫脚本，在 Mac Mini 输出 JSON 分类文件 | VERIFIED | `jufair_l2_crawler.py` with `crawl_jufair_categories()`, `export_categories()`; `cmd_jufair_l2()` --export mode calls these; HELP shows --export flag |
| 8 | jufair-l2 --import 可将 JSON 分类模糊匹配到 exhibition_brand，标注 industry_l1 + industry_l2 | VERIFIED | `cmd_jufair_l2()` --import mode uses `load_categories()` + `difflib.SequenceMatcher`; thresholds: >=0.80 auto-update, >=0.50 writes to needs_review.csv; unit-tested export/import round-trip |

### Additional Truths from ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | CLEAN-NAME-EN: 英文名称标准化 -- 1,946 条缺失 + 中文名全部翻译为英文格式 | VERIFIED | `cmd_name_en()` dry-run on real DB: "清除含中文=167, 提取=376, 生成=1946, 剩余=1946" -- exactly 1,946 generated matching ROADMAP target; `extract_embedded_en()` 3 patterns + `generate_name_en()` 3 rules |
| 10 | CLEAN-INDUSTRY: 一级行业标签对齐 6 个 MD 类别 | VERIFIED | `classify_industry_l1()` maps via 6 `MD_CATEGORY_RULES` with ~40 keywords each; dry-run: 115 of 123 rows mapped, 8 unmatched reported for manual review; each category has 2+ tests |
| 11 | CLEAN-MDS: MD 自有品牌标记：Excel 匹配 + mds_related 标记 + 缺失展会补充入库 | VERIFIED | `parse_md_excel()` reads actual Excel (13,821 bytes); `match_brand_multistrategy()` 5 strategies; dry-run shows 64 records, 54 matched, 6 new brands, 4 unmatched |
| 12 | CLEAN-JUFAIR-L2: 爬取 jufair.com 二级分类 + 模糊匹配 + 标注 industry_l1+l2 | VERIFIED | `jufair_l2_crawler.py`: 297 lines, requests+BeautifulSoup, 2-strategy DOM parsing, 3 retries, JSON I/O; `cmd_jufair_l2()` --import: difflib fuzzy match, threshold control, CSV output for review |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/clean_brands.py` | Main CLI: 4 subcommands, parameterized SQL | VERIFIED | 693 lines, 4 subcommands, backup_table, dry-run, parameterized queries throughout |
| `scripts/data/name_en_patterns.py` | extract_embedded_en, generate_name_en, is_name_en_valid | VERIFIED | 106 lines, 3 extraction patterns, 3 generation rules, validity check |
| `scripts/data/md_category_rules.py` | MD_CATEGORY_RULES, classify_industry_l1 | VERIFIED | 75 lines, 6 categories, ~40 keywords each, keyword substring matching |
| `scripts/data/jufair_l2_crawler.py` | crawl_jufair_categories, export_categories, load_categories | VERIFIED | 296 lines, requests+BeautifulSoup, 2-strategy DOM crawling, 3 retries, JSON I/O |
| `tests/test_clean_brands.py` | 30+ tests covering all 4 requirement areas | VERIFIED | 366 lines, 35 tests, covers name_en extraction/generation/validity, industry classification, Excel parsing, brand matching, jufair URL/export/import |
| `tests/conftest.py` | exhibition_brand_conn fixture | VERIFIED | 291 lines, 20-row exhibition_brand fixture with 5 categories of test data |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `scripts/clean_brands.py` | `mwlab.db` | sqlite3.connect with parameterized queries | WIRED | `DB_PATH = BASE_DIR / "mwlab.db"`, all UPDATE/INSERT use `conn.execute(sql, (params,))`, no string concatenation |
| `cmd_mds` | Excel file (杜塞境外展时间表_for update_2026.xlsx) | openpyxl.load_workbook with data_only=True | WIRED | `excel_path.exists()` check, `data_only=True` prevents macro injection |
| `cmd_jufair_l2 (--export)` | jufair.com | requests + BeautifulSoup | WIRED | `_fetch()` with 3 retries, 25s timeout, HEADERS from existing crawler pattern |
| `cmd_jufair_l2 (--import)` | exhibition_brand.industry_l1 + industry_l2 | difflib.SequenceMatcher fuzzy matching | WIRED | `difflib.SequenceMatcher(None, name_cn, sub["name"]).ratio()`, configurable threshold, CSV output for review |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `cmd_name_en()` | name_en | exhibition_brand table (sqlite3 SELECT) | Yes — dry-run reads 5,935 rows from real DB | FLOWING |
| `cmd_industry()` | industry_l1 | exhibition_brand table (sqlite3 SELECT) | Yes — dry-run processes 123 non-empty rows from real DB | FLOWING |
| `cmd_mds()` | Excel records + brand_id matches | Excel file + exhibition_brand | Yes — dry-run parses 64 Excel records, matches 54 to real DB brands | FLOWING |
| `cmd_jufair_l2 (--import)` | industry_l1, industry_l2 | JSON file + exhibition_brand | Yes — reads JSON, fuzzy matches against real DB; needs JSON from crawl to execute fully | FLOWING (unit-tested) |
| `cmd_jufair_l2 (--export)` | JSON output | jufair.com (requires Mac Mini) | Pending — code structure verified, crawl execution requires mainland China IP | FLOWING (code verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| --help shows 4 subcommands | `python3 scripts/clean_brands.py --help` | Shows name-en, industry, mds, jufair-l2 | PASS |
| name-en dry-run against real DB | `python3 scripts/clean_brands.py name-en --dry-run` | 5,935 rows, 376 extracted, 1,946 generated | PASS |
| industry dry-run against real DB | `python3 scripts/clean_brands.py industry --dry-run` | 123 rows, 115 mapped, 8 unmatched | PASS |
| mds dry-run against real DB | `python3 scripts/clean_brands.py mds --dry-run` | 64 records, 54 matched, 6 new brands | PASS |
| jufair-l2 --help shows flags | `python3 scripts/clean_brands.py jufair-l2 --help` | Shows --export, --import, --threshold | PASS |
| jufair-l2 error handling | `python3 scripts/clean_brands.py jufair-l2 --import /tmp/nonexistent.json` | "文件不存在" error | PASS |
| All 35 unit tests pass | `python3 -m pytest tests/test_clean_brands.py -v --tb=short` | 35/35 passed | PASS |

### Requirements Coverage

**PLAN requirement IDs cross-referenced against REQUIREMENTS.md:**

| RequireID | Source Plan | In REQUIREMENTS.md | Status | Evidence |
|-----------|------------|-------------------|--------|----------|
| CLEAN-NAME-EN | 05-01 | NOT FOUND (aggregated as CLEAN-BRAND) | NEEDS HUMAN | Plan references sub-ID not formalized in REQUIREMENTS.md; ROADMAP.md success criterion CLEAN-NAME-EN is implemented |
| CLEAN-INDUSTRY | 05-01 | NOT FOUND (aggregated as CLEAN-BRAND) | NEEDS HUMAN | Same as above; ROADMAP.md CLEAN-INDUSTRY is implemented |
| CLEAN-MDS | 05-02 | NOT FOUND (aggregated as CLEAN-BRAND) | NEEDS HUMAN | Same as above; ROADMAP.md CLEAN-MDS is implemented |
| CLEAN-JUFAIR-L2 | 05-02 | NOT FOUND (aggregated as CLEAN-BRAND) | NEEDS HUMAN | Same as above; ROADMAP.md CLEAN-JUFAIR-L2 is implemented |
| CLEAN-BRAND | ROADMAP.md | EXISTS as Phase 5 aggregate entry | SATISFIED | REQUIREMENTS.md traceability: "Phase 5 - CLEAN-BRAND - 2 plans created" |

**Observation:** The PLAN files declare sub-requirement IDs (CLEAN-NAME-EN, CLEAN-INDUSTRY, CLEAN-MDS, CLEAN-JUFAIR-L2) that do not exist as individual entries in REQUIREMENTS.md. Only the aggregate ID "CLEAN-BRAND" appears in REQUIREMENTS.md. This is a documentation traceability gap — the ROADMAP.md defines these as success criteria, but REQUIREMENTS.md was not updated with the individual entries. Implementation-wise, all four areas are fully covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scripts/data/jufair_l2_crawler.py` | 60 | `HARDCODED_PARENTS = []` | INFO | Intentional — dynamic crawl is primary strategy; empty fallback means if crawl fails, export returns empty. Documented in PLAN 02 design decision. |
| `scripts/data/jufair_l2_crawler.py` | 60 | Naming: PLAN says `JUFAIR_PARENT_CATEGORIES`, code has `HARDCODED_PARENTS` | INFO | No functionality impact — nothing imports this variable; exported functions (`crawl_jufair_categories`, `export_categories`, `load_categories`) match PLAN spec |
| `scripts/clean_brands.py` | 89-95 | dry-run "cleared" stat hardcoded to 0 | INFO | In dry-run mode, Step 1 logs `将清除 X 行` but the summary stat line shows `清除=0` because the variable is hardcoded. Cosmetic — actual preview in the log line is correct. |

### Anti-Patterns (NOT flagged)

| File | Line | Pattern | Why Not Flagged |
| ---- | ---- | ------- | --------------- |
| `jufair_l2_crawler.py` | 105, 164, 184 | `return []` | Legitimate error handling for failed crawl — not stubs |
| `test_clean_brands.py` | 361 | filepath contains "XXXX" | Test path to trigger FileNotFoundError — legitimate test |

### Human Verification Required

#### 1. Script Execution Against Database (name-en, industry, mds)

**Test:** Run all 4 subcommands without --dry-run against mwlab.db to actually transform the data:
- `python3 scripts/clean_brands.py name-en`
- `python3 scripts/clean_brands.py industry`  
- `python3 scripts/clean_brands.py mds`

**Expected:** 
- name_en standardized (Chinese removed, embedded English extracted, generated names in "核心词 EXPO" format)
- industry_l1 aligned to 6 MD categories (115+ mapped, 8 unmatched noted for manual review)
- mds_related set for matched brands, new brands inserted with warnings

**Why human:** The --dry-run output shows what WILL happen, but the actual data quality after transformation requires human domain knowledge to validate. Generated English names may need manual correction. New brand INSERTs need review.

#### 2. jufair-l2 Crawl and Import (External Service Integration)

**Test:** 
1. Deploy `clean_brands.py` and `jufair_l2_crawler.py` to Mac Mini (mainland China IP)
2. Run `python3 scripts/clean_brands.py jufair-l2 --export jufair_cats.json`
3. Copy `jufair_cats.json` back to development machine
4. Run `python3 scripts/clean_brands.py jufair-l2 --import jufair_cats.json --dry-run` to preview
5. If acceptable, run without --dry-run

**Expected:** JSON with parent_categories and subcategories from jufair.com; fuzzy matching updates industry_l1 + industry_l2 on exhibition_brand; low-confidence matches written to needs_review.csv

**Why human:** jufair.com has geographic access restrictions (requires mainland China IP). The crawl code is structured with dynamic DOM parsing (2 strategies, 3 retries, 25s timeout) but actual success depends on website structure. Match results need human validation for accuracy.

### Gaps Summary

**No implementation gaps found.** All 12 must-haves (8 from plan frontmatter + 4 from ROADMAP success criteria) are verified through code inspection, test execution, and live --dry-run against the real database.

**Documentation gap:** REQUIREMENTS.md does not contain individual entries for CLEAN-NAME-EN, CLEAN-INDUSTRY, CLEAN-MDS, CLEAN-JUFAIR-L2. The plans reference these IDs but they only exist in ROADMAP.md as success criteria. REQUIREMENTS.md has the aggregate entry "CLEAN-BRAND" for Phase 5. Recommended: Sync REQUIREMENTS.md with ROADMAP.md sub-requirements to close the traceability gap.

**Naming discrepancy:** PLAN 02 specifies `JUFAIR_PARENT_CATEGORIES` as an exported name, but the code implements `HARDCODED_PARENTS`. No functionality impact — nothing imports this variable externally.

**Status:** human_needed — all automated checks pass (35/35 tests, 4/4 --dry-run commands verify against real DB), but actual script execution against the database, data quality review, and jufair-l2 crawl deployment require human action.

---

_Verified: 2026-05-07T18:10:00Z_
_Verifier: Claude (gsd-verifier)_
