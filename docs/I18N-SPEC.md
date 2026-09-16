# 英文版规范 · 后台看板 + 登录

**日期**：2026-09-16
**范围**：`/login` + `/overview` + `/opportunity` + `/opportunity/[id]` + `/expo`
（落地页 `/` 的中/EN/DE 已在设计稿里，走同一套机制，不在本次范围）
**产物**：`locales/zh.json` · `locales/en.json`（各 159 键，已校验零缺口）

---

## §1 核心要求：英文版不出现中文字体

分两层做，两层都要：

### 第一层 · 字体栈按 lang 切换

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

### 第二层 · 英文版根本不加载中文 webfont

只改字体栈不够 —— Noto Sans SC 是个几百 KB 的包，英文版不该下载它。
用 `next/font` 时按 locale 条件加载，`lang="en"` 的页面不注入 CJK 字体变量。

> 光靠第一层，中文字符仍会落到系统 CJK 字体（苹方 / 微软雅黑）。
> 要真正"一个中文字体都没有"，必须第二层配合 —— 见 §2 的那个前提。

---

## §2 一个你必须先拍板的前提

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

## §3 表格列宽：英文标签必须写短，不能直译

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

## §4 机制

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

## §5 验收

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
