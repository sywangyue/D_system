# 任务 K · 知识库 `/knowledge`

**前置**：E（i18n 接线）—— **这一页从第一行就按字典写，不留中文硬编码**。
E 之前的页面是先写死中文再回头接线，K 晚于 E，没有这个借口。
**参照实现**：`app/research/page.tsx` + `app/research/[id]/research-detail.tsx`
（服务端壳取 locale/dict → 客户端渲染 Markdown），`app/api/resource/[id]/download/route.ts`（路径安全）
**验收**：见 §7

---

## 1. 这一页是什么

Max 已完成项目的档案：并购 / 收购 / 新品类开拓等。**一个项目一条**，
内容是 **项目背景 + 流程 + 结果**，配图片和文档。

规模是这个任务所有设计决定的依据：**现在 3 条，上限 20 条，超过 20 条 Max 自己存档。**

所以——

| 不要做 | 为什么 |
|---|---|
| 不建数据库表 | 20 条记录不值得一张表 + 一次迁移 + 一套 CRUD 接口 |
| 不写录入表单 / 富文本编辑器 | Max 直接写 Markdown 文件，仓库里已经全是这个习惯 |
| 不写索引脚本 | 页面直接读目录，省掉「改完内容忘了重跑脚本」这类故障 |
| 不做分页 | 20 条一屏放得下 |
| 不做筛选条 | 同上。列表只有一个「显示已归档」的开关 |
| 不跟公司库 / 机会台关联 | Max 已定：独立一页。这三个项目本来就不在 `opportunity` 表里 |

**这是本仓库唯一一个「文件即数据源」的页面。** 别照着公司库/调研库那套
「接口分页 + 客户端取数」写，那是为 501 条和 13 条设计的，这里用不上。

---

## 2. 目录约定

内容分两处放，**分界线只有一条：图片是公开的，其余都不是。**

```
knowledge/<slug>/                    ← 不对外，服务端读
  index.md                             必需。frontmatter + 正文
  docs/
    2024-协议签署版.pdf                 内部文件（合同、估值表），走 /api 下载

public/knowledge/<slug>/             ← 公开静态目录，Next 直接发
  images/
    01-site.jpg
    02-signing.png
```

### 为什么图片能公开、正文和文档不能

图片是**展会现场照片，本身就是开放数据**（Max 2026-09-17 确认），
放 `public/` 由 Next 静态发出，省掉一整个端点。

但要清楚这意味着什么：**`public/` 下的文件不经过 `proxy.ts` 中间件**，
拿到 URL 不登录就能取。页面受登录保护 ≠ 页面里引用的静态文件受保护。

所以 `index.md`（项目背景/流程/结果的正文）和 `docs/`（合同、估值表）
**一律不许进 `public/`**。判断标准就一句：**能被陌生人看到也无所谓的，才放 public/。**

### slug 与跳过规则

- **目录名即 slug**，URL 是 `/knowledge/2024-litai-acquisition`。
- 只允许 `[a-z0-9-]`，不符合的目录直接跳过（别报错，别渲染）。
  这条规则顺带让 `_example/` 之类下划线开头的目录自动隐身。
- 没有 `index.md` 的目录跳过。
- `docs/` 与 `public/knowledge/<slug>/images/` 都是可选的。

### index.md 的 frontmatter

```markdown
---
title: 励泰展览并购
title_en: Litai Exhibition Acquisition
type: ma
year: 2024
status: active
summary: 从初次接洽到交割用了 11 个月，核心是把六个同名展会的主体关系问清楚。
summary_en: Eleven months from first contact to closing; the crux was untangling six same-named shows.
cover: images/01-site.jpg
---

## 项目背景
……

## 流程
……

## 结果
……
```

