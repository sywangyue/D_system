#!/bin/bash
# jufair shell crawler — uses native curl (no Python subprocess) to bypass TLS fingerprinting
# Usage: bash crawlers/jf_shell_crawl.sh [months] [--detail]
set -e

DB="data/jufair_2026.db"
BATCH_ID="jf_safe_$(date +%Y%m%d_%H%M%S)"
BASE="https://www.jufair.com"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

# [AUDIT P2-26] 此处原有 X-Forwarded-For 伪造 IP 轮换池（8 个上海 IP 段），
# 用于绕过 CDN 速率限制。Phase 6 合规整改已明确移除 XFF 绕过，本脚本晚于
# Phase 6 创建、绕开了该整改，现予以清除。
# 替代手段：仅靠下方的保守请求间隔控制频率，不做任何来源伪装。

# Safety timings (seconds)
# 移除 XFF 伪装后，频率控制完全依赖这些间隔，故整体放宽一档。
PAGE_DELAY_MIN=10
PAGE_DELAY_MAX=18
SOURCE_PAUSE_MIN=45
SOURCE_PAUSE_MAX=90
MONTH_PAUSE_MIN=90
MONTH_PAUSE_MAX=180

# 连续疑似封禁达到该次数即整体终止，避免在被封状态下继续打请求
CIRCUIT_BREAKER_MAX=3
consecutive_block=0

TARGET_YEAR="${TARGET_YEAR:-$(date +%Y)}"
MONTHS="${1:-1 2 3 4 5 6 7 8 9 10 11 12}"
DETAIL=0
[[ "$2" == "--detail" ]] && DETAIL=1

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Ensure DB and table exist
python3 -c "
import sqlite3
conn = sqlite3.connect('$DB')
conn.execute('''CREATE TABLE IF NOT EXISTS raw_jufair (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cn_name TEXT NOT NULL, en_name TEXT DEFAULT '',
    date_str TEXT DEFAULT '', year INTEGER, venue TEXT DEFAULT '',
    city TEXT DEFAULT '', area_str TEXT DEFAULT '',
    visitors_str TEXT DEFAULT '', exhibitors_str TEXT DEFAULT '',
    organizer TEXT DEFAULT '', cycle TEXT DEFAULT '',
    industry TEXT DEFAULT '',
    source_type TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL UNIQUE,
    detail_crawled INTEGER DEFAULT 0,
    crawl_batch_id TEXT DEFAULT '',
    crawled_at TEXT DEFAULT (datetime('now'))
)''')
conn.execute('CREATE INDEX IF NOT EXISTS idx_rj_source_url ON raw_jufair(source_url)')
conn.commit()
conn.close()
"

total_new=0

