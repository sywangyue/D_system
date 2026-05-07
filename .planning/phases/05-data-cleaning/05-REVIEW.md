---
phase: 05-data-cleaning
reviewed: 2026-05-07T18:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - scripts/clean_brands.py
  - scripts/data/jufair_l2_crawler.py
  - scripts/data/md_category_rules.py
  - scripts/data/name_en_patterns.py
  - tests/conftest.py
  - tests/test_clean_brands.py
findings:
  critical: 5
  warning: 5
  info: 1
  total: 11
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-07T18:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six source files for Phase 5 data cleaning were reviewed. The codebase has solid structure and good test coverage, but contains five critical bugs that must be fixed before shipping. The most severe issues are in the keyword matching rules (`md_category_rules.py`) where overly broad substring matching causes incorrect industry classification (e.g., "医疗设备展" classified as "机械和设备"), and in the MDS matching logic (`clean_brands.py`) where duplicate parent records are silently dropped.

## Critical Issues

### CR-01: Keyword "设备" causes medical equipment misclassification

**File:** `scripts/data/md_category_rules.py:42`
**Issue:** The keyword `设备` (equipment) in the "机械和设备" category causes all exhibitions containing "设备" to be classified as machinery, including medical, rehabilitation, pharmaceutical, and dental equipment exhibitions. Verified incorrect results: "医疗设备展" → "机械和设备", "康复设备展" → "机械和设备", "制药设备展" → "机械和设备", "口腔设备展" → "机械和设备". These should all map to "医疗和健康".

**Fix:** Remove "设备" from the generic keyword list and create more specific sub-patterns. Either (a) add compound keywords like "医疗设备" to "医疗和健康", or (b) move "设备" to only match when NOT preceded by medical/dental/health-related characters. The simplest fix is to reorder processing so "医疗和健康" rules are checked before "机械和设备", and add negative-lookback patterns:

```python
# Option A: Add medical-equipment compound keywords to 医疗和健康
"医疗和健康": [
    "医疗", "健康", "医", "药", "制药", "口腔", "牙科", "康复",
    "养老", "银发", "保健", "医疗器械", "医疗设备",  # ADD
    "康复设备", "制药设备", "口腔设备",  # ADD
    "生物",
],

# Option B: Remove "设备" from 机械和设备 keywords
"机械和设备": [
    "机械", "机床", "五金", "工业", "铸造", "冶金", "模具",
    "橡塑", "塑料", "橡胶", "包装", "印刷", "制冷", "暖通", "泵阀",
    # "设备" removed — too broad
    ...
],
```

### CR-02: Keyword "药" causes pesticide expo misclassification

**File:** `scripts/data/md_category_rules.py:39`
**Issue:** The single-character keyword `药` (medicine/drug) causes false positives for non-medical terms containing the character, including "农药展" (pesticide exhibition) which is classified as "医疗和健康". The substring `"药" in "农药展"` is True in Python because `药` is a sub-component of `农药`.

**Fix:** Replace single-character `药` with compound keywords only:

```python
"医疗和健康": [
    "医疗", "健康", "医",      # keep single-char "医"
    # "药" REMOVED — too broad, causes false positive on 农药
    "制药", "医药", "药品",    # ADD compound keywords instead
    "口腔", "牙科", "康复",
    "养老", "银发", "保健", "医疗器械", "生物",
],
```

### CR-03: Strategy 4 in match_brand_multistrategy returns wrong brand

**File:** `scripts/clean_brands.py:365-373`
**Issue:** When the search term contains "杜塞尔" or "dusseldorf", Strategy 4 unconditionally returns `LIMIT 1` of any brand whose organizer contains "杜塞尔", regardless of name similarity. This means:
- Searching for a non-existent brand like "杜塞尔工业展(传说中)" returns EXPO-C (a completely unrelated brand just because 杜塞尔多夫展览 is its organizer)
- If multiple brands share the 杜塞尔 organizer, only the first one inserted is returned, potentially the wrong one

**Fix:** Strategy 4 should either (a) be removed and handled by fuzzy matching (Strategy 5), or (b) include a name-similarity check after the organizer match:

