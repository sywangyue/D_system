# MWLAB 万象 · 设计规范

**本文件是现行规范，不是任务书。** 色值与尺寸一律**以 `app/globals.css` 为准**，
本文抄录的是 2026-09-18 的实际值，改了 CSS 就回来同步。

2026-09-17 由四份文档合并而成；2026-09-18 清理：上一轮给 Claude Design 的任务书
（问题清单、交付要求、字阶改造要求）已执行完毕，连同作废的暗色色板一并删除，
只保留仍然有效的规范。原文在 `archive/`。

## 目录

1. Design Token —— 当前实际值
2. 中文排版纪律
3. 品牌与 Logo
4. 英文版规范（i18n）
5. 内容契约 —— 每个文本位的来源
6. **落地页改版规格（V2-18）** —— 喂给 Stitch 的就是这一节 + 第 1、2 节

---

## 1. Design Token —— 当前实际值

给 Stitch / Claude Design 的输入就是这张表。**设计稿只能用这里的值**，
需要新值时先在这里加、说明为什么现有的不够，再落到 `globals.css`。

> 「Design Token」在本项目早期文档里被译作「令牌」，与 JWT 令牌撞词，统一改用 Design Token。

### 1.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| `--color-canvas` | `#ffffff` | 页面底 |
| `--color-sidebar` | `#f2f2f2` | 侧栏 · 输入框底 · 表头 |
| `--color-surface` | `#fafafa` | 面板 · 卡片 · 抽屉 |
| `--color-surface-elevated` | `#ffffff` | 浮层 · 下拉 · 选中态 · 徽标 |
| `--color-surface-hover` | `#e6e6e6` | 卡片上的 hover / 选中 |
| `--color-hairline` | `#00000014` | 发丝线（8%） |
| `--color-hairline-active` | `#00000036` | 发丝线 hover（21%） |
| `--color-fg` | `#171717` | 标题 · 主数据 |
| `--color-fg-muted` | `#4d4d4d` | 正文 · 表格单元 · 导航项 |
| `--color-fg-subtle` | `#8f8f8f` | 表头 · 标签 · 提示 |
| `--color-fg-faint` | `#a8a8a8` | 最弱的元信息，慎用 |
| `--color-accent` | `#171717` | 主按钮底 |
| `--color-accent-fg` | `#ffffff` | 主按钮字 |
| `--color-accent-hover` | `#000000` | 主按钮 hover |
| `--color-error-bg / -border / -text` | `hsl(0 100% 97%)` / `hsl(0 90% 92%)` / `hsl(358 66% 48%)` | 错误态三件套 |

**品牌橙 `--color-brand` `#fe5c00` 只进「门面」**（2026-09-18 起）：
Logo、登录页、落地页可用；**产品界面内部一律不许** —— 盘面 / 机会台 / 公司库 /
调研库 / 知识库 / 展会底图里的强调色一律走 `--color-accent`（黑白高对比）。

分界的理由：登录页是「门」，用品牌色立身份；产品界面是每天盯 8 小时的工作台，
高饱和色会让密集数据变得难读。即使在登录页，橙也只给背景几何体与 Logo，
主按钮保持黑白 —— 页面上唯一的主操作不跟背景抢注意力。

### 1.2 字阶

拉丁与中文分两套，**中文比拉丁小一档**（见第 2 节第 4 条）。

| 级别 | 拉丁 | 中文 | 用途 |
|---|---|---|---|
| micro | `--text-micro` 11px | `--text-micro-cjk` 11px | 标签 · 表头 |
| ui | `--text-ui` 13px | `--text-ui-cjk` 12px | 表格 · 控件 |
| body | `--text-body` 15px | `--text-body-cjk` 14px | 正文 |
| subhead | `--text-subhead` 18px | `--text-subhead-cjk` 17px | 小标题 |
| heading | `--text-heading` 24px | `--text-heading-cjk` 23px | 区块标题 |
| title | `--text-title` 28px | `--text-title-cjk` 27px | 页标题 |
| hero | `--text-hero` 44px | `--text-hero-cjk` 42px | 登录页主标 |
| display | `--text-display` 72px | `--text-display-cjk` 68px | 落地页主标 |

