"""
name_en_patterns.py — CLEAN-NAME-EN 英文名称提取与生成

提供从中文展会名提取嵌入英文、生成标准英文名、验证英文名有效性的函数。

依赖: re, string (均为 stdlib)
"""

import re


def extract_embedded_en(name_cn: str) -> str | None:
    """从中文展会名称中提取嵌入的英文文本。

    三种匹配模式（按优先级）:
      Pattern 1: 末尾 ASCII 序列（如 "展会名称 SNEC"）
      Pattern 2: 括号内英文（如 "展会（SNEC）"）
      Pattern 3: 独立英文缩写（如 "SNEC" 作为 word boundary）

    Args:
        name_cn: 中文展会名称

    Returns:
        提取到的英文文本（strip 后），无匹配时返回 None
    """
    if not name_cn:
        return None

    # Pattern 1: Trailing English after space (most common)
    # e.g. "2026中国国际化工展览会 ICIF China 2026" → "ICIF China 2026"
    m = re.search(r'[A-Z][A-Za-z0-9\s&,-]{3,}$', name_cn)
    if m:
        return m.group(0).strip()

    # Pattern 2: English in parentheses like "(SNEC)" or "（SNEC）"
    m = re.search(r'[（(]([A-Z][A-Za-z\s&-]{2,})[）)]', name_cn)
    if m:
        return m.group(1).strip()

    # Pattern 3: Standalone English abbreviation like "SNEC" or "ITES" as word boundary
    # Use re.ASCII flag for \b since Unicode mode treats Chinese chars as \w (#2924)
    m = re.search(r'\b([A-Z]{2,10})\b', name_cn, re.ASCII)
    if m:
        return m.group(1).strip()

    return None


def generate_name_en(name_cn: str) -> str:
    """为无英文名的中文展会名生成标准英文名称。

    处理流程:
      1. 去除年份（如 "2026"）和届次前缀（如 "第26届"）
      2. 规则1: 括号内已有英文缩写 → 直接使用
      3. 规则2: 提取核心主题词 + "EXPO"
      4. 规则3: 首位关键词 + "EXPO"

    Args:
        name_cn: 中文展会名称

    Returns:
        生成的英文名称，无法生成时返回空字符串
    """
    if not name_cn:
        return ''

    name = name_cn.strip()

    # 去掉年份前缀
    name = re.sub(r'^\d{4}', '', name)
    # 去掉届次前缀（如 "第26届"）
    name = re.sub(r'^(?:第\d+届)', '', name)

    # 规则1: 括号内已有英文缩写 → 直接使用
    m = re.search(r'[（(]([A-Za-z\s/]{2,})[）)]', name)
    if m:
        return m.group(1).strip()

    # 规则2: 提取核心主题词 + "EXPO"
    # 匹配 "国际/中国 + 核心词 + 展览会/博览会/展/大会/峰会/交易会"
    m = re.search(r'(?:国际|中国)?(.{2,10})(?:展览会|博览会|展|大会|峰会|交易会)', name)
    if m:
        core = m.group(1).strip()
        if core:
            return f"{core} EXPO"

    # 规则3: 用 & / 、 等分隔的第一个有意义的段 + EXPO
    segments = [s for s in re.split(r'[、，,&,\s]', name) if s and len(s) >= 2]
    if segments:
        return f"{segments[0]} EXPO"

    return ''


def is_name_en_valid(name_en: str) -> bool:
    """检查 name_en 是否不包含中文字符。

    Args:
        name_en: 待检查的英文名称

    Returns:
        True 如果不包含中文字符，否则 False
    """
    if not name_en:
        return True  # 空值视为有效（将被其他流程处理）
    return not bool(re.search(r'[一-鿿]', name_en))
