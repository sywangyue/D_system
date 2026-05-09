---
phase: 05-data-cleaning
plan: 02
subsystem: data-processing
tags: [openpyxl, excel, jufair, crawling, fuzzy-matching, difflib, beautifulsoup4, requests]

# Dependency graph
requires:
  - phase: 05-data-cleaning
    plan: 01
    provides: clean_brands.py skeleton with name-en + industry subcommands, name_en_patterns.py, md_category_rules.py, test_clean_brands.py
provides:
  - cmd_mds: Excel-based MD brand marking (parse, match, UPDATE mds_related, INSERT new brands)
  - jufair_l2_crawler.py: standalone jufair.com category crawler module
  - cmd_jufair_l2: --export crawl mode and --import fuzzy match mode
affects: [exhibition_brand table mds_related, industry_l1, industry_l2 columns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-strategy brand matching (exact > substring > organizer > fuzzy)
    - Dynamic jufair.com category crawling with hardcoded fallback
    - Export/import workflow for IP-restricted crawling

key-files:
  created:
    - scripts/data/jufair_l2_crawler.py
  modified:
    - scripts/clean_brands.py
    - tests/test_clean_brands.py

key-decisions:
  - "JUFAIR_PARENT_CATEGORIES left empty with dynamic crawl, HARDCODED_PARENTS fallback"
  - "Strategy 4 (organizer) only activates when search name contains '杜塞尔' or 'dusseldorf'"
  - "jufair-l2 --import writes low-confidence matches to needs_review.csv"
  - "Parent exhibition English extracted from trailing non-CJK content in name_cn"

patterns-established:
  - "Pattern 1: _extract_english_trailing() extracts English from mixed CN/EN strings by taking all content after last CJK character"
  - "Pattern 2: match_brand_multistrategy() defined as module-level function in clean_brands.py for testability"

requirements-completed: [CLEAN-MDS, CLEAN-JUFAIR-L2]

# Metrics
duration: 23min
completed: 2026-05-07
---

# Phase 05 Data Cleaning Plan 02: mds + jufair-l2 Subcommands Summary

**Implement cmd_mds for MD brand marking from Excel file (multi-strategy matching with INSERT fallback), create jufair_l2_crawler.py for jufair.com category crawling, and implement cmd_jufair_l2 with --export (crawl) and --import (fuzzy match) modes.**

## Tasks Completed

| # | Task | Type | Commit |
|---|------|------|--------|
| 1 | Implement cmd_mds - Excel parsing, multi-strategy brand matching, INSERT new brands | auto | `ed77030` |
| 2 | Create jufair_l2_crawler.py - jufair.com category crawler module | auto | `e3cb95f` |
| 3 | Implement jufair-l2 subcommand - --export crawl + --import fuzzy match | checkpoint:human-action | `6a80839` |

## Verification

- All 35 tests pass (32 pre-existing + 3 new jufair-l2 tests)
- `python3 scripts/clean_brands.py mds --dry-run` outputs stats: 64 records, 54 matched, 6 new brands, 4 unmatched
- `python3 scripts/clean_brands.py jufair-l2 --help` shows --export, --import, --threshold options
- `python3 scripts/clean_brands.py jufair-l2 --import nonexistent.json` returns file-not-found error
- All acceptance criteria enforced via grep checks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Worktree base resolution**

- **Found during:** Initial setup
- **Issue:** The worktree branch was created from an old commit (d68b197) that predated all Phase 05 files. The worktree directory did not contain scripts/clean_brands.py, scripts/data/, or Phase 05 planning files.
- **Fix:** Ran the worktree_branch_check (git reset --hard to 8b75a83) to bring the worktree to the correct base. Cherry-picked the Task 1 commit from the main branch onto the worktree branch. Copied the Excel file and mwlab.db to the worktree for test execution.
- **Status:** Fixed, all tests pass in the worktree.

**2. [Rule 2 - Missing critical] Parent English extraction edge case**

- **Found during:** Task 1 implementation
- **Issue:** The plan specified using `extract_embedded_en()` for parent_en extraction. However, some parent exhibition names contain non-ASCII English characters (e.g., "杜塞尔多夫美容美发展 BEAUTY DÜSSELDORF" with Ü), which the ASCII-only regex pattern would miss.
- **Fix:** Created `_extract_english_trailing()` function that finds the last CJK character position and takes everything after it. This handles all English text regardless of character encoding. Falls back to returning the full string if no CJK characters exist (handles pure-English names like "components").
- **Status:** Fixed, verified against all 64 Excel records.

## Known Stubs

None. All functionality is complete. The jufair-l2 --import mode requires the user to first run --export on a Mac Mini (mainland China IP), which is documented in the deployment instructions.

## Self-Check: PASSED

- [x] scripts/clean_brands.py exists with cmd_mds, cmd_jufair_l2 definitions
- [x] scripts/data/jufair_l2_crawler.py exists with crawl_jufair_categories, export_categories, load_categories
- [x] tests/test_clean_brands.py has 35 tests all passing
- [x] Commits ed77030, e3cb95f, 6a80839 verified in git log
- [x] .planning/phases/05-data-cleaning/05-02-SUMMARY.md created

## Commits

| Hash | Message |
|------|---------|
| `ed77030` | feat(05-02): implement cmd_mds - Excel parsing, multi-strategy brand matching, INSERT new brands |
| `e3cb95f` | feat(05-02): create jufair_l2_crawler.py - jufair.com category crawler |
| `6a80839` | feat(05-02): implement jufair-l2 subcommand - --export crawl + --import fuzzy match |

## Threat Flags

None. All file operations follow the existing threat model:
- T-05-01: All SQL uses parameterized queries with `?` placeholders
- T-05-02: openpyxl uses `data_only=True` for Excel reading
- T-05-03: Jufair HTTP requests follow existing crawler patterns (no PII)
- T-05-04: all write operations guarded by --dry-run preview and backup_table()