### 1.3 圆角

`--radius-badge` 2px · `--radius-control` 4px · `--radius-panel` 6px · `--radius-card` 8px

### 1.4 字体

| Token | 栈 |
|---|---|
| `--font-sans` | Geist → system-ui |
| `--font-mono` | JetBrains Mono → ui-monospace（**所有数字走这个**） |
| `--font-cjk` | PingFang SC → HarmonyOS Sans SC → 微软雅黑 |
| `--font-logo-cn` | 衬线，只用于 Logo 里的「万象」二字 |

Logo 的几何尺寸另有 `--logo-*` 共 20 个 Token，三档尺寸（默认 / dense / display），
改动规则见第 3 节 —— **改了要重跑 `tools/build_logo_svg.py`**，否则静态资产与实渲染对不上。

### 1.5 实时导出

上表是抄录，权威在代码。开新一轮设计前重新导一次：

```bash
awk '/^[[:space:]]*--/ {gsub(/^[[:space:]]+/,""); print}' app/globals.css | sort -u
```

---

## 2. 中文排版纪律

**这一节是长期纪律，不随设计轮次变化。** 原项目最大的病灶就在这里。

1. **中文字重永远比拉丁低一档**（Geist 600 ↔ Noto Sans SC 500）
2. **中文永不使用负字距**。Stitch 给 CJK 也套了 `-0.02em`，中文会挤在一起
3. **中文行高高于拉丁**（拉丁 1.4 ↔ 中文 1.6；长文中文 1.8）
4. **中英混排时中文字号比拉丁小 1px**，补偿字面率差异
5. **数字永远走拉丁等宽字体**，绝不落到 CJK 字体里
6. **中文标题不用 800 字重** —— 系统字体会触发伪粗体，边缘发毛
7. 中英之间插入 0.25em 间隙（由样式控制，不靠手打空格）

---

## 3. 品牌与 Logo

### MWLAB 万象 · 品牌与 Logo 规范

**日期**：2026-09-17
**适用范围**：MWLAB 万象（暗场、工具）与兄弟品牌 问津 Whenjin（浅场、媒体）
**Token 落点**：`app/globals.css` 的 `@theme`（`--color-brand-*` / `--logo-*` / `--font-logo-cn`）
**资产**：`public/brand/logo/*.svg`、`public/favicon.svg`、`public/favicon.ico`、`public/favicon-192.png`
**生成器**：`tools/build_logo_svg.py`（改任何几何都要重跑它，否则资产与实渲染会对不上）

---

#### §1 两个品牌的关系

一套体系下的两个产品，**共用一条规矩：色块 + 白色标记**。

| | 问津 Whenjin | MWLAB 万象 |
|---|---|---|
| 产品性格 | 从展览行业出发分析某个行业的问题 —— 犀利、提问 | 深挖哪些能被我所用、白地/目标地在哪里 —— 盘面、工具 |
| 场 | **浅场**：白底、墨字、衬线 | **浅场**：白底、无衬线拉丁（看板 2026-09-17 由暗转浅） |
| 色块 | 红 `#c2261c` 方块 + 白色几何 **W** | 橙 `#fe5c00` 色板 + 白色 **MWLAB** 字面 |
| 中文 | 「问津」Noto Serif SC 700 | 「万象」**同一款字**，同一字距 |
| 图标态 | 红方 + 白 W | 橙方 + 白 几何 **M**（问津 W 的垂直镜像） |
| 主色用途 | 报头、栏目标签、订阅按钮 | 品牌板；主 CTA 走黑白高对比，不用橙 |

> **2026-09-17 变更**：看板整体反置为浅色（参 Vercel Geist 的黑白界面）。
> 原先「两个品牌一暗一浅」的区分因此不再成立 —— 两个品牌现在都落在浅场上，
> 区分改由**色相**（红 / 橙）、**标记形态**（方标 + 几何字母 / 色板 + 字标）、
> **拉丁字体**（衬线 / 无衬线）三件事承担。中文仍是同一款衬线，这条没动。
> 影响：应用内一律用 `mwlab-lockup-light.svg` 那一套取值
> （竖线 `#E2E2E0`、中文 `#111111`），`dark` 版只留给深色 PPT 与社交图。

