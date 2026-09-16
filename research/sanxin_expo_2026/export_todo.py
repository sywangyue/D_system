# -*- coding: utf-8 -*-
"""导出待调研清单 CSV。mwlab 线索按可信度分级：精确 > 全文 > 模糊(标注待核)。"""
import os, json, csv
BASE=os.path.dirname(os.path.abspath(__file__))
q=json.load(open(f"{BASE}/queue.json"))
done={r['name'] for r in map(json.loads, open(f"{BASE}/results.jsonl", encoding='utf-8'))}
COVERED=set(json.load(open(f"{BASE}/已覆盖别名.json", encoding='utf-8'))) if os.path.exists(f"{BASE}/已覆盖别名.json") else set()

def clue(o):
    ex=[h['name'] for h in o.get('_hits',[]) if h.get('mt')=='精确']
    if ex: return " | ".join(sorted(set(ex))[:5])
    ft=sorted({h['name'] for h in o.get('全文命中',[])})
    if ft: return " | ".join(ft[:5])
    fz=[h['name'] for h in o.get('_hits',[]) if h.get('mt')=='模糊']
    if fz: return "（模糊匹配，需核实）"+" | ".join(sorted(set(fz))[:3])
    return ""

def pri(o):
    n=o['机构名称']
    s=-len([h for h in o.get('_hits',[]) if h.get('mt')=='精确'])*4 - o.get('全文命中数',0)*3
    for k,w in [('集团',-30),('会展',-18),('展览',-18),('博览',-12),('协会',-6),('贸促会',-6),('中心',5)]:
        if k in n: s+=w
    return s

todo=[o for o in q if o['需调研']=='Y' and o['机构名称'] not in done and o['机构名称'] not in COVERED]
todo.sort(key=pri)
cols=['序号','机构名称','名单来源','mwlab已知展会','mwlab最大面积㎡','归属集团','主体类型','是否自办展',
      '自办展项目','主赛道','规模证据','UFI认证','收购潜力1-5','战略契合1-5','合作切入点','结论备注','来源URL']
with open(f"{BASE}/待调研清单.csv",'w',newline='',encoding='utf-8-sig') as f:
    w=csv.writer(f); w.writerow(cols)
    for i,o in enumerate(todo,1):
        w.writerow([i,o['机构名称'],o['名单来源'],clue(o),o.get('mwlab最大面积',''),*['']*12])
json.dump(todo,open(f"{BASE}/todo.json",'w'),ensure_ascii=False,indent=1)
print('已完成:',len(done),'| 待调研:',len(todo),'| 有可信 mwlab 线索:',
      sum(1 for o in todo if clue(o) and not clue(o).startswith('（模糊')))
