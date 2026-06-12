---
name: industry-research
description: 对目标行业进行展会竞争格局调研。输入行业标签（如「机械和设备」），从 mwlab.db 获取该行业完整展会地图，结合 WebSearch 分析市场趋势，输出 TAM/SAM/SOM 估算、Porter 五力分析和切入点建议。
argument-hint: "[industry_l1 或 industry_l1/industry_l2，例: 机械和设备 或 机械和设备/机床]"
disable-model-invocation: true
allowed-tools: Bash, WebSearch, Read, Write
---

## 行业调研任务

**目标行业**: $ARGUMENTS

---

## 第一步：从 DB 获取行业展会地图（禁止跳过，禁止虚构数据）

> 以下数据由脚本自动注入，直接来自 mwlab.db，是本次调研的唯一可信基础数据来源。
> **规则：报告中所有展会名称、数量、规模数字必须来自以下 DB 数据，禁止 LLM 虚构。**

先用 Write 工具将行业标签写入 /tmp/industry_target.txt：

```
$ARGUMENTS
```

然后执行：

```bash
python3 tools/intel/db_query.py industry-research "$(cat /tmp/industry_target.txt)"
```

---

## 第二步：WebSearch 补充市场趋势

使用 WebSearch 工具搜索以下内容（每项搜索1-2次，获取近2年数据）：

1. `"$ARGUMENTS" 展会市场规模 2024 2025`
2. `"$ARGUMENTS" 行业发展趋势 中国 展览会`
3. `UFI 统计 "$ARGUMENTS" 行业 exhibition market size`

> 重要：WebSearch 结果仅用于宏观趋势和 TAM 数据补充，不用于覆盖 DB 中的具体展会数据。

---

## 第三步：分析与报告生成

基于以上 DB 数据和 WebSearch 结果，在 /tmp/industry_report.md 生成完整 Markdown 报告，格式如下：

```markdown
# 行业调研报告：[行业名称]

**调研日期**：[YYYY-MM-DD]
**数据来源**：mwlab.db（[品牌总数]个展会品牌）+ WebSearch

---

## 一、行业展会全景

### 1.1 基本规模
- 总展会品牌数：[数字，来自 DB]
- UFI 认证展会：[数字，来自 DB]
- 国际化展会：[数字，来自 DB]
- 主要城市：[城市分布，来自 DB]

### 1.2 头部展会（规模 TOP 10）
[列表，来自 DB，字段：展会名、brand_id、规模评分、MA潜力、主办方、城市]

---

## 二、竞争格局分析

### 2.1 市场集中度
[分析头部 3-5 家的规模占比，数据来自 DB scale_score 分布]

### 2.2 主办方竞争格局
[主要主办方列表，展会数量，来自 DB organizer 字段统计]

### 2.3 地域分布
[城市集中度分析，来自 DB city 字段]

---

## 三、市场规模估算（TAM/SAM/SOM）

### 3.1 TAM（全球展会市场）
[引用 WebSearch 搜索到的 UFI 或权威机构数据，如无数据则说明"暂无可信数据来源"]

### 3.2 SAM（中国目标行业展会市场）
- 可接触展会品牌数：[DB 数据]
- 估算方法：[DB 展会数 × 平均展会收入估算，说明估算假设]

### 3.3 SOM（MDS 可实际进入份额）
- 基于 is_international 和城市分布，估算 MDS 可接触比例
- [具体估算过程和结果]

---

## 四、Porter 五力分析（展会行业适配版）

| 维度 | 评估 | 数据依据 |
|------|------|---------|
| 新进入者威胁 | [高/中/低] | [近3年新增展会数，来自 DB year 分布] |
| 替代品威胁 | [高/中/低] | [WebSearch：线上展会/垂直电商动态] |
| 买方议价力 | [高/中/低] | [exhibitors_count 集中度，来自 DB] |
| 供方议价力 | [高/中/低] | [venue/city 稀缺性，来自 DB] |
| 竞争强度 | [高/中/低] | [同行业展会数量，来自 DB] |

---

## 五、切入点建议

### 5.1 高优先级目标（MA 潜力评分 ≥ 4）
[列表：展会名、brand_id、MA潜力、战略相关性，来自 DB ma_potential 字段]

### 5.2 进入策略建议
[基于以上数据，给出 2-3 条具体行动建议。每条建议说明数据依据。]

---

## 六、数据局限性说明

- mwlab.db 覆盖 [品牌数] 个展会品牌，可能不包含所有细分市场展会
- exhibition_relation 表当前数据量：[查询结果]
- TAM 估算基于假设，仅供参考
```

---

## 第四步：保存报告到 DB

报告生成完毕后，执行以下命令将报告持久化到 intel_report 表（D-03 结果沉淀原则）：

```bash
python3 tools/intel/report_writer.py \
  --type industry_research \
  --industry-l1 "$(cat /tmp/industry_target.txt)" \
  --content-file /tmp/industry_report.md
```

执行成功后输出 `报告已写入 → intel_report.id = <N>`。

---

## 注意事项

1. **禁止虚构**：第一步 DB 数据是唯一允许直接引用展会数字的来源
2. **WebSearch 用于宏观**：不用 WebSearch 数据覆盖 DB 中已有的展会信息
3. **数据缺口透明化**：如 DB 无某字段数据，在报告中明确说明"暂无数据"
4. **人工触发**：本 Skill 不做自动化，每次由 BD 团队手动执行
