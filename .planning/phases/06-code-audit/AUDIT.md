# MWLAB-2026 · Phase 6 总审计报告（AUDIT.md）

**审计日期**: 2026-06-11
**审计范围**: 全部后端代码（前端 UI 按客户指令排除）
**审计方式**: 4 个独立审计员按区域并行深审，每项发现均有 file:line 证据，关键 BUG 已在生产库实测验证
**分报告**: REVIEW-intel.md · REVIEW-core.md · REVIEW-crawlers.md · REVIEW-api.md（同目录，含全部细节与证据）

---

## 一、总体结论

**当前代码不可靠，且有三处会直接造成生产事故的雷区。** 单文件代码风格普遍尚可（参数化 SQL、无硬编码密钥），但跨文件链路质量失守：鉴权可被一个 HTTP 头完全绕过、合并引擎再跑一次会大规模覆盖生产数据、企查查批量挖掘流程按文档执行必然在导出步骤失败。

| 区域 | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low/Info | 小计 |
|------|-----------|---------|-----------|------------|------|
| 情报后端 (intel) | 1 | 3 | 8 | 4 | 16 |
| 核心数据链路 (core) | 3 | 6 | 5 | 1 | 15 |
| 爬虫 (crawlers) | 4 | 5 | 8 | 2 | 19 |
| API/认证 (api) | 4 | 3 | 3 | 1 | 11 |
| **合计** | **12** | **17** | **24** | **8** | **61** |

---

## 二、必须立即处理的雷区（按风险排序）

### 雷区 1 — 鉴权完全绕过（API-01 + API-02/03）
`middleware.ts` 无 token / 验签失败时直接放行，且不剥离客户端自带的 `x-user-email` / `x-user-role` 头。**任何人发一个 `curl -H "x-user-role: admin"` 即获得 admin 权限**；dashboard / people（含联系人 PII）/ exhibition 三组 GET 路由更是零鉴权，匿名可全量导出核心竞争情报。测试甚至把"无认证返回 200"固化为预期行为。

### 雷区 2 — 数据库已推上 GitHub（HYG-01）
`mwlab.db`（含 3 个用户的 bcrypt 密码哈希 + 全量业务数据 + 联系人 PII）已被 git 跟踪并推送至远端 `github.com/sywangyue/D_system.git`。`.gitignore` 的 `*.db` 对已跟踪文件无效。需 `git rm --cached` + 历史清理 + 重置密码。另：根目录 `MWlab.pem`（阿里云 SSH 私钥）无 ignore 规则保护，一次 `git add .` 就会泄露。

### 雷区 3 — 合并引擎不可再运行（CORE-01/02/03，已实测）
- 生产库存在 6 条十六进制 brand_id（`EXPO-D92BC0D6` 等），`next_brand_id` 正则解析失败回退 `EXPO-0001`，**再跑一次 merge_engine，所有新建品牌坍缩覆盖到同一行**——大规模数据丢失；
- `data_source` 每次重跑无限追加，生产库已污染（`jufair/jufair/jufair` 3,086 条，实测计数）；
- `normalize_city` 截断四字城市：呼和浩特→浩特、乌鲁木齐→木齐（已在写脏数据）。

**在修复前，禁止运行 `merge_engine.py`**（Phase 1b Jufair 解封后的全量合并会直接触雷）。

### 雷区 4 — 企查查批量挖掘流程断链（INTEL-01/02/03）
batch-prospect skill 按文档执行：线索插入时 `intel_report_id=None` 且全流程无回填 → 第五步导出 `WHERE intel_report_id=?` 必然 0 行报错。叠加 customer_prospect 无唯一约束、insert_prospects 走"改源码再运行"模式，重跑即重复写入。**企查查 API 接入在落库后半程是断的，当前状态不可上线。**

### 雷区 5 — 爬虫恢复前必须先改（CRWL-01/02/03/09）
详情页 UPDATE 用空串覆盖列表页已采数据（数据损毁）；中断的 4,046 条记录永远无法补爬详情；封禁后无熔断反而加速轰炸；同 Cookie 轮换 UA 是典型机器人指纹——**当前代码的请求模式足以解释本次 IP 封禁，且重跑会加剧封禁**。约 30 行最小改动清单见 REVIEW-crawlers.md。

---

## 三、企查查接入"是否最优路径"评估

