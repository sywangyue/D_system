# V2 万象重构 · 方案与信息架构原文

> **归档文件**：以下为已执行完毕的原始文档合并，内容保持原样、不再维护。
> 文中「阶段 X / 任务 X / Phase X」与统一编码的对应关系见 `docs/HISTORY.md`。
> 文中对其他 docs 文件的引用，文件已并入 `docs/` 下的新文件或本目录。

## 目录

1. V2-00 · 重构总方案 2026-09-16
2. V2-00 · 信息架构定稿
3. V2-04 · 后端 API 规格


---

## V2-00 · 重构总方案 2026-09-16

<!-- 原文件：docs/REBUILD-2026-09-PLAN.md -->

### MWLAB 重构总方案 · 2026-09-16

**性质**：推翻重做（Max 已授权「对整改没有限制」）
**主线变更**：产品主体从「展会目录」改为「BD 工作台」，展会数据降级为底图
**关联文档**：`AGENTS.md`（旧架构）、`docs/PHASE7-EXPOFINDER-PLAN.md`（线索接入，本次并入阶段 4）

---

#### §0 结论先行：三个必须先说的判断

##### 判断 1 —— 「舍去展会信息」应该精确为「展会目录这个产品形态下架，数据留下」

展会数据不是包袱，是新主线的**燃料**：

| 资产 | 行数 | 在新架构里的角色 |
|---|--:|---|
| `exhibition_brand` | 7,401 | M&A 标的池的筛选底表 |
| `brand_organizer` | 9,740 | 主办方 = 潜在收购对象 / 合作方，**这才是 M&A 的主语** |
| `exhibition_edition` | 7,703 | 规模证据（面积/展商/观众）＝ 估值锚点 |
| **无 2026+ 届次的品牌** | **2,061** | **白地信号池**：办过又停了 = 需求存在过但没人接住 |
| `brand_geo_tag` | 8,145 | 地理分布，白地的区域判断 |

`ma_analysis_v2.py` + `ma_candidates_v2.json` 已经在做「MDS 品牌 ↔ 中国展会」匹配，
这正是 Max 说的第一条业务线（MD 有的品牌延展）。**它已经存在，只是没有产品形态。**

> 真正要下架的是：日历+地图+趋势+全量表格这套「给所有人看展会」的外壳，
> 以及 `public/dashboard.html` 这个 1,801 行的静态页。

##### 判断 2 —— 新架构的中心实体是「公司」，不是「展会」

三条业务线的共同宾语：

- M&A 标的 → 是**公司**（主办方公司）
- 深度调研 → 对象是**公司**
- 白地品类 → 里面的现有玩家是**公司**
- 项目组合作方 → 是**公司**

现状是：`exhibition_brand` 7,401 行是一等公民，而公司侧只有 `customer_prospect` 495 行。
**重心迁移 = 把公司扶正，展会挂到公司下面。**

##### 判断 3 —— 不用新建表，现有两张表扶正即可

| 现有表 | 现状 | 新角色 |
|---|--:|---|
| `intel_report` | 2 行，有 `report_type` / `target_company` / `report_md` / `report_file` | **深度调研的落库主体**（现在报告散落在 `reports/*.docx`） |
| `customer_prospect` | 495 行，有企查查 `qcc_key_no` / 信用代码 / 法人 / 状态 | **company 表的前身**，改名扶正 |

真正要新建的只有 **1 张表：`opportunity`（机会台）**。

##### 判断 4 —— 五张空表 + 一个空页面是死代码，本次删除

| 对象 | 现状 |
|---|---|
| `person` / `exhibition_contact` / `contact_relation` | 0 行 |
| `exhibition_relation` / `exhibition_timeline` | 0 行 |
| `app/people/*`（355 行）+ 4 个 `/api/people*` 路由 | 读空表，前端常年空列表 |

> ⚠️ 删除清单需 Max 逐项确认后执行，不自动删。

---

#### §1 新信息架构

##### 1.1 实体模型

```
company（公司）  ← 中心实体，由 customer_prospect 扶正
  company_id PK, name, credit_code, qcc_key_no, oper_name,
  status, type[主办方|展商|服务商|标的|合作方], city, country
  │
  ├── opportunity（机会）  ★ 唯一新建表，三条业务线共用
  │     opp_id PK, type[ma|greenfield|project_support]
  │     title, stage, owner, company_id FK(可空), brand_id FK(可空)
  │     md_brand（对标的 MD 品牌，仅 ma/greenfield）
  │     next_action, next_action_due, priority, detail_json
  │
  ├── intel_report（调研报告）  ← 已存在，扶正
  │     report_type, target_company, report_md, report_file
  │     + 新增 opp_id FK
  │
  └── exhibition_brand（展会品牌）  ← 降级为字典/底图
        + 新增 company_id FK（主办方指向 company）
```

**为什么 `opportunity` 用单表 + `type` 而不是建三张表**：
三条线的共同字段占 80%（标题/阶段/负责人/关联公司/下一步/优先级），
差异字段（M&A 的估值与股权、白地的市场规模判断、项目组的交付物类型）放 `detail_json`。
三张表意味着 3 套 API、3 套列表页、3 套筛选器 —— 违反 CLAUDE.md #2「最小代码」。
**代价**：`detail_json` 里的字段无法 SQL 聚合。
若 M&A 的估值需要跨标的排序/统计，就要把该字段提升为正式列。→ 见 §6 决策 3。

##### 1.2 页面清单（9 个路由，取代现有 5 个）

| 路由 | 名称 | 内容 | 优先级 |
|---|---|---|---|
| `/` | **官网门面** | 未登录：品牌落地页（原 `pitch.html` 重做）；已登录：跳 `/overview` | P0 |
| `/login` | **登录** | 三语 + 品牌左栏 + 表单右栏（删 Matrix 数字雨） | P0 |
| `/overview` | **盘面** | 三条业务线的状态卡 + 本周待办 + 最近调研 | P0 |
| `/opportunity` | **机会台** | 主列表，顶部 tab 切 M&A / 白地 / 项目组；Linear 式密集表格 | P0 |
| `/opportunity/[id]` | 机会详情 | 关联公司、对标 MD 品牌、调研报告、时间线、下一步 | P0 |
| `/company` | **公司库** | 495 prospect + 主办方 + 合作方统一视图 | P1 |
| `/company/[id]` | 公司详情 | 企查查字段、关联机会、关联展会、联系记录 | P1 |
| `/research` | **调研库** | `intel_report` 列表，按公司/行业/类型筛 | P1 |
| `/expo` | **展会底图** | 降级后的看板：地图 + 行动日历 + 趋势四宫格 + 行业分布 | P2 |
| `/setting` | 设置 | 用户、数据状态（沿用现有） | P2 |

**路由冲突已解（2026-09-16）**：现状是 `/` redirect 到 `/dashboard.html`，官网藏在 `/pitch.html`。
新方案 —— `/` 按登录态分流：**未登录渲染官网，已登录 302 到 `/overview`**。
`pitch.html` 与 `dashboard.html` 两个静态页一并退役。

**展会模块降级的具体含义**（2026-09-16 Max 定）：
- **砍掉**：横向滚动品牌卡片、完整品牌列表大表（7,401 条全量浏览改为在机会/公司详情里按需查询）
- **保留并升级**：日历从「展会档期表」改为 **「我的行动日历」**（我要去哪个展会、见谁、推进哪个机会）
- **保留**：地图（白地的区域判断）
- **保留**：趋势四宫格 + 行业分布 —— 但数据口径要重定义，见下

