"""
test_clean_brands.py — CLEAN-NAME-EN + CLEAN-INDUSTRY 单元测试
"""

from scripts.data.name_en_patterns import extract_embedded_en, generate_name_en, is_name_en_valid
from scripts.data.md_category_rules import classify_industry_l1, MD_CATEGORY_RULES


# ─── extract_embedded_en ─────────────────────────────────────────────────────

def test_extract_en_pattern1_trailing():
    """Pattern 1: 末尾 ASCII 序列"""
    result = extract_embedded_en("2026中国国际化工展 ICIF China 2026")
    assert result == "ICIF China 2026", f"Expected trailing ASCII, got {result!r}"


def test_extract_en_pattern1_no_trailing():
    """无末尾 ASCII 时返回 None"""
    result = extract_embedded_en("上海国际机床展")
    assert result is None


def test_extract_en_pattern2_parentheses():
    """Pattern 2: 括号内英文"""
    result = extract_embedded_en("中国照明展（GILE）")
    assert result == "GILE", f"Expected GILE, got {result!r}"


def test_extract_en_pattern2_halfwidth_parens():
    """Pattern 2: 半角括号"""
    result = extract_embedded_en("中国国际医疗器械博览会(CMEF)")
    assert result == "CMEF", f"Expected CMEF, got {result!r}"


def test_extract_en_pattern3_abbreviation():
    """Pattern 3: 独立英文缩写"""
    result = extract_embedded_en("SNEC上海光伏展")
    assert result == "SNEC", f"Expected SNEC, got {result!r}"


def test_extract_en_empty_input():
    """空输入返回 None"""
    assert extract_embedded_en("") is None


# ─── generate_name_en ────────────────────────────────────────────────────────

def test_generate_en_removes_year_prefix():
    """规则: 去掉年份前缀"""
    result = generate_name_en("2026上海国际机床展")
    assert "2026" not in result


def test_generate_en_removes_edition_prefix():
    """规则: 去掉届次前缀"""
    result = generate_name_en("第26届中国国际机电产品博览会")
    assert "第26届" not in result


def test_generate_en_parenthesis_abbreviation():
    """规则1: 括号内已有英文缩写 → 直接使用"""
    result = generate_name_en("中国国际医疗器械博览会（CMEF）")
    assert result == "CMEF"


def test_generate_en_core_word_expo():
    """规则2: 提取核心主题词 + EXPO"""
    result = generate_name_en("上海国际礼品展")
    assert "EXPO" in result


def test_generate_en_fallback():
    """规则3: 首位关键词 + EXPO"""
    result = generate_name_en("礼品展")
    assert "EXPO" in result


def test_generate_en_empty_input():
    """空输入返回空字符串"""
    assert generate_name_en("") == ""


# ─── is_name_en_valid ────────────────────────────────────────────────────────

def test_name_en_valid_pure_english():
    """纯英文 → True"""
    assert is_name_en_valid("Machine Tool EXPO") is True


def test_name_en_valid_with_chinese():
    """含中文 → False"""
    assert is_name_en_valid("机床展EXPO") is False


def test_name_en_valid_empty():
    """空字符串 → True（将被其他流程处理）"""
    assert is_name_en_valid("") is True


# ─── classify_industry_l1 ────────────────────────────────────────────────────

def test_classify_machinery():
    """'机床' → '机械和设备'"""
    assert classify_industry_l1("机床展") == "机械和设备"


def test_classify_machinery_packaging():
    """'包装' → '机械和设备'"""
    assert classify_industry_l1("包装展") == "机械和设备"


def test_classify_leisure():
    """'旅游' → '休闲'"""
    assert classify_industry_l1("旅游展") == "休闲"


def test_classify_leisure_pet():
    """'宠物' → '休闲'"""
    assert classify_industry_l1("宠物展") == "休闲"


def test_classify_lifestyle():
    """'食品' → '生活方式'"""
    assert classify_industry_l1("食品展") == "生活方式"


def test_classify_lifestyle_furniture():
    """'家具' → '生活方式'"""
    assert classify_industry_l1("家具展") == "生活方式"


def test_classify_tech():
    """'电子' → '科技+'"""
    assert classify_industry_l1("电子展") == "科技+"


def test_classify_tech_ai():
    """'人工智能' → '科技+'"""
    assert classify_industry_l1("人工智能展") == "科技+"


def test_classify_health():
    """'医疗' → '医疗和健康'"""
    assert classify_industry_l1("医疗展") == "医疗和健康"


