#!/usr/bin/env python3
"""按展览面积对主办方排序，并统一主办方名称。

口径（2026-08-05 与 Max 确认）：
  - 只统计办展主体（企业型），过滤政府机关 / 行业协会 / 组委会挂名单位
  - 归并粒度：集团级（见 tools/organizer_alias.json）
  - 年份范围：默认 2026

用法:
  python3 tools/rank_organizers.py                 # 输出 Top 排行榜
  python3 tools/rank_organizers.py --year 2026 --top 50
  python3 tools/rank_organizers.py --out out.csv   # 导出全量 CSV
  python3 tools/rank_organizers.py --unmapped 60   # 列出未进词典的高面积 token
"""
import argparse
import csv
import json
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "mwlab.db"
ALIAS_FILE = Path(__file__).resolve().parent / "organizer_alias.json"

# 英文公司后缀：出现在英文逗号右侧时不切分（ABC Co., Ltd.）
CORP_SUFFIX = re.compile(r"^\s*(Ltd|Inc|LLC|L\.L\.C|Co|Corp|S\.A|S\.p\.A|Pvt|Pte|LLP|GmbH|AG|BV|NV|PLC|SRL)\b", re.I)
CN_SEP = re.compile(r"[，、；;｜|／]")
BRACKETS = {"（": "）", "(": ")", "【": "】", "[": "]"}

ORGCOM = re.compile(r"组委会|组织委员会|办公室$|执委会")
GOV = re.compile(
    r"人民政府|商务部|工信部|科技部|科学技术部|发改委|发展和改革委员会|工业和信息化部|农业农村|文化和旅游"
    r"|中华人民共和国|市委|省委|办公厅|管委会|政府|东盟秘书处|联合国|国家电网|广域市|部$|[厅局]$"
)
ASSOC = re.compile(
    r"协会|学会|商会|联合会|促进会|理事会|联盟|工会|研究会|基金会|贸促会|学院|大学|研究院"
    r"|中国科学院|中国工程院|委员会|总会|专委会|中心$"
)
CORP = re.compile(
    r"有限公司|股份|集团|公司|展览|会展|博览|电视台|传媒|控股"
    r"|\bLtd\b|\bLLC\b|\bInc\b|\bGmbH\b|\bCorp|\bCo\.|Exhibition|Expo|Fair|Messe|Media|Events|Group"
    r"|\bPte\b|\bPvt\b|S\.A|S\.p\.A|Promotion|Communications",
    re.I,
)


def split_organizer(raw: str) -> list[str]:
    """把主办方字符串切成单位 token，修复英文后缀误切与括号断裂。"""
    # 1) 先按中文分隔符切
    parts = []
    for chunk in CN_SEP.split(raw):
        # 2) 英文逗号：右侧是公司后缀则不切
        buf = ""
        for piece in chunk.split(","):
            if buf and CORP_SUFFIX.match(piece):
                buf += "," + piece
            else:
                if buf:
                    parts.append(buf)
                buf = piece
        if buf:
            parts.append(buf)

    # 3) 括号断裂修复：左括号未闭合的片段与后续片段重新粘合
    merged, pending, need = [], "", None
    for p in parts:
        if pending:
            pending += "，" + p
            if need in p:
                merged.append(pending)
                pending, need = "", None
            continue
        opens = [(o, c) for o, c in BRACKETS.items() if p.count(o) > p.count(c)]
        if opens:
            pending, need = p, opens[0][1]
        else:
            merged.append(p)
    if pending:
        merged.append(pending)

    out, seen = [], set()
    for t in merged:
        t = t.strip().strip("　 \t·•")
        # 仅剥去真正包裹全串的一对括号。"（上海）会展公司（Hyve）" 首尾虽都是括号
        # 但不是同一对，必须保留。
        while len(t) > 1 and t[0] in BRACKETS and t[-1] == BRACKETS[t[0]]:
            close, depth = BRACKETS[t[0]], 0
            for i, ch in enumerate(t):
                depth += (ch == t[0]) - (ch == close)
                if depth == 0 and i < len(t) - 1:
                    break           # 首括号在中途就闭合了，说明不是整体包裹
            else:
                t = t[1:-1].strip()
                continue
            break
        # 剩余的孤立左括号（仅在括号数量不平衡时剥，否则会打断 "（上海）XX（YY）"）
        while t and t[0] in BRACKETS and t.count(t[0]) > t.count(BRACKETS[t[0]]):
            t = t[1:].strip()
        t = re.sub(r"\s+", " ", t)
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


class Aliases:
    def __init__(self, path: Path):
        cfg = json.loads(path.read_text(encoding="utf-8"))
        self.drop = {d.strip().lower() for d in cfg["drop_tokens"]}
        self.groups = []
        for g in cfg["groups"]:
            self.groups.append((
                g["canonical"],
                g["type"],
                g.get("confidence", "high"),
                [re.compile(p, re.I) for p in g["patterns"]],
                [re.compile(p, re.I) for p in g.get("exclude", [])],
                g.get("country_split"),
            ))

    def lookup(self, token: str, country: str = ""):
        """返回 (canonical, type, confidence) 或 None。

        country 用于同名品牌因资产剥离而分属不同公司的情形（见 ITE/Hyve）。
        """
        for canonical, typ, conf, pats, excs, split in self.groups:
            if any(e.search(token) for e in excs):
                continue
            if not any(p.search(token) for p in pats):
                continue
            if split and country:
                if country in split["map"]:
                    return split["map"][country], typ, "high"
                if country in split["ambiguous"]:
                    return split["ambiguous_canonical"], typ, "check"
            return canonical, typ, conf
        return None


