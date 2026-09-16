# -*- coding: utf-8 -*-
"""生成调研队列：显式排除确定无自办展的类型，其余全部进搜索队列。"""
import json, csv, re, unicodedata, sqlite3

import os
BASE=os.path.dirname(os.path.abspath(__file__))   # 脚本自身所在目录
DB = "/Volumes/databoard/AI Project/D_dashboard/data/mwlab.db"
r = json.load(open(f"{BASE}/roster.json"))
att, vis, exh = set(r["attendee"]), set(r["visitor"]), set(r["exhibitor"])
names = sorted(att | vis | exh)

# ---- 显式排除（确定不是自办展主体）----
EXCLUDE = [
 # 国际同行 = 杜塞竞争对手
 (r"Koelnmesse|RX Global|励展|英富曼|Informa|慕尼黑展览|中贸慕尼黑|法兰克福展览|汉诺威米兰|GL events|Hyve|海维\(|海维\（|ITE China|杜塞尔多夫展览|博华展览|博罗那展览", "国际同行(竞争对手)"),
 # 住宿/餐饮
 (r"酒店|希尔顿|温德姆|铂尔曼|丽思卡尔顿|洲际|康得思|lyf|大酒店|振石|悦华|博鳌亚洲湾|滴水湖|开元旅业|远洲旅业|涵田|拈花湾|水月周庄|东钱湖|钱湖", "酒店/住宿文旅"),
 # 院校
 (r"大学|学院|闽江|复旦|同济|交大思源", "院校"),
 # 纯执行类服务：搭建/物流/翻译/保险/摄影/旅行社/印刷/租赁
 (r"搭建|装饰工程|展示工程|空间设计|建筑工程|物流|货运|冷链|翻译|保险|摄影|咔拍|旅行社|假期|印刷|纸制品|租赁|租达人|广告有限公司|广告$|设备有限公司|钢铁|橡胶股份|恒瑞医药|营养科技|微巍|机器人有限公司|纳恩博|九号|支付宝|蚂蚁集团|园林|工厂|株氏会社|JNL TECH|XRISE|Lucky Star Messe Design", "执行类服务商/非会展主体"),
  # 纯科技/营销服务商：名字里无"会展/展览/博览/展会"且属这些形态
 (r"信息科技|网络科技|数字科技|数智科技|智能科技|信息技术|电子商务|文化传媒|文化传播|文化发展|文化创意|传播科技|品牌策划|品牌管理|营销策划|市场营销|商务咨询|企业管理咨询|公关|创意策划|形象策划|实业|贸易|商行|电视台|人民政府|办事处|商务局|投资促进局|经贸发展|服务集团", "科技/营销服务商"),
]
# ---- 强制纳入（名字看着像服务商，但已知/疑似自办展主体）----
FORCE = ["决策者", "博迈思", "易贸", "有色网", "红餐", "万怡医学", "医会通", "药融圈", "高顿",
         "东浩兰生", "威客引力", "智海王潮", "双威文化", "云合智能", "材青社", "苦瓜科技",
         "银发经贸", "老博会", "华墨", "亚果会", "米多多", "荟源", "国贸集团", "吉祥国际",
         "超宇集团", "仕邦", "承一", "迈世", "星直采", "橙策美致", "红橙", "强国智造",
         "宠医声", "投行前哨站", "智享会", "时间博物馆", "路程网", "房车行", "芭蕉鱼",
         "创客AI", "海棠智会", "如期响", "财金社", "高朋", "游哉优哉", "医慧视点",
         "淀沪企业服务", "中建科工", "展大人", "展讯网", "展查查", "励销云", "昊商易通",
         "斜杠和弦", "开展么", "数展科技", "云会通", "华集信息", "博正企业管理", "Nebula Events",
         "Mason Events", "Connect Build", "MP新加坡", "TP Media", "BFC CHINA", "ATC", "LISO",
         "CPCA", "CMES", "Focus", "eastsrarchina", "wmedia", "阅视界", "申办", "中会整合",
         "墨马", "领威智联", "会大咖", "华锐会务", "清扬会务", "会优会务", "青年宏图", "数雅云",
         "展创科技", "同路国际展览", "鲲鹏展翼", "华诺展览", "迈塔维斯", "旗天展览", "科诺会展",
         "拉码国际", "信源物流"]

def norm(s): return unicodedata.normalize("NFKC", s).lower()
def core(s):
    s = re.sub(r"[（(].*?[)）]", "", s)
    s = re.sub(r"(股份)?有限(责任)?公司|集团|公司$", "", s)
    s = re.sub(r"^(北京|上海|广州|深圳|天津|重庆|成都|杭州|南京|武汉|西安|厦门|青岛|苏州|无锡|宁波|济南|郑州|合肥|长沙|福州|三亚|海南|山东|江苏|浙江|广东|河北|河南|四川|安徽|福建|湖南|湖北|新疆|黑龙江|辽宁|吉林|陕西|甘肃|云南|贵州|广西|江西|山西|内蒙古|中国)(省|市)?", "", s)
    return s.strip()

con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
rowsdb = con.execute("""select o.raw_token,o.canonical,o.brand_id,b.name_cn,b.industry_l1,
                        (select max(area_sqm) from exhibition_edition e where e.brand_id=b.brand_id) area
                        from brand_organizer o join exhibition_brand b using(brand_id)""").fetchall()
idx = {}
for x in rowsdb:
    for k in (norm(core(x["raw_token"])), norm(core(x["canonical"]))):
        if len(k) >= 3: idx.setdefault(k, []).append(x)

out = []
for n in names:
    forced = any(f.lower() in norm(n) for f in FORCE)
    reason = ""
    has_expo = bool(re.search(r"会展|展览|博览|展会|会议展|Messe|Expo|Fair|Events", n, re.I))
    if not forced and not has_expo:
        for pat, why in EXCLUDE:
            if re.search(pat, n, re.I): reason = why; break
    if not forced and has_expo:
        for pat, why in EXCLUDE[:2]:
            if re.search(pat, n, re.I): reason = why; break
    k = norm(core(n)); hits = []
    if len(k) >= 3:
        for key, xs in idx.items():
            if k == key or (len(k) >= 4 and (k in key or key in k)): hits += xs
    seen, br = set(), []
    for h in hits:
        if h["brand_id"] not in seen:
            seen.add(h["brand_id"]); br.append((h["name_cn"], h["industry_l1"], h["area"]))
    br.sort(key=lambda t: -(t[2] or 0))
    src = "+".join([s for s, ok in (("参会", n in att), ("观众", n in vis), ("展商", n in exh)) if ok])
    out.append({"机构名称": n, "名单来源": src, "排除理由": reason,
                "需调研": "" if reason else "Y",
                "mwlab命中数": len(br),
                "mwlab展会": " | ".join(f"{a}" for a, _, _ in br[:5]),
                "mwlab最大面积": br[0][2] if br else ""})

with open(f"{BASE}/queue.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
json.dump(out, open(f"{BASE}/queue.json", "w"), ensure_ascii=False, indent=1)

todo = [o for o in out if o["需调研"] == "Y"]
from collections import Counter
print("总机构:", len(out), " 需调研:", len(todo), " 已排除:", len(out) - len(todo))
for k, v in Counter(o["排除理由"] for o in out if o["排除理由"]).most_common(): print(f"  排除-{k}: {v}")
print("需调研中 mwlab 已有命中:", sum(1 for t in todo if t["mwlab命中数"] > 0))