> ⚠️ 趋势/分布保留带来的连锁影响：现在这四张图是对「全部 7,401 品牌」聚合的，
> 新主线下这个口径没有决策价值。必须改为**跟随当前筛选范围**（某个 MD 对标品类 /
> 某个白地品类 / 某个城市）才成立，否则就是一块好看但不被读的面板。
> 这一条进阶段 1 的 IA 文档细化。

---

#### §2 视觉方向：与问津的兄弟关系

> 代码与数据层面，两个项目**继续彻底切开**（沿用既有约定，不复用任何代码和数据）。
> 兄弟关系只存在于**品牌视觉语言**层，且是**对位关系**而非相似关系。

| 维度 | MWLAB（科技 / 强前端） | 问津（文学 / 冷批评 / 媒体） |
|---|---|---|
| 明暗 | 暗色为主 | 亮色为主 |
| 字体 | 几何无衬线 + 等宽数字 | 衬线 / 宋体系 |
| 密度 | 高密度、多列、可扫描 | 低密度、单栏、慢读 |
| 色彩 | 中性灰阶 + 单点高饱和 | 纸色 + 墨色，近乎无彩 |
| 节奏 | 紧、锐、即时反馈 | 松、缓、留白 |
| 主体 | 数据表格与图表 | 长文与引文 |

**共享的不变量（这是「一家出品」的识别点）**：
1. 同一套几何骨架：8px 间距节奏、同一组圆角半径、同一种网格分栏逻辑
2. **同一个 logo 构造法 —— 英文在前、中文在后，永不调换**：

   ```
   MWLAB │ 万象          WHENJIN │ 问津
   ```
   拉丁字标在前、重字重、紧字距；中文在后、轻一档字重、略小一号视觉尺寸，
   中间一根发丝竖线。两边都是「轻字 + 重字」的中文结构
   （万 3 画 + 象 11 画 ‖ 问 6 画 + 津 9 画），对位天然成立。
   图标态（favicon / 侧栏收起）各取末字：**象** ‖ **津**。
3. 同一套字阶比例（数值不同，比例相同）

##### 参考锚点（Max 已确认）

| 参考 | 偷什么 | 落到哪 |
|---|---|---|
| **Linear** | 信息密度、暗色为一等公民、极窄灰阶层级、键盘优先 | `/opportunity` 机会台、全局骨架 |
| **hex.tech** | 数据排版、图表配色、数字字体处理 | `/` 盘面、`/expo` 图表 |
| **Vercel** | 品牌气质：几何秩序、黑白 + 单点高饱和 | logo、登录页、色板结构 |

---

#### §3 执行顺序（含手动/自动/模型分工）

**核心顺序判断：信息架构必须领先视觉半步。**
Stitch 画的是屏幕，屏幕的内容取决于 `opportunity` 有哪些字段。
先画后定模型 = Claude Design 深稿做完才发现字段对不上 = 全部返工。

##### 阶段 0 · 冻结与清场（0.5 天）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 0.1 | 决策：中文字（象 / 谱 / 舆） | **Max 手动** | — |
| 0.2 | 决策：§6 的 6 个问题 | **Max 手动** | — |
| 0.3 | `git tag pre-rebuild-2026-09-16` + 全库备份 | 自动 | Claude |
| 0.4 | 死代码删除清单确认后执行 | 半自动 | **DeepSeek**（机械删除） |

**验证**：`git tag -l` 有 tag；备份文件行数与主库一致；`npm run build` 通过。

##### 阶段 1 · 信息架构定稿（1 天，纯文档，不写代码）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 1.1 | 写 `docs/IA-2026-09.md`：实体 + 字段 + 8 个页面的逐页字段清单 | Claude | **Claude（不可下放）** |
| 1.2 | 把 `ma_candidates_v2.json` 的 32KB 内容反推成 M&A 机会的真实字段 | Claude | Claude |
| 1.3 | Max 逐页过一遍，砍掉不需要的字段 | **Max 手动** | — |

**验证**：每个页面都能回答「这一屏要做什么决策」，答不上来的页面删掉。
**不开 subagent** —— 这一步需要全部上下文，冷启动 agent 会重新读一遍文档，更贵。

##### 阶段 2 · 视觉设计（Max 主导，Claude 供料）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 2.1 | 生成 Stitch prompt（见 §5，按页各一份） | Claude | Claude |
| 2.2 | 跑 Stitch 出第一版 | **Max 手动** | Stitch |
| 2.3 | 把 Stitch 产物 + IA 文档打包成 Claude Design 的深度设计 brief | Claude | Claude |
| 2.4 | Claude Design 深度设计 | **Max 手动** | Claude Design |
| 2.5 | 深稿回 Stitch 做细节/模块调整 | **Max 手动** | Stitch |
| 2.6 | **从深稿反向抽取 design token** → `docs/DESIGN-TOKENS.md` | Claude | **Claude（关键，不可下放）** |

> 对 Stitch 的期待要摆正：它能定**气质与骨架**，定不了**密度**。
> Linear 那种密度 Stitch 做不出来，密度是 Claude Design 阶段的活。

**验证**：token 文档里每个值都能在深稿里找到出处；`app/globals.css` 成为唯一真源，
`public/dashboard.html` 的那套 `--bg-page/--text-1` 全部删除。

##### 阶段 3 · 数据层重建（2 天）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 3.1 | 写迁移设计（DDL + 搬数规则 + 回滚方案） | Claude | Claude |
| 3.2 | 迁移脚本 `schema/migrations/014_rebuild.sql` 实现 | 自动 | **DeepSeek** |
| 3.3 | `customer_prospect` 495 行 → `company` | 自动 | **DeepSeek** |
| 3.4 | `brand_organizer` 9,740 → 去重后补进 `company` | 自动 | **DeepSeek** |
| 3.5 | `ma_candidates_v2.json` → `opportunity` 种子数据 | 自动 | **DeepSeek** |
| 3.6 | **逐字段校验脚本**（不是数行数） | 规则 Claude / 实现 DeepSeek | 混合 |
| 3.7 | 校验结果人工抽查 20 条 | **Max 手动** | — |

> ⚠️ 沿用既有教训：**行数对得上 ≠ 没丢数据**，3.6 必须逐字段与备份比对，不可省。

##### 阶段 4 · 后端 API（1.5 天）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 4.1 | `/api/opportunity` `/api/company` `/api/research` CRUD 样板 | 自动 | **DeepSeek**（格式固定，8 个路由） |
| 4.2 | `/api/overview` 盘面聚合查询 | Claude | Claude |
| 4.3 | 展会底图查询（在 `/api/dashboard` 上瘦身） | 自动 | **DeepSeek** |
| 4.4 | 权限：机会台是否按 owner 隔离 | 取决于 §6 决策 5 | Claude |

##### 阶段 5 · 前端落地（3–4 天，最大的一块）

