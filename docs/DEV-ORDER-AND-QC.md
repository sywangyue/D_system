# 开发顺序与质检协议

**日期**：2026-09-17
**工作方式（Max 定）**：**DS 做，Claude 质检。**
不合格时 Claude **提出问题让 DS 改**，不直接动手；**同一问题 DS 两次没改对，Claude 才接手**。

---

## §1 顺序

| # | 任务 | 规格 | 谁做 | 依赖 |
|---|---|---|---|---|
| 1 | 历史 docx 回填 `intel_report` | `TASK-D-backfill-reports.md` | DS | — |
| 2 | 机会详情页 `/opportunity/[id]` | `TASK-G-opportunity-detail.md` | DS | 1 |
| 3 | 公司库 + 调研库 | `TASK-C-list-detail-pages.md` | DS | 1 |
| 4 | 全站 i18n 接线 | `TASK-E-i18n-wiring.md` | DS | 2, 3 |
| 5 | 8 个端点补测试 | `TASK-F-api-tests.md` | DS | 2, 3 |
| 6 | 展会底图 `/expo` | 待写 TASK-H | DS | — |
| 7 | 设置 / 个人资料收尾 | 待写 TASK-I | DS | 4 |
| 8 | 官网落地页 `/` | 待写 TASK-J | DS | 4 |
| 9 | **配色与 logo 整体重做** | Stitch / Claude Design | **Max 主导** | 8 |
| 10 | 部署上线 | — | Claude + Max | 9 |

### 两处顺序调整的理由

**机会详情提到第 2 位**：Max 每天在用机会台，而点任何一行都进占位页 ——
日常动线是断的。而且它是「挂公司 → 自动带出报告与原始资料」这条价值链
唯一的兑现处，前面所有资源索引工作都指着它。

**i18n 挪到页面做完之后**：一次扫全部页面，比边做边接再返工省。
代价是新页面会先写死中文，但那是机械替换，不是返工。

---

## §2 质检协议

### 2.1 每个任务的质检四步

```
1. 跑该任务规格 §验收 里的每一条命令，逐条记录通过/失败
2. 查该任务规格 §陷阱 里的每一条，确认没踩
3. 跑通用门禁：npx tsc --noEmit && npm run build && npm test
4. 人工看一眼实际页面（有 UI 的任务）
```

### 2.2 通用门禁（任何任务都必须过）

| 检查 | 命令 |
|---|---|
| 类型 | `npx tsc --noEmit` |
| 构建 | `npm run build` —— **Turbopack 告警也算失败** |
| 测试 | `npm test` 与 `python3 -m pytest tests/ -q` |
| 无硬编码色值 | `grep -rnE '#[0-9a-fA-F]{3,8}' app/ components/ --include="*.tsx"` 应为空 |
| 无 Tailwind 内置灰 | `grep -rn 'text-gray-\|bg-white\|bg-gray-' app/ components/` 应为空 |
| 界面不碰品牌橙 | `grep -rn 'color-brand' app/ components/ --include="*.tsx"` 只应命中 `BrandLockup.tsx` |
| 数据未受损 | 对照 §3 基线 |

### 2.3 返工规则

| 情形 | 做法 |
|---|---|
| 首次不合格 | 写明**哪条验收失败、期望值是什么、实际是什么**，交回 DS。不给代码 |
| 第二次仍不合格 | Claude 接手修，并在 commit 里写清 DS 两次未过的原因 |
| **安全或数据丢失类缺陷** | **不走两次规则，Claude 立即修** —— 路径穿越、误删列、写错库这类，多一轮往返就可能把 bug 带上线 |
| DS 发现规格有错 | 以 DS 为准先记录，由 Claude 判定后改规格。任务 B 就是这么发现规格漏写的 |

---

## §3 数据基线（质检时对照）

截至 2026-09-17，库里 14 张表，**全部列在下面**。分两组，验收方式不同。

### 3.1 存量表 —— 任何任务都不该改变它们

```
exhibition_brand      7,401      其中 display_ready=1  7,378
exhibition_edition    7,703
brand_organizer       9,740
brand_geo_tag         8,145
company                 501      494 来自 CIBS2026 批量线索 + 6 家深度尽调标的 + 1
data_provenance       9,825
manual_tag_history   12,302
resource                 50      report 11 / raw 11 / export 16 / roster 10 / note 2
intel_report             13      任务 D 回填 11 份历史 docx 后的值
crawl_log                 7
user                      3      admin / manager / readonly，就这三个
schema_version           17      017 = intel_report.report_type 补 company_research
```

**`user` 必须是 3 行。** 验收要造账号就用现成这三个，或者用 `JWT_SECRET` 自己签一个
令牌（`lib/session.ts` 只认签名，不查建账时间）。往 `user` 表插行的后果是留下一把
不知道密码的钥匙 —— 任务 G 第一轮就是这么漏了一个 `role=admin, is_active=1` 的账号，
而当时的基线里没有 `user`，十一项全对，污染照样漏过去了。

### 3.2 业务表 —— 会随日常使用增长，只核对「变化是否解释得通」

```
opportunity               1
opportunity_event         0
```

这两张是 Max 每天在写的表，不是定值。质检时的要求是：**跑完验收后回到跑之前的值**。
造验收数据用完就删，连同 `opportunity_event` 里的 `stage_change` 一起
（软删除 `is_archived=1` 是给真实机会用的，验收数据要硬删，别留脏行）。

### 3.3 通用规矩

改库前一律 `cp data/mwlab.db data/backups/mwlab_pre-<任务>-$(date +%Y%m%d).db`。

**行数对得上不代表没丢数据** —— 014 迁移就是这么丢过一列的。
**表没列进基线，就等于没人看它** —— 任务 G 的账号污染是这么漏的，所以 3.1 现在是全表。

---

## §4 已知的临时状态（别当 bug 报）

| 项 | 说明 |
|---|---|
| Logo 粗糙 | 2026-09-17 重建，上线前由 Stitch 整体重做 |
| 浅色配色 | 同日由暗转浅，同样待 Stitch 重做 |
| 驻留天数 / 转化率 算不出来 | 需 `stage_change` 事件积累存量，机会台与详情页已在写 |
| `first_year` / `website` 几乎全空 | 历史遗留，无写入方，见 `AGENTS.md` |
| DE 语言缺失 | 待人工翻译，机器翻译的德文界面比英文界面更糟 |
