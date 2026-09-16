# -*- coding: utf-8 -*-
"""用 exhibition_brand.organizer/co_organizer 原始字段做全文包含匹配，补齐 brand_organizer 表的遗漏。"""
import json, re, sqlite3, unicodedata
import os
BASE=os.path.dirname(os.path.abspath(__file__))   # 脚本自身所在目录
DB="/Volumes/databoard/AI Project/D_dashboard/data/mwlab.db"
GENERIC={"国际会展中心","会展中心","国际博览中心","博览中心","国际会展","会展集团","国际展览",
 "展览服务","会展服务","国际会议中心","会议中心","展览中心","国际展览中心","会展文旅","展览展示",
 # 机构通用称谓：不是品牌词，用于全文检索必然大面积误命中
 "贸促会","商务局","促进会","管委会","组委会","会展局","会议展览局","会议展览促进中心",
 "会展行业协会","会议展览业协会","会展业协会","旅游会展协会","会展协会","博览会","展览会",
 "国际贸易促进委员会","人民政府","办事处","投资促进局","国际交流中心","科学会堂"}

def token(name):
    """提取用于全文检索的品牌词：去括号/公司后缀/地域前缀，长度>=3且非通用词"""
    s=re.sub(r"[（(].*?[)）]","",name)
    s=re.sub(r"(股份)?有限(责任)?公司|有限公司|公司$","",s).strip()
    s=re.sub(r"^(北京|上海|广州|深圳|天津|重庆|成都|杭州|南京|武汉|西安|厦门|青岛|苏州|无锡|宁波|济南|郑州|合肥|长沙|福州|三亚|海南|山东|江苏|浙江|广东|河北|河南|四川|安徽|福建|湖南|湖北|新疆|黑龙江|辽宁|吉林|陕西|甘肃|云南|贵州|广西|江西|山西|内蒙古|中国)(省|市)?","",s).strip()
    return s if len(s)>=3 and s not in GENERIC else None

con=sqlite3.connect(DB); con.row_factory=sqlite3.Row
q=json.load(open(f"{BASE}/queue.json"))
n_new=0
for o in q:
    if o["需调研"]!="Y": continue
    t=token(o["机构名称"])
    o["全文命中"]=[]; o["全文命中数"]=0     # 先清零，否则跳过的机构会残留上一轮的旧值
    if not t: continue
    rows=con.execute("""select b.name_cn,b.organizer,b.city,b.industry_l1,
        (select max(area_sqm) from exhibition_edition e where e.brand_id=b.brand_id) area
        from exhibition_brand b
        where b.organizer like ? or b.co_organizer like ?""",(f"%{t}%",f"%{t}%")).fetchall()
    o["全文命中"]=[dict(name=r["name_cn"],org=r["organizer"][:60],city=r["city"],ind=r["industry_l1"],area=r["area"]) for r in rows]
    o["全文命中数"]=len(rows)
    if rows and o["mwlab命中数"]==0: n_new+=1
json.dump(q,open(f"{BASE}/queue.json","w"),ensure_ascii=False,indent=1)
todo=[o for o in q if o["需调研"]=="Y"]
print("需调研:",len(todo))
print("全文有命中:",sum(1 for o in todo if o.get("全文命中数",0)>0))
print("其中此前 brand_organizer 表漏掉的新增:",n_new)
print("\n-- 新增命中示例（按命中数排序前30）--")
new=[o for o in todo if o.get("全文命中数",0)>0]
new.sort(key=lambda o:-o["全文命中数"])
for o in new[:30]:
    ex=" | ".join(sorted({h["name"] for h in o["全文命中"]})[:3])
    print(f"{o['机构名称'][:26]:28s} {o['全文命中数']:3d}  {ex[:70]}")
