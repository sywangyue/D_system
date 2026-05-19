# MWLAB-2026 · Architecture & Technical Reference

**综合自** `.planning/research/` 五份研究文件  
**生成时间**：2026-05-06（文档整合时合并）

---

## 系统架构

```
[大陆节点] Crawlers / Scheduler ──► raw_jufair / raw_cnexpo / crawl_log
                                         │
[应用区]    merge_engine ◄────────────────┘
                 │
                 ▼
         exhibition_brand + exhibition_edition + data_provenance
                 │
                 ▼
         FastAPI（tag_api + dashboard API + auth）
                 │
      [HTTPS]  ──┴──  未来静态前端 SPA（Phase 4）
```

### 构建顺序原则

1. Schema ↔ 爬虫 ↔ 合并 ↔ 标注 API ↔ 查询 API ↔ 运维封装
2. 爬虫与 OLTP API **进程分离**以降低互相拖死风险
3. 每个 Phase 间有人工验收闸口（客户签收）

---

## 技术栈

| 层级 | 选择 | 置信度 | 说明 |
|------|------|--------|------|
| 运行时 | Python 3.12+ | 高 | FastAPI/SQLAlchemy/pandas |
| API | FastAPI + Uvicorn | 高 | 已有 `tag_api.py` 模式延伸 |
| 鉴权 | JWT（python-jose） | 中 | Phase 3 已实现 |
| 数据库 | SQLite → 可选云上 SQL | 中 | PRD §6 待部署阶段决断 |
| 采集 | requests + BeautifulSoup | 高 | 已验证大陆 IP 可跑 |
| 容器 | 多阶段 Dockerfile（Python slim） | 高 | Phase 3 已产出 |

**慎选**：暂不引入重量级消息队列 — 30 用户 + 爬虫外置可满足。

---

## 特性清单

### Table Stakes（已实现）

| 能力 | 对应模块 | Phase |
|------|---------|-------|
| 品牌/届次结构化存储与溯源 | schema/ + mwlab.db | 2 |
| Jufair + cnexpo 采集与批次日志 | crawlers/ + scheduler.py | 1 |
| 双源合并 + provenance | merge_engine.py | 2 |
| 人工打标 API | tag_api.py | 2 |
| Dashboard 读模型 + JWT 用户 | FastAPI 查询 API | 3 |
| Docker + OpenAPI + 部署说明 | Dockerfile + openapi.json | 3 |

### Differentiators（PRD 核心竞争力）

- 双源合并 + provenance / 冲突可解释
- 「无键盘」点选漏斗 + MDS / 竞争关系标签体系
- 面向总经理层级的三步决策看板

---

## 风险登记 & Pitfalls

| 风险信号 | 预防 | 影响 | Phase |
|---------|------|------|-------|
| 聚展网 403/反爬 | 大陆 IP 节点，退避策略，batch 告警 | 高 | 1 |
| 两源字段全空但仍 merge | merge 守卫 + provenance notes | 中 | 2 |
| JWT 泄密/弱密码 | HTTPS 终止、轮转、速率限制 | 高 | 3 |
| 单容器既跑爬虫又跑 API | 分进程/分镜像 | 中 | 3 |
| 「能跑 demo」但无镜像/契约 | Phase 3 DoD：Docker + openapi.json | 高 | 3 |
| 全集采集 8.4K 打标工作量 | 分轮次优先级策略 | 中 | 1b |

### 明确反模式（不做）

- ❌ 在港澳台/境外节点跑 Jufair 批量爬虫（403）
- ❌ 把爬虫与读写 API 同进程强耦合
- ❌ 无 OpenAPI/无镜像的「代码好但上不了线」

---

## 数据流向

```
raw_jufair ──┐
              ├──→ merge_engine ──→ exhibition_brand
raw_cnexpo ──┘                        ├── exhibition_edition
                                       └── data_provenance
                                              │
                                    crawl_log ┘
```

### 合并冲突策略

| 字段 | 优先源 | 补充说明 |
|------|--------|---------|
| 名称/时间/地点 | jufair | 数据更稳定 |
| 面积/展商/观众 | 取大值 | 记录差异到 provenance |
| 主办方 | 双源保留 | 差异人工兜底 |
| 缺失字段 | 谁有取谁 | 全空则 NULL |

---

*参考来源：.planning/research/ARCHITECTURE.md · FEATURES.md · PITFALLS.md · STACK.md · SUMMARY.md*