| # | 动作 | 谁做 | 模型 |
|---|---|---|---|
| 5.1 | `public/dashboard.html` 退役，展会看板重写为 `/expo` React 页 | Claude | Claude |
| 5.2 | 深稿 HTML → React 组件骨架转写 | 自动 | **DeepSeek**（机械转写） |
| 5.3 | 全站 133 处 inline `style={{}}` → token/className | 自动 | **DeepSeek** |
| 5.4 | 中文字体栈 + 字阶落地（CJK 排版规则） | Claude | **Claude（判断力，不可下放）** |
| 5.5 | 暗色模式（Linear 路线，暗色为默认） | Claude | Claude |
| 5.6 | 登录页重做（删 Matrix 数字雨） | 自动 | **DeepSeek** |
| 5.7 | 静态资源治理（8.4MB → WebP，含 4 张 2MB+ 图） | 自动 | **DeepSeek** |

##### 阶段 6 · 内容填充与上线（Max 主导）

| # | 动作 | 谁做 |
|---|---|---|
| 6.1 | 把在做的 M&A 标的、白地品类、项目组需求录进机会台 | **Max 手动** |
| 6.2 | `reports/*.docx` 历史调研报告归档进 `intel_report` | 半自动 / DeepSeek |
| 6.3 | 展查查线索接入（原 Phase 7）挂到 `company` 上 | 后续独立排期 |

---

#### §4 Token 经济：模型分工原则

##### 交给 Hermes + DeepSeek 的（机械、格式固定、有明确验收标准）

- SQL DDL 与数据搬运脚本
- CRUD API 路由样板（同一个模板套 8 遍）
- HTML → React 组件的机械转写
- 批量替换：inline style → token、硬编码色值 → 变量
- 图片压缩、资源治理、死代码删除
- docx / xlsx 导出模板

##### 必须 Claude 做的（需要判断力或全局上下文）

- 数据模型的取舍与边界（阶段 1、3.1）
- **迁移校验规则的设计**（阶段 3.6 —— 这是最容易出事的一步）
- design token 的反向抽取（阶段 2.6）
- 中文排版规则（阶段 5.4 —— 字重、字距、行高对 CJK 的特殊处理）
- Stitch / Claude Design 的 prompt 工程
- 所有 DeepSeek 产物的验收

##### 关于 subagent：建议只开 1 处

| 场景 | 建议 |
|---|---|
| 阶段 5 前，全量盘点前端引用关系 | ✅ 开 1 个 `Explore`，只要结论不要文件内容 |
| 其余所有步骤 | ❌ 不开。subagent 冷启动要重读 `CLAUDE.md`/`AGENTS.md`/IA 文档，重复成本高于收益 |

**省 token 的真正大头不是 subagent，是三件事**：
1. 阶段 1 把 IA 一次定死 —— 返工才是最贵的
2. 机械活全部下放 DeepSeek
3. 每个阶段结束落一份文档，下个 session 读文档而不是读代码

---

#### §5 Stitch Prompt（可直接粘贴）

> 用法：一屏一条，分别跑。中文名已定稿为「万象」，prompt 内已写死，可直接粘贴。

##### Prompt A —— 机会台（主界面，最关键）

```
Design a dark-mode internal B2B intelligence workstation for an exhibition
industry M&A and business-development team. Desktop web, 1440px.

BRAND LOCKUP (identical on every screen, never varied):
The latin wordmark "MWLAB" comes FIRST, set in a geometric grotesque at a
heavy weight with tight tracking. After it, a thin vertical hairline, then the
two Chinese characters "万象" SECOND, set in a modern CJK sans one weight
lighter and at a slightly smaller optical size so the latin stays dominant.
万 has far fewer strokes than 象 — give 万 a touch more weight so the CJK pair
reads as one even block. Latin always leads; Chinese always follows.
Icon-only / collapsed state uses the single character "象".
Accent #FE5C00 appears ONLY on the active state and one primary action;
everything else is neutral grayscale.

REFERENCE FEEL: the information density and keyboard-first restraint of
Linear, the data typography of Hex, the geometric black-and-white order of
Vercel. Precise, cold, engineered. NOT friendly, NOT rounded, NOT playful.

LAYOUT:
- Left sidebar, 200px, collapsed-icon capable. Items: 盘面 / 机会台 / 公司库 /
  调研库 / 展会底图 / 设置. Dark #0E0E10 background.
- Top bar 48px: breadcrumb on the left, a command-palette search field in the
  center ("搜索机会、公司、报告…  ⌘K"), avatar right.
- Main area: a segmented tab row — 并购标的 / 全新品类 / 项目组支持 — then a
  filter strip of small square-ish pill buttons, then a DENSE data table.

THE TABLE IS THE PRODUCT. Requirements:
- Row height 36px, 11 columns, no zebra striping, 1px hairline dividers at 6%
  white opacity.
- Columns: 机会名称 / 类型 / 阶段 / 对标MD品牌 / 关联公司 / 城市 / 规模(㎡) /
  优先级 / 负责人 / 下一步 / 更新时间
- Stage column uses a small 5-segment progress indicator, not a colored badge.
- All numbers right-aligned in a tabular-figures monospace-ish face.
- Priority shown as 1–5 small filled squares, not stars.
- Hover reveals a row-level action affordance at the right edge.
- 24 rows visible without scrolling.

TYPOGRAPHY: Latin in a geometric grotesque; Chinese in a modern CJK sans with
noticeably LOWER weight than the latin so the two align optically. Body 13px,
table header 11px uppercase-tracked, page title 20px. No text below 10px.

SURFACES: background #0A0A0B, cards #141416, borders rgba(255,255,255,0.07).
Flat — no drop shadows, no glass blur, no gradients. Depth comes from
one-step-lighter surfaces only.
```

##### Prompt B —— 盘面首页

```
Same dark design system as before (MWLAB 万象, #0E0E10 sidebar, #FE5C00
single accent, Linear-density, Hex-style data typography).

Design the OVERVIEW home screen. Top: four compact metric blocks in a single
row, each showing a large tabular number (48px, tight tracking), an 11px
uppercase label, and a 40px-tall sparkline underneath — NOT cards with
shadows, just areas separated by 1px hairlines.
Metrics: 在跟进机会 / 并购标的 / 白地品类 / 本周待办

Below, a 2-column asymmetric split (62/38):
- LEFT: "本周待办" — a compact list of action items, each one line: due date
  (monospace), opportunity title, owner avatar, stage pip. 10 rows.
- RIGHT: "最近调研" — 5 report entries, each with company name, report type
  tag, date, and a 3-line excerpt in muted gray.

Full width at the bottom: a horizontal stage-funnel showing how many
opportunities sit in each stage, rendered as proportional segmented bars with
counts on top — Hex-style, muted grays with one orange segment for the
bottleneck stage.

No illustrations. No icons larger than 16px. Whitespace comes from a strict
8px baseline grid, not from padding inflation.
```

##### Prompt C —— 机会详情

```
Same dark design system (MWLAB 万象). Design the OPPORTUNITY DETAIL screen.

Three-zone layout:
- Header band: opportunity title 24px, a type tag, stage stepper (5 steps,
  current one in #FE5C00), owner, and a right-aligned primary button.
- Left main column (65%): tabbed content — 概览 / 深度调研 / 时间线 / 关联展会.
  The 深度调研 tab renders long-form Chinese markdown: 16px body, 1.8 line
  height, generous paragraph spacing, tables with hairline rules.
- Right rail (35%): a stacked set of metadata blocks separated by hairlines —
  关联公司 (name, credit code, legal rep, status), 对标MD品牌, 规模数据
  (3 numbers in a row), 下一步 (editable one-liner with a due date).

The long-form reading area must feel calm and generous, in deliberate
contrast to the dense table screen. Same palette, different rhythm.
```