**唯一的视觉联结是两个品牌的中文字标必须是同一款字。** 这一条不可动 ——
它在两个产品气质差别很大的情况下，仍然让人一眼看出是同一家。

> 与 The Economist 的区别要保留：不问津把文字字标塞进红色长方形里
> （那条规矩写在 whenjin `docs/DESIGN-BRIEF.md` §4）。万象反其道 ——
> 英文恰恰以橙底白字出场，这是两个品牌刻意拉开的第一处差别。

---

#### §2 Logo 构成（标准态）

```
┌───────────────┐
│   MWLAB       │  │  万象
└───────────────┘
   ↑ 橙板 92×33      ↑ 发丝竖线      ↑ Noto Serif SC 700
   Geist 600 白色 20px  1×15 白 18%     17px / 0.06em 字距
```

从左到右三段，**顺序永不调换**：橙板（拉丁）→ 发丝竖线 → 中文。

##### 三档几何（全部数值，单位 px）

| 项 | 密集态 | 标准态 | 展示态 |
|---|--:|--:|--:|
| 拉丁字号（Geist 600，字距 −0.02em） | 15 | 20 | **60** |
| 板内距 上下 / 左右 | 4 / 6 | 6.5 / 9 | **16 / 24** |
| 板尺寸 | 67.5 × 23 | 92 × 33 | **270.1 × 92** |
| 发丝竖线 | 1 × 11，白 18% | 1 × 15，白 18% | **1 × 44，白 18%** |
| 中文（Noto Serif SC 700，字距 0.06em） | 13 | 17 | **52** |
| 段间距 | 9 | 12 | **36** |
| 整幅墨迹宽 | 112.9 | 151.6 | **448.7** |
| 用在哪 | 应用内窄容器（侧栏表头） | 文档 / PPT / 邮件签名 / 展会物料 | 登录页左栏 |

**展示态不是另配的一档，它就是密集态 ×4** —— 六个数值一一对应乘 4
（15→60、4/6→16/24、11→44、13→52、9→36；板 67.5→270.1、23→92 是乘出来的结果）。
要改就六个一起改，改一个比例就走形。Max 2026-09-17 定的量级是「至少放大 4 倍」，
所以直接取密集态的 4 倍，而不是重新配一组好看的数字。

##### 为什么侧栏只到标准态

侧栏是 `200px 宽 × 56px 高` 的固定栏（`components/layout/Sidebar.tsx`）：
标准态的板 92×33 放进去，左右各余 25px、上下各余 11px，已经到头；
展示态的板 270×92 比整条侧栏还宽。**侧栏要再大，得先改侧栏宽度与表头高度** ——
那是版式改动，不是 logo 尺寸改动，没在这次一并做。

##### 基线是怎么定的（不是随手摆的）

拉丁基线 = 内距 6.5 + 行盒内基线偏移 17 = **23.5**
中文基线 = (板高 33 − 中文 17) / 2 + 行盒内基线偏移 16 = **24**
两个基线差 0.5px 是字体度量本身的差异，不是误差；SVG 资产按各字自身的基线落笔，
与浏览器排版结果一致。

`MWLAB` 五个字的 x 位置是**量的、不是算的**：Geist 600 开了 kerning，
纯按 advance 累加会比实际宽出 1.6px。实测逐字位置（20px）：

| M | W | L | A | B |
|--:|--:|--:|--:|--:|
| 0 | 17.156 | 36.281 | 47.203 | 60.516 |

---

#### §3 色值溯源（每个值都有出处，无一处是配出来的）

