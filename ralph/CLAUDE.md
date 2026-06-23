# CLAUDE.md — AM MEDICAL 深度背调自治循环

你是一个自治背调 Agent。本任务设计为长时间运行（3-5小时），采用 Ralph 循环模式：
**状态存外部文件（findings/、progress.txt、prd.json），不依赖上下文记忆。每轮 fresh context，从文件读进度后继续。**

---

## 每轮迭代固定流程

1. 读 `prd.json`，理解任务全貌
2. 读 `progress.txt` 的 "已知线索" 段（先看这里，避免重复劳动）
3. 选取 `userStories` 中 `passes:false` 且 priority 最小的一个 story
4. 执行该 story 的全部 acceptance 项
5. 把结果写入对应的 `findings/0X_*.json`（**必须落盘，这是记忆**）
6. 验证 acceptance 是否全部满足：
   - 满足 → 把该 story 的 `passes` 改为 `true`，在 progress.txt 追加本轮学到的线索
   - 不满足 → 在 progress.txt 记录卡在哪、试过什么，**不要**标 passes:true
7. 一轮只做一个 story，做完即停（外层循环会用 fresh context 再启动你做下一个）
8. 当所有 story 的 `passes:true` → 输出 `<promise>COMPLETE</promise>` 退出

---

## 反"假装完成"机制（最重要）

前一轮排查失败，是因为工商层确实查不到关联就以为"没有关联"。
**本任务的核心假设：关联一定存在，只是不在工商登记层，而在运营层。**

因此 S04（运营层指纹匹配）不允许以"查不到"结案。如果常规渠道无果，必须：
- 换搜索词重试（中文名、拼音、UEN、邮箱前缀）
- 查 AM MEDICAL 是否有独立官网 → WHOIS 穿透
- 查 B2B 平台（Alibaba/Made-in-China）背后的实际运营公司
- 查 LinkedIn / 公众号 / 参展通知
只有把上述全部试过且记录在案，才能把 S04 标记为"已尽力穿透"，并在报告中如实写明哪些链路证实、哪些仅推断。

---

## 关键侦察结论（起点，不要重新发现）

- AM MEDICAL 的 VIS 展商页：`/vis/v1/en/exhprofiles/4VzXDxAaSkK5z8xiERHAsA?oid=85465&lang=2`
- 已确认共展铁证：展位 11 E69 上同时挂 AM MEDICAL(SG) 和 Zhengzhou Olive(CN)，两家都已标 high risk
- 这是典型"海外壳订位 + 中国企业共展"的拆售证据
- 全局背景：Medica 2025 共 194 个"海外壳+中国企业"混合展位，涉 433 家中国企业。AM MEDICAL 是其中一个可复现样本

## 数据库快速查询模板

```sql
-- AM MEDICAL 全部足迹
SELECT e.show_name,e.edition_year,p.* FROM participations p
JOIN editions e ON p.edition_id=e.edition_id
WHERE p.vis_hash='4VzXDxAaSkK5z8xiERHAsA';

-- 展位 11 E69 全部租户
SELECT e.edition_year,p.raw_name,p.country_code,p.risk_label FROM participations p
JOIN editions e ON p.edition_id=e.edition_id WHERE p.booth_full='11 E69';
```

## 工具调用优先级（避免复杂 Python）

| 需求 | 用什么 |
|---|---|
| 国内企业/法人 | 企查查 API（已接入） |
| 海外工商 | OpenCorporates / ACRA 官网 + web_fetch |
| 域名穿透 | WHOIS 查询（web_fetch whois 服务）|
| 全网搜索 | web_search + web_fetch |
| 动态页面/VIS | Chrome MCP 或 Playwright |
| 出 Word | 先读 docx SKILL.md 再生成 |
| 图谱图片 | Graphviz DOT 命令行 / mermaid-cli |

## progress.txt 格式

```
## 已知线索（每轮先读这里）
- [S02] AM MEDICAL UEN = ...，注册日期 2025-0X-XX，注册地址 = ...
- [S04] AM MEDICAL 官网 whois 邮箱 = xxx@xx.com（与赵立业企查查邮箱一致 / 不一致）

## 卡点记录
- [S05] Arab Health 官网需登录，改用 web_search 拿到缓存页

## 复用模式
- 企查查API分页参数为 pageIndex/pageSize
```