##### Prompt D —— 展会底图 `/expo`

```
Same dark design system (MWLAB 万象, #0A0A0B background, #FE5C00 single
accent, Linear density, Hex data typography, flat surfaces, no shadows).

Design the EXHIBITION BASEMAP screen. This is a REFERENCE layer, not the
product — it must read as clearly secondary to the opportunity workspace:
slightly quieter, less saturated, fewer affordances.

Top: a single horizontal filter strip (行业 / 城市 / 规模 / 关系), small
square-ish pills, left aligned, one line only.

Then a 2-column split (58/42):
- LEFT: a dark-themed world map, landmass in #1A1A1D with 1px #2A2A2E
  borders, cities as small unfilled circles sized by exhibition area. No
  drop shadows, no glow. A minimal legend bottom-left on a flat surface.
- RIGHT: "我的行动日历" — a compact month grid. Days are 44px tall. This is
  an ACTION calendar, not a schedule listing: each entry is a one-line item
  with a 2px left color bar, a time, and a short label ("见 XX 主办方").
  Today is a filled #FE5C00 square, not a circle.

Below, full width: four small trend panels in one row, each 180px tall.
Each panel = an 11px uppercase label, a large tabular number with a delta,
and a minimal bar or line chart below it. Charts use 4 steps of gray plus
ONE orange series. No axis lines, no gridlines, no legends inside the chart
— only a baseline and direct value labels on the extremes.
Panels: 观众数量 / 展览面积 / 展商数量 / 行业分布.
The 行业分布 panel is a horizontal stacked bar, NOT a pie chart.

Every number in a tabular-figures face. Chinese labels at a lower weight
than latin numerals so the two align optically.
```

##### Prompt E —— 官网主界面 `/`（v2 · 2026-09-16 重写）

> **v1 作废的原因**（Max 反馈）：内容与架构太狭隘、不符合杜塞尔多夫展览的调性、
> 参考了旧 `pitch.html`。v2 的三条铁律：
> ① **不看旧设计**，直接模仿 Linear / Hex / Vercel；
> ② **砍到 6 个 section**，简洁优先；
> ③ **让数据自己说话** —— 页面主体是真实的数据切面，不是叙事和自我介绍。
> 已删除：成长路线图、开发者卡片、技术架构层、四步工作流、"MWLAB 是什么"。
> 这些是个人项目的口吻，不是一家做 interpack / drupa / MEDICA 的机构的口吻。

```
Design the public landing page for MWLAB 万象 — the market intelligence
platform of Messe Düsseldorf Shanghai. Desktop web, 1440px, dark.

=== HOW TO APPROACH THIS ===
Imitate three references directly and unapologetically:
- LINEAR — for the page architecture: a short confident headline, then an
  immediate large product surface, then very few sections after it. Copy its
  restraint: almost no marketing copy, lots of negative space, hairline
  dividers instead of cards.
- VERCEL — for the geometric order, the hairline-divided statistic bands, and
  the black-and-white-plus-one-accent discipline.
- HEX — for how every chart and table on the page is styled: muted, precise,
  tabular, no decoration.
Do NOT invent a new visual language. Do NOT look at any prior version of this
page.

=== TONE ===
The client is a 75-year-old German trade fair organizer that runs interpack,
drupa, MEDICA, K and GIFA. The page must read as institutional infrastructure:
factual, understated, engineered. State facts, never benefits. No slogans, no
exclamation, no "empowering", no founder story, no roadmap, no personal
credits, no technology stack showcase. If a sentence could appear in a startup
pitch deck, delete it.

=== BRAND LOCKUP (never varied) ===
Latin "MWLAB" FIRST in a heavy geometric grotesque with tight tracking, then a
thin vertical hairline, then "万象" SECOND in a modern CJK sans one weight
lighter and at a slightly smaller optical size. Latin leads, Chinese follows.
Icon-only state uses the single character "象".

=== SYSTEM ===
Page #0A0A0B, raised surfaces #141416, hairlines rgba(255,255,255,.07),
text #FAFAFA / #8A8A8F / #56565B, single accent #FE5C00.
Flat only: no drop shadows, no glassmorphism, no gradients, no glow.
Latin in a geometric grotesque with tabular figures; CJK one weight lighter
than the latin so the two align optically. Strict 8px baseline grid.
160px of vertical space between sections. Content column max 1200px.
Orange appears at most 3 times per viewport.

=== SECTION 1 — Nav, 56px, fixed ===
Left: the brand lockup. Right, in order: text links 数据 / 能力 / 业务,
a 3-way language control 中文 | EN | DE (active segment filled #FE5C00),
and a 32px "进入系统" button.
Background rgba(10,10,11,.8), backdrop blur, 1px bottom hairline.

=== SECTION 2 — Hero ===
Left aligned, content column, 180px top padding. Three elements only:
- Headline, 72px, tight -3% tracking, two lines max:
    "中国展会市场的"
    "结构化盘面"
- Sub-line, 18px #8A8A8F, single line, factual not aspirational:
    "7,401 个展会品牌 · 9,740 家主办方 · 十年届次数据。为杜塞尔多夫展览的
     业务拓展提供事实基础。"
- One primary button "进入系统" and one 15px text link "查看数据覆盖 →".
No background imagery, no glow, no illustration behind the text.

Then, directly beneath and breaking past the content column to 1320px wide:
A LARGE PRODUCT SURFACE — a realistic rendering of the actual application:
a dark dashboard with a 200px left sidebar, a dense 11-column data table of
exhibition brands, and a small world map panel at the right. It sits on the
page with a 1px hairline border and a 12px radius, its bottom edge fading into
the page background. This is the Linear move: the product IS the hero image.
It must look like real software with real rows of Chinese exhibition names,
not a stylised mockup.

=== SECTION 3 — Data coverage band ===
A single full-width row, no heading above it, divided into 6 cells by vertical
hairlines, with a hairline above and below the whole band. Each cell: a 36px
tabular number, an 11px uppercase #56565B label beneath.
  7,401 展会品牌 | 9,740 主办方 | 7,703 历史届次 | 8,145 地理标签
  | 495 企业档案 | 12,302 人工核验
Beneath the band, one 13px #56565B line, left aligned:
  "数据来源全程可溯 · 每月两次增量更新"
Nothing else. This section is 4 lines tall total.

=== SECTION 4 — What the data can show (THE MAIN SECTION) ===
An 11px uppercase orange overline "数据切面", then a 40px headline
"同一份数据，六种读法", then nothing else before the content.

A 3×2 grid of six panels. Each panel: #141416 surface, 1px hairline, 12px
radius, 28px padding, 280px tall. Each contains a 15px title, a 12px #8A8A8F
one-line description, and then A REAL DATA VISUAL rendered in Hex's style —
muted grays with one orange series, no gridlines, no legends inside the chart,
direct value labels only on the extremes.

  1. 地理分布 — 全球 8,145 个展会地理标签
     A dark dot-matrix world map, cities as unfilled circles sized by area,
     a handful of orange nodes.
  2. 主办方集团结构 — 9,740 条主办方索引归并到集团
     A horizontal bar list: Informa / RX 励展 / Hyve / Messe Frankfurt /
     Koelnmesse / Messe Düsseldorf, bar length = brand count, one bar orange.
  3. 行业结构 — 8 个一级品类的规模构成
     A single horizontal stacked bar with 8 muted segments and value labels
     beneath, not a pie chart.
  4. 规模排名 — 按展览面积排序的品牌榜
     A compact 6-row table: 品牌名 / 城市 / 面积㎡ / 展商数, right-aligned
     tabular numbers, 32px row height, hairline dividers.
  5. 档期分布 — 全年展会档期密度
     A 12-column bar chart by month, one month highlighted orange.
  6. 白地信号 — 2,061 个停办品牌 = 需求存在过的赛道
     A two-tone horizontal bar (在办 vs 停办) plus 3 example rows in 12px
     text beneath.

=== SECTION 5 — Business lines ===
Overline "应用", headline "三条业务线".
Three columns separated ONLY by vertical hairlines — no cards, no fill, no
borders, no rounded boxes. Each column: a 44px muted index "01"/"02"/"03" in
#2A2A2E, a 20px title, a 15px #8A8A8F description of at most two lines, then
three one-line items at 13px with a 10px orange tick.
  01 并购标的 — 为杜塞已有品牌寻找中国延展的收购与合作标的
     · 主办方企业穿透  · 规模与估值锚定  · 深度尽调报告
  02 全新品类 — 杜塞全球没有、中国市场应该有的空白赛道
     · 停办信号识别    · 现有玩家盘点    · 可行性评估
  03 项目组支持 — 为各项目组提供数据工具与合作方对接
     · 展商线索挖掘    · 合作方撮合      · 定制数据工具
Keep this section short. It is the shortest section on the page.

=== SECTION 6 — Footer ===
A top hairline, then 64px of padding. Two columns.
LEFT: the brand lockup, beneath it two 12px #56565B lines:
  "Messe Düsseldorf Shanghai · Business Development"
  "© 2026 杜塞尔多夫展览（上海）有限公司 · 内部系统"
RIGHT, right aligned: a 13px "进入系统 →" link and beneath it a 12px #56565B
line "访问需内部账号".
Nothing else. No developer credit, no social icons, no newsletter, no sitemap.

=== HARD BANS ===
- No stock photography, no 3D renders, no illustrated people, no emoji.
- No card grid with drop shadows anywhere on the page.
- No timeline, no roadmap, no "our story", no team or founder block.
- No technology stack section.
- No testimonial, no logo wall, no pricing.
- Maximum 3 font sizes per section.
- Every number uses tabular figures.
```

