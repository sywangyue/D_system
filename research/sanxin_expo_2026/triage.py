# -*- coding: utf-8 -*-
"""三新展名单初筛：规则分层 + mwlab 主办方匹配。只读，输出 CSV。"""
import json, re, csv, sqlite3, unicodedata

import os
BASE=os.path.dirname(os.path.abspath(__file__))   # 脚本自身所在目录
DB = "/Volumes/databoard/AI Project/D_dashboard/data/mwlab.db"

roster = json.load(open(f"{BASE}/roster.json"))
att, vis = set(roster["attendee"]), set(roster["visitor"])
names = sorted(att | vis)

# 国际同行（杜塞的竞争对手，按要求不调研）
RIVAL = ["koelnmesse", "rx global", "励展", "英富曼", "informa", "慕尼黑展览", "中贸慕尼黑",
         "法兰克福展览", "汉诺威米兰", "gl events", "hyve", "海维", "ite china", "博华展览",
         "杜塞尔多夫展览"]
VENUE = r"会展中心|博览中心|会议中心|展览中心|科学会堂|展览馆|国际会展|会展会堂|博览馆|交流中心|会议展览中心|博览城"
HOTEL = r"酒店|希尔顿|温德姆|铂尔曼|丽思卡尔顿|洲际|康得思|lyf|大酒店|旅业|hospitality"
GOV   = r"贸促会|商务局|投资促进局|协会|学会|办事处|大学|学院|人民政府|促进中心|会展办|专委会|总商会|电视台|商行"
ORG   = r"展览|会展|博览|展会|展示|会议|expo|messe|events?\b"
SVC   = r"科技|信息技术|网络|数字|传媒|广告|文化传播|翻译|物流|货运|旅行社|设计|搭建|工程|保险|公关|印刷|租赁|摄影|支付宝|机器人|医药|钢铁|橡胶|营养|银行"

def norm(s):
    s = unicodedata.normalize("NFKC", s).lower()
    return re.sub(r"[\s()（）\[\]、,，。·\-]", "", s)

def core(s):
    """取企业核心词：去地域前缀与组织形式后缀"""
    s = re.sub(r"[（(].*?[)）]", "", s)
    s = re.sub(r"(股份)?有限(责任)?公司|集团|公司$", "", s)
    s = re.sub(r"^(北京|上海|广州|深圳|天津|重庆|成都|杭州|南京|武汉|西安|厦门|青岛|苏州|无锡|宁波|济南|郑州|合肥|长沙|福州|三亚|海南|山东|江苏|浙江|广东|河北|河南|四川|安徽|福建|湖南|湖北|新疆|黑龙江|辽宁|吉林|陕西|甘肃|云南|贵州|广西|江西|山西|内蒙古|中国)(省|市)?", "", s)
    return s.strip()

def tier(n):
    ln = norm(n)
    if any(r in ln for r in RIVAL): return "E-国际同行(排除)"
    if re.search(HOTEL, n, re.I): return "D-酒店/文旅"
    if re.search(VENUE, n): return "C-场馆"
    if re.search(GOV, n):   return "D-政府/协会/院校"
    if re.search(ORG, n, re.I): return "A-会展公司(待核)"
    if re.search(SVC, n, re.I): return "B-服务商/科技"
    return "F-未分类"

con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
orgs = con.execute("""select o.canonical, o.raw_token, o.brand_id, b.name_cn
                      from brand_organizer o join exhibition_brand b using(brand_id)""").fetchall()
idx = {}
for r in orgs:
    for k in (norm(core(r["raw_token"])), norm(core(r["canonical"]))):
        if len(k) >= 3: idx.setdefault(k, []).append(r)

rows = []
for n in names:
    k = norm(core(n))
    hits = []
    if len(k) >= 3:
        for key, rs in idx.items():
            if k == key or (len(k) >= 4 and (k in key or key in k)):
                hits += rs
    seen, brands = set(), []
    for h in hits:
        if h["brand_id"] not in seen:
            seen.add(h["brand_id"]); brands.append(f'{h["name_cn"]}')
    src = ("参会" if n in att else "") + ("/观众" if n in vis else "")
    rows.append({"机构名称": n, "名单来源": src.strip("/"), "初筛分层": tier(n),
                 "mwlab命中展会数": len(brands), "mwlab命中展会": " | ".join(brands[:6])})

with open(f"{BASE}/triage.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

from collections import Counter
c = Counter(r["初筛分层"] for r in rows)
for k, v in sorted(c.items()): print(f"{k:22s} {v:4d}")
print("---")
print("有 mwlab 命中的机构:", sum(1 for r in rows if r["mwlab命中展会数"] > 0))
print("A 类中有命中的:", sum(1 for r in rows if r["初筛分层"].startswith("A") and r["mwlab命中展会数"] > 0))
