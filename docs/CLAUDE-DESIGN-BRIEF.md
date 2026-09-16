# Claude Design 深度设计 Brief · MWLAB 万象

**日期**：2026-09-16
**输入**：`design/stitch/` — Stitch 交付 9 屏（6 个界面 + 登录 4 态）
**上游**：`docs/REBUILD-2026-09-PLAN.md`（§1 信息架构 · §2 品牌 · §5 Stitch prompt）
**任务**：结构保留，**设计语言与状态系统整体重做**

---

## §0 给 Claude Design 的一句话

> Stitch 把**骨架**搭对了，把**设计语言**做错了。
> 不要重新布局，不要重排信息架构 —— 那部分已经过审。
> 你要做的是：**清污染、定字体、立纪律、补状态**。

---

## §1 保留（已过审，不得改动）

| 项 | 说明 |
|---|---|
| 9 屏的**页面结构与信息层级** | 侧栏 / tab / 筛选条 / 表格 / 面板网格的骨架全部保留 |
| `/` 落地页的 6 段结构 | Nav → Hero+产品图 → 数字带 → 六块数据切面 → 三条业务线 → Footer |
| 机会台的 11 列字段 | 机会名称 / 类型 / 阶段 / 对标MD品牌 / 关联公司 / 城市 / 规模 / 优先级 / 负责人 / 下一步 / 更新时间 |
| 登录页 58/42 分栏 | 含已交付的 4 个状态帧 |
| 基础色阶 | `#0A0A0B` / `#0E0E10` / `#141416` / 发丝线 `rgba(255,255,255,.07)` |

---

## §2 必修问题清单（按严重度）

### 🔴 P0-1 · 品牌锁定语序不一致

| 屏 | 现状 |
|---|---|
| `public_landing`、4 个 `sign_in` | `MWLAB │ 万象` ✅ 正确 |
| `m_a_pipeline`、`overview`、`opportunity_detail`、`exhibition_basemap` | `万象 │ MWLAB` ❌ **反了** |

**规则（不可协商）**：拉丁在前、重一档字重、紧字距；中文在后、轻一档字重、略小一号视觉尺寸；中间一根发丝竖线。图标态取单字「象」。
兄弟项目同构：`WHENJIN │ 问津`，图标态「津」。

### 🔴 P0-2 · 四个应用屏完全没有中文字体

实测（grep `Noto Sans SC` / `PingFang` / `Source Han`）：

```
public_landing        ✅ 2 处
sign_in × 4           ✅ 各 2 处
m_a_pipeline          ❌ 0
overview              ❌ 0
opportunity_detail    ❌ 0
exhibition_basemap    ❌ 0
```

这四屏的中文全部走系统回退 —— **正是本次重构要根治的原项目头号病灶，原样复发**。
截图里表格中文与拉丁（Electronica / CMEF / Hannover）字重、字面、基线全部对不齐，就是这个原因。

### 🔴 P0-3 · 等宽字体栈是坏的，所有"等宽数字"都是假的

```css
/* Stitch 输出 —— Geist 在前，JetBrains Mono 永远不会被命中 */
font-family: 'Geist', 'JetBrains Mono', monospace;
```

DESIGN.md 声称 `data-tabular` / `label-code` 用 JetBrains Mono，**实际全部由 Geist 渲染**。
表格数字列的对齐是靠 `text-right` 硬撑的，不是真的等宽。

**正确写法**：
```css
font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
font-variant-numeric: tabular-nums;
```

### 🔴 P0-4 · Material 3 色板污染整个 token 层

`DESIGN.md` 前 50 行是 Stitch 自动注入的 M3 tonal palette，与我们的系统冲突：

| Token | 值 | 问题 |
|---|---|---|
| `primary` | `#ffb599` | **粉橙色，不是品牌色**。任何用 `primary` 的组件会渲染成浅粉橙 |
| `primary-container` | `#fe5c00` | 品牌色被降级藏在这里 |
| `outline` | `#ab897d` | 棕粉色描边 |
| `on-surface-variant` | `#e4beb1` | 粉棕文字 |
| `tertiary` | `#a0caff` | 天蓝色，系统里根本不存在的第三色 |
| `surface-tint` | `#ffb599` | 粉橙叠加层 |

**处置**：整段删除。只保留这 12 个 token：

```
bg-canvas #0A0A0B   bg-sidebar #0E0E10   bg-surface #141416
bg-surface-elevated #1A1A1E              bg-surface-hover #1F1F24
border-hairline rgba(255,255,255,.07)    border-active rgba(255,255,255,.14)
text-primary #F5F5F7   text-secondary #8A8A93   text-tertiary #52525A
accent #FE5C00   accent-hover #FF7324
```

> 落地时目标是 Tailwind **v4** 的 `@theme`，不是 Stitch 输出的 v3 `tailwind.config`。

### 🟠 P1-5 · Accent 纪律完全失守

约束是「每屏最多 3 次橙色」。机会台实际：

侧栏 active + 「录入机会」按钮 + 实时同步点 + **阶段进度条 ×24 行** + **优先级方块 ×24 行**
≈ **200+ 处橙色**，满屏橙点。

更糟的是**阶段**和**优先级**两列用了同一种视觉语言（一串小方块），读者分不清哪列是哪列。