```python
# Strategy 4: Organizer contains 杜塞尔 + verify name relevance
combined = (search_cn + " " + search_en).lower()
if "杜塞尔" in combined or "dusseldorf" in combined:
    rows = conn.execute(
        "SELECT brand_id, name_cn FROM exhibition_brand "
        "WHERE organizer LIKE '%杜塞尔%'"
    ).fetchall()
    # Use difflib to find best name match among 杜塞尔 brands
    for bid, name in rows:
        ratio = difflib.SequenceMatcher(None, search_text, name or "").ratio()
        if ratio > best_ratio:
            best_ratio, best_id = ratio, bid
    if best_ratio >= threshold:
        return best_id
```

### CR-04: Duplicate parent records cause silent data loss in cmd_mds

**File:** `scripts/clean_brands.py:451-455`
**Issue:** When multiple satellite shows share the same parent exhibition, only the first record's parent is added to `inserted_parents` set and processed for insertion. All subsequent records referencing the same parent are silently discarded — they are not counted as matched, not inserted as new brands, and not reflected in `unmatched_count`. The `skipped` concept does not account for these dropped records.

Example: If "上海机床展" and "北京机床展" both map to parent "机床母展", and neither the satellites nor the parent match existing brands, only "机床母展" is inserted once. "北京机床展" is silently lost with no log warning.

**Fix:** Count orphaned satellite records explicitly instead of silently skipping:

```python
orphaned_satellites = 0
for rec in records:
    # ...
    else:
        parent_key = rec["parent_cn"].strip()
        if parent_key and parent_key not in inserted_parents:
            inserted_parents.add(parent_key)
            unmatched_parents.append(rec)
        elif parent_key and parent_key in inserted_parents:
            # Parent was already added for another satellite — log warning
            log.warning("ORPHANED SATELLITE (parent already queued): %s -> %s",
                        rec["sat_cn"], parent_key)
            orphaned_satellites += 1

# Then adjust count:
log.info("统计: 总行数=%d 已匹配=%d 新品牌=%d 卫星展孤立=%d",
         len(records), matched, new_brands, orphaned_satellites)
```

### CR-05: Incorrect statistics calculation in cmd_name_en (double-counting)

**File:** `scripts/clean_brands.py:141`
**Issue:** The formula `skipped = total - cleared - extracted - generated - remaining` double-counts rows. Rows cleared in Step 1 (Chinese name_en set to empty string) become candidates for Step 2's extraction and Step 3's generation. Since `cleared`, `extracted`, and `generated` are not disjoint sets, the `skipped` value is artificially understated by the number of rows that passed through multiple steps.

Example: 100 total rows, 5 cleared in Step 1, 3 of those 5 get extraction in Step 2, 1 of remaining 2 gets generation in Step 3. The formula computes `100 - 5 - 3 - 1 - 1 = 90`, but actual skipped should be `100 - 3 - 1 - 1 = 95`.

**Fix:** Do not subtract `cleared` from the total since cleared rows are counted in subsequent steps. Use a separate metric:

```python
log.info(
    "统计: 总行数=%d | 含中文name_en清零=%d | 提取嵌入英文=%d | 自动生成=%d | 仍为空=%d",
    total, cleared, extracted, generated, remaining,
)
```

## Warnings

### WR-01: Test depends on external Excel file not in repository

**File:** `tests/test_clean_brands.py:189-191`
**Issue:** The test `test_parse_md_excel` requires the file `杜塞境外展时间表_for update_2026.xlsx` to exist on disk. This file is not tracked in git (shown as untracked in git status). The test will fail in CI/CD environments where this file is not present.

**Fix:** Either (a) add the Excel file to the repository, (b) mock the openpyxl loading to use synthetic data, or (c) make the test conditional (skip if file not found with `@pytest.mark.skipif`):

```python
@pytest.mark.skipif(
    not excel_path.exists(),
    reason="Excel file not available (not in CI environment)"
)
def test_parse_md_excel():
    ...
```

### WR-02: parse_md_excel hardcodes row 4 as data start

**File:** `scripts/clean_brands.py:267`
**Issue:** The function starts reading from row 4 (`for row in range(4, ws.max_row + 1)`), which assumes the Excel header always occupies 3 rows. If the Excel format changes (e.g., an extra header row is added), this silently shifts all data by one row, producing misaligned records with no validation.