| Token | 值 | 出处 |
|---|---|---|
| `--color-brand` | `#fe5c00` | `docs/DESIGN.md` P0-4 的 `accent`（Stitch 把它降级藏在 `primary-container`，本次还原为品牌正色） |
| `--color-brand-fg` | `#ffffff` | 板上字面，与问津的白色 W 同处理 |
| `--color-brand-hover` | `#ff7324` | 同上，P0-4 的 `accent-hover` |
| `--color-brand-rule` | `#e2e2e0` | whenjin `src/styles/tokens.css` 的 `--color-rule` |
| `--color-brand-ink` | `#111111` | whenjin `--color-text` |
| `--color-logo-rule` | `#e2e2e0` | whenjin `--color-rule`，与 `mwlab-lockup-light.svg` 同值 |
| 字标中文墨色 | `#111111` | whenjin `--color-text`（= `--color-brand-ink`）。**不用**正文的 `#171717` —— 字标与正文分开 |
| 问津的红 `#c2261c` | — | whenjin `--color-accent`。**只属于问津，不进本项目** |

---

#### §4 字体

| 用途 | 字体 | 加载方式 |
|---|---|---|
| 板上拉丁 `MWLAB` | Geist 600 | 已自托管（`public/fonts/geist-latin.woff2`） |
| 中文 `万象` | **Noto Serif SC 700** | 新增自托管子集 `public/fonts/noto-serif-sc-logo.woff2`，**1.3 KB，只含万(U+4E07)、象(U+8C61)** |

为什么给这两个字开自托管的例外：本项目的规则是「中文不加载 CJK webfont，走系统栈」
（一个常用字子集 1MB+，而 PingFang SC / 微软雅黑已是各平台原生好字体）。但品牌锁定里的
「万象」必须与问津的「问津」**同款**，而系统栈里没有一款各平台一致的衬线 ——
所以只给这两个字切一个子集。正文仍然一个字都不加载。

⚠️ `--font-logo-cn` **只能用在「万象」两个字上**，子集里没有别的字。

问津侧同款字的依据（两处独立来源互相印证）：
- whenjin `src/styles/tokens.css`：`--font-logo-cn: "Noto Serif SC", serif` + `--font-size-...`
- whenjin `src/layouts/BaseLayout.astro`：`family=Noto+Serif+SC:wght@700&text=问津`
- whenjin `src/styles/main.css` `.brand-wordmark-cn`：`font-weight: 700`；字距 `--letter-spacing-cn: 0.06em`

---

#### §5 用法与禁止

**底色对应**

| 场 | 用哪个资产 |
|---|---|
| **应用（看板已反置为浅色）** | **`mwlab-lockup-light.svg`** |
| 浅底（白纸、文档、浅色 PPT） | `mwlab-lockup-light.svg` |
| 暗底（深色 PPT、社交图、深色终端） | `mwlab-lockup-dark.svg` |
| 一色印刷 / 不能用橙 | `mwlab-lockup-mono-light.svg`（空心板，墨） |
| 暗底且不能用橙 | `mwlab-lockup-mono-dark.svg`（白板，墨字） |

**档位怎么选**（容器决定档位，别随手改数字）：

| 容器 | 档位 |
|---|---|
| 高度 < 40px 的窄条（侧栏表头、工具条） | 密集态 |
| 文档 / PPT / 邮件签名 / 展会物料 | 标准态 |
| 专门给品牌留白的面（登录页左栏） | 展示态（= 密集态 ×4） |

**最小尺寸**：整幅高度不低于密集态（23px），再小就改用图标态。图标态最小 **16px**。

**展示态的代价**：板高 92px 会让登录页左栏内容增高到约 615px。
窗口高度 ≥ 768px 无影响；窗口高度 < 620px 时登录页会出现约 40px 纵向滚动。
若要连矮窗口也不滚，该在 `@media (max-height: 700px)` 把展示态降一档 —— 本次没做。

**保护间距**：四周留空 ≥ 板高的 1/2（标准态 ≈17px）。

**禁止**

1. 不给板加圆角 —— 问津的方标是硬角，这是同一套几何观。
2. 不把「万象」放进橙板。板只装拉丁；中文在板外。
3. 不换中文款字、不改 0.06em 字距 —— 与问津的联结就断在这。
4. 不用问津的红 `#c2261c`。
5. 不拉伸、不重排（拉丁 → 竖线 → 中文 的顺序固定）。
6. 不改 `MWLAB` 的字重（600）与字距（−0.02em）：SVG 资产按这个口径烘字，
   改了实渲染与资产就对不上。
