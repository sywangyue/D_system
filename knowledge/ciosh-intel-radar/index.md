---
title: CIOSH 情报雷达
title_en: CIOSH Intelligence Radar
type: project_support
year: 2026
status: active
summary: 为 CIOSH 劳保展"第二曲线"做的自动化行业情报系统。每日采集 EHS / 工业安全 / 新型 PPE 情报，经三层漏斗与 AI 分析后生成邮件周报。
summary_en: An automated industry-intelligence system built for the CIOSH second-curve initiative. It crawls EHS, industrial-safety and smart-PPE sources daily, then ships an AI-analysed email digest.
cover: images/00-cover.jpg
---

## 项目背景

CIOSH（中国国际劳动保护用品交易会）是中国最大的 PPE 展会，由**杜塞尔多夫展览（上海）与中国纺织品商业协会**合资运营。项目当前处于稳定/瓶颈期，核心问题是**展商品类过度单一** —— 全部集中在低级别 PPE（手套、劳保服、防护面具、面料），需要一条"第二曲线"给展会新的落脚点，目标是 2027 年拓出新展区、新展商、新展团、新观众。

品类扩张的难点不在执行，而在**判断依据**：往哪个方向扩、哪个新品类已经有真实市场信号、竞争展会在做什么，这些靠人工看行业新闻既不持续也不可追溯。情报雷达就是为这个判断补数据侧的。

## 系统做什么

一句话：**每天自动把 EHS / 工业安全 / 新型 PPE 的行业动静抓回来，用 AI 判一遍与 CIOSH 的相关性和可行动作，攒成邮件周报发出来。**

```
采集层（双通道）  →  处理层（三层漏斗）  →  Skill 进化层
```

**采集层**走两条通道：Tavily 拿国际英文内容（EHS tech / smart PPE / occupational health），百度新闻拿国内中文内容（EHS 管理 / 智能安全帽 / 工业物联网安全）。关键词库当前 31 个，分三级 —— Tier 1（19 个核心品类）与 Tier 2（6 个国际英文）每日必跑，Tier 3（6 个新兴扩展品类）只在周一跑。

**处理层是三层漏斗**，目的是把 AI 调用花在值得分析的条目上：

| 层 | 逻辑 | 限额 |
|---|---|---|
| Layer 1 | URL 去重（simhash 指纹，相似度阈值 85） | — |
| Layer 2 | 标题关键词评分过滤 | score ≥ 1 才通过 |
| Layer 3 | DeepSeek 深度分析 | 国际 ≤15 条 / 国内 ≤25 条 / 日总量 ≤40 条 |

**Skill 进化层**每周一 03:30 自动跑，让系统自己往前走：按词频与情报密度进化关键词库、进化 Layer 2 的过滤权重、对 Analyzer Prompt 做版本管理（人工确认后才生效）、追加更新各品类简报（只追加不覆盖）。

调度靠 macOS LaunchAgent —— 日报每天 03:00，周报加 Skill 进化每周一 03:30。

## 产出长什么样

分析结果不是摘要，而是**「情报 → 对 CIOSH 意味着什么 → 可以怎么动」**三段式。下面是 2026-08-04 那期行业内部周报的完整邮件页：

![CIOSH 行业内部周报 2026-08-04](images/01-weekly-mail.jpg)

典型的一条长这样 —— 「NFPA 报告：2025 年美国消防员执勤死亡人数升至 83 人」，后面直接跟着「凸显高性能消防防护装备需求 → 可支撑消防防护品类展区推广与展商定向邀约」。这一句才是这个系统存在的理由：把一条行业新闻翻译成招展动作。

## 当前数据

截至 2026-08-03（数据跨度 2026-06-04 起）：

| 项目 | 数量 |
|---|--:|
| 采集条目 | 818 |
| 已 AI 分析 | 391 |
| URL 去重指纹 | 1,566 |
| 已生成报告 | 18（日报 8 · 周报 4 · 行业内部周报 3 · 行业外部周报 3） |

品类分布上，`policy_regulatory`（58）、`industrial_safety`（40）、`emergency_response`（37）、`smart_ppe`（29）是抓得最多的四类，`core_ppe` 只有 11 条 —— 这个比例本身就是结论：**信号确实在现有品类之外**。

## 技术栈与状态

独立 Python 脚本系统，SQLite 单库（`ciosh_intel.db`，唯一写入途径）。外部依赖三个：Tavily API（国际搜索）、DeepSeek API（AI 分析）、163 SMTP（发信）。密钥走 `.env`，不入库。

> ⚠️ **当前定时任务是停的。** `logs/cron_daily.log` 从 2026-07-17 起每天同一个报错：`ModuleNotFoundError: No module named 'dotenv'` —— cron 环境里缺依赖，日报连续多日未产出。库里最后一条情报停在 2026-08-03。恢复只需在 cron 用的解释器里补装 `python-dotenv`。