**修法**：
- 阶段列 → 中性灰进度指示 + 文字（`3/5 意向`），不用橙色
- 优先级列 → 一个数字或一根 3px 短条，不要 5 个方块
- 橙色只留给：侧栏 active、唯一主 CTA、当前选中行的 2px 左边框

### 🟠 P1-6 · 状态系统几乎不存在（你点名的问题）

登录页 4 态是唯一做对的。四个应用屏**只有默认态**。

必须补齐的状态矩阵：

| 组件 | 需要的状态 |
|---|---|
| 表格行 | default / hover / **selected** / 多选 checkbox / 键盘焦点 / 当前行 |
| 表格整体 | 加载 skeleton / **空状态** / 加载失败 / 排序进行中 / 筛选无结果 |
| 按钮 | default / hover / active / **disabled** / **loading** |
| 输入框 | default / **focus-visible** / filled / error / disabled |
| 侧栏项 | default / hover / active / **收起态（64px）** |
| 数据面板 | 有数据 / 加载中 / 无数据 / 加载失败 |
| Tab | default / hover / active / 带计数徽标 |
| 筛选 pill | default / hover / **已选中** / 可清除 |

**交付要求**：每个组件的全部状态画在同一张对照板上，不要散在各屏里。

### 🟠 P1-7 · 表格行高不齐，扫描节奏被破坏

「独家商业承办」6 个字在类型列换行，那几行行高从 32px 撑到 48px。
**修法**：类型列固定宽度 + 单行截断，或改用 2–3 字表述（承办 / 收购 / 参股 / 孵化）。

### 🟠 P1-8 · 右侧内容被裁切

- 机会台：「下一步」列切出画面
- 落地页：产品截图的地图面板、「行业结构」「白地信号」两块面板都被裁

11 列在 1440px 放不下。需要定**列优先级** + 冻结首列 + 横向滚动，而不是让它无声截断。

### 🟡 P2-9 · 幻觉内容必须连根清除

Stitch 自己发明的"金融终端"元素，业务上完全不存在：

```
基准汇率 USD/CNY 7.2405          标的底稿加密级别 CONFIDENTIAL-L2
更新引擎 MW-FEED v4.19           数据哈希 7f89b4..d901
延迟 18ms                        实时同步 99.8%
```

根源在 `DESIGN.md` 的 Layout 段：它虚构了「ultrawide / dual-monitor financial setups」
和「Entity Master Tree 可调整分区 280–340px」—— 这些我们的 prompt 里没有，是 Stitch 的幻想。
**连同 DESIGN.md 里这两段一起删。**

我们不是彭博终端，是一家展会公司的内部 BD 工作台。

### 🟡 P2-10 · 落地页节奏过松

160px 的 section 间距被放大，数字带与下一节之间大片空白，与「简洁 + 密度」的目标相矛盾。
收到 **120px**，且 Hero 产品截图与数字带之间不留空隙（产品图底边直接接数字带上边框）。

### 🟡 P2-11 · Hero 中文标题字重过重、第二行没上橙色

prompt 要求第二行「结构化盘面」用 `#FE5C00`，Stitch 做成了全白。
中文标题字重也压过了拉丁，违反「CJK 轻一档」的规则。

---

## §3 字阶重定（现有的不够用）

Stitch 的字阶最大只到 **24px**，而落地页 Hero 需要 **72px** —— 字阶不覆盖营销域。
而 `body-md 13px` 与 `body-sm 12px` 只差 1px，是无意义的层级。

**要求产出一套 8 级字阶，同时覆盖应用域与营销域**，并明确每一级的：
拉丁字号 / 中文字号（比拉丁小 1px）/ 拉丁字重 / 中文字重（低一档）/ 行高（中文比拉丁高）/ 字距（**中文一律 0，不用负字距**）。

---

## §4 中文排版规则（本次最重要的交付物）

这是原项目最大的病灶，Stitch 没有解决，**必须由你定死**：

1. **中文字重永远比拉丁低一档**（Geist 600 ↔ Noto Sans SC 500）
2. **中文永不使用负字距**。Stitch 给 CJK 也套了 `-0.02em`，中文会挤在一起
3. **中文行高高于拉丁**（拉丁 1.4 ↔ 中文 1.6；长文中文 1.8）
4. **中英混排时中文字号比拉丁小 1px**，补偿字面率差异
5. **数字永远走拉丁等宽字体**，绝不落到 CJK 字体里
6. **中文标题不用 800 字重** —— 系统字体会触发伪粗体，边缘发毛
7. 中英之间插入 0.25em 间隙（由样式控制，不靠手打空格）

---

## §5 交付要求

| # | 产出 | 说明 |
|---|---|---|
| 1 | **组件状态对照板** | §2 P1-6 的全部状态，画在一张板上 |
| 2 | **Token 表** | 12 个颜色 + 8 级字阶 + 圆角 + 间距，清掉 M3 污染，Tailwind v4 `@theme` 口径 |
| 3 | **中文排版规范** | §4 的 7 条落成具体数值 |
| 4 | 6 屏精修稿 | 结构不动，应用新语言 |
| 5 | 表格列优先级方案 | 1440 / 1680 / 1920 三档下各显示哪些列 |

**不要做**：重新布局、改信息架构、加新页面、引入第二个强调色、加插画或图标装饰。
