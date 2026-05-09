---
phase: 05-data-cleaning
plan: 01
subsystem: exhibition_brand
tags:
  - clean_brands
  - name_en
  - industry_l1
  - TDD
dependency_graph:
  requires: []
  provides:
    - scripts/clean_brands.py
    - scripts/data/name_en_patterns.py
    - scripts/data/md_category_rules.py
  affects:
    - mwlab.db (exhibition_brand table)
tech_stack:
  added:
    - Python 3.12+ (argparse, sqlite3, re)
  patterns:
    - Parameterized SQL queries for all UPDATE operations
    - --dry-run mode to preview without writes
    - Automatic backup_table before writes
    - Modular sub-commands via argparse subparsers
key_files:
  created:
    - scripts/clean_brands.py
    - scripts/data/name_en_patterns.py
    - scripts/data/md_category_rules.py
    - tests/test_clean_brands.py
  modified:
    - tests/conftest.py
decisions:
  - Put --db and --dry-run on each subparser individually rather than using argparse parents (avoids conflict when both main parser and subparser define the same argument)
  - Pattern 1 trailing English regex includes digits (0-9) because exhibition names commonly end with year numbers (e.g., "ICIF China 2026")
  - Pattern 3 abbreviation regex uses re.ASCII flag because Python 3's default \b treats Chinese characters as Unicode \w, making word boundaries invisible
  - Added "交易会" to the recognized Chinese exhibition suffix list in generate_name_en (alongside 展览会, 博览会, 展, 大会, 峰会)
metrics:
  duration: ~30 min
  completed_date: 2026-05-07
  tasks_completed: 3/3
  commits: 3
  tests_passing: 30/30
---

# Phase 05 Plan 01: Brand Cleaning Skeleton with name-en and industry Subcommands

**One-liner:** Created `clean_brands.py` script framework with 4 subcommand stubs (name-en, industry, mds, jufair-l2), fully implemented name-en (English name extraction/generation) and industry (MD category mapping) subcommands, backed by 30 unit tests.

## Tasks Completed

### Task 1: Test Scaffolding and Data Modules (commit 7e3a874)

Created two data modules and full test infrastructure:

- **scripts/data/name_en_patterns.py**: Three extraction patterns for embedded English in Chinese names (trailing ASCII, parentheses, abbreviations), name generation with year/edition prefix removal and core-word+EXPO fallback, and validity checking.
- **scripts/data/md_category_rules.py**: Six MD category keyword mapping dictionaries (机械和设备, 休闲, 生活方式, 科技+, 医疗和健康, 零售贸易和服务) with classify_industry_l1 function.
- **tests/conftest.py**: Added `exhibition_brand_conn` fixture with 20 carefully crafted rows covering 5 valid name_en + industry_l1, 5 empty, 5 Chinese-in-name-en, and 5 extractable-embedded-English cases.
- **tests/test_clean_brands.py**: 30 test cases covering all extraction patterns, generation strategies, validity checks, and industry classification across all 6 categories.

### Task 2: clean_brands.py Skeleton and name-en Subcommand (commit f86782b)

Created `scripts/clean_brands.py` with:

- Argparse CLI with 4 subcommands (name-en, industry as stubs for mds and jufair-l2)
- `--db` and `--dry-run` flags on each subcommand
- `backup_table()` function creating `exhibition_brand_backup_YYYYMMDD` before writes
- 3-step name-en pipeline: clear Chinese-in-name_en, extract embedded English from name_cn, generate names for remaining empty rows
- All UPDATE operations use parameterized queries
- Sys.path setup for importing `scripts.data.*` modules

### Task 3: Industry Subcommand (commit 12939a5)

Implemented full `cmd_industry` with:

- Queries all non-empty industry_l1 rows
- Maps each to one of 6 MD categories via keyword matching
- Updates only when target category differs from original
- Reports mapping statistics and lists unmatched values for manual review
- Supports --dry-run preview mode

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pattern 1 trailing English regex didn't match text with digits**
- **Found during:** Task 1 test execution
- **Issue:** The regex `[A-Z][A-Za-z\s&-]{3,}$` couldn't match trailing English containing digits (e.g., "ICIF China 2026" because "2026" has digits). The test expected "ICIF China 2026" but got "ICIF" from Pattern 3.
- **Fix:** Added `0-9` to the trailing character class: `[A-Z][A-Za-z0-9\s&,-]{3,}$`
- **Files modified:** `scripts/data/name_en_patterns.py`
- **Commit:** 7e3a874 (applied before first commit)

