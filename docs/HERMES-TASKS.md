# Hermes 任务包 · 索引

**日期**：2026-09-17（色板转浅后校准）
**给谁**：hermes + DeepSeek
**背景**：阶段 5 前端实现进行中。5.1–5.4 已完成（token 层 / 登录态 / 盘面 / 机会台）。
本包是剩余工作里**机械、有参照、验收标准客观**的部分。

> ⚠️ **2026-09-17 色板由暗转浅**（Vercel Geist 灰阶），logo 体系一并重建。
> 这两块都是**临时状态**，上线前由 Stitch / Claude Design 整体重做。
> 本包的任务**不要去动配色与 logo**，只用现成 token，改动越少将来返工越小。

---

## 执行顺序（有依赖，别跳）

| # | 任务 | 文件 | 依赖 | 估时 |
|---|---|---|---|---|
| **D** | 历史 docx 回填 `intel_report` | `docs/TASK-D-backfill-reports.md` | 无 | 0.5 天 |
| **E** | 全站 i18n 接线 | `docs/TASK-E-i18n-wiring.md` | 无 | 1 天 |
| **C** | 公司库 + 调研库 列表与详情页 | `docs/TASK-C-list-detail-pages.md` | **E**（新页面要按 E 的模式写，否则得返工） | 1.5 天 |
| **F** | 8 个新 API 端点补测试 | `docs/TASK-F-api-tests.md` | C（含 C 新增页面的冒烟） | 1 天 |

> **D 先跑的理由**：调研库现在只有 2 条记录，其中 1 条报告正文是空的。
> `reports/` 下躺着 11 份 docx 没入库。D 做完，C 的调研库页面才有真东西可展示，
> 否则做出来看不出对错 —— 这和先做机会台再做盘面是同一个道理。

---

## 通用铁律（四个任务都适用）

1. **动手前读参照实现**，不要重新发明：
   - 页面：`app/opportunity/pipeline.tsx`（一阶列表）、`app/overview/page.tsx`（服务端聚合页）
   - 接口：`app/api/opportunity/route.ts`、`app/api/opportunity/[id]/route.ts`
   - 规格：`docs/API-SPEC-PHASE4.md`
2. **颜色只用 token**。`app/globals.css` 是唯一真源。
   代码里**不得出现任何十六进制色值**，也不得用 Tailwind 内置的
   `text-gray-*` / `bg-white` / `bg-gray-*` —— 它们不跟随主题，
   2026-09-17 由暗转浅时就是靠 token 才能一次改完。
3. **橙色只属于 logo**。`--color-brand`（#fe5c00）目前只被
   `components/brand/BrandLockup.tsx` 使用，**界面里不要碰它**。
   UI 的主操作色是 `--color-accent`（#171717 近黑，浅场上的主按钮），
   需要强调时用 `text-fg` 或提升底色，不要引入第二种彩色。
4. **文字四档，别只用两档**：
   `text-fg`（标题主数据）→ `text-fg-muted`（正文表格单元）→
   `text-fg-subtle`（表头标签提示）→ `text-fg-faint`（最弱元信息，慎用）。
   少一档就会出现「只能在太重和看不见之间二选一」，此前踩过。
5. **每改一处都要能跑**：`npx tsc --noEmit` 与 `npm run build` 必须零错误零告警。
   Turbopack 的告警也算错误（见 `app/api/resource/[id]/download/route.ts` 顶部注释里
   踩过的 NFT 追踪坑）。
6. **数据库改动一律先在副本上跑**，逐字段与备份比对。
   行数对得上不代表没丢数据 —— 014 迁移就是这么丢过一列的
   （详见 `schema/migrations/015_restore_report_link.sql` 的注释）。

---

## ⛔ 不在本包内（Claude 来做）

| 项 | 为什么不下放 |
|---|---|
| 5.5 机会详情页 | 「关联公司 → 自动带出报告与原始数据」这条价值链的兑现处，四个 tab 的信息层级要现场判断 |
| 5.7 展会底图 | d3 地图投影 + 行动日历，复杂度高且设计稿细节多 |
| 5.8 官网落地页 | 纯设计判断 |
| 橙色点位落地 | 等 Max 指定位置 |
| 任何 schema 迁移的**设计** | 迁移脚本可以写，但改哪些列、为什么改，由 Claude 定 |

---

## 交付方式

每个任务独立提交，commit message 写清楚：
改了什么、为什么、验收结果、以及**做的过程中发现的与规格不符之处**。

最后一条很重要：任务 B 的实际价值有一半来自 DeepSeek 发现了规格漏写的一点
（那三张表没有基础谓词，`where` 数组为空时 `WHERE` 子句会是空串导致语法错）。
**遇到规格和代码对不上，先记下来，不要默默绕过。**
