# Exhibition Competitive Dashboard · PRD v1.0

**项目代号**: MWLAB-2026  
**版本**: v1.0 · 2026.04.27  
**架构师**: Project Commander  
**客户**: BD总监 · 杜塞尔多夫展览上海  
**核心目标**: 帮助总经理快速判断"我们想进入的展会市场"的竞争盘面

---

## §1 项目定位

**一句话定义**: 基于结构化展会数据库的竞争盘面看板，输入一个目标品类，输出该品类的竞争对手 / 潜在伙伴 / 新进入者三维分析视图。

**单一服务对象**: 中国总经理（决策者，非技术）  
**唯一使用场景**: 评估是否进入某个新展会市场  
**明确不做**: 上游产业链指数、下游AI建议、Geckos集成、文字录入交互

---

## §2 As-Is 现状基线

| 资产 | 状态 | 价值评估 |
|------|------|---------|
| 手工梳理的品牌主表(93条) | ✅ 已完成 | **金标准模板**，所有字段定义以此为准 |
| 届次表（2条样本） | ✅ 结构已定 | 时序数据模板 |
| 聚展网爬虫脚本 | ✅ 已验证可跑 | 数据源1，仅限国内IP执行 |
| cnexpo.com 测试脚本 | ✅ 已验证可跑 | 数据源2，结构待研究 |
| 品类聚焦：机床 | ✅ 已选定 | 首批数据采集和打标的目标品类 |

**关键发现**: 用户的手工表格（93条数据）已经定义了20个品牌字段+21个届次字段，这是PRD字段设计的**唯一权威来源**，不需要重新设计字段，只需要工程化复刻。

---

## §3 数据架构（双层设计）

### 3.1 表层结构（来自现有手工表）

**表A: `exhibition_brands`（展会品牌表）— 主键稳定，变化慢**

来自现有"品牌表"，20个字段全部保留，工程化标准化：

| 字段 | 类型 | 来源 | 备注 |
|------|------|------|------|
| brand_id 🔑 | TEXT | 手工/自动生成 EXPO-XXXX | 主键 |
| name_cn | TEXT | 爬取 | 中文名 |
| name_en | TEXT | 爬取 | 英文名 |
| first_year | INTEGER | 爬取 | 首届年份 |
| organizer | TEXT | 爬取+人工补 | **关键字段** |
| co_organizer | TEXT | 爬取+人工补 | |
| city | TEXT | 爬取 | 常设城市 |
| frequency | TEXT | 爬取 | 年展/双年展 |
| industry_l1 | TEXT | 人工标 | 一级行业（医疗/机械/工业等） |
| industry_l2 | TEXT | 人工标 | 二级行业（机床/数控机床等） |
| **competition_relation** | ENUM | 人工标 | 是/否 — **核心标签** |
| **mds_related** | ENUM | 人工标 | 无/MFC/Reha China 等 — **核心标签** |
| scale_score | INTEGER 1-10 | 人工评 | 展会规模评分 |
| is_international | BOOL | 人工标 | 是/否 |
| is_ufi_certified | BOOL | 人工标 | 是/否 |
| ma_potential | INTEGER 1-5 | 人工评 | 并购潜力 |
| **strategic_relevance** | INTEGER 1-5 | 人工评 | 战略相关度 — **核心标签** |
| competitor_group | TEXT | 人工标 | 竞争对手集团归属 |
| website | TEXT | 爬取 | |
| notes | TEXT | 自由 | |

**表B: `exhibition_editions`（届次表）— 时序数据，每年新增**

来自现有"届次表"，21个字段全部保留：

| 字段 | 类型 | 来源 |
|------|------|------|
| edition_id 🔑 | TEXT | EXPO-XXXX-YYYY |
| brand_id | FK | → exhibition_brands |
| edition_num | INTEGER | 届次号 |
| year | INTEGER | 举办年份 |
| date_start, date_end | DATE | 爬取 |
| city, venue | TEXT | 爬取 |
| status | ENUM | 已举办/即将举办/取消/延期 |
| **area_sqm** | INTEGER | 爬取 — **核心字段** |
| **exhibitors_count** | INTEGER | 爬取 — **核心字段** |
| **visitors_count** | INTEGER | 爬取 — **核心字段** |
| overseas_exhibitor_pct | FLOAT | 爬取/估算 |
| booth_price_per_sqm | INTEGER | 爬取 |
| heat_score | INTEGER 1-5 | 人工评 |
| yoy_trend | ENUM | 上升/平稳/下降 |
| anomaly_flag | BOOL | 人工标 |
| data_source | TEXT | jufair/cnexpo/官网/手工 |
| recorded_at | DATETIME | 系统 |
| notes | TEXT | 自由 |

