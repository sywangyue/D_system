#!/usr/bin/env python3
"""把 reports/ 下的 docx 调研报告正文抽出来回填进 intel_report，并回写 resource.report_id。

背景（`docs/archive/V2-task-specs.md`（V2-06））：
  reports/ 下 11 份 docx 已经由 scripts/index_resources.py 登记进 resource 表
  （kind='report'，含 company_id 关联），但正文一份都没进 intel_report ——
  报告不可搜索，调研库页面打开是空的。本脚本把正文抽成 Markdown 入库。

可反复重跑：以 report_file 为准判重，已存在同路径的记录就地 UPDATE 正文，
不重复插入（将来新增 docx 直接重跑即可）。

只写 intel_report（除 id 外的列）与 resource.report_id，不动 resource 其他列
（company_id / sha256 / collected_at 归 index_resources.py 维护）。

用法:
  python3 scripts/backfill_reports.py            # dry-run，只打印
  python3 scripts/backfill_reports.py --execute  # 实际写库
"""
import argparse
import re
import sqlite3
from datetime import datetime
from pathlib import Path

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "mwlab.db"

# ── 抬头块：出现在正文标题之前的固定行 ───────────────────────────────
# 实测 11 份 docx 分三个文档族，抬头完全不同（规格 §3 假定只有一种）：
#   族 A（8 份，qcc 标准族）：0 抬头英文法人名 / 1 Messe Düsseldorf China /
#                             2 VERTRAULICHER UNTERSUCHUNGSBERICHT /
#                             3 CONFIDENTIAL INVESTIGATION REPORT /
#                             4 保密企业调研报告 → 5 公司中文名 ← 标题
#   族 B（1 份，川方至 20260612 老版）：0 中文法人名 / 1 Messe Düsseldorf China /
#                             3 企业风险调研报告 / 4 Company Due Diligence Report
#                             → 6 公司中文名 ← 标题（规格写的「第 6 段」出自这份）
#   族 C（2 份，非 qcc 模板）：励泰 4 合 作 伙 伴 深 度 调 研 报 告 →
#                             5 励泰展览（Litai Exhibition）← 标题
#                           FPackAsia 1 MWLAB-2026 · 竞争盘面情报 →
#                             3 FPackAsia 包装展 深度调研报告 ← 标题
# 所以不能用固定下标（对族 A 取第 5 段会拿到「上海励泰展览服务有限公司」✓，
# 但对族 B 拿到空串、对族 C 拿到宣传语或产品条）。改为「按内容跳过抬头」。
LETTERHEAD = re.compile(
    r"messe\s*d[üu]sseldorf|"                                    # 法人名（拉丁写法）
    r"杜塞尔多夫展览|"                                            # 法人名（中文写法，族 B 第 0 段）
    r"vertraulicher\s*untersuchungsbericht|"
    r"confidential\s*investigation\s*report|"
    r"company\s*due\s*diligence\s*report|"
    r"保密企业调研报告|"
    r"企业风险调研报告|"
    r"mwlab-2026",                                               # 报告族产品条
    re.IGNORECASE,
)

# 「文档类型标签」行：整行只是报告文体名，不是标题。
# 归一化（去空白、去两端的装饰横线）后精确匹配或按后缀+长度判定。
DECOR = re.compile(r"^[\s—–\-·]+|[\s—–\-·]+$")
DOCTYPE_EXACT = {
    "保密企业调研报告", "企业风险调研报告", "公司尽职调查报告",
    "深度调研报告", "合作伙伴深度调研报告", "合作伙伴调研报告",
    "竞争对手调研报告", "行业调研报告", "调研报告",
}


def norm_title_line(s: str) -> str:
    """去空白（含全角空格）与两端装饰横线，用于判定是否为抬头/文体标签。"""
    return DECOR.sub("", re.sub(r"\s+", "", s))


