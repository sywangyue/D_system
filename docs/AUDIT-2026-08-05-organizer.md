# 数据完真度摸底 + 主办方口径统一（2026-08-05）

## 1. 结论速览

| 维度 | 状态 | 说明 |
|---|---|---|
| 字段填充率 | 良好 | 品牌核心字段 ≥94%，届次面积可用 7,432/7,592 (97.9%) |
| 面积可回溯性 | 良好 | 7,268/7,580 (95.9%) 可回溯到 `data_provenance` 原始 payload |
| **品牌去重** | **差** | 2026 年 700 组疑似重复，虚增面积 6,288 万㎡（占 29%） |
| **主办方规范化** | **差（已修）** | 原 4,652 个取值 → 集团级归并后 957 家办展主体 |
| 时间序列 | 无 | 6,995/7,292 品牌只有 1 条届次，无法做同比 |
| 空字段 | — | `first_year` / `scale_score` / `ma_potential` / `strategic_relevance` / `co_organizer` / `website` 基本全空 |

## 2. 面积字段可信度

逐条把 `exhibition_edition.area_sqm` 回溯 `data_provenance.raw_payload` 重新解析比对：

- 一致 **7,268**（95.9%）— 「万平方米」单位换算正确
- 不一致 **110** — 疑为后续人工/脚本改写
- 原始无面积、库中有值 **202**

### 已确认的两类污染

**a) 跨记录串味.** 多条不同 source_url 被并入同一 `brand_id` 后，届次取了错误来源的值。
典型：`EXPO-3210`（古镇灯博会**夏季**）原始 `area_str="2万平方米" / 300家`，库中为 `1,500,000㎡ / 3,300家`（秋季展数据）。

风险面：2,141 个品牌有多条溯源，其中 **874 个面积值冲突、537 个展会名不一致**。

**b) 源站自身错值.** 上述 1,500,000㎡ 在 jufair 页面上即为错误。2026 年面积 ≥30 万㎡ 的 54 条记录需人工复核。

### 重复品牌
以 `(城市, 面积, 展商数)` 三元组识别，2026 年 **700 组 / 1,855 个品牌**疑似同展会重复收录（如广交会一期/二期/三期各记 850,000㎡）。

## 3. 主办方字段

原始状态：4,652 个不同取值 / 7,283 条有值，其中 **3,675 个只出现一次**。

问题：
- 多单位混装（867 条含中文逗号、857 条含顿号）
- 别名分裂：励展系 37 种写法、Informa/ITE 系 30+ 种、商务部 3 种
- 半数以上 token 是政府机关 / 行业协会挂名，不是实际办展方
- 脏值：8 条 `organizer='test'`（`display_ready=1`，已进看板）

## 4. 统一口径（2026-08-05 与 Max 确认）

1. **归属**：只统计办展主体（企业型），过滤政府 / 协会 / 组委会挂名单位
2. **粒度**：集团级（`国药励展`、`励展华博` 并入 `RX 励展`）
3. **年份**：2026

> **ITE / Hyve 的两次断裂（2026-08-05 全网核实后修正）**
>
> 1. ITE Group plc（LSE:ITE，1991 年成立，英国总部但业务重心在俄罗斯/独联体）
>    2019-09-20 更名 **Hyve Group plc**，24 日起以 HYVE 代码交易。与 Informa 无股权关系，**不可与 Informa 合并**。
> 2. **2022 年 Hyve 将俄罗斯业务（15 个展会，含 MosBuild / RosUpack / YugAgro）售予 Rise Expo Ltd，
>    该业务沿用 ITE 品牌延续至今**（ite.group，总部迪拜）。
>    因此 2022 年之后，「ITE」与「Hyve」是**两家不同的公司**，不能按名称一律合并。
>
> 本库的处理：按 `country_cn` 路由——俄罗斯 → `ITE Group（俄罗斯，2022 年自 Hyve 剥离）`；
> 印度/土耳其/英国/巴西/印尼等 → `Hyve Group`；
> 哈萨克斯坦/乌兹别克斯坦/阿塞拜疆/乌克兰 → `ITE/Hyve 待判定（独联体·中亚）`（39 条，`confidence=check`）。
> 中亚归属未能查证：Hyve 官网仍列 Central Asia 事业部，但另有 ICA Group 承接该区域的报道，暂不归并。
>
> 另注意 **Iteca**（阿拉木图，哈萨克斯坦本土公司）与 ITE 是不同实体，`ITE` 的正则必须前锚定，
> 否则会误吞 Iteca / CITEXPO / HITEX / 埃及国际展览贸易公司ITE。
>
> UBM（博闻）2018 年并入 Informa Markets，上海博华（Sinoexpo）为其中国合资平台，归入 Informa。

