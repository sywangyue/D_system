# MWLAB 万象 · 设计规范（品牌 / 英文版 / 内容契约 / 设计简报）

> 由四份原文档合并（2026-09-17）。**色值以 `app/globals.css` 为准**：
> 界面已转为浅色、橙色只留在 Logo，文中暗色与橙色的描述均已作废。V2-18 UI 重做时统一改写本文件。

## 目录

1. 品牌与 Logo
2. 英文版规范（i18n）
3. 内容契约：每个文本位的来源
4. Claude Design 设计简报（色板部分已作废，见文首说明）


---

## 品牌与 Logo

<!-- 原文件：docs/DESIGN.md -->

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

## 英文版规范（i18n）

<!-- 原文件：docs/DESIGN.md -->

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

## 内容契约：每个文本位的来源

<!-- 原文件：docs/DESIGN.md -->

### 内容契约 · 六屏每个文本位的来源

**日期**：2026-09-16
**解决的问题**：精修稿里 43 条假展会名等硬编码文案，必须全部换成「数据 / 可编辑 / 配置」三选一
**上游**：`docs/archive/V2-plan.md` §1 信息架构 · `design/MWLAB 六屏精修稿.dc.html`

---

#### §0 四种来源，只能是其中之一

| 标记 | 含义 | 谁写 | 前端怎么拿 |
|---|---|---|---|
| **DB** | 数据库字段 | 爬虫 / 治理脚本 | API 查询 |
| **EDIT** | 后台可编辑 | Max 在系统里录入或改 | API 读写 |
| **UP** | 上传的文件 | Max 上传 docx / xlsx / 图 | 文件表 + 对象存储 |
| **I18N** | 界面文案 | 写在 locale 文件里 | `t('key')` |

> **硬编码的定义**：任何直接写死在 JSX/HTML 里的中文字符串。
> 界面标签也不许硬编码 —— 它们是 **I18N**，这是英文版的前提（见 §7）。

---

#### §1 一个必须先纠正的认知

**机会台的数据不来自爬虫，来自你自己。**

三条业务线（并购标的 / 全新品类 / 项目组支持）是你的 BD 判断，系统无法推断。
所以 `opportunity` 表 **100% 是 EDIT**，需要完整的录入与编辑界面 —— 这在精修稿里目前完全没有。

爬来的展会数据只在两处出现：作为机会的**关联对象**（选一个展会品牌挂上去），
和 `/expo` 展会底图的**底表**。

---

#### §2 `/` 落地页

| 位置 | 来源 | 说明 |
|---|---|---|
| Nav 链接、语言切换、按钮 | **I18N** | |
| Hero 标题 / 副标 | **I18N** | 副标里的数字用插值，不写死 |
| **数字带 6 个数** | **DB** | `SELECT count()` 实时聚合，**绝不能硬编码** |
| 产品截图 | **UP** | 一张 PNG，改版时换图；不要用 iframe 塞真界面 |
| 六块数据切面 | **DB** | 见下 |
| 三条业务线标题与条目 | **I18N** | 这是产品定位文案，不是数据 |
| Footer | **I18N** | |

> ⚠️ **旧 `pitch.html` 就是栽在这**：硬编码了 `5,941 展会品牌`，实际库里已经 7,401，
> 数字挂在门面上过期了一年多。数字带必须走接口。

六块数据切面的取数：

| 面板 | 取数 |
|---|---|
| 地理分布 | `brand_geo_tag` 按城市聚合 |
| 主办方集团结构 | `brand_organizer` 按集团归并后取 top 6 |
| 行业结构 | `exhibition_brand` 按 `industry_l1` 分组（8 类） |
| 规模排名 | `exhibition_edition` 按 `area_sqm` 降序 top 6 |
| 档期分布 | `exhibition_edition.date_start` 按月分桶 |
| 白地信号 | 无 2026+ 届次的品牌数 + 3 条示例 |

---

#### §3 `/login` 登录页

| 位置 | 来源 |
|---|---|
| 全部文案（标题、标签、按钮、错误提示、底部声明） | **I18N** |
| 左栏 2×2 数字 | **DB**（同落地页口径） |
| 语言切换 | **I18N** + 写 cookie |

