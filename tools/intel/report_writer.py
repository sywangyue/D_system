#!/usr/bin/env python3
"""
tools/intel/report_writer.py — 报告写入工具

将调研报告同时持久化到：
  1. mwlab.db → intel_report 表
  2. 文件系统 → reports/{industry|brand|customer}/<slug>.md

用法（命令行测试）:
  python3 tools/intel/report_writer.py \
      --type industry_research \
      --industry-l1 "机械和设备" \
      --content "### 行业概览..."

  python3 tools/intel/report_writer.py \
      --type brand_research \
      --brand-id "EXPO-0001" \
      --content "### 品牌基本信息..."
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = _REPO_ROOT / "mwlab.db"

_REPORT_DIRS: dict[str, Path] = {
    "industry_research": _REPO_ROOT / "reports" / "industry",
    "brand_research":    _REPO_ROOT / "reports" / "brand",
    "batch_prospect":    _REPO_ROOT / "reports" / "customer",
    "single_prospect":   _REPO_ROOT / "reports" / "customer",
}


def _slugify(text: str) -> str:
    """简单 slug：保留字母数字中文，其余换 _，截断到 60 字符。"""
    text = re.sub(r"[^\w一-鿿]", "_", text)
    return text[:60]


def _report_filename(report_type: str, params: dict) -> Path:
    """生成报告文件路径（不保证唯一，带时间戳）。"""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    slug_parts: list[str] = []
    if report_type == "industry_research":
        slug_parts.append(_slugify(params.get("industry_l1", "unknown")))
        if params.get("industry_l2"):
            slug_parts.append(_slugify(params["industry_l2"]))
    elif report_type == "brand_research":
        slug_parts.append(_slugify(params.get("brand_id", "unknown")))
    elif report_type in ("batch_prospect", "single_prospect"):
        slug_parts.append(_slugify(params.get("target_company", params.get("brand_id", "unknown"))))

    slug = "_".join(slug_parts) or "report"
    filename = f"{report_type}_{slug}_{ts}.md"
    return _REPORT_DIRS[report_type] / filename


def write_report(
    report_type: str,
    content_md: str,
    brand_id: str | None = None,
    industry_l1: str | None = None,
    industry_l2: str | None = None,
    target_company: str | None = None,
    params: dict | None = None,
    status: str = "published",
    created_by: str = "claude-code",
) -> int:
    """
    写入调研报告到 DB + 文件系统，返回 intel_report.id。

    参数:
        report_type:    'industry_research' | 'brand_research' | 'batch_prospect' | 'single_prospect'
        content_md:     Markdown 报告正文
        brand_id:       展会品牌 ID（brand_research / batch_prospect 时必填）
        industry_l1:    行业一级分类（industry_research 时必填）
        industry_l2:    行业二级分类（可选）
        target_company: 目标公司名（single_prospect 时必填）
        params:         额外参数，存为 JSON
        status:         'draft' | 'published' | 'archived'
        created_by:     操作者标识
    """
    valid_types = {"industry_research", "brand_research", "batch_prospect", "single_prospect"}
    if report_type not in valid_types:
        raise ValueError(f"report_type 必须是 {valid_types} 之一，得到: {report_type}")

    params_dict = {
        "brand_id": brand_id,
        "industry_l1": industry_l1,
        "industry_l2": industry_l2,
        "target_company": target_company,
        **(params or {}),
    }

    # 生成并写入 .md 文件
    report_path = _report_filename(report_type, params_dict)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(content_md, encoding="utf-8")

    # 文件路径相对于项目根
    rel_path = str(report_path.relative_to(_REPO_ROOT))

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.execute(
            """
            INSERT INTO intel_report
                (report_type, brand_id, industry_l1, industry_l2,
                 target_company, params_json, report_md, report_file,
                 status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report_type,
                brand_id,
                industry_l1,
                industry_l2,
                target_company,
                json.dumps(params_dict, ensure_ascii=False),
                content_md,
                rel_path,
                status,
                created_by,
                now,
                now,
            ),
        )
        conn.commit()
        report_id = cur.lastrowid
    finally:
        conn.close()

    return report_id


def main() -> None:
    parser = argparse.ArgumentParser(description="调研报告写入工具（DB + 文件系统）")
    parser.add_argument("--type", required=True, dest="report_type",
                        choices=["industry_research", "brand_research", "batch_prospect", "single_prospect"],
                        help="报告类型")
    parser.add_argument("--brand-id", help="展会品牌 ID")
    parser.add_argument("--industry-l1", help="行业 L1")
    parser.add_argument("--industry-l2", help="行业 L2")
    parser.add_argument("--target-company", help="目标公司名")
    parser.add_argument("--content", help="报告 Markdown 内容（字符串）")
    parser.add_argument("--content-file", help="报告内容文件路径（--content 和 --content-file 二选一）")
    parser.add_argument("--status", default="published",
                        choices=["draft", "published", "archived"])
    args = parser.parse_args()

    if args.content:
        content_md = args.content
    elif args.content_file:
        content_md = Path(args.content_file).read_text(encoding="utf-8")
    else:
        parser.error("必须提供 --content 或 --content-file")

    report_id = write_report(
        report_type=args.report_type,
        content_md=content_md,
        brand_id=args.brand_id,
        industry_l1=args.industry_l1,
        industry_l2=args.industry_l2,
        target_company=args.target_company,
        status=args.status,
    )
    print(f"报告已写入 → intel_report.id = {report_id}")


if __name__ == "__main__":
    main()
