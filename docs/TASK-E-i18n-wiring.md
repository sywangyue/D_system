# 任务 E · 全站 i18n 接线

**前置**：无
**验收**：见 §5 的 grep，`app/` 与 `components/` 下界面文案零硬编码中文

---

## 1. 现状

`locales/zh.json` 与 `locales/en.json` 各 159 键已就绪，
但**只有登录页真正在用**。其余组件的中文全是硬编码：

```
app/opportunity/new-drawer.tsx    27 处
app/overview/page.tsx             23 处
app/opportunity/pipeline.tsx      19 处
app/setting/setting-content.tsx    9 处
components/layout/Sidebar.tsx      8 处
components/settings/*.tsx         17 处
app/profile/profile-content.tsx    3 处
其余占位页                        ~14 处
```

**不接线的后果**：英文版只有登录页是英文，进系统全是中文。
而英文版的读者是德方总部。

---

## 2. 机制：服务端读字典，往下传 props

**不要引入 Context Provider、不要用 next-intl、不要在客户端读 cookie。**
沿用登录页已验证的模式：

```tsx
// 服务端页面
import { getDict } from "@/lib/i18n"
export default async function Page() {
  const t = await getDict()
  return <ClientThing t={t} />
}
```

```tsx
// 客户端组件
"use client"
import type { Dict } from "@/lib/i18n-shared"
export default function ClientThing({ t }: { t: Dict }) {
  return <h1>{t.pipeline.title}</h1>
}
```

**理由**：语言状态只有 cookie 一处来源。登录态就是因为客户端和服务端
各存一份才出过「前端以为已登录、接口全 401」的事故
（见 `lib/session.ts` 顶部注释）。i18n 不重蹈。

### 已是服务端组件、直接取字典

`app/layout.tsx` · `app/overview/page.tsx` · `app/profile/page.tsx` ·
`app/company|research|expo/page.tsx` · `app/opportunity/[id]/page.tsx`

### 需要从上层接 props

`components/layout/Sidebar.tsx` ← 由 `AppShell` 传
（`AppShell` 是服务端组件，在 `layout.tsx` 里已能拿到 `t`，加一个 prop 传下去）

`app/opportunity/pipeline.tsx` 与 `new-drawer.tsx` ← 由 `app/opportunity/page.tsx` 传

`app/setting/setting-content.tsx`、`components/settings/*` ← 由 `app/setting/page.tsx` 传

---

## 3. 键的增补

现有 159 键覆盖不全。缺的自己加，**两份 JSON 必须同步**，规则：

| 规则 | 说明 |
|---|---|
| 分节 | 按页面分：`pipeline` / `overview` / `company` / `research` / `settings` / `profile` / `placeholder` |
| 复用 | 通用词（保存/取消/搜索/全部/加载中）放 `common`，不要每页复制一份 |
| 插值 | 用 `{count}` `{name}` 这种占位，**禁止字符串拼接**（中英语序不同） |
| **英文取短式** | 表格列头与按钮**不得直译**。`对标 MD 品牌` → `MD brand` 而非 `MD Benchmark Brand`；`录入机会` → `New` 而非 `Create Opportunity`。理由见 `docs/I18N-SPEC.md` §3：机会台 11 列在 1440px 本就放不下 |

---

## 4. ⚠️ 五个陷阱

### 4.1 只翻界面文案，不翻数据

用户录入的机会名称、公司名、报告标题**原样显示**，不查字典。
判断标准：这个字符串是从 API 拿来的 → 不翻；是写死在 JSX 里的 → 翻。

### 4.2 英文版不得出现任何中文字符

已经栽过两次：语言开关标签曾是「中文」、logo 曾带「万象」。
渲染这些字必须加载 CJK 字体，违反「英文版禁止出现中文字体」。
**新增文案同理**：任何在 `lang="en"` 下会显示的字符串，`en.json` 里必须是纯拉丁。

### 4.3 数字与日期走 Intl，不要手拼

```tsx
new Intl.NumberFormat(locale).format(n)
new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d)
```

`04-18` 在英文下应是 `Apr 18`。现有代码里 `.slice(5, 10)` 这种硬切要换掉。

### 4.4 `lib/i18n.ts` 不能进客户端包

它引了 `next/headers`。客户端组件只能从 **`lib/i18n-shared.ts`** 导入类型和标签。
搞混会直接构建失败（Task E 开始前这个坑已经踩过一次并修复）。

### 4.5 `.lat` 类要保留

中英混排时拉丁片段包 `<span className="lat">`，
它负责字重升一档 + `margin-inline: .25em` 的间隙（中文排版规范 R1/R7）。
换成 `t()` 时不要把这层包裹丢掉。

---

## 5. 验收

```bash
# 1. 界面层零硬编码中文（locales/ 除外）
grep -rnE '>[^<>{}]*[一-鿿]+[^<>{}]*<' app/ components/ --include="*.tsx"
grep -rnE '"[^"]*[一-鿿]+[^"]*"' app/ components/ --include="*.tsx" | grep -v "locales"
#   两条都应为空。注释里的中文不算，只看会渲染的字符串。

# 1b. 接口错误文案也是界面文案 —— 客户端会把 error 直接渲染出来
grep -rnE "error: [\`'\"][^\`'\"]*[一-鿿]" app/api/
#   应为空。第一轮质检就是漏了这条：上面两条只扫 .tsx，
#   而错误串在 .ts 路由里，英文界面照样会显示中文报错。

# 2. 两份字典键完全对齐
python3 -c "
import json
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('缺失:',set(z)-set(e) or '无'); print('多余:',set(e)-set(z) or '无')"

# 3. en.json 里不得有中文
python3 -c "
import json,re
s=open('locales/en.json',encoding='utf-8').read()
m=re.findall(r'[一-鿿]+',s); print('en.json 中文残留:', m or '无')"

# 4. 构建
npx tsc --noEmit && npm run build

# 5. 人工：切到 EN，走一遍 登录 → 盘面 → 机会台 → 录入抽屉，
#    页面上不应出现任何中文字符
```
