#!/usr/bin/env python3
"""014 迁移校验 —— 逐字段与备份比对，行数相等不作数。

用法: python3 scripts/verify_migration_014.py <迁移后的库> <迁移前的备份>
"""
import sqlite3, sys, json

AFTER, BEFORE = sys.argv[1], sys.argv[2]
a = sqlite3.connect(AFTER);  a.row_factory = sqlite3.Row
b = sqlite3.connect(BEFORE); b.row_factory = sqlite3.Row
fails, checks = [], 0

def ck(name, cond, detail=""):
    global checks
    checks += 1
    print(f"  {'✓' if cond else '✗'} {name}" + (f"  {detail}" if detail and not cond else ""))
    if not cond: fails.append(name)

def cols(conn, t):
    return [r[1] for r in conn.execute(f"PRAGMA table_info({t})")]

def tables(conn):
    return {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}

print("\n【1】空表已删除")
for t in ("person","exhibition_contact","contact_relation",
          "exhibition_relation","exhibition_timeline"):
    ck(f"{t} 已删", t not in tables(a))

print("\n【2】company 逐字段比对（关键：不能只看行数）")
n_b = b.execute("SELECT COUNT(*) FROM customer_prospect").fetchone()[0]
n_a = a.execute("SELECT COUNT(*) FROM company").fetchone()[0]
ck(f"行数 {n_b} → {n_a}", n_b == n_a, f"差 {n_b - n_a}")

# 重命名映射；intel_report_id 是本次有意删除的列
RENAME = {"id": "company_id", "company_name": "name"}
old_cols = [c for c in cols(b, "customer_prospect") if c != "intel_report_id"]
new_cols = cols(a, "company")
for oc in old_cols:
    ck(f"列 {oc} → {RENAME.get(oc, oc)} 存在", RENAME.get(oc, oc) in new_cols)
ck("intel_report_id 已删", "intel_report_id" not in new_cols)
for nc in ("name_en","type","city","country"):
    ck(f"新列 {nc}", nc in new_cols)

# 真正的逐字段值比对：全部 495 行、全部保留列，逐格比
rows_b = {r["id"]: r for r in b.execute("SELECT * FROM customer_prospect")}
rows_a = {r["company_id"]: r for r in a.execute("SELECT * FROM company")}
ck("主键集合一致", set(rows_b) == set(rows_a),
   f"仅在前: {list(set(rows_b)-set(rows_a))[:5]} 仅在后: {list(set(rows_a)-set(rows_b))[:5]}")
diffs = []
for pk in set(rows_b) & set(rows_a):
    for oc in old_cols:
        if oc == "id": continue
        vb, va = rows_b[pk][oc], rows_a[pk][RENAME.get(oc, oc)]
        if vb != va:
            diffs.append((pk, oc, vb, va))
ck(f"逐格值比对 {len(set(rows_b)&set(rows_a))} 行 × {len(old_cols)-1} 列 = "
   f"{(len(set(rows_b)&set(rows_a)))*(len(old_cols)-1)} 格",
   not diffs, f"前 3 处不一致: {diffs[:3]}")

print("\n【3】UNIQUE 索引未丢（去重逻辑依赖）")
idx = {r[0] for r in a.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='company'")}
ck("idx_company_brand_qcc (UNIQUE)", "idx_company_brand_qcc" in idx, str(sorted(idx)))
uniq = a.execute("SELECT sql FROM sqlite_master WHERE name='idx_company_brand_qcc'").fetchone()
ck("该索引确实是 UNIQUE", uniq and "UNIQUE" in uniq[0].upper())

print("\n【4】intel_report 原数据完好 + 新列就位")
ck("行数 2", a.execute("SELECT COUNT(*) FROM intel_report").fetchone()[0] ==
             b.execute("SELECT COUNT(*) FROM intel_report").fetchone()[0])
ir_b = {r["id"]: dict(r) for r in b.execute("SELECT * FROM intel_report")}
ir_a = {r["id"]: dict(r) for r in a.execute("SELECT * FROM intel_report")}
ck("原有字段逐格一致",
   all(ir_b[k][c] == ir_a[k][c] for k in ir_b for c in ir_b[k]))
for nc in ("opp_id","company_id","title"):
    ck(f"新列 {nc}", nc in cols(a, "intel_report"))

print("\n【5】展会四表结构与数据零改动（除 exhibition_brand 新增 company_id）")
for t in ("exhibition_edition","brand_organizer","brand_geo_tag",
          "data_provenance","manual_tag_history","crawl_log","user"):
    nb = b.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    na = a.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    ck(f"{t} {nb} 行未变 且 列未变", nb == na and cols(b,t) == cols(a,t))
eb_b, eb_a = cols(b,"exhibition_brand"), cols(a,"exhibition_brand")
ck("exhibition_brand 行数未变",
   b.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0] ==
   a.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0])
ck("exhibition_brand 仅新增 company_id", eb_a == eb_b + ["company_id"],
   f"差异: {set(eb_a)^set(eb_b)}")

print("\n【6】新表结构")
for t in ("opportunity","opportunity_event"):
    ck(f"{t} 已建且为空", t in tables(a) and
       a.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] == 0)
# CHECK 约束真的生效？插一条非法数据试试
try:
    a.execute("INSERT INTO opportunity(type,title,created_by) VALUES('bogus','x','t')")
    ck("type 的 CHECK 约束生效", False, "非法 type 竟然插入成功")
    a.rollback()
except sqlite3.IntegrityError:
    ck("type 的 CHECK 约束生效", True)
try:
    a.execute("INSERT INTO opportunity(type,title,priority,created_by) VALUES('ma','x',9,'t')")
    ck("priority 1-5 约束生效", False, "priority=9 竟然插入成功")
    a.rollback()
except sqlite3.IntegrityError:
    ck("priority 1-5 约束生效", True)
a.rollback()

print("\n" + "─"*56)
print(f"共 {checks} 项检查，{len(fails)} 项失败")
if fails:
    print("失败项:"); [print("  ·", f) for f in fails]
    sys.exit(1)
print("✓ 全部通过")