| 字段 | 必需 | 说明 |
|---|---|---|
| `title` | ✅ | 中文标题 |
| `title_en` | — | 缺了就回退 `title`（英文界面下显示中文标题，好过显示空） |
| `type` | ✅ | **复用已有业务线枚举**：`ma` / `greenfield` / `project_support`。标签走 `bizLineLabel(t, type)`，别自己写映射 |
| `year` | ✅ | 四位数字，列表按它倒序 |
| `status` | — | `active`（默认）/ `archived`。缺省按 `active` |
| `summary` / `summary_en` | — | 列表卡片上的一行说明 |
| `cover` | — | 写 `images/xxx.jpg`，与正文插图同一种写法。缺了列表卡片就不出图 |

**正文的三个小标题（项目背景 / 流程 / 结果）由 Max 自己在 Markdown 里写 `##`，
不要在代码里硬编码这三段结构。** 他说了「包括且不限于」，结构不稳定，
写死成三个字段等于逼他以后每加一种内容就来改代码。

### frontmatter 怎么解析

装 `gray-matter`，别手写 YAML 解析。

手写的话要处理引号、冒号、中文、多行、注释，写出来五十行还漏边界；
`gray-matter` 是这件事的标准件。**在 commit 里写明新增了依赖**（同任务 C 的 `react-markdown`）。

> 考虑过用 `meta.json` 避免这个依赖，否决了：Max 手写 JSON 要对付尾逗号和引号转义，
> 比 YAML frontmatter 难用，而且元数据和正文分两个文件，改一个项目要开两次。

---

## 3. 要写的文件

| 文件 | 作用 |
|---|---|
| `lib/knowledge.ts` | 扫目录、解析 frontmatter、返回列表 / 单条。**服务端专用**，用 `fs` |
| `app/knowledge/page.tsx` | 列表页（服务端组件，直接调 `lib/knowledge.ts`，不发 HTTP） |
| `app/knowledge/[slug]/page.tsx` | 详情页（同上） |
| `app/knowledge/[slug]/knowledge-body.tsx` | 客户端组件，只负责渲染 Markdown（`react-markdown` 是客户端库） |
| `app/api/knowledge/[slug]/doc/[...path]/route.ts` | **只管 `docs/` 下的文件**下载 |
| `components/layout/Sidebar.tsx` | 加一个导航项 |
| `locales/zh.json` + `locales/en.json` | 新增 `knowledge` 段与 `nav.knowledge` |
| `docs/DEPLOY.md` | 补两条 rsync（见 §5.4） |
| `knowledge/_example/index.md` | 写满所有字段的模板，给 Max 新建项目用 |

**图片没有对应的端点** —— 它在 `public/` 下，Next 自己发。

服务端页面直接调 `lib/knowledge.ts`，**不要为它建 `/api/knowledge` 列表接口** ——
页面和数据在同一个进程里，套一层 HTTP 只是给自己发请求（`lib/queries/overview.ts`
的注释里写过这件事）。

---

## 4. 页面

### 4.1 列表 `/knowledge`

一屏卡片网格，按 `year` 倒序、同年按 `title` 排。每张卡片：

```
┌──────────────────────────┐
│  cover 图（有就出，16:9） │
│  2024   并购标的          │   ← year + type 徽标
│  励泰展览并购             │   ← title
│  从初次接洽到交割用了…     │   ← summary，两行截断
└──────────────────────────┘
```

- 默认只显示 `status: active`。顶栏右侧一个「显示已归档」开关，打开才带出 `archived`。
- 空态一个就够：`knowledge/` 下没有合法项目时显示「还没有项目」。
  **不需要**「筛选无结果」态 —— 没有筛选条。

### 4.2 详情 `/knowledge/[slug]`

```
← 返回知识库
标题 · year 徽标 · type 徽标 ·（archived 时多一个「已归档」徽标）
─────────────────────────────────────────┬──────────────
正文（prose-cjk + react-markdown + GFM）   │  文档下载列表
                                          │  （docs/ 下的文件）
```

- 正文容器用 `prose-cjk`，与调研库详情同一套（`globals.css` 里任务 C 已经把
  表格/列表/引用/代码都接到令牌层了，不用再补样式）。
