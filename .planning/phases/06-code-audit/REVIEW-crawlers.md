---
phase: 06-code-audit
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - crawlers/jufair_crawler.py
  - crawlers/cnexpo_crawler.py
findings:
  critical: 4
  warning: 12
  info: 2
  total: 18
status: issues_found
---

# 爬虫代码审计报告（jufair / cnexpo）

**审计日期：** 2026-06-11
**范围：** `crawlers/jufair_crawler.py`（594 行）、`crawlers/cnexpo_crawler.py`（506 行）、`tests/` 中爬虫相关测试
**背景：** Jufair 爬虫近期在 4,046/8,400 条进度时被封 IP，politeness/退避行为是现实业务问题。

---

## 概览

两个爬虫结构清晰、有基础重试和抖动延迟，但存在 **4 个 🔴 严重问题**：①jufair 详情页更新会用空字符串覆盖列表页已采集字段（数据损毁）；②中断后 `detail_crawled=0` 的记录永远无法补爬（直接命中本次 4,046 条中断场景）；③封禁发生后无全局熔断，爬虫继续对全部剩余目标发请求，cnexpo 在详情失败时甚至跳过 sleep 实现"零间隔连发"；④cnexpo 详情解析按 `<p>` 位置取数且 venue 兜底正则必命中任意文本，版式微变即静默写脏数据。另有 12 个 🟠/🟡 问题，包括 schema 已定义的 `crawl_log` 表两个爬虫完全未写入、仅识别 403 一种反爬信号、同 Session 轮换 UA 的指纹矛盾等。**爬虫零测试覆盖。**

数据安全底线方面：raw 表用 `source_url UNIQUE + INSERT OR IGNORE`，失败的运行不会产生重复行或删除既有数据，**不会破坏已落库的存量数据**——但 CRWL-01 会在同一次运行内损毁刚插入的数据。

---

## 发现

### 🔴 严重

#### CRWL-01：详情页更新用空串覆盖列表页已采集字段（数据损毁）

- **位置：** `crawlers/jufair_crawler.py:382-393`
- **问题：** `--detail` 模式下，记录先按列表页数据插入（含 `area_str/visitors_str/exhibitors_str`，见 235-240 行），随后详情页 UPDATE 使用 `updates = {k: extra.get(k, "") for k in [...]}` 构造全字段覆盖。若详情页缺少某字段（如"展览面积"的 `<dl>` 不存在），`extra.get(k, "")` 返回空串，**把列表页已抓到的值清空**。
- **证据：**
  ```python
  updates = {k: extra.get(k, "") for k in
             ["organizer", "city", "cycle", "industry", "area_str", "visitors_str", "exhibitors_str"]}
  ...
  UPDATE raw_jufair SET ... area_str=:area_str ... WHERE source_url=:source_url
  ```
  列表页解析（235-240 行）已填 `area_str/visitors_str/exhibitors_str`，详情页解析（314-318 行）只在标签存在时才写入 dict。
- **修复方向：** UPDATE 仅包含 `extra` 中实际存在的非空键，或 SQL 用 `COALESCE(NULLIF(:v,''), 字段)` 保留旧值。

#### CRWL-02：中断后无法补爬详情页（断点续爬能力缺失）

- **位置：** `crawlers/jufair_crawler.py:372, 378-379`
- **问题：** 详情页补爬只针对 `new_records`（本次新插入的记录）。中断后重跑时，已插入但 `detail_crawled=0` 的记录被 `crawled` 集合过滤掉，不进入 `new_records`，**详情页永远不会被补爬**。本次 IP 封禁中断在 4,046/8,400 处，重跑无法补齐这 4,046 条之后未完成的详情字段。
- **证据：** `new_records = [it for it in items if it["source_url"] not in crawled]`，详情循环仅 `for rec in new_records`。表中已有 `detail_crawled` 标志位但无任何代码路径基于它做补爬。
- **修复方向：** 增加按 `WHERE detail_crawled=0` 查询存量记录补爬详情的执行路径（利用现有标志位，不属于新功能）。

#### CRWL-03：被封禁后无全局熔断，持续轰炸目标站（直接关联本次封禁）

- **位置：** `crawlers/jufair_crawler.py:346-347, 417-422`；`crawlers/cnexpo_crawler.py:331-333`
- **问题：** 单个 URL 失败 3 次后 `fetch_page` 返回 None，但运行级别无熔断：
  - jufair：`html is None → break` 仅结束当月，外层立即开始下一个月/下一个 source_type，被封后最多还会发起 24 轮（12 月 × 2 类型）× 3 重试的请求；
  - cnexpo 更严重：详情页失败 `if not detail: continue` **跳过了循环尾部的 `time.sleep(_jitter_delay())`（362 行）**，封禁期间对剩余全部链接（最多 100 页 × 每页数十条）以仅受 403 重试间隔约束的速率连发请求。