def is_noise(line: str) -> bool:
    """抬头块 / 装饰性宣传语 / 纯文体标签 —— 都不该当标题。"""
    n = norm_title_line(line)
    if not n:
        return True
    if LETTERHEAD.search(line):
        return True
    if n in DOCTYPE_EXACT:
        return True
    # 装饰性副题：整行被 —— / -- 包住（如「—— 面向 interpack China 筛选 ——」）
    if re.match(r"^[—–]{1,2}.+[—–]{1,2}$", line.strip()):
        return True
    return False


def pick_title(doc, fallback: str) -> tuple[str, list[str]]:
    """返回 (title, 被跳过的行)。按内容跳过抬头块，取第一个有意义的段落。

    fallback：全部段落都是抬头/空白时（理论上不会发生）用文件名兜底。
    """
    skipped = []
    for para in doc.paragraphs:
        text = " ".join(para.text.split())
        if not text:
            continue
        if is_noise(text):
            skipped.append(text)
            continue
        return text, skipped
    return fallback, skipped


def fallback_title(rel: Path) -> str:
    """文件名去掉 qcc_research_ 前缀与 _{YYYYMMDD}_{HHMMSS} 时间戳。"""
    stem = rel.stem
    stem = re.sub(r"^qcc_research_", "", stem)
    stem = re.sub(r"_\d{8}_\d{6}$", "", stem)
    return stem


def cell_text(cell) -> str:
    """单元格可能有多个段落 → 用 <br> 连接，并转义管道符。"""
    txt = "<br>".join(
        " ".join(p.text.split()) for p in cell.paragraphs if p.text.strip()
    )
    return txt.replace("|", "\\|")