##### Prompt F —— 登录界面 `/login`

> **背景**：现有登录页是 Matrix 数字雨 + "The Matrix has you" 打字机 + 日文半角假名，
> 本次全部删除。三语切换与「← 回到官网」是已有功能，必须保留。
> 文案口吻与 Prompt E v2 对齐：陈述事实，不用标语。

```
Design the SIGN-IN screen for "MWLAB 万象", the internal business-development
intelligence platform of Messe Düsseldorf Shanghai. Desktop web, 1440px.
Use the identical dark system: page #0A0A0B, surfaces #141416, hairlines
rgba(255,255,255,.07), text #FAFAFA / #8A8A8F / #56565B, single accent #FE5C00,
flat surfaces, geometric grotesque latin with tabular figures, CJK one weight
lighter than latin, strict 8px grid.

SPLIT LAYOUT, 58 / 42, full viewport height, a single 1px vertical hairline
between the two panes. No imagery, no photography, no animated background.

=== LEFT PANE (58%) — brand and proof, #0A0A0B ===
Top-left, 48px inset: the brand lockup — latin "MWLAB" FIRST in a heavy
geometric grotesque, a thin vertical hairline, then "万象" SECOND in a CJK
sans one weight lighter and slightly smaller. Latin leads, Chinese follows.
Vertically centered block:
- 11px uppercase #56565B overline, letter-spaced:
    "MESSE DÜSSELDORF SHANGHAI · BUSINESS DEVELOPMENT"
- 44px headline over two lines, tight tracking (same wording as the landing
  page — no slogans, no marketing voice):
    "中国展会市场的"
    "结构化盘面"   ← set this line in #FE5C00
- 15px #8A8A8F sub-line, factual: "7,401 个展会品牌 · 9,740 家主办方"
- Then a compact 2×2 statistics block, cells divided by hairlines, each with a
  28px tabular number and an 11px uppercase label:
    7,401 展会品牌   9,740 主办方索引
    7,703 历史届次   2,061 白地信号
Bottom-left, 48px inset, 11px #56565B on two lines:
    "内部工具 · 不对外发布"
    "© 2026 杜塞尔多夫展览（上海）有限公司"
Add one very subtle piece of instrumentation behind the content: a fine dot
matrix at about 3% white opacity, no motion, no glow. It must be almost
invisible — atmosphere, not decoration.

=== RIGHT PANE (42%) — the form, #0E0E10 ===
Top-right, 32px inset: a 3-way language segmented control 中文 | EN | DE,
28px tall, active segment filled #FE5C00, inactive text #8A8A8F.
Vertically centered form column, max width 360px, left aligned:
- 28px title "欢迎回来"
- 14px #8A8A8F sub "请使用内部账号登录"
- 32px gap
- Field 1: an 11px uppercase label "邮箱" in #8A8A8F, then a 44px input.
  Input styling: #141416 fill, 1px rgba(255,255,255,.09) border, 8px radius,
  14px text, 14px horizontal padding, placeholder #56565B "name@mds.cn".
- Field 2: label "密码", same input, with a small 16px show/hide eye affordance
  inset at the right edge.
- 8px beneath field 2, right aligned: a 12px #8A8A8F text link "忘记密码？"
- 24px gap, then a full-width 44px primary button "登 录", #FE5C00 fill,
  8px radius, 14px weight-600 text, with visible letter spacing between the
  two Chinese characters.
- Beneath the button, a 12px #56565B centered line: "账号由管理员统一分配"
Bottom-right, 32px inset: a 13px #8A8A8F text link "← 回到官网".

=== STATES — render all four as separate frames ===
1. DEFAULT — as described above.
2. FOCUSED — the email input has a 1px #FE5C00 border and a 2px #FE5C00 glow
   at 25% opacity. No other change.
3. ERROR — a 40px error bar sits directly above the form title: #1F1214 fill,
   1px rgba(254,92,0,.35) border, 8px radius, a 14px alert glyph in #FE5C00,
   and 13px text "邮箱或密码错误，请重试". The email input border also turns
   #FE5C00. Nothing shifts position — the layout reserves this space.
4. LOADING — the primary button keeps its width, its label is replaced by a
   16px spinning ring in #FFFFFF at 80% opacity, and both inputs drop to 50%
   opacity and become non-interactive.

=== RULES ===
- No Matrix rain, no falling characters, no typewriter effect, no terminal
  aesthetic, no scan lines, no neon glow.
- The left pane must be readable as a credential of seriousness, not a poster.
- Total interactive elements on screen: 7 or fewer.
```

---

#### §6 决策记录（2026-09-16 已定）

| # | 问题 | 结论 |
|---|---|---|
| 1 | 中文名 | ✅ **万象** —— MWLAB 万象 / 万象实验室 |
| 2 | `opportunity` 建模 | ✅ **单表 + type**，差异字段进 `detail_json` |
| 3 | 展会模块保留范围 | ✅ 留 **地图 + 行动日历 + 趋势四宫格 + 行业分布**；砍 横滚卡片 + 全量大表 |
| 4 | 协作模式 | ✅ **Max + 总经理，2 人** |
| 5 | `MW` 的实指 | ⏳ 未答，不阻塞（「万象」按意译处理，不做音译对应） |
| 6 | 历史调研报告是否入库 | ⏳ 待定，建议入库 |

