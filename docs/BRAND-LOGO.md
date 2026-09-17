# MWLAB 万象 · 品牌与 Logo 规范

**日期**：2026-09-17
**适用范围**：MWLAB 万象（暗场、工具）与兄弟品牌 问津 Whenjin（浅场、媒体）
**Token 落点**：`app/globals.css` 的 `@theme`（`--color-brand-*` / `--logo-*` / `--font-logo-cn`）
**资产**：`public/brand/logo/*.svg`、`public/favicon.svg`、`public/favicon.ico`、`public/favicon-192.png`
**生成器**：`tools/build_logo_svg.py`（改任何几何都要重跑它，否则资产与实渲染会对不上）

---

## §1 两个品牌的关系

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

## §2 Logo 构成（标准态）

```
┌───────────────┐
│   MWLAB       │  │  万象
└───────────────┘
   ↑ 橙板 92×33      ↑ 发丝竖线      ↑ Noto Serif SC 700
   Geist 600 白色 20px  1×15 白 18%     17px / 0.06em 字距
```

从左到右三段，**顺序永不调换**：橙板（拉丁）→ 发丝竖线 → 中文。

### 三档几何（全部数值，单位 px）

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

### 为什么侧栏只到标准态

侧栏是 `200px 宽 × 56px 高` 的固定栏（`components/layout/Sidebar.tsx`）：
标准态的板 92×33 放进去，左右各余 25px、上下各余 11px，已经到头；
展示态的板 270×92 比整条侧栏还宽。**侧栏要再大，得先改侧栏宽度与表头高度** ——
那是版式改动，不是 logo 尺寸改动，没在这次一并做。

### 基线是怎么定的（不是随手摆的）

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

## §3 色值溯源（每个值都有出处，无一处是配出来的）

| Token | 值 | 出处 |
|---|---|---|
| `--color-brand` | `#fe5c00` | `docs/CLAUDE-DESIGN-BRIEF.md` P0-4 的 `accent`（Stitch 把它降级藏在 `primary-container`，本次还原为品牌正色） |
| `--color-brand-fg` | `#ffffff` | 板上字面，与问津的白色 W 同处理 |
| `--color-brand-hover` | `#ff7324` | 同上，P0-4 的 `accent-hover` |
| `--color-brand-rule` | `#e2e2e0` | whenjin `src/styles/tokens.css` 的 `--color-rule` |
| `--color-brand-ink` | `#111111` | whenjin `--color-text` |
| `--color-logo-rule` | `#e2e2e0` | whenjin `--color-rule`，与 `mwlab-lockup-light.svg` 同值 |
| 字标中文墨色 | `#111111` | whenjin `--color-text`（= `--color-brand-ink`）。**不用**正文的 `#171717` —— 字标与正文分开 |
| 问津的红 `#c2261c` | — | whenjin `--color-accent`。**只属于问津，不进本项目** |

---

## §4 字体

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

## §5 用法与禁止

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

## §6 资产清单

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

## §7 落地位置与遗留

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