- 右栏列 `docs/` 下的文件：文件名 + 大小 + 下载按钮。
  **不要复用 `components/resource/ResourceList`** —— 那个组件吃的是 `resource`
  表的行（有 `resource_id` / `kind` / `collected_at`），知识库的文档是文件系统里的
  裸文件，没有这些字段。硬套要么造假数据要么改坏共用组件。这里写一个简单的列表即可。
- `docs/` 为空或不存在时整块不渲染。
- slug 不存在 → `notFound()`（真 404，与 `/opportunity/[id]` 一致）。

---

## 5. ⚠️ 五个陷阱

### 5.1 Markdown 里的图片路径必须重写

Max 在 `index.md` 里会这么写：

```markdown
![签约现场](images/02-signing.png)
```

`react-markdown` 直接输出 `<img src="images/02-signing.png">`，浏览器按当前 URL
`/knowledge/<slug>` 解析成 `/knowledge/images/02-signing.png` —— **404，图全裂**。
图片的真实位置是 `public/knowledge/<slug>/images/02-signing.png`，
对外 URL 是 `/knowledge/<slug>/images/02-signing.png`。

用 `react-markdown` v10 的 `urlTransform` 改写：

```
images/02-signing.png  →  /knowledge/<slug>/images/02-signing.png
```

只改写相对路径。`http://` `https://` `/` `data:` 开头的原样放行。
`cover` 字段在列表页也要过同一次改写。

> 注意这里有个巧合要防：页面路由是 `/knowledge/[slug]`，图片 URL 是
> `/knowledge/<slug>/images/...`，两者前缀相同但图片走的是 `public/` 静态文件，
> 不会命中 `[slug]` 路由（Next 的静态文件优先级更高）。**验收时必须真的在浏览器里
> 看到图**，别只看 HTML 里 src 拼对了就算过。

### 5.2 只有图片能进 `public/`

`index.md` 和 `docs/` 留在 `knowledge/` 下，不许挪进 `public/`。
理由见 §2 —— `public/` 不经中间件，进去就等于公开发布。

`lib/knowledge.ts` 扫目录时也**只扫 `knowledge/`**，不要去读 `public/`
判断图片存不存在。`cover` 指向的图丢了就是浏览器出裂图，不值得为此多一次 IO；
真要防，在卡片上给 `<img onError>` 兜一下即可。

### 5.3 文档端点的路径拼接照现成的写法抄

先说清楚**不需要**做什么：登录这关 `proxy.ts` 已经全局做完了，
页面 307 跳登录、`/api/*` 直接 401，实测伪造 `x-user-role` 头也会被中间件剥离。
所以这个端点里的 `requireUser` 只是跟其余 14 个路由保持一致的一行，
**不是第二道登录门，别按「鉴权功能」去设计**。

需要做的只有一件：`[...path]` 是**从 URL 里来的字符串**，
你无论如何都得写一个函数把它变成磁盘路径 —— 这个函数必须存在，不写就没有下载功能。
拒绝 `..` 只是这个函数里的一个 `if`，不是外面再加一层。
少写它不会让代码变简单，只会让 `..%2f..%2f.env.local` 也能拼出去，
而 `.env.local` 里是 `JWT_SECRET` 和企查查密钥。

照 `app/api/resource/[id]/download/route.ts` 里 `resolveSafe()` 的思路写：

- 在**字符串层**就拒绝：绝对路径、任一段是 `..` 或 `.`，直接 return null；
- 不要「先 join 再回头比前缀」；
- `path.join` 的根目录必须是**字面量**（`path.join(process.cwd(), 'knowledge', ...)`），
  否则 Turbopack 的文件追踪收敛不了，会把整个仓库打进部署产物
  （构建报 `Encountered unexpected file in NFT list`，那个文件的注释里写了原委）;
- **slug 本身也是路径的一段，同样要校验**，别只校验 `[...path]`；
- 只允许落在 `knowledge/<slug>/docs/` 里，越到 `index.md` 也算越界。

响应 `Content-Disposition: attachment`，中文文件名照那个文件里的 RFC 5987 写法
（`filename*` + ASCII 回退），别再踩一遍。