for m in $MONTHS; do
    for st in domestic international; do
        tc="1"; [[ "$st" == "international" ]] && tc="0"
        label="月$(printf '%02d' $m) $st"
        
        page=1
        while true; do
            # [AUDIT P1-7] Jufair 2026-07 URL 改版：
            #   旧 /exhibition-0-0-1-0-0-08-1/ → 新 /n-cn/m-8/ 、/n-cn/m-8/p-2/
            # jufair_crawler.py 已切换，此处此前仍用旧格式，与 Python 版分叉。
            tp="n-cn"; [[ "$st" == "international" ]] && tp="n-intl"
            if [ "$page" -eq 1 ]; then
                url="${BASE}/${tp}/m-${m}/"
            else
                url="${BASE}/${tp}/m-${m}/p-${page}/"
            fi
            
            html=$(curl -sL --max-time 25 --connect-timeout 10 \
                -H "User-Agent: $UA" \
                -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
                -H "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8" \
                -H "Referer: ${BASE}/" \
                "$url" 2>/dev/null)

            if [ -z "$html" ]; then
                consecutive_block=$((consecutive_block + 1))
                log "[WARN] $label p$page 空响应 (连续 ${consecutive_block}/${CIRCUIT_BREAKER_MAX})"
                if [ "$consecutive_block" -ge "$CIRCUIT_BREAKER_MAX" ]; then
                    log "[ABORT] 连续 ${CIRCUIT_BREAKER_MAX} 次空响应/封禁，终止运行"
                    log "        批次: $BATCH_ID  已新增 $total_new 条"
                    exit 2
                fi
                break
            fi
            
            # Check for target year data
            # [AUDIT P1-9] 原为硬编码 grep -q '2026\.'，跨年即全部判定为"无数据"
            if ! echo "$html" | grep -q "${TARGET_YEAR}\."; then
                log "  $label p$page 无${TARGET_YEAR}年数据，停止"
                break
            fi
            
            # Check for soft block
            if ! echo "$html" | grep -q 'exh-info-wrap'; then
                consecutive_block=$((consecutive_block + 1))
                log "[WARN] $label p$page 疑似封禁 (连续 ${consecutive_block}/${CIRCUIT_BREAKER_MAX})"
                if [ "$consecutive_block" -ge "$CIRCUIT_BREAKER_MAX" ]; then
                    log "[ABORT] 连续 ${CIRCUIT_BREAKER_MAX} 次空响应/封禁，终止运行"
                    log "        批次: $BATCH_ID  已新增 $total_new 条"
                    exit 2
                fi
                break
            fi

            # 本页正常，重置熔断计数
            consecutive_block=0
            
            # Parse with Python (reads from stdin)
            n=$(echo "$html" | python3 -c "
import sys, json, re
from bs4 import BeautifulSoup
html = sys.stdin.read()
soup = BeautifulSoup(html, 'html.parser')
articles = soup.select('.exh-info-wrap')
items = []
for art in articles:
    a_tag = art.select_one('h2 a')
    if not a_tag: continue
    cn_name = a_tag.get_text(strip=True)
    href = a_tag.get('href', '')
    detail_url = '${BASE}' + href if href.startswith('/') else href
    en_name = art.select_one('.En_name')
    time_tag = art.select_one('time')
    venue_tag = art.select_one('.pavilion-name')
    date_str = time_tag.get_text(strip=True) if time_tag else ''
    year = int(date_str.split('.')[0]) if date_str and '.' in date_str else 0
    venue = venue_tag.get_text(strip=True) if venue_tag else ''
    # Stats
    area_str = visitors_str = exhibitors_str = ''
    scale_divs = art.select('.scale-remind')
    if scale_divs:
        for sd in scale_divs:
            data_el = sd.select_one('data')
            unit_el = sd.select_one('.unitText')
            val = (data_el.get_text(strip=True) if data_el else '') + (unit_el.get_text(strip=True) if unit_el else '')
            if unit_el and '平方米' in unit_el.get_text(strip=True): area_str = val
            elif unit_el and '人' in unit_el.get_text(strip=True): visitors_str = val
            elif unit_el and '家' in unit_el.get_text(strip=True): exhibitors_str = val
    items.append({
        'cn_name': cn_name,
        'en_name': en_name.get_text(strip=True) if en_name else '',
        'date_str': date_str, 'year': year, 'venue': venue,
        'city': '', 'area_str': area_str,
        'visitors_str': visitors_str, 'exhibitors_str': exhibitors_str,
        'organizer': '', 'cycle': '', 'industry': '',
        'source_type': '${st}',
        'source_url': detail_url,
        'detail_crawled': 0,
        'crawl_batch_id': '${BATCH_ID}',
    })
print(json.dumps(items, ensure_ascii=False))
" 2>/dev/null)
            
            count=$(echo "$n" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo 0)
            
            if [ "$count" -eq 0 ]; then
                log "  $label p$page 无条目"
                break
            fi
            
            # Insert into DB
            inserted=$(echo "$n" | python3 -c "
import sys, json, sqlite3
items = json.load(sys.stdin)
conn = sqlite3.connect('${DB}')
new = 0
for it in items:
    try:
        cur = conn.execute('''INSERT OR IGNORE INTO raw_jufair
            (cn_name, en_name, date_str, year, venue, city,
             area_str, visitors_str, exhibitors_str,
             organizer, cycle, industry,
             source_type, source_url, detail_crawled, crawl_batch_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (it['cn_name'], it['en_name'], it['date_str'], it['year'], it['venue'], it['city'],
             it['area_str'], it['visitors_str'], it['exhibitors_str'],
             it['organizer'], it['cycle'], it['industry'],
             it['source_type'], it['source_url'], it['detail_crawled'], it['crawl_batch_id']))
        # [AUDIT P1-8] 原为 conn.changes()：sqlite3.Connection 无此方法，
        # AttributeError 被下方 except 吞掉，导致新增计数恒为 0、日志完全失真。
        new += cur.rowcount if cur.rowcount > 0 else 0
    except Exception as e:
        print(f'[WARN] insert failed: {e}', file=sys.stderr)
conn.commit()
conn.close()
print(new)
" 2>/dev/null || echo 0)
            
            total_new=$((total_new + inserted))
            detail_msg=""
            [ $DETAIL -eq 1 ] && detail_msg=" +详情待补"
            log "  $label p$page ${count}条 → 新增${inserted}${detail_msg}"
            
            page=$((page + 1))
            # Random delay between pages
            delay=$((PAGE_DELAY_MIN + RANDOM % (PAGE_DELAY_MAX - PAGE_DELAY_MIN + 1)))
            sleep $delay
        done
        # Pause between source types (domestic → international)
        pause=$((SOURCE_PAUSE_MIN + RANDOM % (SOURCE_PAUSE_MAX - SOURCE_PAUSE_MIN + 1)))
        log "  [COOL] ${st}完成，冷却 ${pause}s..."
        sleep $pause
    done
    # Pause between months
    mpause=$((MONTH_PAUSE_MIN + RANDOM % (MONTH_PAUSE_MAX - MONTH_PAUSE_MIN + 1)))
    log "[COOL] 月$(printf '%02d' $m)完成，冷却 ${mpause}s..."
    sleep $mpause
done

# Detail crawl
if [ $DETAIL -eq 1 ]; then
    log "开始详情页补爬..."
    python3 -c "
import sqlite3, subprocess, json, re, time, random
conn = sqlite3.connect('${DB}')
rows = conn.execute(\"SELECT source_url FROM raw_jufair WHERE detail_crawled=0\").fetchall()
print(f'待补爬 {len(rows)} 条', flush=True)
for i, (surl,) in enumerate(rows):
    try:
        r = subprocess.run(['curl', '-sL', '--max-time', '20', '--connect-timeout', '10',
            '-H', 'User-Agent: ${UA}',
            '-H', 'Accept: text/html,application/xhtml+xml',
            '-H', 'Accept-Language: zh-CN,zh;q=0.9',
            surl], capture_output=True, text=True, timeout=25)
        html = r.stdout or ''
    except: continue
    if not html: continue
    
    # Extract from JSON-LD first
    org = city = cycle = ind = area_s = exh_s = vis_s = ''
    try:
        m = re.search(r'<script[^>]*type=\"application/ld\+json\"[^>]*>(.+?)</script>', html, re.DOTALL)
        if m:
            ld = json.loads(m.group(1))
            items = ld if isinstance(ld, list) else [ld]
            for item in items:
                if item.get('@type') == 'Event':
                    if item.get('organizer'):
                        o = item['organizer']
                        org = o['name'] if isinstance(o, dict) else str(o)
                    if item.get('location'):
                        loc = item['location']
                        if isinstance(loc, dict) and loc.get('address'):
                            addr = loc['address']
                            if isinstance(addr, dict):
                                city = addr.get('addressLocality', '')
    except: pass
    
    # HTML fallback
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    for dl in soup.select('dl.content-line'):
        dt = dl.find('dt'); dd = dl.find('dd')
        if not dt or not dd: continue
        label = dt.get_text(strip=True).rstrip(':')
        value = dd.get_text(strip=True)
        if '主办单位' in label and not org: org = value
        elif '举办城市' in label and not city: city = value
        elif '所属行业' in label and not ind:
            links = dd.find_all('a')
            ind = ', '.join(a.get_text(strip=True) for a in links) if links else value
    for dl in soup.find_all('dl'):
        dt = dl.find('dt'); dd = dl.find('dd')
        if not dt or not dd: continue
        label = dt.get_text(strip=True); value = dd.get_text(strip=True)
        if label == '举办周期' and not cycle: cycle = value
        elif label == '展览面积' and not area_s: area_s = value
        elif label == '展商数量' and not exh_s: exh_s = value
        elif label == '观众数量' and not vis_s: vis_s = value
    
    updates = {}
    if org: updates['organizer'] = org
    if city: updates['city'] = city
    if cycle: updates['cycle'] = cycle
    if ind: updates['industry'] = ind
    if area_s: updates['area_str'] = area_s
    if exh_s: updates['exhibitors_str'] = exh_s
    if vis_s: updates['visitors_str'] = vis_s
    
    if updates:
        set_clause = ', '.join(f'{k}=?' for k in updates)
        params = list(updates.values()) + [surl]
        conn.execute(f'UPDATE raw_jufair SET {set_clause}, detail_crawled=1 WHERE source_url=?', params)
    else:
        conn.execute('UPDATE raw_jufair SET detail_crawled=1 WHERE source_url=?', (surl,))
    
    if (i+1) % 20 == 0: conn.commit()
    time.sleep(0.5 + random.uniform(0, 0.5))
conn.commit()
conn.close()
print('Done', flush=True)
" 2>&1
fi

log "=============================="
log "完成！批次: $BATCH_ID  共新增 $total_new 条"