##### 决策 1 落地：「万象」

- **语义**：森罗万象 / 包罗万象 / 万象更新 / 气象万千。
- **与新主线的张力（必须正视）**：「万象」字面是「包罗万物」，更贴旧的展会目录；
  而新主线是「从万象中挑出少数几个高价值机会」。
  **化解叙事**：*观万象而取一象* —— 7,401 个展会是「万象」，M&A 标的与白地品类是从中取的「一象」。
  这个叙事在产品上是成立的，`/expo` 展会底图正是「万象」层，`/opportunity` 机会台是「取象」层。
- **商标风险**：「万象」被用得多（华润万象城、万象天地等）。作为内部系统名无碍，
  但**不要用于对外商标注册**。
- **字形工程问题**：万 3 画 vs 象 11 画，密度严重失衡。三个解法：
  1. 两字同字面框对齐，「万」加粗补偿重量（推荐）
  2. 竖排「万 / 象」与 MWLAB 横向锁定
  3. **完整字标用「MWLAB 万象」（英文在前），favicon / 收起态图标只用「象」**（已写进全部 Stitch prompt）

##### 决策 4 落地：2 人协作的工程含义

- ✅ 保留 `opportunity.owner` 字段与「按负责人筛选」
- ❌ **不做行级权限隔离**，沿用现有 `user.role` 的 admin/user 二元角色
- ❌ 不做分配/转派工作流、不做通知
- 假设：总经理是看全部 + 评论的角色，不是各自持有私有数据。**若这个假设不对请纠正**，
  它决定 §4.4 要不要做行级过滤。

---

#### §7 工期与风险

| 阶段 | 工期 | 风险 |
|---|---|---|
| 0 冻结清场 | 0.5 天 | 低 |
| 1 信息架构 | 1 天 | **中 —— 定不准会导致阶段 2/5 全部返工** |
| 2 视觉设计 | 2–3 天（含 Max 跑工具的往返） | 中 —— Stitch 出不了密度，预期要摆正 |
| 3 数据层 | 2 天 | **高 —— 迁移丢数据，必须逐字段校验** |
| 4 后端 API | 1.5 天 | 低 |
| 5 前端落地 | 3–4 天 | 中 |
| 6 内容填充 | Max 节奏 | — |
| **合计** | **约 10–12 个工作日** | |

**三个真实风险**：
1. **阶段 1 定不准** → 唯一解法是阶段 1.3 让 Max 逐页过字段，别跳过
2. **阶段 3 丢数据** → 必须逐字段比对，行数相等不作数
3. **Stitch/Claude Design 往返失控** → 限定 2 轮，第 2 轮后无论如何抽 token 进入阶段 3

---

## V2-00 · 信息架构定稿

<!-- 原文件：docs/IA-2026-09.md -->

### 信息架构定稿 · MWLAB 万象

**日期**：2026-09-16 · **阶段 1**（重构方案 §3）
**上游**：`docs/REBUILD-2026-09-PLAN.md` · `docs/CONTENT-CONTRACT.md` · `docs/I18N-SPEC.md`
**用法**：**Max 逐页过 §4，砍掉不需要的字段。** 砍完才进阶段 3 数据层。

---

#### §0 摘要

| 动作 | 对象 |
|---|---|
| **新建 2 张表** | `opportunity` · `opportunity_event` |
| **扶正 2 张表** | `customer_prospect` → `company`；`intel_report` 补字段 |
| **降级 1 组表** | `exhibition_*` 保留不动，改为被引用的字典 |
| **删除 5 张空表** | `person` · `exhibition_contact` · `contact_relation` · `exhibition_relation` · `exhibition_timeline` |
| 迁移编号 | `schema/migrations/014_rebuild.sql`（当前 `schema_version = 13`） |

---

#### §1 新建表

##### 1.1 `opportunity` —— 机会台主表

**100% 人工录入**。三条业务线共用一张表，靠 `type` 区分。

```sql
CREATE TABLE opportunity (
  opp_id          INTEGER PRIMARY KEY,
  type            TEXT NOT NULL,          -- ma | greenfield | project_support
  title           TEXT NOT NULL,
  title_en        TEXT,                   -- 见 §5 决策 1
  stage           TEXT NOT NULL,          -- contact|intent|dd|audit|closing
  deal_type       TEXT,                   -- 见下「两个 type 不是一回事」
  company_id      INTEGER REFERENCES company(company_id),
  brand_id        TEXT    REFERENCES exhibition_brand(brand_id),
  md_brand        TEXT,                   -- 对标的 MD 品牌，如 interpack / drupa
  priority        INTEGER,                -- 1–5
  owner           TEXT,                   -- user.email
  next_action     TEXT,
  next_action_due TEXT,                   -- ISO date
  detail_json     TEXT NOT NULL DEFAULT '{}',
  is_archived     INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_opp_type_stage ON opportunity(type, stage);
CREATE INDEX idx_opp_owner      ON opportunity(owner);
CREATE INDEX idx_opp_due        ON opportunity(next_action_due);
```

###### ⚠️ 两个 type 不是一回事（我从精修稿里读出来的）

设计稿的 tab 是「并购标的 / 全新品类 / 项目组支持」，
而表格里的**类型列**却是「收购 / 并购 / 参股 / 承办 / 孵化」。这是两个维度：

| 字段 | 含义 | 取值 | 谁用 |
|---|---|---|---|
| `type` | **业务线** | `ma` / `greenfield` / `project_support` | 顶部 tab |
| `deal_type` | **交易形式** | 收购 / 并购 / 参股 / 承办 / 孵化 | 表格「类型」列，**只对 `type=ma` 有意义** |

如果合成一个字段，白地和项目组就没法用「参股/承办」这些词。**建议保留两个。**

###### `detail_json` 按 type 存什么

| type | 键 |
|---|---|
| `ma` | `valuation_range` 对价区间 · `equity_pct` 股权比例 · `baseline_date` 评估基准日 · `ebitda` · `audit_confidence` |
| `greenfield` | `market_size` 市场规模判断 · `existing_players` 现有玩家 · `dead_brand_ids` 停办信号来源 · `feasibility` |
| `project_support` | `requester` 需求方项目组 · `deliverable` 交付物类型 · `partner_company_ids` |

> **`detail_json` 里的字段无法 SQL 排序聚合。**
> 若「对价区间」要跨标的排序，就把它提升为正式列 —— 见 §5 决策 2。

##### 1.2 `opportunity_event` —— 时间线 + 附件（合二为一）

```sql
CREATE TABLE opportunity_event (
  event_id    INTEGER PRIMARY KEY,
  opp_id      INTEGER NOT NULL REFERENCES opportunity(opp_id),
  event_type  TEXT NOT NULL,   -- note|stage_change|file|meeting|task_done
  content     TEXT,
  file_path   TEXT,            -- event_type='file' 时用
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_oppev ON opportunity_event(opp_id, created_at DESC);
```

**为什么不能省**：机会详情的「时间线」tab 展示的是你写的纪要
（团队访谈纪要 / 西部展馆排期确认），不是字段变更，`manual_tag_history` 装不下。