- **证据：** cnexpo 329-362 行，`continue` 在 sleep 之前；jufair `crawl_all` 417-422 行无任何失败累计/中止逻辑。
- **修复方向：** 增加全局连续失败计数器，超过阈值（如连续 5 个 URL 全部重试失败）即终止整个运行；cnexpo 的 `continue` 前补 sleep。

#### CRWL-04：cnexpo 详情页按 `<p>` 位置取数，venue 兜底正则必命中 → 版式变化静默写脏数据

- **位置：** `crawlers/cnexpo_crawler.py:231-247`
- **问题：** 日期取 `paragraphs[2]`、展馆取 `paragraphs[3]`、主办方取 `paragraphs[4]`、统计取 `paragraphs[5]`——纯位置索引。页面任何位置多插一个非空 `<p>`（公告、广告）即全部错位。其中 venue 提取的正则 `r"(?:[一-鿿]+-[一-鿿]+\s+)?(.+)"` 对任意非空文本**必然匹配**，错位时会把无关段落文本静默写入 `venue` 字段——不是漏数据，是写错数据。
- **证据：**
  ```python
  venue_m = re.search(r"(?:[一-鿿]+-[一-鿿]+\s+)?(.+)", venue_line)
  if venue_m and venue_m.group(1):
      data["venue"] = venue_m.group(1).strip()
  ```
- **修复方向：** 改为按标签文本锚定（如同 jufair 的"主办单位/举办城市"标签匹配），至少对 venue 增加格式校验（含"馆/中心/会展"等关键词）后再写入。

### 🟠 警告（高）

#### CRWL-05：仅识别 403 一种反爬信号；200 验证码页被误判为"无数据"

- **位置：** `crawlers/jufair_crawler.py:82-99, 265-267`；`crawlers/cnexpo_crawler.py:71-87`
- **问题：** 退避逻辑仅针对 403。429（标准限速码）、503、302 跳转验证页走普通短重试（3s/6s），继续施压。更隐蔽的是：jufair 软封禁常以 200 + 验证码 HTML 返回，`has_target_year` 检查 `"2026."` 子串失败后打印"无2026年数据，停止"——**把封禁误判为数据自然结束**，且不留任何异常痕迹。
- **修复方向：** 429/503 纳入与 403 相同的退避分支并尊重 `Retry-After` 头；200 响应中检测验证码/异常页特征（如页面无 `.exh-info-wrap` 且无翻页结构时告警而非静默停止）。

#### CRWL-06：crawl_log 表完全未写入，批次报告能力为零

- **位置：** 两个爬虫全文；`schema/init_db.sql:81-94`
- **问题：** schema 定义了 `crawl_log`（batch_id/started_at/finished_at/status[running|success|failed|partial]/total_fetched/total_inserted），但两个爬虫没有任何写入代码。本次封禁中断后，数据库中**无任何记录表明该批次中断于何处、状态如何**，只能靠人翻终端输出。
- **修复方向：** 运行开始插入 `running` 行，结束/异常时 UPDATE 为 success/failed/partial 并写入计数。

#### CRWL-07：失败也打印"✅ 完成"、退出码恒为 0（错误吞没）

- **位置：** `crawlers/jufair_crawler.py:587-590`；`crawlers/cnexpo_crawler.py:499-502`
- **问题：** 所有 fetch 失败仅 print 后丢弃，无失败计数汇总。即使整个运行全部请求失败（如被封禁），仍输出"✅ 任务完成"且 `sys.exit` 码为 0。cron/自动化无法感知失败，人看汇总也会误判。
- **修复方向：** 累计失败数，失败 > 0 时输出 partial 提示并以非零码退出。

#### CRWL-08：cnexpo 关键词过滤在详情抓取之后且结果不落库 → 重复运行成倍放大请求量

- **位置：** `crawlers/cnexpo_crawler.py:336-341`
- **问题：** keyword 过滤发生在详情页已抓取之后；不匹配的 URL 被丢弃且**不写入数据库**，下次运行（无论何关键词）它们仍在 `crawled` 集合之外，会被再次完整抓取详情页。多次带关键词运行 = 对同一批详情页反复请求，礼貌性恶化，加剧封禁风险。
- **修复方向：** 不匹配关键词的记录也落库（数据本就是全字段），过滤留给下游查询；或至少记录已访问 URL。