### 5.4 两个新目录都要单独部署

`docs/DEPLOY.md` 的 rsync 是列举式的，只同步 `.next/` 和爬虫目录。
本任务新增**两个**目录，**都不加进去的话线上这一页是空的、图是裂的**：

```
knowledge/           → 正文与文档
public/knowledge/    → 图片
```

照 `crawlers/` 那两条 rsync 的格式补进 DEPLOY.md。

### 5.5 `title` / `summary` / 正文是数据，不进字典

与 `TASK-E §4.1` 同一条规矩：公司名、报告标题、机会名称原样显示。
知识库的 `title` / `summary` / 正文同理 —— 它们有 `_en` 变体是因为 Max 自己写了两份，
不是翻译层的事。**界面文案**（「返回知识库」「显示已归档」「还没有项目」「文档」）
才进 `locales/*.json`。

`type` 是闭集，走 `bizLineLabel(t, type)`，字典里已经有 `enum.bizLine`，别新增一份。

---

## 6. 建目录时顺手做的事

仓库里 `knowledge/` 与 `public/knowledge/` 都还不存在。建 `knowledge/_example/`
（下划线开头，按 §2 的 slug 规则会被自动跳过，不会出现在页面上），
里面放一份写满所有 frontmatter 字段的 `index.md`，当作 Max 新建项目时的模板。

真实项目内容由 Max 自己写，**不要编造三个项目的内容填进去**。

---

## 7. 验收

```bash
npx tsc --noEmit && npm run build    # 零错误零告警

# 造两个测试项目（验收后删掉）
mkdir -p knowledge/test-alpha/docs public/knowledge/test-alpha/images
mkdir -p knowledge/test-beta
# test-alpha: status 缺省、带 cover、正文里插一张图、docs/ 放一个 pdf
# test-beta:  status: archived

curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge            # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge/test-alpha # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge/nope       # 404

# 图片：公开静态，不登录也能取（这是设计如此，不是缺陷）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  localhost:3000/knowledge/test-alpha/images/01.jpg        # 200 image/jpeg

# 文档：要登录
curl -s -o /dev/null -w "%{http_code}\n" \
  'localhost:3000/api/knowledge/test-alpha/doc/x.pdf'      # 401
curl -s -D - -o /dev/null -b "session=$T" \
  'localhost:3000/api/knowledge/test-alpha/doc/x.pdf' | grep -i 'content-disposition'
#   应为 attachment

# 路径穿越必须挡住（五条全部非 200）
for p in '../index.md' '../../.env.local' '..%2f..%2f.env.local' 'a/../../../.env.local' '/etc/passwd'; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" -b "session=$T" \
    "localhost:3000/api/knowledge/test-alpha/doc/$p"
done
# slug 也要试：localhost:3000/api/knowledge/..%2f..%2f/doc/x.pdf
```

人工检查：

- 列表默认看不到 `test-beta`，打开「显示已归档」才出现
- **详情页正文里的插图在浏览器里真的显示出来了**（§5.1），不是裂图
- 右栏文档点了下载到的是文件
- 切 EN：界面文案全英文，项目标题按 `title_en`（没写就回退中文标题），正文原样中文
- `knowledge/_example/` 不出现在列表里

```bash
# 清理
rm -rf knowledge/test-alpha knowledge/test-beta public/knowledge/test-alpha
```

**最关键的两条**：正文插图在浏览器里能显示（§5.1），以及 `docs/` 端点挡得住路径穿越（§5.3）。
任一条不过，整个任务视为未完成。

---

## 8. 与顺序表的关系

本任务在 `DEV-ORDER-AND-QC.md` §1 里是**新增项**，插在 E 之后。
与 F（8 个端点补测试）无依赖，可以并行；但 F 的测试范围要把
`/api/knowledge/[slug]/doc` 的路径穿越加进去 —— 那是本仓库
第二个直接读文件系统的端点，值得有回归测试。
