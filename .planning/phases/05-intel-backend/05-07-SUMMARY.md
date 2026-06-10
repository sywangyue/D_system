# 05-07 SUMMARY — 单一客户深度调研 Skill

**Status:** Complete  
**Completed:** 2026-06-10

## Self-Check: PASSED

## What Was Built

### .claude/skills/single-prospect/SKILL.md
- 调用方式：`/single-prospect 上海精密机床 代理商资质排查`
- 步骤结构：
  1. `!python3 tools/intel/db_query.py company-history` — 参展轨迹注入
  2. `python3 tools/intel/qcc_client.py "$ARGUMENTS" --size 3` — 工商信息
  3. WebSearch × 5 — 代理资质 + 风险信息 + 近况 + 协会/股权
  4. 生成报告 /tmp/single_report.md（5段结构）
  5. `report_writer.py --type single_prospect` — 入库

## 报告结构（5段）
1. 企业基本信息（企查查字段映射，含未配置降级提示）
2. 展会参与轨迹（DB company-history 数据，含规律分析）
3. 潜在需求分析（当前状态 + 痛点 + MDS契合度 + 切入点）
4. **风险标注**（违规代理排查清单 + 风险等级标注）
5. BD 行动建议（优先级 + 接触方式 + 时间窗口 + 注意事项）

## 三数据源整合方式
- mwlab.db → `company-history` 命令，基于 organizer 字段模糊匹配
- 企查查 → `qcc_client.py` 工商信息，未配置时降级到 WebSearch
- WebSearch → 代理资质核查 + 风险信息 + 最新动态

## 与 D-22（person 表复用）的关系
- 报告本体入 intel_report（report_type=single_prospect）
- 联系人数据不自动写入（需人工维护 person + exhibition_contact 表）

## Verification
- `disable-model-invocation: true` ✓
- `db_query.py company-history` 调用 ✓
- `qcc_client.py` 调用 ✓
- `风险标注/违规代理` 段落 ✓ (4处)
- `single_prospect` report_type ✓
- `report_writer.py` 持久化调用 ✓