登录页**不应有任何 EDIT 内容**。当前精修稿此屏是干净的。

---

#### §4 `/overview` 盘面

| 区块 | 来源 | 字段 |
|---|---|---|
| 四个指标数 | **DB** | `opportunity` 按 `type` / `stage` 计数 |
| 指标标签 | **I18N** | |
| 本周待办列表 | **DB** | `opportunity.next_action` + `next_action_due` ≤ 本周 |
| 最近调研列表 | **DB** | `intel_report` 按 `updated_at` 降序 5 条 |
| 阶段漏斗 | **DB** | `opportunity` 按 `stage` 分组计数 |
| **空状态文案** | **I18N** | 「本周没有到期事项」「还没有调研报告」 |

---

#### §5 `/opportunity` 机会台

**整屏 43 条假展会名全部删除。** 表格是纯数据渲染。

| 列 | 来源 | 字段 |
|---|---|---|
| 机会名称 | **EDIT** | `opportunity.title` |
| 类型 | **EDIT** | `opportunity.type`，枚举：`ma` / `greenfield` / `project_support` |
| 阶段 | **EDIT** | `opportunity.stage`，枚举 5 档 |
| 对标 MD 品牌 | **EDIT** | `opportunity.md_brand`，从固定清单选 |
| 关联公司 | **EDIT** | `opportunity.company_id` → `company.name`，下拉搜索选择 |
| 城市 | **DB** | 跟随 `company` 或 `exhibition_brand` 派生，不单独存 |
| 规模 ㎡ | **DB** | 关联展会的 `exhibition_edition.area_sqm` |
| 优先级 | **EDIT** | `opportunity.priority` 1–5 |
| 负责人 | **EDIT** | `opportunity.owner` → `user` 表 |
| 下一步 | **EDIT** | `opportunity.next_action` |
| 更新时间 | **DB** | `updated_at` 自动写 |

**必须补的界面（精修稿里没有）**：

1. **录入机会**：右侧抽屉表单，按 `type` 切换差异字段（`detail_json`）
2. **行内编辑**：至少「阶段 / 优先级 / 下一步」三列点击即改
3. **空状态**：「还没有机会，点右上角录入第一条」+ 一个 CTA
4. **加载骨架**：8 行 skeleton，不是转圈
5. **筛选无结果**：「没有符合条件的机会」+ 清除筛选按钮

**必须删的幻觉元素**（Stitch 遗留）：
`基准汇率 USD/CNY` · `标的底稿加密级别 CONFIDENTIAL-L2` · `更新引擎 MW-FEED v4.19` ·
`数据哈希` · `延迟 18ms` · `实时同步 99.8%`

---

#### §6 `/opportunity/[id]` 机会详情 与 `/expo` 展会底图

##### 机会详情

| 区块 | 来源 |
|---|---|
| 标题 / 类型 / 阶段 / 负责人 | **EDIT** |
| **深度调研正文** | **UP + EDIT** | `intel_report.report_md` 富文本编辑，或上传 docx 转存 |
| 关联公司信息块 | **DB** | `company` 企查查字段，只读 |
| 对标 MD 品牌 / 下一步 | **EDIT** |
| 时间线 | **DB** | 由 `manual_tag_history` 与编辑记录自动生成 |
| 关联展会规模三数 | **DB** | `exhibition_edition` |

> 当前精修稿里那份「项目尽调报告：标的运营壁垒、财税真实性与并购整合估值重构」
> 是 Claude Design 编的样例长文。**留版式，删文字**，换成 `report_md` 渲染 + 空状态。
> `reports/*.docx` 里已有的历史报告走 **UP** 通道导入。

##### 展会底图

| 区块 | 来源 |
|---|---|
| 地图 / 趋势四宫格 / 行业分布 | **DB**，且必须**跟随当前筛选范围**（见重构方案 §1.2 的口径提醒） |
| **我的行动日历** | **EDIT** | 你自己录的行程，不是展会档期表 |
| 筛选器选项 | **DB** | 从实际数据 distinct 出来，不写死 |

---

