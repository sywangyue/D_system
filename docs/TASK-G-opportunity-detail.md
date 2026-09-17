# 任务 G · 机会详情页 `/opportunity/[id]`

**前置**：D（回填后关联报告才有内容）
**参照**：`app/overview/page.tsx`（服务端聚合页）、`design/MWLAB 六屏精修稿.dc.html` 第 5 屏
**接口**：`/api/opportunity/[id]` **已就绪，六块数据一次返回**
**替换**：现在的 `Placeholder` 占位

**这是全系统价值链的兑现处**：机会挂上公司 → 该公司名下的调研报告与
企查查原始数据自动出现在这里。做砸了，前面所有资源索引工作都白做。

---

## 1. 接口返回

```json
{
  "opportunity": { …全字段，detail_json 已解析成对象… },
  "company":     { …关联公司全字段，可为 null… },
  "brand":       { …关联展会品牌 + 最新一届数据，可为 null… },
  "resources":   [ { resource_id, kind, title, file_path, mime, size_bytes, collected_at, source } ],
  "events":      [ { event_id, event_type, content, file_path, occurred_at, created_by, created_at } ],
  "reports":     [ { id, title, report_type, status, updated_at } ]
}
```

**`resources` 里既有直接挂在本机会上的，也有挂在其关联公司上的** ——
接口已经合并好了，页面直接渲染，不要再过滤。

---

## 2. 页面结构

```
┌ 返回机会台
├ 头部：标题 · 业务线徽标 · 五档阶段步进器 · 负责人 · 下一步(带到期日)
├─────────────────────────────────────────────────────┬──────────────┐
│ 左栏 65%：四个 tab                                   │ 右栏 35%     │
│   概览 / 深度调研 / 时间线 / 关联展会                 │  关联公司    │
│                                                      │  对标 MD 品牌 │
│                                                      │  规模数据     │
│                                                      │  资源下载列表 │
└──────────────────────────────────────────────────────┴──────────────┘
```

### 2.1 头部

- 标题 24px；`type` 徽标用中文（并购标的 / 全新品类 / 项目组支持）
- **五档阶段步进器**：contact → intent → dd → audit → closing，当前档高亮。
  用中性色，**不要用 `--color-brand`**（那是 logo 专用）
- 阶段可点击直接推进，调 `PATCH /api/opportunity/[id]`，
  成功后 `router.refresh()`。机会台的行内改阶段已经是这个做法，照它
- 下一步 + 到期日；逾期用 `--color-error-text`

### 2.2 左栏 tab

| tab | 内容 | 空态 |
|---|---|---|
| **概览** | `detail_json` 按 `type` 展开：ma 显示对价区间/股权比例/评估基准日；greenfield 显示市场规模/现有玩家/可行性；project_support 显示需求方/交付物 | 「尚未填写详细信息」 |
| **深度调研** | `reports[]` 列表，点开进 `/research/[id]` | 「还没有关联的调研报告」+ 说明「挂上公司后会自动带出该公司名下的报告」 |
| **时间线** | `events[]` 倒序。`stage_change` 显示为「接洽 → 意向」，`note`/`meeting`/`file` 各有形态 | 「还没有记录」 |
| **关联展会** | `brand` 的品牌名/城市/主办方/行业 + 最新一届的面积/展商/观众 | `brand` 为 null 时整个 tab 隐藏，不要显示空 tab |

### 2.3 右栏

- **关联公司**：公司名 / 统一社会信用代码 / 法定代表人 / 成立日期 / 经营状态。
  为 null 时显示「未关联公司」+ 一句「关联后可自动带出其调研报告与原始数据」
- **规模数据**：`brand` 的面积 / 展商 / 观众三个数，用 `.num` 等宽
- **资源**：`resources[]` 按 `collected_at` 倒序。每行 kind 徽标 + 标题 + 大小 + 下载。
  下载用 `<a href="/api/resource/{id}/download" download>`，
  **不要 fetch + createObjectURL**（会把整个文件读进内存）

---

## 3. ⚠️ 六个陷阱

### 3.1 `detail_json` 已经是对象

接口出口已经 `JSON.parse` 过了，**不要再 parse 一次**。
脏数据时接口会降级成 `{}`，页面按空处理即可。

### 3.2 三个业务线的 `detail_json` 键不同

```
ma               valuation_range · equity_pct · baseline_date · ebitda · audit_confidence
greenfield       market_size · existing_players · dead_brand_ids · feasibility
project_support  requester · deliverable · partner_company_ids
```

按 `opportunity.type` 分支渲染，缺失的键跳过不显示，**不要显示 undefined**。

### 3.3 `type` 与 `deal_type` 是两个维度

`type` 是业务线（决定 tab 与 detail_json 结构），
`deal_type`（收购/并购/参股/承办/孵化）**只对 `type='ma'` 有意义**，
其余业务线为 null。不要混用，也不要给 greenfield 显示交易形式。

### 3.4 阶段推进必须走 PATCH

不要直接写库、不要用别的端点。
`PATCH /api/opportunity/[id]` 会**自动写一条 `stage_change` 事件** ——
那是日后计算阶段驻留天数与转化率的唯一数据源，绕过就等于永久丢数据。

### 3.5 软删除不是硬删

若做归档按钮，调 `DELETE /api/opportunity/[id]`，它是软删除
（`is_archived=1`）。**不要**做物理删除入口 —— 机会记录着尽调过程，
删了会连带丢掉 `opportunity_event` 里的时间线。

### 3.6 不要动配色与 logo

色板刚由暗转浅、logo 刚重建，两者上线前由 Stitch 整体重做。
只用现成 token，不新增颜色，不碰 `--color-brand`。

---

## 4. 验收

```bash
npx tsc --noEmit && npm run build    # 零错误零告警

# 造一条挂了公司的机会（上海励泰名下有 2 份资源）
CID=$(sqlite3 data/mwlab.db "SELECT company_id FROM company WHERE name='上海励泰展览服务有限公司'")
curl -s -b "session=$T" -X POST localhost:3000/api/opportunity \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"ma\",\"title\":\"验收用\",\"stage\":\"dd\",\"company_id\":$CID}"

# 打开详情页，必须同时看到：
#   右栏「关联公司」显示 上海励泰展览服务有限公司 / 桂芳金 / 存续
#   右栏「资源」列出 2 份（1 docx + 1 json），下载按钮可点且下到的是文件不是 HTML
#   深度调研 tab 列出该公司的报告（任务 D 回填后应有 1 份）

# 阶段推进会留痕
curl -s -b "session=$T" -X PATCH localhost:3000/api/opportunity/{id} \
  -H 'Content-Type: application/json' -d '{"stage":"audit"}'
sqlite3 data/mwlab.db "SELECT event_type, content FROM opportunity_event ORDER BY event_id DESC LIMIT 1"
#   应为 stage_change | dd → audit

# 清理验收数据
sqlite3 data/mwlab.db "DELETE FROM opportunity_event WHERE opp_id=(SELECT opp_id FROM opportunity WHERE title='验收用'); DELETE FROM opportunity WHERE title='验收用';"
```

**最关键的一条**：挂了公司的机会，详情页必须能看到该公司的资源并下载成功。
这条不过，整个任务视为未完成。