#### CRWL-09：同一 Session（同 Cookie）上每请求轮换 UA — 反爬指纹矛盾

- **位置：** `crawlers/jufair_crawler.py:37, 72`；`crawlers/cnexpo_crawler.py:39, 66`
- **问题：** 全局 `requests.Session` 保持 Cookie 不变，却在每次请求前于 Chrome 125/126、Safari 18、Firefox 128 之间轮换 UA。同一会话 Cookie 配上交替变化的浏览器标识是典型机器人特征，风控系统极易识别——**疑似本次封禁诱因之一**。
- **修复方向：** 每次运行随机选定一个 UA 并全程固定；如需换 UA，同时重建 Session（清 Cookie）。

### 🟡 警告（中）

#### CRWL-10：insert_batch 返回提交条数而非实际插入数，新增统计虚高

- **位置：** `crawlers/jufair_crawler.py:158-177`；`crawlers/cnexpo_crawler.py:137-155`
- **问题：** `INSERT OR IGNORE` 可能忽略行（如同一页面内同 URL 出现两次），但函数返回 `len(records)`。批次"新增 N 条"报告与实际入库数可能不一致。
- **修复方向：** 用 `conn.total_changes` 差值或 `cursor.rowcount` 返回真实插入数。

#### CRWL-11：403 升级计数器在"放弃"时清零，跨 URL 退避升级失效

- **位置：** `crawlers/jufair_crawler.py:91`；`crawlers/cnexpo_crawler.py:79`
- **问题：** 单 URL 三次 403 放弃时 `_consecutive_403 = 0`。下一个 URL 再遇 403 又从 15s 起步——封禁状态下的退避永远不会真正升级（最高 45s），整体节奏仍然过快。
- **修复方向：** 放弃时保留计数器，仅在收到 200 时清零（jufair:79 已有该逻辑，删除 91 行的清零即可）。

#### CRWL-12：依赖 `resp.text` 默认编码推断，无 GBK 兜底

- **位置：** `crawlers/jufair_crawler.py:80`；`crawlers/cnexpo_crawler.py:70`
- **问题：** 若响应头未声明 charset，requests 回退 ISO-8859-1，中文站 GBK/GB2312 页面会乱码，解析后静默写入乱码数据。当前两站可能是 UTF-8，但无任何防护或校验。
- **修复方向：** charset 缺失时设置 `resp.encoding = resp.apparent_encoding`。

#### CRWL-13：--proxy 验证失败时静默回退直连

- **位置：** `crawlers/jufair_crawler.py:576-578`
- **问题：** Tor 验证失败仅打印警告后 `_proxy_enabled = False` 直连继续。用户显式要求走代理（很可能因为本机 IP 已被封）时，回退直连会让被封 IP 继续裸连目标站。
- **修复方向：** 代理验证失败时直接退出，由用户决定是否直连。

#### CRWL-14：cnexpo 日期正则仅匹配单一格式；注释承诺的年份过滤不存在

- **位置：** `crawlers/cnexpo_crawler.py:232, 295-297`
- **问题：** 日期仅匹配 `\d{4}.\d{2}.\d{2} - \d{2}.\d{2}`，单日展会或全写结束日期（`2026.05.06 - 2026.05.08`）均失配 → `date_str=''`、`year=0`。函数注释称"全量爬取后按年份/关键词过滤"，实际代码无任何年份过滤，所有年份记录均入库。
- **修复方向：** 放宽日期正则覆盖单日/全写格式；删除或兑现注释中的年份过滤承诺。

#### CRWL-15：jufair 列表页统计区按 div 索引取数，结构脆弱

- **位置：** `crawlers/jufair_crawler.py:233-240`
- **问题：** `scale_divs[0]` 当面积、`children[1]` 当观众、`scale_divs[1]` 当展商——位置假设无任何标签文本校验，站点调换展示顺序时字段静默错位（面积进观众列）。
- **修复方向：** 结合 `.unitText` 单位文本（平方米/人/家）校验字段归属。

#### CRWL-16：硬编码 TARGET_YEAR=2026 与魔法 URL 模式

- **位置：** `crawlers/jufair_crawler.py:25, 337`；`crawlers/cnexpo_crawler.py:303`
- **问题：** 目标年份、`/exhibition-0-0-{type}-0-0-{month}-` 与 `/events/1000/0/` 路径模式均为硬编码魔法值，无注释说明各段含义；跨年使用需改源码。
- **修复方向：** TARGET_YEAR 提为 CLI 参数默认值；URL 模式加注释说明字段含义。

#### CRWL-17：print-only 日志，无时间戳、无落盘