7. 图标态不用「象」字。实测 16px 下该字 12 画糊成一团；用几何 M。

---

#### §6 资产清单

```
public/brand/logo/
  mwlab-lockup-dark.svg        暗底      标准态 151.6×33
  mwlab-lockup-light.svg       浅底      标准态
  mwlab-lockup-mono-dark.svg   暗底一色  标准态
  mwlab-lockup-mono-light.svg  白场一色  标准态（空心板）
  mwlab-icon.svg               图标态    100×100 橙方 + 白 M
  mwlab-icon-reverse.svg       图标态反色 白方 + 墨 M
public/favicon.svg             图标态同源副本（由生成器直接写出）
public/favicon-192.png         apple-touch-icon
public/favicon.ico             16/32/48/64 四尺寸合一
```

**所有 SVG 里的字都是轮廓烘出来的，不引用任何 webfont** ——
所以它们在 PPT / 邮件签名 / 印刷 / `<img>` 里都能原样渲染，不赌对方能不能加载字体。

**重生成**（改了任何几何或字体之后）：

```bash
pip install fonttools brotli pillow   # 首次
python3 tools/build_logo_svg.py
```

脚本从 `public/fonts/` 的两个字体文件取轮廓，坐标取整（误差 0.0085px），
`viewBox` 贴着墨迹收口，并用 macOS 的 `sips` 出 favicon 栅格。

---

#### §7 落地位置与遗留

| 位置 | 实现 |
|---|---|
| 侧栏 | `components/layout/Sidebar.tsx` → `components/brand/BrandLockup.tsx`（**标准态**） |
| 登录页 | `app/login/login-form.tsx` → 同一组件（**展示态**）；`lang=en` 时 `showCn={false}`，只留橙板 |
| 浏览器标签页 | `public/favicon.svg` / `.ico` / `-192.png` |

组件按 `size="dense | standard | display"` 选档，变量名即 `--logo-*{,-dense,-display}`。

**遗留（待 Max 拍板，本次没动）**

1. `--color-accent` 2026-09-17 随看板反置改为 Geist 的黑（`#171717` 底 / 白字）。
   CTA 要不要用橙，仍是简报 P1-5「每屏最多 3 处橙色」那个决定 —— 目前橙只上品牌板。
2. 侧栏**收起态（64px）**尚未实现。设计系统板给的图标态是橙方 + 白「象」；
   按 §5 第 7 条，落地时应改用几何 M（`public/brand/logo/mwlab-icon.svg`）。
3. `public/brand/banner.html`（LinkedIn 横幅源文件）与两张已导出的 PNG
   仍是旧字标，需要按本规范重做 —— 本次未改。
4. 侧栏的品牌标要再大，必须同时改侧栏宽度（现 200px）与表头高度（现 56px）——
   这两项一动，下面 6 个导航项与右侧内容区都要跟着重排，属于版式决策。
5. 矮窗口（< 620px 高）下登录页会纵向滚动约 40px。要修就在
   `@media (max-height: 700px)` 里把展示态降一档，本次未做。
6. 设计系统板 `design/MWLAB 设计系统板.dc.html` 的「品牌锁定」段已同步更新。

---


---

## 4. 英文版规范（i18n）

### 英文版规范 · 后台看板 + 登录

**日期**：2026-09-16
**范围**：`/login` + `/overview` + `/opportunity` + `/opportunity/[id]` + `/expo`
（落地页 `/` 的中/EN/DE 已在设计稿里，走同一套机制，不在本次范围）
**产物**：`locales/zh.json` · `locales/en.json`（各 159 键，已校验零缺口）

---

#### §1 核心要求：英文版不出现中文字体

分两层做，两层都要：

##### 第一层 · 字体栈按 lang 切换

```css
:root {
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-cjk:  'Noto Sans SC', 'PingFang SC', sans-serif;
  --font-ui:   var(--font-sans), var(--font-cjk);   /* 中文版 */
}
:root:lang(en), [lang="en"] {
  --font-ui: var(--font-sans);                       /* 英文版：CJK 整条摘除 */
}
body { font-family: var(--font-ui); }
```