def test_classify_health_dental():
    """'口腔' → '医疗和健康'"""
    assert classify_industry_l1("口腔展") == "医疗和健康"


def test_classify_retail():
    """'零售' → '零售贸易和服务'"""
    assert classify_industry_l1("零售展") == "零售贸易和服务"


def test_classify_trade():
    """'贸易' → '零售贸易和服务'"""
    assert classify_industry_l1("贸易展") == "零售贸易和服务"


def test_classify_no_match():
    """无匹配返回空字符串"""
    assert classify_industry_l1("航天展") == ""


def test_classify_empty():
    """空输入返回空字符串"""
    assert classify_industry_l1("") == ""


def test_all_categories_have_rules():
    """所有 6 个类别均有非空关键词列表"""
    assert len(MD_CATEGORY_RULES) == 6
    for cat, keywords in MD_CATEGORY_RULES.items():
        assert len(keywords) > 0, f"Category {cat!r} has empty keyword list"


# ─── mds ─────────────────────────────────────────────────────────────────────

from scripts.clean_brands import parse_md_excel, match_brand_multistrategy  # noqa: E402, PLC0415


def test_parse_md_excel():
    """读取 fixture Excel，验证返回 list 且包含关键字段。

    原先指向仓库根目录的「杜塞境外展时间表_for update_2026.xlsx」，
    该文件已归档到 _archive/（且 _archive/ 被 .gitignore 忽略），
    故复制一份进 tests/fixtures/ 随代码入库，测试不再依赖本机文件布局。
    """
    from pathlib import Path

    excel_path = Path(__file__).parent / "fixtures" / "md_overseas_schedule_2026.xlsx"
    assert excel_path.exists(), f"fixture 缺失: {excel_path}"

    records = parse_md_excel(str(excel_path))
    assert isinstance(records, list), f"Expected list, got {type(records)}"
    assert len(records) > 0, "Expected non-empty records"

    # Verify required keys exist in every record
    for rec in records:
        assert "category" in rec, f"Missing 'category' in {rec}"
        assert "parent_cn" in rec
        assert "parent_en" in rec
        assert "sat_cn" in rec
        assert "sat_en" in rec
        assert "location" in rec

    # Verify categories are from MD 6-class set
    md_categories = {"机械和设备", "休闲", "生活方式", "科技+", "医疗和健康", "零售贸易和服务"}
    seen_cats = {r["category"] for r in records if r["category"]}
    assert seen_cats.issubset(md_categories), f"Unexpected categories: {seen_cats - md_categories}"

    # Verify satellite entries have either CN or EN or both
    for rec in records:
        if rec["sat_cn"] or rec["sat_en"]:
            assert bool(rec["sat_cn"]) or bool(rec["sat_en"])

    # Verify parent_en is extracted (at least some entries should have English)
    has_parent_en = any(r["parent_en"] for r in records)
    assert has_parent_en, "No parent_en extracted from any record"


