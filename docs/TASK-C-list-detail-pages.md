# 任务 C · 公司库 + 调研库（列表与详情页）

**前置**：E（i18n 接线）先做完 —— 新页面直接按 E 的模式写，否则 E 还得回头返工
**参照实现**：`app/opportunity/pipeline.tsx`（一阶列表）、`app/overview/page.tsx`（服务端聚合页）
**接口**：`/api/company`、`/api/company/[id]`、`/api/research`、`/api/research/[id]` **均已就绪**
**验收**：见 §6

**动手前把参照实现完整读一遍。本任务是照它套，不是重新设计。**

---

## 1. 要写的文件（4 个）

| 文件 | 替换 |
|---|---|
| `app/company/page.tsx` | 现在的 `Placeholder` 占位 |
| `app/company/[id]/page.tsx` | 新建 |
| `app/research/page.tsx` | 现在的 `Placeholder` 占位 |
| `app/research/[id]/page.tsx` | 新建 |

列表页若需要交互（筛选/分页/搜索），拆成 `page.tsx`（服务端壳）+
`xxx-list.tsx`（客户端），与机会台的 `page.tsx` + `pipeline.tsx` 同构。

---

## 2. 公司库

### 2.1 列表 `/company`

```
一阶列（只要这 5 列，不要加）
  公司名称 · 类型 · 经营状态 · 城市 · 更新时间

筛选   type / company_status / source_type
搜索   q（打到 name 与 credit_code）
排序   updated_at(默认) / name / prospect_score
分页   size 50
```

基线：**501 条**。其中 494 条来自 CIBS2026 展商批量线索，
6 条是做过深度尽调的标的（励泰两家 / 华尔科技 / 杭州川方至 / 仁然 / 奥利弗）。

### 2.2 详情 `/company/[id]`

接口一次返回五块，全都要落到页面上：

```json
{ "company":{...}, "brand":{...|null}, "resources":[...],
  "opportunities":[...], "reports":[...] }
```

| 区块 | 内容 |
|---|---|
| 头部 | 公司名 + 类型徽标 + 经营状态 |
| 工商信息 | 统一社会信用代码 / 法定代表人 / 成立日期 / 注册号 / 注册地址 / 邮箱 |
| **资源** | `resources[]`，按 `collected_at` 倒序。每行：kind 徽标、标题、大小、采集时间、**下载按钮** |
| 关联机会 | `opportunities[]`，一阶字段，点击进 `/opportunity/[id]` |
| 关联报告 | `reports[]`，点击进 `/research/[id]` |
| 关联展会品牌 | `brand`，为 null 时整块不渲染 |

**资源区是这个页面的重点**。下载链接直接指向：

```
/api/resource/{resource_id}/download
```

用 `<a href download>`，不要用 fetch 再 createObjectURL —— 那会把整个文件读进内存。

---

## 3. 调研库

### 3.1 列表 `/research`

```
一阶列   标题 · 类型 · 状态 · 关联公司 · 更新时间
         外加 excerpt 作为列表项下的一行摘要（接口已返回）
筛选     report_type / status / company_id
搜索     q（打到 title 与 target_company）
```

`report_type` 的中文映射：

```
batch_prospect     批量线索
industry_research  行业调研
company_research   公司尽调
```

### 3.2 详情 `/research/[id]`

```json
{ "report":{...含完整 report_md}, "company":{...|null}, "resources":[...] }
```

- **`report_md` 用 Markdown 渲染**，容器加 `className="prose-cjk"`
  （中文排版规范 R3：长文行高 1.8，已在 `globals.css` 里定义好）
- 渲染库用 `react-markdown` + `remark-gfm`（表格）。
  **先检查 `package.json` 有没有；没有就装，并在 commit 里说明新增了依赖。**
- 右栏：关联公司卡片 + `resources[]` 下载列表
- `report_md` 为空时显示空状态，不要渲染成一片空白

---

## 4. ⚠️ 六个陷阱

### 4.1 主键名各不相同

```
company       → company_id
intel_report  → id          ← 调研库用的是裸 id
opportunity   → opp_id
resource      → resource_id
```

路由参数、key、跳转链接逐处核对，不要一路复制。

### 4.2 `company` 与 `intel_report` 没有 `is_archived`

机会台的每条查询都带 `WHERE is_archived = 0`，这两张表**没有这一列**。
照抄会 `no such column`。也**不要**给它们做删除按钮。

### 4.3 一阶绝不能出现 `report_md`

`intel_report.report_md` 可达几万字。列表页只用接口返回的 `excerpt`
（已经是 `SUBSTR(report_md,1,160)`）。
**不要自己再去请求详情接口来拼列表**。

### 4.4 下载链接不要做成 fetch + blob

见 §2.2。`/api/resource/[id]/download` 返回的是文件流，
浏览器原生下载即可。中文文件名的 `Content-Disposition` 已经按 RFC 5987 处理过了。

### 4.5 空状态不要省

四个页面都要有：加载骨架 / 空列表 / 筛选无结果 / 加载失败带重试。
参照 `pipeline.tsx` 里的 `Empty` 组件，直接复用它的形态。
**`/company` 有 501 条不会空，但 `/research` 在任务 D 跑之前只有 2 条**，
筛选一下就空了。

### 4.6 不要动配色与 logo

色板刚由暗转浅、logo 体系刚重建，两者**上线前都要由 Stitch 整体重做**。
只用现成 token，不要新增颜色、不要改 `BrandLockup`。

---

## 5. 与 5.5 的边界

`/opportunity/[id]` 机会详情**不在本任务内**，Claude 来做。
但公司详情里的「关联机会」要能跳过去 —— 那个占位页已经存在，跳过去不会 404。

---

## 6. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警

# 起服务后（T 为 admin session token）
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/company     # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/research    # 200

# 公司详情：取一个有资源的（上海励泰，company_id 见下）
CID=$(sqlite3 data/mwlab.db "SELECT company_id FROM company WHERE name='上海励泰展览服务有限公司'")
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/company/$CID  # 200
#   页面上应能看到 2 份资源（1 docx + 1 json）且下载按钮可点

# 下载确实是文件流，不是 HTML
RID=$(sqlite3 data/mwlab.db "SELECT resource_id FROM resource WHERE file_path LIKE '%上海励泰%.docx'")
curl -s -D - -o /tmp/t.docx -b "session=$T" localhost:3000/api/resource/$RID/download | grep -i content-type
#   应为 application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

人工检查：
- 列表页字段数与 §2.1 / §3.1 完全一致，**没有多塞列**
- 调研库详情的 Markdown 正文容器带 `prose-cjk`
- 切到 EN 后页面无中文（依赖任务 E 已完成）