##### 第二层 · 英文版根本不加载中文 webfont

只改字体栈不够 —— Noto Sans SC 是个几百 KB 的包，英文版不该下载它。
用 `next/font` 时按 locale 条件加载，`lang="en"` 的页面不注入 CJK 字体变量。

> 光靠第一层，中文字符仍会落到系统 CJK 字体（苹方 / 微软雅黑）。
> 要真正"一个中文字体都没有"，必须第二层配合 —— 见 §2 的那个前提。

---

#### §2 一个你必须先拍板的前提

**界面文案可以做到 100% 英文，但你录入的数据本身是中文。**

一条机会叫「华东精细化工及表面活性剂博览」，在英文版里它还是中文，
浏览器会用系统 CJK 字体渲染它 —— 这时"英文版没有中文字体"就不成立了。

现状盘点：

| 内容 | 有英文名吗 |
|---|---|
| `exhibition_brand.name_en` | ✅ **7,222 / 7,401 = 97.6%** —— 展会底图几乎可以真全英文 |
| `company.name` | ❌ 无英文字段 |
| `opportunity.title` | ❌ 新表，尚未设计 |

**两条路，你选**：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A（推荐）** | `opportunity` 加 `title_en`、`company` 加 `name_en`，英文版优先取英文名，缺失回退中文 | 各加一列，录入时多填一个字段（可选填） |
| **B** | 界面全英文，数据照显中文 | 零成本，但"英文版无中文字体"只做到界面层 |

> 倾向 A 的理由不只是字体：英文版的实际读者是**德方总部**，
> 他们看「华东精细化工及表面活性剂博览」是读不懂的，`title_en` 本身就有业务价值。
> 但只对需要给外方看的机会填，不强制。

---

#### §3 表格列宽：英文标签必须写短，不能直译

机会台 11 列在 1440px 本来就放不下（brief P1-8）。英文标签若直译会更挤。
所以 `en.json` 里**一律取短式**，不是字面翻译：

| 列 | 中文 | ❌ 直译 | ✅ 采用 |
|---|---|---|---|
| 对标 MD 品牌 | 7 字 ≈ 16 单位 | MD Benchmark Brand (18) | **MD brand (8)** |
| 优先级 | 3 字 ≈ 6 | Priority (8) | **Pri. (4)** |
| 阶段·投后整合 | 4 字 ≈ 8 | Post-Merger Integration (23) | **Close (5)** |
| 阶段·尽调审计 | 4 字 ≈ 8 | Due Diligence (13) | **DD (2)** |
| 录入机会 | 4 字 ≈ 8 | Create Opportunity (18) | **New (3)** |

实测后只有 3 列英文比中文宽（`name` +3、`nextAction` +5、`stage` +1），
其余持平或更窄，`mdBrand` 反而**窄了一半**。表格宽度问题不会因为英文加剧。

**规则**：任何新增列标签，英文不得超过中文字符数 × 2 + 3 个单位。

---

#### §4 机制

| 项 | 做法 |
|---|---|
| locale 选择 | URL 不分段，存 cookie `mwlab_locale`，默认跟随 `Accept-Language` |
| 切换入口 | 登录页三语控件、应用内头像菜单 |
| 数字 | `Intl.NumberFormat(locale)` —— 不手拼千分位 |
| 日期 | `Intl.DateTimeFormat(locale)` —— `04-18 10:24` 在英文下是 `Apr 18, 10:24` |
| 面积单位 | `m²` 两边一致，不翻译成 sqm |
| 插值 | `{count}` `{days}` `{rate}` `{time}` `{n}` `{shown}` `{total}`，禁止拼接字符串 |
| EDIT 内容 | **不翻译**（除 §2 方案 A 的英文名字段） |
| 星期缩写 | 中文 `一二三…`，英文 `M T W T F S S` |

---

#### §5 验收