def classify(token: str) -> str:
    if ORGCOM.search(token):
        return "组委会"
    if GOV.search(token):
        return "政府"
    if ASSOC.search(token):
        return "协会"
    if CORP.search(token):
        return "企业"
    return "其他"


def normalize_corp_name(token: str) -> str:
    """未进词典的企业型 token 做轻量规范化，收敛「XX展览公司/XX展览有限公司」这类写法差异。"""
    t = token.strip()
    t = re.sub(r"[（(]\s*[)）]", "", t)
    t = re.sub(r"(股份)?(有限)?(责任)?公司$", "", t)
    t = re.sub(r"^(德国|法国|英国|美国|日本|韩国|意大利|西班牙|荷兰|波兰|土耳其|印度|俄罗斯)", "", t)
    return t.strip() or token.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--out", help="导出全量 CSV 路径")
    ap.add_argument("--unmapped", type=int, default=0, help="列出未进词典的高面积 token 数量")
    ap.add_argument("--include-all-types", action="store_true", help="不过滤政府/协会/组委会")
    ap.add_argument("--dedup", action="store_true",
                    help="同(城市,面积,展商数)视为同一展会，只保留一条，规避重复品牌虚增面积")
    args = ap.parse_args()

    if not DB.exists():
        sys.exit(f"数据库不存在: {DB}")
    aliases = Aliases(ALIAS_FILE)
    db = sqlite3.connect(DB)
    rows = db.execute(
        """SELECT b.brand_id, b.name_cn, b.organizer, e.area_sqm, e.city, e.exhibitors_count, b.country_cn
           FROM exhibition_brand b JOIN exhibition_edition e ON e.brand_id = b.brand_id
           WHERE e.year = ? AND e.area_sqm > 0 AND b.organizer != ''""",
        (args.year,),
    ).fetchall()

    dropped_dup = 0
    if args.dedup:
        kept, seen_sig = [], set()
        for r in rows:
            sig = (r[4], r[3], r[5])
            if sig in seen_sig:
                dropped_dup += 1
                continue
            seen_sig.add(sig)
            kept.append(r)
        rows = kept

    agg = defaultdict(lambda: {"area": 0, "brands": 0, "type": "", "conf": "", "raw": set()})
    unmapped = defaultdict(lambda: {"area": 0, "n": 0})
    skipped_area = defaultdict(int)

    for brand_id, name_cn, organizer, area, _city, _exh, country in rows:
        for token in split_organizer(organizer):
            if token.lower() in aliases.drop:
                continue
            hit = aliases.lookup(token, country)
            if hit:
                canonical, typ, conf = hit
            else:
                typ = classify(token)
                canonical = normalize_corp_name(token) if typ == "企业" else token
                conf = "auto"
                if typ in ("企业", "其他"):
                    u = unmapped[canonical]
                    u["area"] += area
                    u["n"] += 1
            if not args.include_all_types and typ != "企业":
                skipped_area[typ] += area
                continue
            rec = agg[canonical]
            rec["area"] += area
            rec["brands"] += 1
            rec["type"] = typ
            rec["conf"] = conf if rec["conf"] in ("", conf) else "mixed"
            rec["raw"].add(token)

    ranked = sorted(agg.items(), key=lambda kv: -kv[1]["area"])
    total = sum(v["area"] for _, v in ranked)

    dedup_note = f" | 已去重剔除 {dropped_dup} 条" if args.dedup else ""
    print(f"年份 {args.year} | 参与统计品牌 {len(rows)}{dedup_note} | 办展主体 {len(ranked)} 家 | 面积口径合计 {total/10000:,.0f} 万㎡")
    if skipped_area:
        s = "  ".join(f"{k} {v/10000:,.0f}万㎡" for k, v in sorted(skipped_area.items(), key=lambda x: -x[1]))
        print(f"已过滤挂名单位面积: {s}")
    print()
    print(f"{'#':>3} {'主办方':<30}{'面积(万㎡)':>11}{'展会数':>7}{'均面积':>8}  别名数")
    print("-" * 78)
    for i, (name, v) in enumerate(ranked[: args.top], 1):
        avg = v["area"] / v["brands"] / 10000
        flag = " ⚠" if v["conf"] == "check" else ""
        print(f"{i:>3} {name:<30}{v['area']/10000:>11,.1f}{v['brands']:>7}{avg:>8.2f}  {len(v['raw'])}{flag}")

    if args.unmapped:
        print(f"\n未进词典、面积最高的 {args.unmapped} 个 token（人工确认是否需要归并）:")
        for name, v in sorted(unmapped.items(), key=lambda kv: -kv[1]["area"])[: args.unmapped]:
            print(f"  {v['area']/10000:>8.1f}万  x{v['n']:<3} {name}")

    if args.out:
        with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["排名", "主办方(集团级)", "总面积_sqm", "总面积_万sqm", "展会数", "均面积_sqm", "置信度", "原始写法"])
            for i, (name, v) in enumerate(ranked, 1):
                w.writerow([i, name, v["area"], round(v["area"] / 10000, 2), v["brands"],
                            round(v["area"] / v["brands"]), v["conf"], " | ".join(sorted(v["raw"]))])
        print(f"\n已导出: {args.out}")


if __name__ == "__main__":
    main()