**2. [Rule 1 - Bug] Pattern 3 abbreviation word boundary broken in Unicode mode**
- **Found during:** Task 1 test execution
- **Issue:** Python 3's default Unicode-aware `\w` treats Chinese characters as word characters, so `\b` doesn't see a word boundary between "SNEC" and "上" in "SNEC上海光伏展". Pattern 3 returned None for this input.
- **Fix:** Added `re.ASCII` flag to the \b pattern: `re.search(r'\b([A-Z]{2,10})\b', name_cn, re.ASCII)`
- **Files modified:** `scripts/data/name_en_patterns.py`
- **Commit:** 7e3a874 (applied before first commit)

**3. [Rule 2 - Missing critical] "交易会" not included in generate_name_en suffix patterns**
- **Found during:** Task 1 test execution
- **Issue:** The regex `(?:展览会|博览会|展|大会|峰会)` didn't include "交易会", which is a common Chinese exhibition name suffix (e.g., "中国国际服务贸易交易会"). Without it, the name fell through to the fallback segment splitter, producing a poor result.
- **Fix:** Added "交易会" to the suffix alternation.
- **Files modified:** `scripts/data/name_en_patterns.py`
- **Commit:** 7e3a874 (applied before first commit)

**4. [Rule 1 - Bug] argparse parents mechanism caused --db argument conflict**
- **Found during:** Task 2 testing
- **Issue:** Using `parents=[shared]` on both the main parser and each subparser caused the `--db` default value (mwlab.db) to override the user-provided `--db` value. The namespace ended up with the default from the main parser's parents rather than the subparser's user-provided value.
- **Fix:** Removed `parents` mechanism entirely. Defined `--db` and `--dry-run` directly on each subparser individually.
- **Files modified:** `scripts/clean_brands.py`
- **Commit:** f86782b (applied before commit)

**5. [Rule 2 - Missing critical] Missing sys.path setup for module imports**
- **Found during:** Task 2 testing
- **Issue:** Running `python scripts/clean_brands.py` failed with `ModuleNotFoundError: No module named 'scripts'` because the project root wasn't on `sys.path`.
- **Fix:** Added `sys.path.insert(0, str(BASE_DIR))` at module level.
- **Files modified:** `scripts/clean_brands.py`
- **Commit:** f86782b (applied before commit)

## Known Stubs

| File | Lines | Reason |
|------|-------|--------|
| `scripts/clean_brands.py` | `cmd_mds` (line ~155) | Intentionally deferred to Plan 2 (CLEAN-MDS requires Excel parsing with openpyxl) |
| `scripts/clean_brands.py` | `cmd_jufair_l2` (line ~165) | Intentionally deferred to Plan 2 (CLEAN-JUFAIR-L2 requires crawling from Beijing Mac Mini IP) |

## Commits

| Commit | Message |
|--------|---------|
| `7e3a874` | test(05-01): add test scaffolding and data modules for brand cleaning |
| `f86782b` | feat(05-01): create clean_brands.py with name-en subcommand |
| `12939a5` | feat(05-01): implement industry subcommand for MD category mapping |

## Self-Check: PASSED

- [x] `scripts/clean_brands.py` exists with shebang and 4 subcommands
- [x] `scripts/data/name_en_patterns.py` exports extract_embedded_en, generate_name_en, is_name_en_valid
- [x] `scripts/data/md_category_rules.py` exports MD_CATEGORY_RULES, classify_industry_l1, list_nonempty_categories
- [x] `tests/conftest.py` contains `exhibition_brand_conn` fixture
- [x] `tests/test_clean_brands.py` exists with 30 passing tests
- [x] `python3 scripts/clean_brands.py --help` shows 4 subcommands
- [x] `python3 scripts/clean_brands.py name-en --dry-run` exits cleanly
- [x] `python3 scripts/clean_brands.py industry --dry-run` exits cleanly with mapping output
- [x] All SQL uses parameterized queries (no string concatenation)
- [x] backup_table called before any UPDATE
- [x] All 3 commits exist in git log