```bash
# 1. 界面层零硬编码中文（locales/ 除外）
grep -rnE '>[^<>{]*[一-龥]{2,}[^<>}]*<' app/ components/

# 2. 两份 locale 键完全对齐
python3 -c "
import json
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('缺失:',set(z)-set(e) or '无'); print('多余:',set(e)-set(z) or '无')"

# 3. 英文版页面不请求 CJK 字体
#    DevTools Network 过滤 font，lang=en 时不应出现 Noto Sans SC
```

三条全过 = 英文版达标。

---

---

## 5. 内容契约 —— 每个文本位的来源

界面上每一个字都必须能回答「它从哪来」。四选一，没有第五种。

| 标记 | 含义 | 谁写 | 前端怎么拿 |
|---|---|---|---|
| **DB** | 数据库字段 | 爬虫 / 治理脚本 | API 查询 |
| **EDIT** | 后台可编辑 | Max 在系统里录入或改 | API 读写 |
| **UP** | 上传的文件 | Max 上传 docx / xlsx / 图 | 文件表 + 对象存储 |
| **I18N** | 界面文案 | 写在 locale 文件里 | `t('key')` |

> **硬编码的定义**：任何直接写死在 JSX/HTML 里的中文字符串。
> 界面标签也不许硬编码 —— 它们是 **I18N**，这是英文版的前提（见第 4 节）。

---

### 机会台的数据来自你自己

三条业务线（并购标的 / 全新品类 / 项目组支持）是你的 BD 判断，系统无法推断。
所以 `opportunity` 表 **100% 是 EDIT**，必须有完整的录入与编辑界面（V2-05 已落地）。
同理，公司库与调研库的内容也是 EDIT / UP，只是目前走的是脚本导入而不是界面录入。

爬来的展会数据只在两处出现：作为机会的**关联对象**（选一个展会品牌挂上去），
和 `/expo` 展会底图的**底表**。

---

---

## 6. 落地页改版规格（V2-18）

**日期**：2026-09-18 · **状态**：**Stitch 稿已落地并上线**（V2-18，提交 `023f826`）
**参考**：Linear（linear.app）的首屏与「Build, review, and ship」段

> 本节 6.1–6.7 的要求已全部实现，留档作为改版依据。后续要深化（Claude Design 那一轮）
> 请在此基础上提要求，不要当成还没开始做。实现与稿子的四处有意出入记在提交信息里。

### 6.0 先作废旧纪律

上一轮落地页规范里的以下禁令，**2026-09-18 起全部作废**，代码注释里还留着的一并改掉：

| 旧纪律 | 状态 |
|---|---|
| 三条业务线「不用卡片、不填底色、不加圆角」 | ❌ 作废 —— 改为卡片翻转 + 边框 |
| 数据切面「不填底色、不加圆角、不带投影」 | ❌ 作废 —— 改为带底色 + 动效 |
| 「禁带投影的卡片网格」 | ❌ 作废 —— Hero 与卡片都要投影 |
| 页脚「没有别的」 | ❌ 作废 —— 增加 terms / privacy / 合作方 logo / like |
| 「六个 section，不多加」 | ❌ 作废 —— 增加第 7 段（数据管道图） |

**仍然有效**：第 1 节 Design Token（颜色只能用表里的）、第 2 节中文排版纪律、
公开页不带内部数据（落地页无鉴权，任何出现在这里的数字都等于对全网公开）。

### 6.1 所有可点选项加 hover 动态

导航锚点、按钮、文字链、卡片、数据面板 —— 凡是能点的，都要有 hover 反馈。

- 用 `--color-surface-hover` / `--color-hairline-active` 做底色与描边的变化
- 过渡 150–200ms，`ease-out`；**不要用弹跳或超过 300ms 的缓动**
- 位移最多 1–2px，不要放大缩放整块元素

### 6.2 首屏 Hero —— 看板即主视觉（参考 Linear）

结构从上到下：**渐变/毛玻璃背景 → 悬浮的 dashboard 界面 → 投影**。

- **背景**：大面积柔和渐变，或毛玻璃质感。色相限制在中性灰与极浅暖调之间，
  **不许引入第二个强调色，不许用品牌橙**
