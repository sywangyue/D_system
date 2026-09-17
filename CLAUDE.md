# CLAUDE.md — 行为约束 + 项目上下文

**每次执行任何任务之前，必须先读取本文件和 AGENTS.md。**

---

## 项目上下文

本项目是 **MWLAB 万象**：杜塞尔多夫展览上海 BD 工作台（前身为展会竞争看板 MWLAB-2026）。

- **当前状态**：V2 重构全部完成并已部署（2026-09-17，https://mwlaboratory.com）；下一步 V2-18 UI 整体重做
- **历史与编码**：`docs/HISTORY.md`（V1-xx 展会看板时代 / V2-xx 万象时代）；待办见 `docs/ROADMAP.md`
- **文档入口**：`docs/README.md`；架构 `docs/ARCHITECTURE.md`；质检 `docs/QC.md`；部署 `docs/DEPLOY.md`
- **全景入口**：`AGENTS.md`（数据架构、采集管道、技术约束）
- 注意：`scheduler.py` 不存在于仓库；采集管道是本机 crontab + `scripts/run_pipeline.sh`。

## 硬性约束（不可违反）

### 0. 每次回答必须以 "Hello Max" 开头

无论任何场景，任何输出的第一行必须是 `Hello Max`。

### 1. Think Before Coding — 编前先想，不藏困惑

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- 明确陈述你的假设。不确定时，提问。
- 如果存在多种解读，列出来，不要自己悄悄选一个。
- 如果有更简单的方案，说出来。有异议时推回去。
- 如果有任何不清楚的地方，停下来，说明困惑点，提问。

### 2. Simplicity First — 最小代码原则

**Minimum code that solves the problem. Nothing speculative.**

- 不实现超出请求范围的功能。
- 单次使用的代码不做抽象封装。
- 没有被要求的"灵活性"或"可配置性"不写。
- 如果你写了 200 行但可以是 50 行，重写。

### 3. Surgical Changes — 外科手术式改动

**Touch only what you must. Clean up only your own mess.**

- 不"顺手优化"周边代码、注释或格式。
- 不重构没有损坏的东西。
- 发现无关的死代码时，提及它，不要删除它。
- 你的改动造成孤儿代码时，删除它们；但不删除原本就存在的死代码。

### 4. Goal-Driven Execution — 目标驱动执行

**Define success criteria. Loop until verified.**

多步骤任务，先陈述简要计划：
```
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
```

## 行为规则

1. **不写兼容性代码**，除非我明确要求。
2. **需求不明确时，先提问**，再写代码。
3. **改动超过三个文件时，先拆分任务**再执行，不一次性推进。
4. **每次纠错后，反思原因并制定具体计划**，避免重复同类错误。
5. **用中文沟通**，回复简洁，不过度解释。

## 关键文件路径

| 文件 | 路径 |
|------|------|
| 文档索引 | `docs/README.md` |
| 架构 / 质检 / 部署 | `docs/ARCHITECTURE.md` · `docs/QC.md` · `docs/DEPLOY.md` |
| 历史原文（PRD、审计、任务规格） | `docs/archive/` |
| 主数据库 | `data/mwlab.db` |
| Jufair 原始库 | `data/jufair_2026.db` |
| cnexpo 原始库 | `data/cnexpo_2026.db` |
| 爬虫目录 | `crawlers/` |
| Schema | `schema/init_db.sql` + `schema/migrations/` |
| 合并引擎 | `tools/merge_engine.py` |
| 打标工具 | `tools/export_for_tagging.py`, `tools/import_tags.py` |
| 企查查 API 客户端 | `tools/intel/qcc_client.py` |
| 月度采集管道 | `scripts/run_pipeline.sh` |

> 数据库一律在 `data/` 下。仓库根目录曾有一个同名空库 `mwlab.db`，是历史遗留陷阱，已删除。

## 代码风格

- **命名**：snake_case 文件名，snake_case 字段名
- **API 端点**：`/api/资源-名/动作`，小写连字符
- **数据库表**：snake_case 单数（如 exhibition_brand / exhibition_edition）

## gstack

使用 gstack 的 `/browse` skill 进行所有网页浏览，**禁止使用** `mcp__claude-in-chrome__*` 工具。

可用 skills：`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`。