#### §7 与英文版的关系（第三步的前提）

**§0 里每一个 I18N 标记，就是英文版的工作量。** 契约执行到位，英文版几乎自动成立：

- 界面文案走 `locales/zh.json` + `locales/en.json`
- 数字与日期走 `Intl.NumberFormat` / `Intl.DateTimeFormat`，不手拼
- **EDIT 内容不翻译** —— 你录的机会名称是什么语言就显示什么语言
- 英文版禁止出现中文字体：`lang="en"` 时字体栈里**移除** `--font-cjk`，
  只留 `'Geist', system-ui, sans-serif`

> 反过来说：**如果这一步偷懒把标签硬编码成中文，英文版就要重写一遍界面。**
> 这是为什么去硬编码必须排在英文版前面。

---

#### §8 验收标准

```
grep -rnE '>[^<>{]*[一-龥]{2,}[^<>}]*<' app/ components/
```

除 `locales/` 外**零命中** = 契约执行到位。

---

## Claude Design 设计简报（色板部分已作废，见文首说明）

<!-- 原文件：docs/DESIGN.md -->

### Claude Design 深度设计 Brief · MWLAB 万象

> ⚠️ **本简报的色板部分已作废（2026-09-17）**：看板整体反置为浅色，色值改取
> **Vercel Geist**（黑白色界面），不再是本文 §1 保留的 `#0A0A0B / #0E0E10 / #141416`
> 那套暗色。以 `app/globals.css` 的 `@theme` 与 `design/MWLAB 设计系统板.dc.html`
> 的 Token 表为准。本文其余部分（§2 问题清单、§3 字阶、§4 中文排版 7 条）
> 仍然有效，未受影响。

**日期**：2026-09-16
**输入**：`design/stitch/` — Stitch 交付 9 屏（6 个界面 + 登录 4 态）
**上游**：`docs/archive/V2-plan.md`（§1 信息架构 · §2 品牌 · §5 Stitch prompt）
**任务**：结构保留，**设计语言与状态系统整体重做**

---

#### §0 给 Claude Design 的一句话

> Stitch 把**骨架**搭对了，把**设计语言**做错了。
> 不要重新布局，不要重排信息架构 —— 那部分已经过审。
> 你要做的是：**清污染、定字体、立纪律、补状态**。

---

#### §1 保留（已过审，不得改动）

| 项 | 说明 |
|---|---|
| 9 屏的**页面结构与信息层级** | 侧栏 / tab / 筛选条 / 表格 / 面板网格的骨架全部保留 |
| `/` 落地页的 6 段结构 | Nav → Hero+产品图 → 数字带 → 六块数据切面 → 三条业务线 → Footer |
| 机会台的 11 列字段 | 机会名称 / 类型 / 阶段 / 对标MD品牌 / 关联公司 / 城市 / 规模 / 优先级 / 负责人 / 下一步 / 更新时间 |
| 登录页 58/42 分栏 | 含已交付的 4 个状态帧 |
| 基础色阶 | `#0A0A0B` / `#0E0E10` / `#141416` / 发丝线 `rgba(255,255,255,.07)` |

---

#### §2 必修问题清单（按严重度）

##### 🔴 P0-1 · 品牌锁定语序不一致

| 屏 | 现状 |
|---|---|
| `public_landing`、4 个 `sign_in` | `MWLAB │ 万象` ✅ 正确 |
| `m_a_pipeline`、`overview`、`opportunity_detail`、`exhibition_basemap` | `万象 │ MWLAB` ❌ **反了** |

**规则（不可协商）**：拉丁在前、重一档字重、紧字距；中文在后、轻一档字重、略小一号视觉尺寸；中间一根发丝竖线。图标态取单字「象」。
兄弟项目同构：`WHENJIN │ 问津`，图标态「津」。

##### 🔴 P0-2 · 四个应用屏完全没有中文字体

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

##### 🔴 P0-3 · 等宽字体栈是坏的，所有"等宽数字"都是假的

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

##### 🔴 P0-4 · Material 3 色板污染整个 token 层

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

##### 🟠 P1-5 · Accent 纪律完全失守

约束是「每屏最多 3 次橙色」。机会台实际：