**为什么附件不单独建表**：上传文件本身就是时间线上的一个事件
（「顾言风 上传了尽调底稿」）。合并后少一张表，且时间线天然完整。

---

#### §2 扶正表

##### 2.1 `customer_prospect` → `company`

495 行全部保留。`source_type` 现在全是 `qcc_search`，`contact_status` 全空。

| 现有列 | 处置 |
|---|---|
| `id` → `company_id` | 改名 |
| `company_name` → `name` | 改名 |
| `qcc_key_no` `credit_code` `oper_name` `start_date` `company_status` `reg_no` `address` `email` | 保留（企查查字段） |
| `brand_id` | 保留，指向展会品牌 |
| `prospect_score` `contact_status` `notes` | 保留（BD 字段） |
| `exhibitor_name` `name_confidence` | 保留（展商匹配链路产物） |
| `source_type` | 保留，扩充取值：`qcc_search` / `organizer` / `manual` |
| **`intel_report_id`** | **保留**（见下方勘误） |

> **勘误 2026-09-16**：本文初稿判断 `intel_report_id`「方向反了」应删除，**这是错的**。
> 实测 495 行里 494 行有值，指向 `report_type='batch_prospect'` 的报告 3
> （博华游艇展 CIBS2026）—— 一份批量线索报告挖出 494 家公司，是**一对多**关系，
> `intel_report.company_id` 存不下。014 已误删，**015 恢复并从备份逐格回填**。
>
> 两个方向是两种关系，都要留：
> `company.intel_report_id` = 这家公司从哪份批量报告挖出来的（多对一）
> `intel_report.company_id` = 这份深度尽调报告写的是哪家公司（一对一）

**新增列**：

```sql
name_en    TEXT,   -- 见 §5 决策 1
type       TEXT,   -- organizer|exhibitor|service|target|partner
city       TEXT,
country    TEXT
```

> 2 条 `company_name` 重复，迁移时按 `credit_code` 去重，无信用代码的保留并标记。

##### 2.2 `intel_report` 补字段

现有 `report_type` / `brand_id` / `industry_l1` / `industry_l2` / `target_company` /
`params_json` / `report_md` / `report_file` / `status` / `created_by` 全部保留。

```sql
ALTER TABLE intel_report ADD COLUMN opp_id     INTEGER REFERENCES opportunity(opp_id);
ALTER TABLE intel_report ADD COLUMN company_id INTEGER REFERENCES company(company_id);
ALTER TABLE intel_report ADD COLUMN title      TEXT;   -- 现在没有标题列，调研库列表无法展示
```

`target_company` 是自由文本，保留但**新数据一律写 `company_id`**。
`reports/*.docx` 的历史报告按 §5 决策 3 决定是否回填。

##### 2.3 展会表降级

`exhibition_brand` / `exhibition_edition` / `brand_organizer` / `brand_geo_tag`
**结构不动、数据不动**，只改角色：从「产品主体」变成「被 `opportunity` 和 `company` 引用的字典」。

唯一新增：

```sql
ALTER TABLE exhibition_brand ADD COLUMN company_id INTEGER REFERENCES company(company_id);
-- 主办方指向公司，由 brand_organizer 归并结果回填
```

---

#### §3 删除清单（需你逐项确认）

| 对象 | 行数 | 确认 |
|---|--:|---|
| 表 `person` | 0 | ☐ |
| 表 `exhibition_contact` | 0 | ☐ |
| 表 `contact_relation` | 0 | ☐ |
| 表 `exhibition_relation` | 0 | ☐ |
| 表 `exhibition_timeline` | 0 | ☐ |
| 页面 `app/people/*`（355 行） | 读空表 | ☐ |
| 路由 `app/api/people/**`（4 个） | 读空表 | ☐ |
| 路由 `app/api/exhibition/[id]/timeline/**`（2 个） | 读空表 | ☐ |
| 静态页 `public/dashboard.html`（1,801 行） | 被 `/expo` 取代 | ☐ |
| 静态页 `public/pitch.html`（1,141 行） | 被 `/` 取代 | ☐ |

---

#### §4 逐页字段清单 —— **请在这一节动刀**

> 判据：**这一屏要帮你做什么决策？** 答不上来的字段划掉。

##### 4.1 `/overview` 盘面

| 区块 | 字段 | 来源 | 砍 |
|---|---|---|---|
| KPI ×4 | 在跟进机会 / 并购标的 / 白地品类 / 本周待办 | `opportunity` 计数 | ☐ |
| 本周待办 | `next_action` · `next_action_due` · `owner` · `title` · `stage` | opportunity | ☐ |
| 最近调研 | `title` · `report_type` · `updated_at` · 摘要 3 行 | intel_report | ☐ |
| 阶段漏斗 | 5 阶段计数 + 均值驻留天数 + 转化率 | opportunity 聚合 | ☐ |

> ⚠️ **均值驻留天数和转化率算不出来** —— 需要 `opportunity_event` 里有 `stage_change`
> 事件才能计算停留时长。新系统上线后要跑一段时间才有数。**第一版建议只显示计数。**

##### 4.2 `/opportunity` 机会台

| 列 | 字段 | 砍 |
|---|---|---|
| 机会名称 | `title` | ☐ |
| 类型 | `deal_type` | ☐ |
| 阶段 | `stage` | ☐ |
| 对标 MD 品牌 | `md_brand` | ☐ |
| 关联公司 | `company.name` | ☐ |
| 城市 | `company.city` 或 `exhibition_brand.city` | ☐ |
| 规模 ㎡ | `exhibition_edition.area_sqm` 最新届 | ☐ |
| 优先级 | `priority` | ☐ |
| 负责人 | `owner` | ☐ |
| 下一步 | `next_action` | ☐ |
| 更新时间 | `updated_at` | ☐ |

**必须补的界面**（精修稿里完全没有）：
录入抽屉 ☐ · 行内编辑「阶段/优先级/下一步」☐ · 空状态 ☐ · 骨架屏 ☐ · 筛选无结果 ☐

##### 4.3 `/opportunity/[id]` 机会详情

| tab | 字段 | 砍 |
|---|---|---|
| 概览 | 标题 / 类型 / 阶段 / 负责人 / 对价区间 / 评估基准日 / 下一步 | ☐ |
| 深度调研 | `intel_report.report_md` 渲染 + 上传 docx | ☐ |
| 时间线 | `opportunity_event` 倒序 | ☐ |
| 关联展会 | 品牌名 / 面积 / 展位 / 观众 / UFI / 区域排位 | ☐ |
| 右栏·公司 | 法定代表人 / 成立时间 / 注册资本 / 实缴 / 状态 | ☐ |
| 右栏·股权穿透 | 穿透层级 / 持股结构 | ☐ **企查查只买了 5 个接口，股权穿透类一律 214 —— 这块拿不到数据** |

##### 4.4 `/company` 公司库 与 `/company/[id]`

| 列 | 字段 | 砍 |
|---|---|---|
| 公司名 / 信用代码 / 法定代表人 / 成立时间 / 状态 / 城市 | company | ☐ |
| 类型 | `type` | ☐ |
| 关联机会数 | 聚合 | ☐ |
| 评分 | `prospect_score` | ☐ |

##### 4.5 `/expo` 展会底图

