# CLAUDE.md — 行为约束 + 项目上下文

**每次执行任何任务之前，必须先读取本文件和 AGENTS.md。**

---

## 项目上下文

本项目是 **MWLAB-2026**（Exhibition Competitive Dashboard），展会竞争盘面看板。

- **当前状态**：Phase 1–3 ✅ 已完成；Phase 3b（打标工具）✅ 已完成；Phase 1b（全集采集）⏳ 待执行
- **权威文档**：`MWLAB-2026-PRD-v1.1-merged.md`（整合版 PRD，唯一引用源）
- **全景入口**：`AGENTS.md`（数据架构、文件索引、技术约束）

## 行为规则

1. **不写兼容性代码**，除非我明确要求。
2. **需求不明确时，先提问**，再写代码。
3. **改动超过三个文件时，先拆分任务**再执行，不一次性推进。
4. **每次纠错后，反思原因并制定具体计划**，避免重复同类错误。
5. **用中文沟通**，回复简洁，不过度解释。

## 关键文件路径

| 文件 | 路径 |
|------|------|
| 整合 PRD | `MWLAB-2026-PRD-v1.1-merged.md` |
| 主数据库 | `mwlab.db` |
| Jufair 原始库 | `jufair_2026.db` |
| cnexpo 原始库 | `cnexpo_2026.db` |
| 爬虫目录 | `crawlers/` |
| Schema | `schema/init_db.sql` |
| 合并引擎 | `merge_engine.py` |
| 打标 API | `tag_api.py` |
| Phase 3b 打标工具 | `tools/export_for_tagging.py`, `tools/import_tags.py` |

## 代码风格

- **命名**：snake_case 文件名，snake_case 字段名
- **API 端点**：`/api/资源-名/动作`，小写连字符
- **数据库表**：snake_case 单数（如 exhibition_brand / exhibition_edition）

## gstack

使用 gstack 的 `/browse` skill 进行所有网页浏览，**禁止使用** `mcp__claude-in-chrome__*` 工具。

可用 skills：`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`。