侧栏 active + 「录入机会」按钮 + 实时同步点 + **阶段进度条 ×24 行** + **优先级方块 ×24 行**
≈ **200+ 处橙色**，满屏橙点。

更糟的是**阶段**和**优先级**两列用了同一种视觉语言（一串小方块），读者分不清哪列是哪列。

**修法**：
- 阶段列 → 中性灰进度指示 + 文字（`3/5 意向`），不用橙色
- 优先级列 → 一个数字或一根 3px 短条，不要 5 个方块
- 橙色只留给：侧栏 active、唯一主 CTA、当前选中行的 2px 左边框

##### 🟠 P1-6 · 状态系统几乎不存在（你点名的问题）

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

##### 🟠 P1-7 · 表格行高不齐，扫描节奏被破坏

「独家商业承办」6 个字在类型列换行，那几行行高从 32px 撑到 48px。
**修法**：类型列固定宽度 + 单行截断，或改用 2–3 字表述（承办 / 收购 / 参股 / 孵化）。

##### 🟠 P1-8 · 右侧内容被裁切

- 机会台：「下一步」列切出画面
- 落地页：产品截图的地图面板、「行业结构」「白地信号」两块面板都被裁

11 列在 1440px 放不下。需要定**列优先级** + 冻结首列 + 横向滚动，而不是让它无声截断。

##### 🟡 P2-9 · 幻觉内容必须连根清除

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

##### 🟡 P2-10 · 落地页节奏过松

160px 的 section 间距被放大，数字带与下一节之间大片空白，与「简洁 + 密度」的目标相矛盾。
收到 **120px**，且 Hero 产品截图与数字带之间不留空隙（产品图底边直接接数字带上边框）。

##### 🟡 P2-11 · Hero 中文标题字重过重、第二行没上橙色

prompt 要求第二行「结构化盘面」用 `#FE5C00`，Stitch 做成了全白。
中文标题字重也压过了拉丁，违反「CJK 轻一档」的规则。

---

#### §3 字阶重定（现有的不够用）

Stitch 的字阶最大只到 **24px**，而落地页 Hero 需要 **72px** —— 字阶不覆盖营销域。
而 `body-md 13px` 与 `body-sm 12px` 只差 1px，是无意义的层级。

**要求产出一套 8 级字阶，同时覆盖应用域与营销域**，并明确每一级的：
拉丁字号 / 中文字号（比拉丁小 1px）/ 拉丁字重 / 中文字重（低一档）/ 行高（中文比拉丁高）/ 字距（**中文一律 0，不用负字距**）。

---

#### §4 中文排版规则（本次最重要的交付物）

这是原项目最大的病灶，Stitch 没有解决，**必须由你定死**：

1. **中文字重永远比拉丁低一档**（Geist 600 ↔ Noto Sans SC 500）
2. **中文永不使用负字距**。Stitch 给 CJK 也套了 `-0.02em`，中文会挤在一起
3. **中文行高高于拉丁**（拉丁 1.4 ↔ 中文 1.6；长文中文 1.8）
4. **中英混排时中文字号比拉丁小 1px**，补偿字面率差异
5. **数字永远走拉丁等宽字体**，绝不落到 CJK 字体里
6. **中文标题不用 800 字重** —— 系统字体会触发伪粗体，边缘发毛
7. 中英之间插入 0.25em 间隙（由样式控制，不靠手打空格）

---

#### §5 交付要求

| # | 产出 | 说明 |
|---|---|---|
| 1 | **组件状态对照板** | §2 P1-6 的全部状态，画在一张板上 |
| 2 | **Token 表** | 12 个颜色 + 8 级字阶 + 圆角 + 间距，清掉 M3 污染，Tailwind v4 `@theme` 口径 |
| 3 | **中文排版规范** | §4 的 7 条落成具体数值 |
| 4 | 6 屏精修稿 | 结构不动，应用新语言 |
| 5 | 表格列优先级方案 | 1440 / 1680 / 1920 三档下各显示哪些列 |

**不要做**：重新布局、改信息架构、加新页面、引入第二个强调色、加插画或图标装饰。