| 区块 | 砍 |
|---|---|
| 地图（`brand_geo_tag`） | ☐ |
| 我的行动日历（新数据，**需要一张日程表还是挂在 `opportunity_event` 上？见 §5 决策 4**） | ☐ |
| 趋势四宫格（观众/面积/展商/行业） | ☐ |
| 筛选器（行业/城市/规模/关系） | ☐ |

> ⚠️ 趋势四宫格必须**跟随当前筛选范围**，全库聚合没有决策价值（重构方案 §1.2 已记）。

---

#### §5 需你拍板的 4 个决策

| # | 问题 | 建议 |
|---|---|---|
| 1 | `opportunity.title_en` / `company.name_en` 加不加？ | **加**。英文版读者是德方总部，中文标题他们读不懂；`exhibition_brand.name_en` 已有 97.6% 覆盖可参照 |
| 2 | `detail_json` 里哪个字段要提升为正式列？ | 若「对价区间」需要跨标的排序 → 提升 `valuation_low` / `valuation_high` 两列；否则一个都不提 |
| 3 | `reports/*.docx` 历史报告回填进 `intel_report`？ | **回填**。否则调研库是空的，M&A 最重的资产搜不到 |
| 4 | 「我的行动日历」怎么存？ | **挂 `opportunity_event`**（`event_type='meeting'` + 日期），不单独建表。代价：与机会无关的行程存不了 |

---

#### §6 阶段 3 数据层的前置条件

1. §3 删除清单逐项确认
2. §4 每页砍完字段
3. §5 四个决策拍板
4. `git tag pre-rebuild-2026-09-16` + 全库备份

四条齐了才写 `014_rebuild.sql`。**迁移校验必须逐字段比对，行数相等不作数。**

---

## V2-04 · 后端 API 规格

<!-- 原文件：docs/API-SPEC-PHASE4.md -->

### 阶段 4 · 后端 API 规格

**日期**：2026-09-17
**参考实现**：`app/api/opportunity/route.ts` + `app/api/opportunity/[id]/route.ts`
**用法**：其余端点照参考实现套。**先读完参考实现的代码再动手。**

---

#### §0 一条核心原则：二阶式

> 本系统的核心是**存储报告与采集来的资源**，不是展示后台数据。
> 列表页只给最少的列，点详情才看全部。

| 阶 | 端点 | 返回 | 典型体积 |
|---|---|---|---|
| **一阶** | `GET /api/{res}` | 精简字段 + 分页 + 服务端筛选排序 | 每页 ≤ 50 条 × 5 字段 |
| **二阶** | `GET /api/{res}/{id}` | 全字段 + 关联对象 + 关联资源 | 单条 |

**反面教材**：现有 `/api/dashboard` 一次返回全部 5,332 条品牌，前端做纯客户端过滤。
新端点一律不许这样。分页与筛选必须在 SQL 里做。

---

#### §1 列表端点契约

##### 请求

```
GET /api/opportunity?type=ma&stage=dd&owner=x@y.cn&q=半导体&page=1&size=50&sort=updated_at&order=desc
```

| 参数 | 说明 |
|---|---|
| `page` | 从 1 起，默认 1 |
| `size` | 默认 50，**上限 200**（超过按 200 截断，不报错） |
| `sort` | **必须走列白名单**，不在白名单一律回退默认列 |
| `order` | `asc` / `desc`，非法值回退 `desc` |
| `q` | 模糊搜索，`LIKE '%q%'`，只查 1–2 个主字段 |
| 其余 | 每个资源自定义的筛选白名单 |

> ⚠️ `sort` 与 `order` **绝不能拼进 SQL 字符串**，必须先在白名单里查到映射再用。
> 其余参数一律走 `?` 占位符。

##### 响应

```json
{
  "items": [ { …精简字段… } ],
  "page": 1,
  "size": 50,
  "total": 137
}
```

`total` 是筛选后的总数（同一套 WHERE 再跑一次 `COUNT(*)`），不是全表数。

---

#### §2 详情端点契约

```json
{
  "opportunity": { …全字段，detail_json 已解析成对象… },
  "company":     { …关联公司，可为 null… },
  "brand":       { …关联展会品牌，可为 null… },
  "resources":   [ { resource_id, kind, title, file_path, size_bytes, collected_at } ],
  "events":      [ { event_id, event_type, content, occurred_at, created_by, created_at } ],
  "reports":     [ { id, title, report_type, status, updated_at } ]
}
```

**详情端点必须带 `resources`** —— 这是本系统的核心功能，所有详情页都要能看到并下载该对象的资源。
`company` / `research` 的详情端点同理。

---

#### §3 写操作

| 方法 | 端点 | 权限 |
|---|---|---|
| `POST` | `/api/{res}` | `requireWriter` |
| `PATCH` | `/api/{res}/{id}` | `requireWriter` |
| `DELETE` | `/api/{res}/{id}` | `requireWriter`，**软删除**（`is_archived=1`），不物理删 |

规则：

1. 写操作用 `getWritableDb()`，**必须 `try/finally` 里 `close()`**，
   否则 WAL 连接泄漏。读操作用 `getDb()`（单例只读，不要 close）。
2. `updated_at` 由服务端写，**不接受客户端传入**。
3. `PATCH` 只更新请求体里出现的字段，缺省字段不动（不要整行覆盖）。
4. 字段白名单：请求体里不在白名单的键**静默忽略**，不报错。
5. 枚举值在写库前校验一遍（DB 有 CHECK 约束兜底，但要给出可读的 400 而不是 500）。

---

#### §4 错误码

| 码 | 场景 | 响应体 |
|---|---|---|
| 400 | 参数/枚举非法 | `{ "error": "可读中文说明" }` |
| 401 | 未认证或账号被禁用 | `{ "error": "unauthorized" }` |
| 403 | readonly 角色写操作 | `{ "error": "forbidden" }` |
| 404 | 资源不存在 | `{ "error": "not found" }` |
| 409 | 唯一约束冲突 | `{ "error": "可读中文说明" }` |

---

#### §5 待实现端点

| 端点 | 一阶字段 | 筛选白名单 | 谁做 |
|---|---|---|---|
| `/api/opportunity` ✅ | title, type, stage, owner, updated_at | type, stage, owner, priority, q | **参考实现（已完成）** |
| `/api/company` | name, type, company_status, city, updated_at | type, company_status, source_type, q | DeepSeek |
| `/api/research` | title, report_type, status, target_company, updated_at | report_type, status, q | DeepSeek |
| `/api/resource` | kind, title, size_bytes, collected_at | kind, company_id, opp_id, source, q | DeepSeek |
| `/api/resource/[id]/download` | — 返回文件流 | — | **我做**（路径穿越防护） |
| `/api/overview` | 聚合，无列表 | — | **我做** |
| `/api/dashboard` 瘦身 | 改为分页 | — | DeepSeek |

---

#### §6 验收

```bash
# 分页与总数
curl -b "session=$T" '/api/opportunity?size=2' | jq '{n:(.items|length), total, page, size}'

# 筛选生效（total 应随之变化）
curl -b "session=$T" '/api/opportunity?type=ma' | jq .total

# sort 注入防护：非法列名不应报错，应回退默认排序
curl -b "session=$T" '/api/opportunity?sort=1;DROP+TABLE+opportunity' | jq .total

# 详情带 resources
curl -b "session=$T" '/api/opportunity/1' | jq 'keys'

# readonly 写操作应 403
curl -b "session=$T_READONLY" -X POST '/api/opportunity' -d '{}' | jq .
```