**表C: `data_provenance`（数据溯源表）— 新增，未来必需**

记录每条爬取数据的原始来源，支持双源交叉对比：

| 字段 | 类型 | 说明 |
|------|------|------|
| record_id 🔑 | TEXT | 主键 |
| brand_id | FK | 关联品牌 |
| source_site | ENUM | jufair / cnexpo / manual |
| source_url | TEXT | 原始页面URL |
| raw_payload | JSON | 原始爬取的全字段JSON |
| crawled_at | DATETIME | 爬取时间 |
| crawl_batch_id | TEXT | 批次号，关联到 crawl_log |

**表D: `crawl_log`（爬取日志）+ 表E: `users`（用户管理）+ 表F: `manual_tag_history`（人工打标历史）**

详细schema在执行阶段由Claude Code展开，本PRD只锁定字段范围。

### 3.2 双源交叉对比逻辑

两个数据源对同一展会的字段冲突时的处理规则（必须在脚本里硬编码）：

| 字段类别 | 优先级规则 |
|---------|-----------|
| 名称、举办时间、地点 | jufair 为准（数据更新更稳定） |
| 展商数、观众数、面积 | **取较大值**，但记录两源差异到 `data_provenance.notes` |
| 主办方 | **两源都保留**，差异时人工兜底 |
| 缺失字段 | 谁有取谁，都没有为 NULL |

---

## §4 更新策略

| 频率 | 类型 | 操作 |
|------|------|------|
| 每周一 | 增量 | 抓取新增展会、届次状态变更（已举办→即将举办等） |
| 每月1日 | 全量 | 重新抓取所有品牌的最新届次数据，对比差异并打异常标记 |
| 每年Q1 | 校准 | 人工复核所有 `competition_relation` / `mds_related` / `strategic_relevance` 标签 |

---

## §5 前端约束（Dashboard层）

**严格规则（来自客户指令）**:
- ❌ 无文字输入
- ✅ 全部点选
- ✅ 不超过 3 个筛选控件
- ❌ UI/UX 设计延后（最终交给 Claude Design）

**3个点选控件已锁定**:
1. **行业筛选** — 单选 industry_l1 → industry_l2 联动
2. **关系筛选** — 多选: 竞争对手 / 潜在伙伴 / 新进入者 / 全部
3. **MDS相关性** — 单选: 全部 / MFC / Reha China / 无

**默认展示三栏**: 竞争对手清单 | 潜在伙伴清单 | 新进入者清单  
**关键数字卡片**: 该品类品牌总数、年度总展商规模、年度总观众规模、近12个月新进入者数量

---

## §6 部署目标

| 维度 | 决策 |
|------|------|
| 域名 | 用户已选定（待告知） |
| 服务器 | 云端部署（具体平台由Claude Code在Phase 3评估后建议） |
| 用户管理 | 内置账号系统，支持总经理+BD团队登录，最多30人 |
| 数据存储 | SQLite（本地开发）→ 云端同步（部署阶段决策） |

---

## §7 Agent任务分配（分Phase执行）

> **铁律**: 每个Agent单次执行任务**不超过3个**。Phase之间客户验收通过后才能进入下一Phase。

### Phase 1 · 数据采集器（Hermes Agent）

**目标**: 把两个数据源的爬虫脚本工程化，能稳定输出符合 Schema 的数据。

**Hermes任务1**: 复刻并标准化 `jufair_crawler.py`
- 输入: 现有测试脚本 + 本PRD §3.1表B字段定义
- 输出: `crawlers/jufair_crawler.py`，能按"品类关键词+时间窗口"抓取列表页+详情页
- 字段输出严格遵循 `exhibition_editions` schema
- 写入 SQLite 表 `raw_jufair`

**Hermes任务2**: 开发 `cnexpo_crawler.py`
- 输入: cnexpo.com 测试脚本（用户提供）
- 输出: `crawlers/cnexpo_crawler.py`，逻辑结构与 jufair 对齐
- 写入 SQLite 表 `raw_cnexpo`

**Hermes任务3**: 写定时任务调度器 `scheduler.py`
- 周一增量、月初全量
- 写入 `crawl_log` 表
- 失败重试3次后告警

**📌 Hermes 执行指令**:
> 严格按照以下顺序执行3个任务，禁止合并、禁止额外发挥。每完成一个任务输出测试报告（抓取条数、字段覆盖率、失败原因），等待人工确认后进入下一个。所有文件命名使用英文蛇形命名法（snake_case）。代码必须能在 Mac Mini 北京办公室节点运行（境外IP无法访问聚展网，已验证返回HTTP 403）。