def test_match_brand_multistrategy():
    """测试多策略匹配的精确/子串/无匹配三种场景。"""
    import sqlite3

    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE exhibition_brand (
            brand_id TEXT PRIMARY KEY,
            name_cn TEXT NOT NULL,
            name_en TEXT NOT NULL DEFAULT '',
            organizer TEXT NOT NULL DEFAULT ''
        );
        INSERT INTO exhibition_brand VALUES ('EXPO-TEST1', '上海国际机床展', 'Machine Tool EXPO', '');
        INSERT INTO exhibition_brand VALUES ('EXPO-TEST2', '中国国际塑料橡胶展', 'CHINAPLAS', '');
        INSERT INTO exhibition_brand VALUES ('EXPO-TEST3', '杜塞尔多夫包装展-PACK', '', '杜塞尔多夫展览（上海）');
    """)
    conn.commit()

    # Strategy 1: Exact name_en match
    assert match_brand_multistrategy(conn, name_en="Machine Tool EXPO") == "EXPO-TEST1"

    # Strategy 2: Exact name_cn match
    assert match_brand_multistrategy(conn, name_cn="上海国际机床展") == "EXPO-TEST1"

    # Strategy 2: Exact name_cn match (satellite en)
    assert match_brand_multistrategy(conn, name_en="CHINAPLAS") == "EXPO-TEST2"

    # Strategy 3: Substring match (first 10 chars)
    assert match_brand_multistrategy(conn, name_cn="中国国际塑料橡胶展某某") == "EXPO-TEST2"

    # Strategy 4: Organizer match via 杜塞尔 keyword in name
    assert match_brand_multistrategy(conn, name_cn="杜塞尔多夫包装展-PACK") == "EXPO-TEST3"

    # No match: high threshold prevents fuzzy match
    assert match_brand_multistrategy(conn, name_cn="完全不存在的展览", threshold=0.90) is None

    # Empty inputs
    assert match_brand_multistrategy(conn, name_cn="") is None
    assert match_brand_multistrategy(conn) is None

    conn.close()


# ─── jufair-l2 ────────────────────────────────────────────────────────────────

from scripts.data.jufair_l2_crawler import (  # noqa: E402, PLC0415
    JUFAIR_BASE,
    export_categories,
    load_categories,
)


def test_jufair_url_pattern():
    """验证 jufair.com URL 生成逻辑正确。"""
    # URL 模式: /exhibition-{parentId}-{subId}-0-0-0-0-1/
    import re

    # parent 页面: /exhibition-{parentId}
    parent_url = f"{JUFAIR_BASE}/exhibition-123-0-0-0-0-0-1/"
    m = re.search(r'/exhibition-(\d+)', parent_url)
    assert m is not None, "parent ID 未匹配"
    assert m.group(1) == "123", f"Expected parent_id=123, got {m.group(1)}"

    # subcategory 页面: /exhibition-{parentId}-{subId}
    sub_url = f"{JUFAIR_BASE}/exhibition-123-456-0-0-0-0-1/"
    m = re.search(r'/exhibition-123-(\d+)', sub_url)
    assert m is not None, "sub ID 未匹配"
    assert m.group(1) == "456", f"Expected sub_id=456, got {m.group(1)}"

    # Verify re.escape for dynamic parent_id extraction
    pattern = re.compile(r'/exhibition-' + re.escape("123") + r'-(\d+)')
    m = pattern.search(sub_url)
    assert m is not None, "动态 parent_id 模式未匹配"
    assert m.group(1) == "456"

    # 无效 URL 不应匹配
    bad_url = f"{JUFAIR_BASE}/some-other-page/"
    m = re.search(r'/exhibition-(\d+)', bad_url)
    assert m is None, "无效 URL 不应匹配 exhibition 模式"


def test_export_import_categories():
    """验证 export → JSON → import 的 round-trip 正确。"""
    import json
    import tempfile

    sample_data = {
        "parent_categories": [
            {"name": "机械", "url": f"{JUFAIR_BASE}/exhibition-1-0-0-0-0-0-1/", "parent_id": "1"},
            {"name": "电子", "url": f"{JUFAIR_BASE}/exhibition-2-0-0-0-0-0-1/", "parent_id": "2"},
        ],
        "subcategories": [
            {"name": "机床", "sub_id": "10", "parent_id": "1"},
            {"name": "机器人", "sub_id": "11", "parent_id": "1"},
            {"name": "半导体", "sub_id": "20", "parent_id": "2"},
        ],
        "crawled_at": "2026-05-07T00:00:00Z",
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        tmp_path = f.name

    try:
        # Export
        export_categories(sample_data, tmp_path)

        # Import
        loaded = load_categories(tmp_path)

        # Verify structure
        assert "parent_categories" in loaded
        assert "subcategories" in loaded
        assert loaded["crawled_at"] == "2026-05-07T00:00:00Z"

        # Verify parents
        assert len(loaded["parent_categories"]) == 2
        assert loaded["parent_categories"][0]["name"] == "机械"
        assert loaded["parent_categories"][1]["parent_id"] == "2"

        # Verify subs
        assert len(loaded["subcategories"]) == 3
        sub_names = {s["name"] for s in loaded["subcategories"]}
        assert sub_names == {"机床", "机器人", "半导体"}

        # Verify empty data edge case
        empty_data = {"parent_categories": [], "subcategories": [], "crawled_at": ""}
        export_categories(empty_data, tmp_path)
        loaded_empty = load_categories(tmp_path)
        assert len(loaded_empty["parent_categories"]) == 0
        assert len(loaded_empty["subcategories"]) == 0

    finally:
        import os
        os.unlink(tmp_path)


def test_load_categories_file_not_found():
    """文件不存在的错误处理。"""
    import json
    try:
        load_categories("/tmp/nonexistent_jufair_cats_XXXX.json")
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass
    except json.JSONDecodeError:
        pass