**Fix:** Dynamically detect the header row by scanning for known column headers (e.g., "类别", "卫星展"):

```python
def _find_data_start_row(ws) -> int:
    for row in range(1, min(ws.max_row + 1, 20)):
        b_val = str(ws.cell(row, 2).value or "")
        c_val = str(ws.cell(row, 3).value or "")
        if "类别" in b_val and ("母展" in c_val or "杜塞" in c_val):
            return row + 1
    return 4  # fallback to default
```

### WR-03: generate_name_en can produce names with stale prefixes

**File:** `scripts/data/name_en_patterns.py:81`
**Issue:** The regex `r'(?:国际|中国)?(.{2,10})(?:展览会|博览会|展|大会|峰会|交易会)'` only optionally matches "国际" or "中国" at the start, but these words may still be captured in the core group. Example: "2026中国国际机床展" → after stripping `2026`, the name becomes "中国国际机床展". The regex matches "中国" as optional prefix, then `(.{2,10})` captures "国际机床" (still containing "国际"). Result: `"国际机床 EXPO"` instead of the more natural `"机床 EXPO"`. Similar issues occur when stripping `年` from date-formatted names like "2026年上海国际机床展" → `"年上海国际机床 EXPO"`.

**Fix:** Strip more prefix qualifiers before attempting core extraction:

```python
# Remove common Chinese prefixes after stripping year/edition
name = re.sub(r'^(?:第\d+届)', '', name)
name = re.sub(r'^\d{4}年?', '', name)  # also strip trailing 年
# Remove common prefixes that should not appear in generated names
name = re.sub(r'^(?:中国|国际|上海|北京|广州|深圳|西部|全国)\s*', '', name)
```

### WR-04: jufair_l2_crawler CSS selectors are too broad

**File:** `scripts/data/jufair_l2_crawler.py:113-114`
**Issue:** The selector `a[href*='/exhibition-']` matches ANY link containing `/exhibition-` in the URL, including footer links, sidebar links, pagination links, and "View all exhibitions" links. While `seen_urls` deduplication helps, irrelevant navigation links (e.g., `.../exhibition-all-categories-...`) could still be captured as parent categories. Additionally, the 3-strategy fallback chain (navigation links, dropdown menus, hardcoded fallback) adds complexity without improving accuracy.

**Fix:** Narrow the selector scope to the primary navigation menu area:

```python
# Strategy 1: Only search in the main navigation structure
for a in soup.select("nav.main-nav a[href*='/exhibition-'], "
                     ".nav-primary a[href*='/exhibition-'], "
                     "#category-menu a[href*='/exhibition-']"):
```

### WR-05: F-string used in SQL query (safe currently, but fragile)

**File:** `scripts/clean_brands.py:57` (also line 58)
**Issue:** The backup table name is interpolated via f-string into SQL: `conn.execute(f"CREATE TABLE {backup_name} AS SELECT * FROM exhibition_brand")`. While the current `backup_name` source (`datetime.now().strftime("%Y%m%d")`) is safe (digits only), this pattern is fragile — a future modification to `backup_name` could introduce SQL injection. Parameterized table names are not supported by SQLite, but the risk should be documented or mitigated.

**Fix:** At minimum, validate `backup_name` contains only safe characters:

```python
backup_name = f"exhibition_brand_backup_{today}"
# Validate table name to prevent SQL injection
if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', backup_name):
    raise ValueError(f"Invalid backup table name: {backup_name}")
conn.execute(f"CREATE TABLE {backup_name} AS SELECT * FROM exhibition_brand")
```

## Info

### IN-01: Tautological assertion in test_parse_md_excel

**File:** `tests/test_clean_brands.py:213-214`
**Issue:** The assertion `assert bool(rec["sat_cn"]) or bool(rec["sat_en"])` is always True because the `if` condition on the previous line already requires `rec["sat_cn"] or rec["sat_en"]`. This assertion can never fail and provides no test coverage.

**Fix:** Remove the redundant assertion:

```python
if rec["sat_cn"] or rec["sat_en"]:
    # Satellite entries must have at least one name
    pass  # or remove the entire conditional block
```

---

_Reviewed: 2026-05-07T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