- **主体**：`/expo` 或 `/overview` 的真实界面，**不是插画、不是抽象图形**
- **投影**：大范围低透明度，营造界面浮在背景上的层次。Linear 的量感即可，不要更重
- 界面顶边可略微裁切出画面，暗示「还有更多」
- 保留现有的标题两行 + 副标题 + 主按钮 + 文字链

> 现有 `ProductShot.tsx` 已经是截图框（读 `public/landing/product.webp`），
> 这条是把它升级成 Linear 那种「背景 + 悬浮 + 投影」，不是新做一个组件。

### 6.3 数字带与数据切面合并成一段

现在是两段（`CoverageBand` 六个数 + `DataFacets` 3×2 六块面板），**合并为一段**。

- 加**底色**（用 `--color-surface`，与页面底 `--color-canvas` 拉开层次）
- 加一层**简单的交互式流体扭曲**：鼠标移动时背景轻微流动/折射
- **流体只能在背景层**，绝不能让数字和文字跟着变形 —— 数据必须始终清晰可读
- 性能底线：移动端与 `prefers-reduced-motion` 下自动降级为静态底色

### 6.4 三条业务线改卡片翻转

三块文本区域改为**带边框的卡片**，hover 时翻转露出背面。

- 正面：序号 + 标题 + 一行说明
- 背面：原来的三个短条目
- 边框用 `--color-hairline`，圆角用 `--radius-card`（8px）
- 翻转 300–400ms；**移动端改为点击翻转**，触屏没有 hover

### 6.5 新增第 7 段 · 数据管道图

标题：**「自组，自建，为 BD 而生」**

版式照 Linear 的「Build, review, and ship」：左文右图，或上文下图。
图的内容是**数据管道示意**——采集 → 合并 → 治理 → 看板的流程，
或终端里 pipeline 跑动的日志感。**不是裸代码截图**，要让不写代码的人也看得懂价值。

> 真实管道是：jufair / cnexpo 采集 → 双源合并 → 行业分类 / 届次状态 / 展示池 → 看板。
> 每月 7、27 号自动跑。图里的步骤名用这套真实的，不要编。

### 6.6 页脚 like 按钮

一个 like 按钮，点击放**礼花**。

- **纯前端动效，不计数、不存任何数据**（落地页无鉴权，写接口等于给全网开一个可刷的口子）
- 礼花用轻量实现，**别为它引入大体积动画库**
- 连点要有节流，不要一直堆粒子

### 6.7 页脚扩展

现有页脚只有「字标 + 两行小字 / 进入系统 + 一行小字」，增加：

- **Terms** 与 **Privacy** 两个链接（页面内容后续再写，先占位）
- **两个合作方 logo**，位置与大小由设计决定
- like 按钮（见 6.6）

> ⚠️ **两个 logo 现在是印刷素材**：`public/logo-mds.jpg` / `logo-mdc.jpg`，
> 990×999、**CMYK 色彩空间**、各 2.2MB。CMYK 的 JPG 在浏览器里颜色会偏，
> 而且 footer 里实际只显示 100px 上下。落地时**必须转 sRGB、压到显示尺寸、转 WebP**，
> 不要直接 `<img src="/logo-mds.jpg">`。

### 6.8 需要新增的 Design Token

渐变、毛玻璃、投影这三样**现在一个 Token 都没有**（`globals.css` 里没有任何
shadow / gradient / blur 变量，代码里也没有用过 `shadow-*`）。

Stitch 出稿后，把这几类的具体值定成 Token 再落地，**不要在组件里写死**：

| 需要的 Token | 用在哪 |
|---|---|
| `--shadow-hero` | 首屏 dashboard 的大投影 |
| `--shadow-card` | 业务线卡片 |
| `--gradient-hero` | 首屏背景渐变 |
| `--blur-glass` | 毛玻璃模糊半径 |

### 6.9 给 Stitch 的边界

**不要动**：导航栏结构、品牌锁定（`BrandLockup`，橙板 + 衬线中文，规范见第 3 节）、
页面的中英文案、六个数字的口径。

**不要加**：第二个强调色、插画、图标装饰、订阅框、社交图标、开发者署名。

**颜色只能从第 1 节的 Token 表里取**，新色值必须先说明为什么现有的不够。
