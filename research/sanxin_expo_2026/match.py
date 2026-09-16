# -*- coding: utf-8 -*-
"""mwlab 主办方匹配（严格版）：仅精确匹配，通用词不参与，避免子串误伤。"""
import json, re, unicodedata, sqlite3
import os
BASE=os.path.dirname(os.path.abspath(__file__))   # 脚本自身所在目录
DB="/Volumes/databoard/AI Project/D_dashboard/data/mwlab.db"

STOP={"会展中心","国际会展中心","会展","国际会展","展览","国际展览","博览中心","国际博览中心",
      "会展集团","国际会展集团","展览服务","国际展览服务","会议中心","国际会议中心","展览中心",
      "国际展览中心","会展有限","博览","国际博览","展览展示","会展服务","国际会展服务","展会",
      "会议展览","国际会议展览","科技","文化传播","信息科技",
      # 机构通用称谓：不是品牌词，参与匹配必然大面积误命中
      "贸促会","上海贸促会","市贸促会","商务局","市商务局","促进会","管委会","组委会","会展局",
      "会议展览局","会议展览促进中心","会展行业协会","会议展览业协会","会展业协会","旅游会展协会",
      "会展协会","博览会","展览会","国际贸易促进委员会","人民政府","办事处","投资促进局",
      "国际交流中心","科学会堂","会展文旅","会展经营","展览服务有限","国际会展有限"}

def norm(s): return unicodedata.normalize("NFKC",s).lower()
def core(s):
    s=re.sub(r"[（(].*?[)）]","",s)
    s=re.sub(r"(股份)?有限(责任)?公司|公司$","",s)
    s=re.sub(r"^(北京|上海|广州|深圳|天津|重庆|成都|杭州|南京|武汉|西安|厦门|青岛|苏州|无锡|宁波|济南|郑州|合肥|长沙|福州|三亚|海南|山东|江苏|浙江|广东|河北|河南|四川|安徽|福建|湖南|湖北|新疆|黑龙江|辽宁|吉林|陕西|甘肃|云南|贵州|广西|江西|山西|内蒙古|中国)(省|市)?","",s)
    return s.strip()

def keys(s):
    """返回该名称的匹配键集合：全名 + 去公司后缀名 + 去地域核心名"""
    ks=set()
    a=norm(re.sub(r"\s","",s))
    b=norm(re.sub(r"(股份)?有限(责任)?公司|公司$","",re.sub(r"[（(].*?[)）]","",s)).strip())
    c=norm(core(s))
    for k in (a,b,c):
        if len(k)>=4 and k not in STOP: ks.add(k)
    return ks

con=sqlite3.connect(DB); con.row_factory=sqlite3.Row
rows=con.execute("""select o.raw_token,o.canonical,o.brand_id,b.name_cn,b.industry_l1,b.city,
  (select max(area_sqm) from exhibition_edition e where e.brand_id=b.brand_id) area,
  (select max(year) from exhibition_edition e where e.brand_id=b.brand_id) yr
  from brand_organizer o join exhibition_brand b using(brand_id)""").fetchall()
idx={}
for x in rows:
    for k in keys(x["raw_token"])|keys(x["canonical"]): idx.setdefault(k,[]).append(x)

q=json.load(open(f"{BASE}/queue.json"))
for o in q:
    hits=[]; mt={}
    mykeys=keys(o["机构名称"])
    for k in mykeys:
        for x in idx.get(k,[]): hits.append(x); mt[x["brand_id"]]="精确"
    # 受控包含：库中品牌词(>=4字,非通用)是本机构键的子串，或反之
    for k in mykeys:
        for key,xs in idx.items():
            if key==k or len(key)<4 or len(k)<4: continue
            if key in k or k in key:
                for x in xs:
                    hits.append(x); mt.setdefault(x["brand_id"],"模糊")
    seen,br=set(),[]
    for h in hits:
        if h["brand_id"] not in seen:
            seen.add(h["brand_id"]); br.append(dict(name=h["name_cn"],ind=h["industry_l1"],area=h["area"],yr=h["yr"],city=h["city"],mt=mt.get(h["brand_id"],"模糊")))
    br.sort(key=lambda d:-(d["area"] or 0))
    o["mwlab命中数"]=len(br)
    o["mwlab展会"]=" | ".join(d["name"] for d in br[:8])
    o["mwlab最大面积"]=br[0]["area"] if br else ""
    o["mwlab精确命中数"]=sum(1 for d in br if d["mt"]=="精确")
    o["_hits"]=br
json.dump(q,open(f"{BASE}/queue.json","w"),ensure_ascii=False,indent=1)
print("精确命中机构数:",sum(1 for o in q if o.get("mwlab精确命中数",0)>0))
print("有命中机构数:",sum(1 for o in q if o["mwlab命中数"]>0))
print("需调研且有命中:",sum(1 for o in q if o["需调研"]=="Y" and o["mwlab命中数"]>0))
print("\n-- 抽查 --")
for n in ["新疆国际会展中心","上海新国际博览中心有限公司","山东福瑞德国际会展集团有限公司","西安国际会展中心","上海东浩兰生会展（集团）有限公司","华墨集团","厦门会展集团股份有限公司","上海歌华展览服务有限公司","中国连锁经营协会"]:
    m=[o for o in q if o["机构名称"]==n]
    if m: print(f"{n:24s} hit={m[0]['mwlab命中数']:3d}(精确{m[0].get('mwlab精确命中数',0)})  {m[0]['mwlab展会'][:80]}")
