#!/usr/bin/env python3
"""把 reports/ exports/ research/ 下的报告与采集资源登记进 resource 表。

可反复重跑：以 file_path 为唯一键，已登记的刷新 size/sha256，不重复插入。
文件本身不动，本脚本只建索引。

用法:
  python3 scripts/index_resources.py            # dry-run，只打印
  python3 scripts/index_resources.py --execute  # 实际写库
"""
import argparse, hashlib, mimetypes, re, sqlite3, sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "mwlab.db"

# qcc_research_{公司名}_{YYYYMMDD}_{HHMMSS}[_raw].{docx|json}
QCC = re.compile(r"^qcc_research_(?P<name>.+?)_(?P<d>\d{8})_(?P<t>\d{6})(?P<raw>_raw)?\.(docx|json)$")
SKIP = {".py", ".pyc", ".DS_Store", ".gitkeep"}


def norm(s: str) -> str:
    """归一化公司名用于匹配：只保留中日韩字符与字母数字。

    文件名里 `华尔科技_河南_集团有限公司` 对应库里 `华尔科技（河南）集团有限公司` ——
    全角括号在落盘时被替换成了下划线。注意下划线在正则 \\w 里算 word 字符，
    必须显式排除，否则文件名侧留着 `_`、库侧括号被去掉，两边永远对不上。
    """
    return re.sub(r"[^0-9a-zA-Z一-鿿]", "", s)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def classify(rel: Path, name: str):
    """→ (kind, source, company_name_or_None, collected_at_or_None)"""
    parts = rel.parts
    m = QCC.match(name)
    if m:
        kind = "raw" if m.group("raw") else "report"
        ts = datetime.strptime(m.group("d") + m.group("t"), "%Y%m%d%H%M%S")
        return kind, "qcc", m.group("name"), ts.isoformat(sep=" ")

    ext = rel.suffix.lower()
    if parts[0] == "exports":
        return "export", "manual", None, None
    if parts[0] == "research":
        return ("note" if ext == ".md" else "roster"), "manual", None, None
    if parts[0] == "reports":
        if ext == ".docx":
            return "report", "manual", None, None
        if ext in (".xlsx", ".xls"):
            return "roster", "manual", None, None
        return "export", "manual", None, None
    return "note", "manual", None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true", help="实际写库；缺省为 dry-run")
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    companies = {norm(r["name"]): r["company_id"]
                 for r in conn.execute("SELECT company_id, name FROM company")}

    rows, unmatched = [], []
    for d in ("reports", "exports", "research"):
        base = ROOT / d
        if not base.exists():
            continue
        for p in sorted(base.rglob("*")):
            if not p.is_file() or p.suffix in SKIP or p.name.startswith("."):
                continue
            rel = p.relative_to(ROOT)
            kind, source, cname, collected = classify(rel, p.name)
            company_id = None
            if cname:
                company_id = companies.get(norm(cname))
                if company_id is None:
                    unmatched.append(cname)
            if collected is None:
                collected = datetime.fromtimestamp(p.stat().st_mtime).isoformat(sep=" ", timespec="seconds")
            rows.append({
                "kind": kind, "title": p.stem, "file_path": str(rel),
                "mime": mimetypes.guess_type(p.name)[0],
                "size_bytes": p.stat().st_size, "sha256": sha256(p),
                "company_id": company_id, "source": source, "collected_at": collected,
                "created_by": "index_resources.py",
            })

    by_kind = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    print(f"扫描到 {len(rows)} 个资源文件")
    for k, v in sorted(by_kind.items(), key=lambda x: -x[1]):
        print(f"  {k:<8} {v}")
    matched = sum(1 for r in rows if r["company_id"])
    print(f"\n匹配到公司的: {matched} / {sum(1 for r in rows if r['source']=='qcc')} 条 qcc 资源")
    if unmatched:
        print(f"未匹配公司名（{len(set(unmatched))} 个）: {sorted(set(unmatched))}")

    dupes = {}
    for r in rows:
        dupes.setdefault(r["sha256"], []).append(r["file_path"])
    dup_groups = {k: v for k, v in dupes.items() if len(v) > 1}
    if dup_groups:
        print(f"\n字节级重复 {len(dup_groups)} 组:")
        for v in list(dup_groups.values())[:5]:
            print("  " + " == ".join(v))

    if not args.execute:
        print("\n（dry-run，未写库。加 --execute 实际登记）")
        return

    cur = conn.cursor()
    for r in rows:
        cur.execute("""
            INSERT INTO resource (kind,title,file_path,mime,size_bytes,sha256,
                                  company_id,source,collected_at,created_by)
            VALUES (:kind,:title,:file_path,:mime,:size_bytes,:sha256,
                    :company_id,:source,:collected_at,:created_by)
            ON CONFLICT(file_path) DO UPDATE SET
                size_bytes=excluded.size_bytes, sha256=excluded.sha256,
                mime=excluded.mime,
                company_id=COALESCE(resource.company_id, excluded.company_id)
        """, r)
    conn.commit()
    print(f"\n✓ 已登记 {conn.execute('SELECT COUNT(*) FROM resource').fetchone()[0]} 条")


if __name__ == "__main__":
    main()