**结论：需调整，不需重构。**（详见 REVIEW-intel.md 专节）

做对了的：MD5 签名符合企查查官方规范；密钥走环境变量无硬编码；占位符降级模式让无 Key 也能全链路演练；模糊匹配采用"top 3-5 + 人工核验"而非自动打分，符合手动触发约束。**没有**做缓存/重试队列/限速器——在每月手动几十次调用的量级下这是正确的克制。

必须调整的：①落库链路断裂（雷区 4）；②Status 201（无结果）被误判为错误、102（余额不足）无特判——按次计费下"余额烧完仍继续批量循环"是真实资损路径；③批量循环无调用次数汇总，BD 无法对账 API 消耗（加一行计数即可）。

明确不建议做的：重试装饰器、本地缓存、QPS 限速器、调用记录表——均属投机性复杂度，违反 Simplicity First。

---

## 四、文档漂移（与代码现实不符的权威文档）

| # | 漂移项 | 现实 |
|---|--------|------|
| D-01 | CLAUDE.md / AGENTS.md / ROADMAP 引用 `tag_api.py` | 文件已不存在（PRD v1.1 已记录 FastAPI 移除，但其余文档未同步） |
| D-02 | STATE.md "API 框架：FastAPI + JWT" | 实际为 Next.js API Routes + JWT |
| D-03 | PRD 的 Phase 5 = 部署与性能优化；ROADMAP 的 Phase 5 = 情报后端 | 两套 Phase 编号冲突，需统一 |
| D-04 | `scheduler.py` 周一/月初定时调度 | 项目已转全手动触发（设计漂移，是否保留属客户决策） |
| D-05 | `import_tags.py --tagger` 标注"兼容旧参数" | 违反"不写兼容性代码"约束 |
| D-06 | migration 编号冲突：`005_intel_tables.sql` 与 `005_people.sql` 并存 | 迁移回放顺序不可判定；且 `schema/db.py init_db()` 只应用到 001（CORE-04） |
| D-07 | PRD 说部署 Railway；CLAUDE.md/STATE 说阿里云 | 需确认当前真实部署目标 |

另有两处需客户决策（审计员按约束未擅自处理）：`backfill_organizer.py` 与 `_local.py` 约 60-70% 重复；`backfill_organizer.py` 伪造 X-Forwarded-For 绕过目标站 IP ACL（CORE-09，合规风险）。

---

## 五、测试覆盖总评

14 个 API route 仅 3 个有实质测试，middleware 测试全部是 `expect(true).toBe(true)` 占位；爬虫零测试；tools/intel 五个脚本零测试；merge_engine 的测试**恰好绕开了全部 3 个 BLOCKER 路径**（无十六进制 ID 用例、无重复运行幂等用例、无四字城市用例）。`dashboard.test.ts` 把鉴权漏洞固化为预期行为。

---

## 六、建议整改波次（供 PLAN 生成参考）

| 波次 | 内容 | 对应发现 |
|------|------|----------|
| Wave 1 · 安全止血 | middleware 头剥离 + 401；GET 路由鉴权；写接口角色校验；mwlab.db 出库 + 历史清理 + 改密；.pem 防护 | API-01~04, HYG-01/02 |
| Wave 2 · 数据完整性 | merge_engine 三 BLOCKER + 幂等化 + 存量数据清洗；init_db 应用全部迁移；migration 重编号 | CORE-01~05, INTEL-12 |
| Wave 3 · 企查查上线前修复 | batch-prospect 流程顺序修正；customer_prospect 唯一约束 + 幂等插入；QCC 201/102 状态码；skill 参数解析；openpyxl 依赖 | INTEL-01~04, 06, 08 |
| Wave 4 · 爬虫恢复前修复 | 约 30 行最小改动清单（固定 UA、熔断、退避、补 sleep、空串覆盖修复、断点补爬） | CRWL-01~03, 05, 09, 11 |
| Wave 5 · 文档对齐 + 关键回归测试 | D-01~07 文档修正；幂等性/四字城市/middleware 头剥离等关键用例补测 | D-*, 测试缺口 |

Medium/Low 级发现（约 32 项）可并入对应波次顺带修复或显式延后，由客户决定范围。

---

*审计完成: 2026-06-11 · 4 agents · 61 findings · 全部仅审查未改动源码*
