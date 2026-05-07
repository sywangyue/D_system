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
