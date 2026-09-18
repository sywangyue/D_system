# 质检协议与数据基线

**工作方式（Max 定）**：**DS 做，Claude 质检。** 不合格时 Claude 写返工单交回 DS，不给代码；
同一问题 DS 两次没改对，Claude 接手；**安全与数据丢失类缺陷 Claude 立即修**。
Max 可以对单次质检授权「有问题直接修」。

历次质检与返工的结果记在 `HISTORY.md`；原始任务规格与返工单在 `archive/V2-task-specs.md`。

## 1. 质检协议

### 1.1 每个任务的质检四步

```
1. 跑该任务规格 §验收 里的每一条命令，逐条记录通过/失败
2. 查该任务规格 §陷阱 里的每一条，确认没踩
3. 跑通用门禁：npx tsc --noEmit && npm run build && npm test
4. 人工看一眼实际页面（有 UI 的任务）
```

### 1.2 通用门禁（任何任务都必须过）

| 检查 | 命令 |
|---|---|
| 类型 | `npx tsc --noEmit` |
| 构建 | `npm run build` —— **Turbopack 告警也算失败** |
| 测试 | `npm test` 与 `python3 -m pytest tests/ -q` |
| 无硬编码色值 | `grep -rnE '#[0-9a-fA-F]{3,8}' app/ components/ --include="*.tsx" \| grep -v '//\|\*' \| grep -v LoginBackdrop` 应为空 |
| 无 Tailwind 内置灰 | `grep -rn 'text-gray-\|bg-white\|bg-gray-' app/ components/` 应为空 |
| 品牌橙只进「门面」 | `grep -rln 'color-brand\|bg-brand' app/ components/ --include="*.tsx"` 只应命中 `BrandLockup.tsx`、`login-form.tsx` |

> **第一条加了两个过滤**（2026-09-18）：`grep -v '//\|\*'` 排掉注释里提到的历史色值
> （当时 7 处命中全是注释）；`grep -v LoginBackdrop` 排掉登录页那张等距几何插画 ——
> 它的几十个灰阶是插画自身的明暗关系，不是设计令牌，而且渐变 defs 被四块图形共享，
> 拆成独立 .svg 就得复制四份。
>
> **第三条从「界面不碰品牌橙」收窄为「只进门面」**（2026-09-18，V2-18）：
> 登录页是「门」，用品牌色立身份是对的；每天盯 8 小时的产品界面内部保持中性也是对的。
> 所以橙色允许出现在 Logo、登录页、落地页，**产品界面内部（盘面 / 机会台 / 公司库 /
> 调研库 / 知识库 / 展会底图）一律不许**。登录页的橙只在背景几何体与 Logo，
> 主按钮仍是黑白高对比 —— 页面上唯一的主操作不跟背景抢。
| 数据未受损 | 对照 §3 基线 |

### 1.3 返工规则

| 情形 | 做法 |
|---|---|
| 首次不合格 | 写明**哪条验收失败、期望值是什么、实际是什么**，交回 DS。不给代码 |
| 第二次仍不合格 | Claude 接手修，并在 commit 里写清 DS 两次未过的原因 |
| **安全或数据丢失类缺陷** | **不走两次规则，Claude 立即修** —— 路径穿越、误删列、写错库这类，多一轮往返就可能把 bug 带上线 |
| DS 发现规格有错 | 以 DS 为准先记录，由 Claude 判定后改规格。任务 B 就是这么发现规格漏写的 |

---

## 2. 数据基线（质检时对照）

截至 **2026-09-18**（补跑 pipeline `auto-20260918` 之后），库里 14 张表，
**全部列在下面**。分两组，验收方式不同。

### 2.1 存量表 —— 任何任务都不该改变它们

```
exhibition_brand      7,475      其中 display_ready=1  7,452（23 条待补全）
exhibition_edition    7,778
brand_organizer       9,740      不随 pipeline 增长，见 AGENTS.md
brand_geo_tag         8,145
company                 501      494 来自 CIBS2026 批量线索 + 6 家深度尽调标的 + 1
data_provenance       9,906
manual_tag_history   12,302
resource                 50      report 11 / raw 11 / export 16 / roster 10 / note 2
intel_report             13      V2-06 回填 11 份历史 docx 后的值
crawl_log                 8      每跑一次 pipeline +1
user                      3      admin / manager / readonly，就这三个
schema_version           17      017 = intel_report.report_type 补 company_research
```

> **展会四表（brand / edition / provenance 与 raw 库）每月 7/27 号 cron 跑完就会变**，
> 它们「不该改变」的意思是**任务不该改变它们**，不是「永远是这些数字」。
> 对不上先问一句「中间跑过 pipeline 吗」，看 `crawl_log` 最后一条的批次号和日期 ——
> 是 `auto-<日期>` 就属正常增长，照 `logs/pipeline_*.log` 的合并统计核对增量。

**`user` 必须是 3 行。** 验收要造账号就用现成这三个，或者用 `JWT_SECRET` 自己签一个
令牌（`lib/session.ts` 只认签名，不查建账时间）。往 `user` 表插行的后果是留下一把
不知道密码的钥匙 —— 任务 G 第一轮就是这么漏了一个 `role=admin, is_active=1` 的账号，
而当时的基线里没有 `user`，十一项全对，污染照样漏过去了。

### 2.2 业务表 —— 会随日常使用增长，只核对「变化是否解释得通」

```
opportunity               1
opportunity_event         0
```

这两张是 Max 每天在写的表，不是定值。质检时的要求是：**跑完验收后回到跑之前的值**。
造验收数据用完就删，连同 `opportunity_event` 里的 `stage_change` 一起
（软删除 `is_archived=1` 是给真实机会用的，验收数据要硬删，别留脏行）。

### 2.3 通用规矩

改库前一律 `cp data/mwlab.db data/backups/mwlab_pre-<任务>-$(date +%Y%m%d).db`。

**行数对得上不代表没丢数据** —— 014 迁移就是这么丢过一列的。当时的逐字段比对脚本在本地
`_archive/onetime/scripts/verify_migration_014.py`（V2-17 移出仓库），它是 014 专用的；
下次迁移照它的思路重写一份，别直接拿来跑。
**表没列进基线，就等于没人看它** —— 任务 G 的账号污染是这么漏的，所以 3.1 现在是全表。

---

## 3. 已知的临时状态（别当 bug 报）

| 项 | 说明 |
|---|---|
| Logo 粗糙 | 2026-09-17 重建，上线前由 Stitch 整体重做 |
| 浅色配色 | 同日由暗转浅，同样待 Stitch 重做 |
| 驻留天数 / 转化率 算不出来 | 需 `stage_change` 事件积累存量，机会台与详情页已在写 |
| `first_year` / `website` 几乎全空 | 历史遗留，无写入方，见 `AGENTS.md` |
| DE 语言缺失 | 待人工翻译，机器翻译的德文界面比英文界面更糟 |