## 5. 交付物

| 文件 | 用途 |
|---|---|
| `tools/organizer_alias.json` | 集团级别名词典，`confidence=check` 的条目待人工确认 |
| `tools/rank_organizers.py` | 拆分 → 分类 → 归并 → 按面积排序（只读，不改库） |
| `schema/migrations/013_brand_organizer.sql` | 建 `brand_organizer` 索引表 + 清理 8 条 `organizer='test'` |
| `tools/build_organizer_index.py` | 重建 `brand_organizer`（全量覆写，可反复重跑） |

```bash
python3 tools/rank_organizers.py --dedup --top 30      # 去重后排行榜（推荐）
python3 tools/rank_organizers.py --unmapped 50         # 未进词典的高面积 token
python3 tools/rank_organizers.py --dedup --out rank.csv --top 0

sqlite3 data/mwlab.db < schema/migrations/013_brand_organizer.sql
python3 tools/build_organizer_index.py --dry-run       # 先看统计
python3 tools/build_organizer_index.py                 # 重建索引表
```

### brand_organizer 落库结果（2026-08-05）

`organizer` 原始字段保持不动（保留可回溯性），另建一对多索引表：

- 7,275 个品牌 → **9,740 行**参与单位
- 类型：企业 4,240 / 协会 3,471 / 其他 938 / 政府 676 / 组委会 415
- 置信：auto 7,943 / high 1,736 / check 61
- 规范名去重后 4,990 家，**其中企业型 1,656 家**（原始自由文本为 4,652 个取值）

归并效果（原始写法数 → 1 个 canonical）：
RX 励展 22→1（330 个品牌）、Informa Markets 23→1（303）、法兰克福 18→1（121）、Hyve 15→1（81）

查询示例：
```sql
SELECT o.canonical, SUM(e.area_sqm)/10000.0 AS 万平米, COUNT(*) AS 展会数
  FROM brand_organizer o
  JOIN exhibition_edition e ON e.brand_id = o.brand_id AND e.year = 2026
 WHERE o.org_type = '企业' AND e.area_sqm > 0
 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

> `app/api/dashboard/route.ts` 里的 `COUNT(DISTINCT b.organizer)` 目前返回 4,652（无意义），
> 可改为 `SELECT COUNT(DISTINCT canonical) FROM brand_organizer WHERE org_type='企业'`。
> 前端改动本次未做。

技术要点（`split_organizer`）：
- 英文逗号右侧是公司后缀（Ltd/Inc/LLC…）时不切分，避免 `ABC Co., Ltd.` 被切出裸 `Ltd.`
- 括号平衡修复；仅剥去整体包裹的括号，保留 `XX（YY）` 内的成对括号

## 6. 待办

1. 复核 `tools/organizer_alias.json` 中 `confidence=check` 的条目：
   `ITE/Hyve 待判定（独联体·中亚）`(39)、`汉诺威米兰展览（合资）`(25)、
   `中国机械国际合作（CMEC/国机）`(22)、`爱博`(12)、`Mack Brooks`(2)
2. ~~清理 8 条 `organizer='test'`~~ ✅ 已在 013 迁移中完成，写入 `manual_tag_history`
3. 处理 700 组重复品牌（与 `dedup_review_in_progress` 的 1,753 对复核合并推进）
4. 修正 `EXPO-3210` 等跨记录串味的 874 个品牌
5. 补 `first_year` / `scale_score`，否则 PRD 中相关看板无数据
