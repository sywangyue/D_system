#!/usr/bin/env python3
"""
DDG Lite 主办方搜索 — 纯 curl + HTML 解析，无需 opencli/Chrome
速度: ~1.5s/条, 3,265条 ≈ 1.4小时
"""
import subprocess, re, sqlite3, json, time, urllib.parse
from datetime import datetime

DB = "/Volumes/databoard/AI Project/D_dashboard/mwlab.db"
LOG = "/tmp/org_ddg.log"

def log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, 'a') as f:
        f.write(line + '\n')

def search_ddg(query: str) -> str:
    """搜索 DDG Lite，返回 HTML"""
    encoded = urllib.parse.quote(query)
    result = subprocess.run(
        ['curl', '-s', f'https://lite.duckduckgo.com/lite/?q={encoded}',
         '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'],
        capture_output=True, text=True, timeout=15
    )
    return result.stdout

def extract_organizer(html: str) -> str | None:
    """从 DDG Lite HTML 提取主办方"""
    # 策略1: 找 "主办方：XXX" 或 "主办单位：XXX" (在链接文本或摘要中)
    patterns = [
        r'主办方[：:]\s*([^\s<",，;；。]{3,60}?)(?:[<",，;；。\s]|$)',
        r'主办单位[：:]\s*([^\s<",，;；。]{3,60}?)(?:[<",，;；。\s]|$)',
        r'由\s*([^\s<",，;；。]{3,40}?)\s*主办',
    ]
    
    # 在所有可见文本中搜索
    # 先清理 HTML 标签，保留文本
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'\s+', ' ', text)
    
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            org = m.group(1).strip()
            # 过滤明显不合理的
            if org and len(org) >= 3:
                # 清理尾部垃圾
                org = re.sub(r'\s*承办.*$', '', org)
                org = re.sub(r'\s*地址.*$', '', org)
                org = org.rstrip('，,;；。').strip()
                if org and not org.startswith('http'):
                    return org
    
    # 策略2: 从链接文本中找含"主办方"的链接
    link_matches = re.findall(r'class=.result-link[^>]*>(.*?)</a>', html)
    for link_text in link_matches:
        link_text = re.sub(r'<[^>]+>', '', link_text)
        if '主办方' in link_text or '主办单位' in link_text:
            # 提取公司/机构名
            for pat in [r'主办方[：:－-]\s*(.+?)(?:[－-]|$)', r'主办单位[：:－-]\s*(.+?)(?:[－-]|$)']:
                m = re.search(pat, link_text)
                if m:
                    org = m.group(1).strip()
                    if len(org) >= 3:
                        return org
            # 如果没匹配到，整个链接文本可能就是 "主办方介绍-XXX公司"
            parts = link_text.split('-')
            if len(parts) >= 2:
                return parts[-1].strip()
    
    return None


# ════════════════════════════════════
# MAIN
# ════════════════════════════════════

brands = []
for fn in ['/tmp/org_batch_1.json', '/tmp/org_batch_2.json', '/tmp/org_batch_3.json']:
    with open(fn) as f:
        brands.extend(json.load(f))

total = len(brands)
log(f"START DDG: {total} brands")

db = sqlite3.connect(DB)
db.execute("PRAGMA journal_mode=WAL")
db.execute("PRAGMA busy_timeout=5000")
db.execute("PRAGMA synchronous=OFF")

ok = fail = skip = 0
t0 = time.time()

for i, b in enumerate(brands):
    # 跳过已填
    cur = db.execute("SELECT organizer FROM exhibition_brand WHERE brand_id=?", (b['brand_id'],))
    row = cur.fetchone()
    if row and row[0] and row[0].strip() and row[0] not in ('待查', '超时', ''):
        skip += 1
        continue
    
    try:
        html = search_ddg(f'{b["name_cn"]} 主办方')
        org = extract_organizer(html)
        
        if org:
            db.execute('UPDATE exhibition_brand SET organizer=? WHERE brand_id=?', (org, b['brand_id']))
            ok += 1
        else:
            db.execute('UPDATE exhibition_brand SET organizer=? WHERE brand_id=?', ('待查', b['brand_id']))
            fail += 1
        
        if (ok + fail) % 50 == 0:
            elapsed = (time.time() - t0) / 60
            done = ok + fail
            rate = done / elapsed if elapsed > 0 else 0
            remaining = total - skip - done
            eta = remaining / rate if rate > 0 else 0
            log(f"[{i+1}/{total}] ok={ok} fail={fail} skip={skip} rate={rate:.0f}/m ETA={eta:.0f}m | {b['name_cn'][:25]} → {str(org)[:30]}")
            db.commit()
        
    except Exception as e:
        fail += 1

db.commit()
db.close()
elapsed = (time.time() - t0) / 60
log(f"DONE {elapsed:.0f}min | ok={ok} fail={fail} skip={skip}")