- **位置：** 两文件全部输出语句
- **问题：** 数小时的长任务全靠无时间戳的 stdout print。本次封禁事故无法回答"封禁发生在几点、之前的请求节奏如何"——事后取证能力为零。
- **修复方向：** print 前缀加 `datetime.now()` 时间戳，或改用 `logging` 输出到文件（最小改动：包一个带时间戳的 log 函数）。

### 🟢 提示

#### CRWL-18：cnexpo 英文名启发式正则可能捕获页面导航/页脚文本

- **位置：** `crawlers/cnexpo_crawler.py:272-278`
- **问题：** 从全页 `<p>` 文本里抓第一个形如 "... Expo/Fair/Show ..." 的英文串，长度 8-100 的护栏较弱，可能抓到无关推荐位的展会名。
- **修复方向：** 限定在标题区域附近的段落内搜索。

#### CRWL-19：jufair 每月重复全表查询 crawled URL 集合

- **位置：** `crawlers/jufair_crawler.py:338`
- **问题：** `get_crawled_urls` 在 `crawl_month` 内调用，全量运行重复执行 24 次全表扫描。不影响正确性（集合内容只增不减），仅冗余。
- **修复方向：** 提升到 `crawl_all` 一次性获取后传入。

---

## IP 封禁风险评估

**结论：当前代码的请求模式足以解释本次封禁，且封禁发生后的行为会主动加剧封禁。**

### 致封因素（按贡献度排序）

1. **会话指纹矛盾（CRWL-09）**：固定 Cookie + 每请求轮换 4 种浏览器 UA，是风控系统最容易命中的机器人特征。8,400 条目标意味着上万次请求全部带着这个矛盾指纹。
2. **长时间无停顿的恒定节奏**：基础间隔 3s±抖动，连续运行数小时无长休止、无每 N 请求的批间停顿、无单日请求上限。抖动只随机化了 2 秒窗口，宏观节奏仍是机器特征。
3. **反爬信号识别面过窄（CRWL-05）**：只认 403。429/503 走 3s/6s 短重试等于无视警告继续施压；200 验证码页被当成"无数据"，错过最早的减速时机。
4. **封禁后行为恶化（CRWL-03）**：被封后 jufair 继续按月推进发起新请求；cnexpo 因 `continue` 跳过 sleep，对剩余链接零间隔扫射——**站方视角是"封禁后攻击性反而增强"，极易从临时封升级为长期封**。
5. **退避升级失效（CRWL-11）**：计数器在放弃时清零，实际退避封顶 45s，从未真正"退下来"。

### 最小改动建议（不引入新功能，均在现有设计内）

| 改动 | 位置 | 工作量 |
|------|------|--------|
| 每次运行固定单个 UA（删除每请求轮换） | 两文件 `_rotate_ua` 调用处 | ~2 行 |
| 429/503 并入 403 退避分支，读取 `Retry-After` | 两文件 `fetch_page` | ~6 行 |
| 全局连续失败 ≥5 次即终止运行 | 两文件主循环 | ~8 行 |
| cnexpo 详情失败的 `continue` 前补 sleep | cnexpo:333 | 1 行 |
| 删除"放弃时 `_consecutive_403=0`" | jufair:91, cnexpo:79 | 删 2 行 |
| 每 50 个请求插入 60–120s 长休止 | `fetch_page` 内加请求计数 | ~5 行 |
| 200 页面无 `.exh-info-wrap` 且无分页时按异常处理而非"无数据" | jufair:348-350 | ~4 行 |

以上合计约 30 行改动，可显著降低复发概率；其中前 4 项与本次封禁直接相关，建议恢复爬取前完成。

---

## 测试覆盖

**爬虫测试覆盖为零。**

- `tests/` 现有：`test_merge_engine.py`、`test_schema.py`、`test_clean_brands.py`、`test_tagging_tools.py`、`middleware.test.ts` —— 均不覆盖 `crawlers/jufair_crawler.py` 和 `crawlers/cnexpo_crawler.py`。
- `test_clean_brands.py:266` 引用的 `scripts.data.jufair_l2_crawler` 是另一个文件，与本次审计范围内的爬虫无关。
- 可测性评估：`parse_list_page`、`parse_detail_page`（解析部分）、`_extract_year`、`insert_batch` 均为纯函数或可注入内存 SQLite，配合 HTML fixture 即可低成本建立回归测试。CRWL-01（空串覆盖）、CRWL-04（段落错位）、CRWL-10（计数虚高）这类静默数据问题，正是单测最能拦截的类型。

---

_审计人: Claude (gsd-code-reviewer)_
_深度: standard_
_说明: 仅审查，未修改任何源文件_
