# Claude Code 执行指令
# 任务：Medica 2021–2025 + Rehacare 2022/2024 展商数据爬取
# 目标数据库：SQLite，表结构见 medica_schema.sql

---

## 背景说明

Messe Düsseldorf 的展商目录运行在一套叫 VIS（Visitor Information System）的系统上，URL 前缀为 `/vis/v1/`。该系统是 React/Vue 单页应用（SPA），数据通过 JavaScript 异步加载，普通 HTTP 请求只能拿到空壳 HTML。

**已探明的关键参数：**
- Medica 2024 展会对象 ID：`oid=80396`
- Medica 2025 展会对象 ID：`oid=85465`
- 展商持久唯一 ID：URL 路径中的 hash，如 `exhprofiles/QW73U2v2Q0aMVQqulQE3OQ`
- 展位格式示例："Hall 7, level 0 / C06" → hall=7, booth=C06, booth_full="7 C06"

---

## Phase 0：环境准备

```bash
pip install playwright beautifulsoup4 aiohttp sqlite3 --break-system-packages
npx playwright install chromium
```

在工作目录创建 SQLite 数据库并执行 `medica_schema.sql`：
```python
import sqlite3
conn = sqlite3.connect('medica_investigation.db')
with open('medica_schema.sql') as f:
    conn.executescript(f.read())
conn.commit()
```

---

## Phase 1：发现所有届次的 OID（最重要的第一步）

目标：找出 Medica 2021/2022/2023 和 Rehacare 2022/2024 的 OID。

### 方法 A：Wayback Machine CDX API（优先使用）

对每个目标年份，查询 Wayback Machine 的历史快照，从快照页面提取 floorplan URL 中的 oid。

逻辑：
1. 调用 CDX API 查找 `medica-tradefair.com/floorplan*` 在对应年份 11 月的快照
   ```
   URL: https://web.archive.org/cdx/search/cdx
   参数: url=medica-tradefair.com/floorplan*, output=json, matchType=prefix,
         from=20231101, to=20231130, limit=5
   ```
2. 取返回的最近快照 timestamp（如 `20231115120000`）
3. 抓取该快照页面：`https://web.archive.org/web/{timestamp}/https://www.medica-tradefair.com/floorplan?lang=2&ticket=g_u_e_s_t&oid=XXXXX`
4. 从页面 HTML 正则提取 `oid=(\d+)`

对以下 Wayback 时间段逐一执行：
- Medica 2021: from=20211115, to=20211119
- Medica 2022: from=20221114, to=20221118
- Medica 2023: from=20231113, to=20231117
- Rehacare 2022: from=20221026, to=20221029（网站 rehacare.de）
- Rehacare 2024: from=20241023, to=20241026（网站 rehacare.de）

### 方法 B：主站反向推算（备用）

已知 Medica 2024=80396，2025=85465，差值约 5069。
尝试以下 oid 探测 Medica 2023（预计 75000~76000）：
用 Playwright 访问 `https://www.medica-tradefair.com/floorplan?lang=2&ticket=g_u_e_s_t&oid={候选oid}`，
如果页面标题包含 "2023" 则命中。

### 执行结果

将找到的所有 oid 更新进 `editions` 表：
```python
conn.execute("UPDATE editions SET oid=? WHERE show_name=? AND edition_year=?",
             (oid_value, show_name, year))
```

---

## Phase 2：发现 VIS 系统的 JSON API 端点（关键逆向工程步骤）

**目标：** 找出 JavaScript 异步调用的实际 JSON API URL，从而绕过 SPA 渲染，直接用 aiohttp 批量请求数据。

**使用 Playwright 拦截网络请求：**

```python
from playwright.async_api import async_playwright
import json, asyncio

async def discover_api():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # 非无头模式，避免反爬
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/120.0.0.0 Safari/537.36',
            locale='en-US',
            viewport={'width': 1280, 'height': 800}
        )
        page = await context.new_page()
        
        captured = []
        
        async def on_request(request):
            url = request.url
            # 过滤出可能是展商数据的 XHR/Fetch 请求
            if any(k in url for k in ['profile', 'exhibitor', 'directory',
                                       'search', 'api', 'json', 'data']):
                if 'medica' in url or 'messe' in url:
                    captured.append({
                        'url': url,
                        'method': request.method,
                        'headers': dict(request.headers),
                        'post_data': request.post_data
                    })
        
        page.on('request', on_request)
        
        # 访问 2025 目录页（a 字母）
        await page.goto(
            'https://www.medica-tradefair.com/vis/v1/en/directory/a',
            wait_until='networkidle'
        )
        await asyncio.sleep(3)  # 等待异步请求完成
        
        # 同时抓取页面文本，确认数据是否已渲染
        content = await page.content()
        
        print("=== 捕获的 API 请求 ===")
        for r in captured:
            print(json.dumps(r, indent=2))
        
        await browser.close()
        return captured

asyncio.run(discover_api())
```