---

### Phase 2 · 数据清洗与匹配引擎（Claude Code）

**目标**: 把两个原始表合并为统一的 `exhibition_brands` + `exhibition_editions`，处理冲突，建立溯源。

**Claude Code 任务1**: 设计并实现 SQLite 完整 Schema
- 输入: 本PRD §3 全部字段定义
- 输出: `schema/init_db.sql`、`schema/migrations/` 目录
- 包含全部6张表：brands / editions / data_provenance / crawl_log / users / manual_tag_history

**Claude Code 任务2**: 实现双源合并引擎 `merge_engine.py`
- 输入: `raw_jufair` + `raw_cnexpo`
- 输出: 写入 `exhibition_brands` + `exhibition_editions` + `data_provenance`
- 实现 §3.2 的字段优先级规则
- 提供命令行工具 `python merge_engine.py --batch <crawl_batch_id>`

**Claude Code 任务3**: 实现人工打标 API
- 输入: brand_id + 字段名 + 新值
- 输出: 更新主表 + 写入 `manual_tag_history`
- 提供 RESTful 接口（FastAPI），暂不做UI

**📌 Claude Code 执行指令**:
> 你是Phase 2的核心大脑。Phase 1的Hermes产出的代码可能存在边界问题（编码、超时、字段缺失），你的合并引擎必须假设原始数据是脏的并优雅处理。三个任务串行执行，每个任务完成后必须输出：(1) Schema/代码文件 (2) 单元测试覆盖率报告 (3) 在用户的93条样本数据上跑通验证。不允许引入除FastAPI、SQLAlchemy、pandas之外的依赖。

---

### Phase 3 · API层与用户系统（Cursor）

**目标**: 把数据库包装成前端能用的 REST API + 用户认证。

**Cursor 任务1**: 实现查询API（FastAPI）
- 端点: `GET /api/dashboard?industry_l2=&relation=&mds=`
- 返回: 三栏聚合数据 + 4个数字卡片所需统计
- 性能要求: 93条样本数据下响应时间 < 200ms

**Cursor 任务2**: 实现用户认证系统
- 邮箱+密码登录，JWT token
- 角色: admin（BD总监）/ manager（总经理）/ readonly
- 30人上限的简化设计，无需复杂RBAC

**Cursor 任务3**: 部署脚本+CI
- Docker化
- 提供两个备选部署方案的评估报告：(A) 云服务器+Caddy (B) Cloudflare Pages+Workers，由用户在Phase 3结尾决策

**📌 Cursor 执行指令**:
> 你是工程整合者。Claude Code 的代码可能写得很好但缺乏部署考量，你需要把它变成能上线的产品。三个任务完成后，必须提供：(1) 可运行的Docker镜像 (2) API文档（OpenAPI格式） (3) 部署方案对比表（成本、维护难度、扩展性三个维度）。

---

### Phase 4 · UI/UX设计（Claude Design）

**目标**: Phase 1-3 全部验收通过后启动。  
**任务范围**: 基于已有API设计前端界面。  
**当前状态**: ⏸ 暂缓启动

---

## §8 验收节点

| Phase | 验收物 | 验收人 |
|-------|--------|--------|
| 1 | 两个数据源能稳定抓取100+条机床品类展会，字段覆盖率 ≥ 80% | BD总监 |
| 2 | 93条手工样本能100%被合并引擎复现，零字段丢失 | BD总监 |
| 3 | API在浏览器Postman可用，登录系统跑通，部署方案二选一 | BD总监 |
| 4 | 前端Demo可演示给总经理 | 总经理+BD总监 |

---

## §9 命名规范（强制）

- 所有文件名: `snake_case.py`，禁止中文、空格、连字符
- 数据库表名: `snake_case`，单数（如 `exhibition_brand` 而非 `exhibition_brands`... **本PRD为可读性使用复数，实际工程化由Claude Code统一决策**）
- 字段名: `snake_case`，英文
- API端点: `/api/资源-名/动作`，小写连字符

---

## §10 风险登记

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 聚展网IP白名单（仅大陆IP） | 高 | 爬虫部署在Mac Mini北京节点，已验证 |
| cnexpo.com反爬未知 | 中 | Phase 1 任务2 必须先做反爬探测报告 |
| 字段在两源都缺失 | 中 | 人工打标兜底，已有93条样本作金标准 |
| 总经理不会用Dashboard | 高 | Phase 4 设计前必须做用户访谈 |

---

*PRD v1.0 · ECD-2026 · 2026.04.27 · CONFIDENTIAL*  
*下一步动作: 客户验收本PRD → 启动 Phase 1 → Hermes 接收任务1*