def docx_to_md(path: Path) -> str:
    """docx → Markdown。只用 python-docx（不引 pandoc 等外部二进制）。

    两个必须做对的地方：

    1. 段落与表格按 body 顺序交错输出。docx.Document.paragraphs 与 .tables
       是两个彼此独立的集合，各自取用会把表格全堆到文末，而报告正文里满是
       「见下表」，错位后完全读不通。

    2. 块与块之间才空行，块**内部**不能空行。Markdown 表格的行必须紧挨着，
       中间插一个空行表格就被切成一个个单行表；连续列表项同理。
       所以先在块内用 "\\n" 拼好，最后才用 "\\n\\n" 连接块。
    """
    doc = docx.Document(str(path))
    blocks: list[str] = []
    bullets: list[str] = []

    def flush_bullets() -> None:
        if bullets:
            blocks.append("\n".join(bullets))
            bullets.clear()

    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]

        if tag == "p":
            para = Paragraph(child, doc)
            text = " ".join(para.text.split())
            if not text:
                continue
            style = (para.style.name if para.style is not None else "") or ""
            if style.startswith("Heading"):
                flush_bullets()
                m = re.search(r"(\d+)", style)
                level = min(int(m.group(1)), 6) if m else 1
                blocks.append(f"{'#' * level} {text}")
            elif style == "List Bullet":
                bullets.append(f"- {text}")
            else:
                flush_bullets()
                blocks.append(text)

        elif tag == "tbl":
            flush_bullets()
            table = Table(child, doc)
            rows = [[cell_text(c) for c in r.cells] for r in table.rows]
            rows = [r for r in rows if any(c for c in r)]
            if not rows:
                continue
            width = max(len(r) for r in rows)
            rows = [r + [""] * (width - len(r)) for r in rows]
            lines = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * width]
            lines += ["| " + " | ".join(r) + " |" for r in rows[1:]]
            blocks.append("\n".join(lines))          # 块内单换行 → 一张完整的表

    flush_bullets()
    return "\n\n".join(blocks) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true", help="实际写库；缺省为 dry-run")
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    # reports/ 下所有 docx（跳过 Office 临时文件）
    files = sorted(
        p for p in (ROOT / "reports").rglob("*.docx")
        if not p.name.startswith("~$") and p.stat().st_size > 0
    )

    rows = []
    for p in files:
        rel = p.relative_to(ROOT)
        rel_str = str(rel)

        # company_id 一律从 resource 表取，不重新做名称匹配（规格 §3）
        res = conn.execute(
            "SELECT resource_id, company_id, report_id FROM resource WHERE file_path = ?",
            (rel_str,),
        ).fetchone()

        report_type = (
            "industry_research" if rel.parts[0] == "reports" and rel.parts[1] == "industry"
            else "company_research"
        )
        mtime = datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")

        # title 规则：跳过抬头块取首个有意义的段落；全被跳过时用文件名词根
        _d = docx.Document(str(p))
        title, skipped = pick_title(_d, fallback_title(rel))

        md = docx_to_md(p)
        existing = conn.execute(
            "SELECT id FROM intel_report WHERE report_file = ?", (rel_str,)
        ).fetchone()

        rows.append({
            "file_path": rel_str,
            "report_type": report_type,
            "title": title,
            "skipped": skipped,
            "company_id": res["company_id"] if res else None,
            "registered": res is not None,
            "md": md,
            "created_at": mtime,
            "id": existing["id"] if existing else None,
        })

    # ── dry-run 明细 ────────────────────────────────────────────────
    print(f"reports/ 下找到 {len(files)} 份 docx\n")
    for r in rows:
        action = f"UPDATE id={r['id']}" if r["id"] else "INSERT"
        print(f"  {r['file_path']}")
        print(f"    {r['report_type']:<18} {action:<14} 正文 {len(r['md']):>6} 字符  mtime {r['created_at']}")
        print(f"    标题: {r['title']}")
        if r["skipped"]:
            print(f"    跳过: {r['skipped']}")
        print(f"    company_id: {r['company_id'] if r['company_id'] else '—（resource 未关联）'}"
              f"{'' if r['registered'] else '  ⚠ 该文件未登记进 resource，先跑 index_resources.py'}")
        print()

    matched = sum(1 for r in rows if r["company_id"])
    has_company_col = sum(1 for r in rows if r["report_type"] == "company_research")
    print(f"company_id 从 resource 取到: {matched} / {has_company_col} 份 company_research")
    print(f"industry_research: {sum(1 for r in rows if r['report_type'] == 'industry_research')} 份")
    print(f"预计 intel_report 行数: {conn.execute('SELECT COUNT(*) FROM intel_report').fetchone()[0]} "
          f"+ {sum(1 for r in rows if not r['id'])} 新 / {sum(1 for r in rows if r['id'])} 更新")

    if not args.execute:
        print("\n（dry-run，未写库。加 --execute 实际回填）")
        return

    cur = conn.cursor()
    for r in rows:
        if r["id"]:
            cur.execute(
                """UPDATE intel_report
                      SET report_type=?, report_md=?, report_file=?, company_id=?,
                          title=?, status='published', created_by='backfill_reports.py',
                          created_at=?, updated_at=?
                    WHERE id=?""",
                (r["report_type"], r["md"], r["file_path"], r["company_id"],
                 r["title"], r["created_at"], r["created_at"], r["id"]),
            )
            rid = r["id"]
        else:
            cur.execute(
                """INSERT INTO intel_report
                       (report_type, brand_id, industry_l1, industry_l2, target_company,
                        params_json, report_md, report_file, status, created_by,
                        created_at, updated_at, opp_id, company_id, title)
                   VALUES (?, NULL, NULL, NULL, NULL, '{}', ?, ?, 'published',
                           'backfill_reports.py', ?, ?, NULL, ?, ?)""",
                (r["report_type"], r["md"], r["file_path"],
                 r["created_at"], r["created_at"], r["company_id"], r["title"]),
            )
            rid = cur.lastrowid

        # 回写 resource.report_id —— 只动这一列
        cur.execute(
            "UPDATE resource SET report_id = ? WHERE file_path = ?", (rid, r["file_path"])
        )

    conn.commit()

    print(f"\n✓ intel_report 现有 {conn.execute('SELECT COUNT(*) FROM intel_report').fetchone()[0]} 行")
    print(f"✓ resource 中 report_id 非空 "
          f"{conn.execute('SELECT COUNT(*) FROM resource WHERE report_id IS NOT NULL').fetchone()[0]} 行")


if __name__ == "__main__":
    main()