**分析结果：**
- 找到返回 JSON 数组（含 company name, hall, booth 字段）的请求 URL
- 记录该 URL 的 pattern，包括所有 query 参数
- 记录必要的请求 headers（特别是 Cookie、Authorization、x-api-key 等）

**预期 API 格式（推测，以实际拦截为准）：**
- `GET /vis/v1/api/profiles?oid={oid}&letter=a&lang=2&page=1&per_page=50`
- 或 `GET /vis/v1/en/api/directory?oid={oid}&initial=a`
- 或 GraphQL 端点

---

## Phase 3：批量爬取所有届次展商数据

**前提：** Phase 2 已获得 JSON API 的确切 URL pattern 和必要 headers。

**策略：**
- 按 oid（届次）× 字母（a-z + other/0-9）逐一请求
- 每请求之间随机 sleep(1.5~3.0 秒)，避免触发限速
- 分页：如 API 有分页，循环直到返回空数组或 `has_more=false`
- 遇到 429/503 时指数退避重试（最多 5 次）

**核心爬取循环伪码：**

```python
import asyncio, aiohttp, sqlite3, json, random
from datetime import datetime

LETTERS = list('abcdefghijklmnopqrstuvwxyz') + ['other']
SESSIONS_HEADERS = {
    # 从 Phase 2 拦截到的真实 headers 复制到这里
    'User-Agent': '...（复制实际值）',
    'Referer': 'https://www.medica-tradefair.com/',
    'Cookie': '...（如有必要）',
}

async def fetch_letter(session, oid, letter, api_pattern):
    """爬取一届展会某字母开头的所有展商"""
    page = 1
    results = []
    while True:
        url = api_pattern.format(oid=oid, letter=letter, page=page)
        async with session.get(url, headers=SESSIONS_HEADERS) as resp:
            if resp.status == 429:
                await asyncio.sleep(30)  # rate limit，等待后重试
                continue
            data = await resp.json()
        
        items = data.get('items') or data.get('profiles') or data  # 字段名视实际 API 而定
        if not items:
            break
        results.extend(items)
        
        if not data.get('has_more', len(items) > 0):
            break
        page += 1
        await asyncio.sleep(random.uniform(1.5, 3.0))
    return results

async def scrape_edition(conn, edition_id, oid, show_name, year, api_pattern):
    """爬取一整届展会"""
    async with aiohttp.ClientSession() as session:
        for letter in LETTERS:
            print(f"[{show_name} {year}] letter={letter}, oid={oid}")
            items = await fetch_letter(session, oid, letter, api_pattern)
            
            for item in items:
                # 字段映射（视实际 API 响应结构调整）
                vis_hash = item.get('id') or item.get('hash') or item.get('uid')
                raw_name = item.get('name') or item.get('companyName')
                country  = item.get('country') or item.get('countryName')
                hall     = item.get('hall') or item.get('hallId')
                booth    = item.get('stand') or item.get('boothNumber') or item.get('standNumber')
                cats     = '; '.join(item.get('categories', []))
                p_url    = f"/vis/v1/en/exhprofiles/{vis_hash}"
                
                conn.execute("""
                    INSERT OR REPLACE INTO participations
                      (edition_id, vis_hash, raw_name, raw_country,
                       hall, booth_number, product_categories,
                       profile_url, scraped_at)
                    VALUES (?,?,?,?,?,?,?,?,?)
                """, (edition_id, vis_hash, raw_name, country,
                      str(hall), str(booth), cats, p_url,
                      datetime.now().isoformat()))
            
            conn.commit()
            await asyncio.sleep(random.uniform(1.5, 3.0))  # 字母间延迟
```

**执行顺序（以 2025 Medica 为第一优先）：**
1. Medica 2025, oid=85465（锚定基准年，最重要）
2. Medica 2024, oid=80396
3. Medica 2023, oid=TBD（Phase 1 探明后填入）
4. Medica 2022, oid=TBD
5. Medica 2021, oid=TBD
6. Rehacare 2024, oid=TBD（域名 rehacare.de，结构类似）
7. Rehacare 2022, oid=TBD

---

## Phase 4：构建 company_entities 去重主表

爬取完成后，从 participations 聚合生成主体表：

```sql
INSERT OR REPLACE INTO company_entities
    (vis_hash, canonical_name, canonical_country,
     first_seen_year, last_seen_year, total_editions)
SELECT
    p.vis_hash,
    -- 优先使用锚定年（2025）的名称
    MAX(CASE WHEN e.is_anchor = 1 THEN p.raw_name END)
        OVER (PARTITION BY p.vis_hash) AS canonical_name,
    MAX(CASE WHEN e.is_anchor = 1 THEN p.raw_country END)
        OVER (PARTITION BY p.vis_hash) AS canonical_country,
    MIN(e.edition_year) AS first_seen_year,
    MAX(e.edition_year) AS last_seen_year,
    COUNT(DISTINCT e.edition_year) AS total_editions
FROM participations p
JOIN editions e ON p.edition_id = e.edition_id
GROUP BY p.vis_hash;
```

---

## Phase 5：执行分析，生成异常标记

爬取完成后，自动运行以下写入：

```sql
-- 写入展位轮换异常（同展位不同届不同企业）
INSERT INTO anomaly_flags
    (flag_type, show_name, booth_full,
     edition_year_a, vis_hash_a, company_name_a,
     edition_year_b, vis_hash_b, company_name_b,
     confidence_score, evidence_detail)
SELECT
    'booth_rotation',
    a.show_name,
    a.booth_full,
    a.edition_year, a.vis_hash, a.raw_name,
    b.edition_year, b.vis_hash, b.raw_name,
    80,  -- 展位轮换默认置信度
    json_object(
        'hall', a.hall,
        'years', a.edition_year || '→' || b.edition_year,
        'note', 'same_booth_different_company'
    )
FROM v_booth_history a
JOIN v_booth_history b
    ON  a.booth_full = b.booth_full
    AND a.show_name  = b.show_name
    AND a.vis_hash  != b.vis_hash
    AND a.edition_year < b.edition_year
WHERE a.show_name = 'Medica';
```

---

## 最终输出确认

执行后验证以下数字：
```sql
-- 数据完整性确认
SELECT e.show_name, e.edition_year, e.oid, COUNT(*) AS exhibitor_count
FROM editions e
LEFT JOIN participations p ON p.edition_id = e.edition_id
GROUP BY e.edition_id
ORDER BY e.show_name, e.edition_year;

-- 异常预览
SELECT * FROM v_booth_rotation_alert LIMIT 20;
SELECT COUNT(*) AS total_anomalies FROM anomaly_flags WHERE flag_type='booth_rotation';
```

Medica 参展商数量参考（用于验证爬取完整性）：
- Medica 2025: 约 5,700 家展商
- Medica 2024: 约 5,500 家展商
- 每届展商数量与以上数字差异 > 20% 则判定爬取不完整，需重新执行

---

## 注意事项

1. **Rehacare 域名不同：** `www.rehacare.de/vis/v1/en/directory/a`，需单独探测 API
2. **Phase 2 是卡点：** 如果网站做了 Token/签名机制，可能需要保持 Playwright 会话发起请求而非 aiohttp 直连
3. **数据量：** 5届 Medica × 26字母 ≈ 130次主请求，约 2小时完成（含随机延迟）
4. **backup plan：** 如 VIS API 拦截失败，退回 Playwright 直接解析渲染后的 HTML DOM（性能更低但更稳健）
5. **country_code 标准化：** API 返回的国家字段可能是全称（"Germany"），需映射到 ISO 3166-1

---

## 交付物验证 Checklist

- [ ] `editions` 表 7 行，所有 oid 均已填入
- [ ] `participations` 表 Medica 2025 约 5700 行
- [ ] `v_booth_rotation_alert` 有返回结果（存在异常即为数据可用）
- [ ] `v_cn_in_intl_hall` 有返回结果
- [ ] `anomaly_flags` 表已写入 booth_rotation 类型记录
