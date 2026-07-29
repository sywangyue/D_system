![MWLAB-2026 · BD Database · Exhibition Competitive Dashboard · 80s terminal pixel style](docs/readme-hero-mds.png)

# MWLAB-2026 · Exhibition Competitive Dashboard

**代号**：MWLAB-2026
**客户语境**：杜塞尔多夫展览上海（BD 总监）
**一句话**：结构化展会数据库 + 竞争盘面看板——选品类，看竞争对手 / 潜在伙伴 / 新进入者，附规模信号（品牌数 / 展商 / 观众 / 面积）。

- **核心场景**：评估是否进入某个新展会市场，三步点选内给出竞争结构与规模信号。
- **服务对象**：中国总经理（决策者优先，非技术用户）。
- **原则内不做**：上游产业链指数、下游 AI 建议、自由文字录入为主交互。

---

> **本文档写给接手这个项目的开发者。**
> 目标是让你在 10 分钟内跑起来，并搞清楚数据是怎么从爬虫流到看板的。
> 产品层面的权威定义在 `docs/MWLAB-2026-PRD-v1.1-merged.md`，不在这里重复。

---

## 目录

1. [5 分钟跑起来](#1-5-分钟跑起来)
2. [先理解数据管道](#2-先理解数据管道)
3. [仓库结构](#3-仓库结构)
4. [常见任务命令手册](#4-常见任务命令手册)
5. [用户与权限](#5-用户与权限)
6. [数据模型](#6-数据模型)
7. [测试](#7-测试)
8. [踩坑清单](#8-踩坑清单)
9. [当前状态与已知缺口](#9-当前状态与已知缺口)

---

## 1. 5 分钟跑起来

**前提**：Node.js 18+、Python 3.12+

```bash
# 1. 依赖
npm install
pip install -r requirements.txt

# 2. 环境变量（JWT_SECRET 必填，否则服务启动即抛错）
cat > .env.local <<'ENV'
JWT_SECRET=本地随便一串足够长的随机字符串
ENV

# 3. 数据库
#    data/mwlab.db 不在版本控制内。若你手上没有现成的库，
#    schema/db.py 会在首次连接时按 schema/init_db.sql + migrations/ 自动建库建表。
python3 -c "import sys; sys.path.insert(0,'.'); from schema.db import init_db; init_db('data/mwlab.db').close()"

# 4. 播种开发账号（幂等，已存在则跳过）
python3 scripts/seed_users.py

# 5. 启动
npm run dev
```

打开 http://localhost:3000，用 `admin@mwlab.internal` / `admin123` 登录。

> 局域网其他设备访问时，需在 `next.config.ts` 的 `allowedDevOrigins` 里加上该设备 IP。

---

## 2. 先理解数据管道

**这是理解本项目最重要的一张图。** 数据不是一步到位的，中间有几个必须手动触发的环节，漏掉任何一环都会让看板出现「数据不对」的表象。

```
① 采集（须大陆 IP）
   crawlers/jufair_crawler.py  ──►  data/jufair_2026.db   (raw_jufair)
   crawlers/cnexpo_crawler.py  ──►  data/cnexpo_2026.db   (raw_cnexpo)
                                          │
② 合并（双源冲突消解）                     ▼
   tools/merge_engine.py --batch ALL  ──►  data/mwlab.db
                                            exhibition_brand
                                            exhibition_edition
                                            data_provenance
                                          │
③ 治理（缺一不可，且必须按序）             ▼
   scripts/classify_all_brands.py     行业分类 l1/l2
   scripts/dedup.py --execute         品牌去重
   scripts/check_display_ready.py     展示池标记 display_ready
                                          │
④ 消费                                    ▼
   Next.js API Routes ── better-sqlite3 ──►  看板 / Intel 工具 / Excel 导出
```

### 三个原始库与主库的关系

| 库 | 角色 | 谁写 | 谁读 |
|----|------|------|------|
| `data/jufair_2026.db` | 聚展网原始落地 | jufair 爬虫 | merge_engine、classify |
| `data/cnexpo_2026.db` | 中国会展网原始落地 | cnexpo 爬虫 | merge_engine |
| `data/mwlab.db` | **主库**，一切查询的唯一来源 | merge_engine、治理脚本、API 写接口 | 全部 |

原始库只进不出，是溯源的底本；主库是加工产物，可以从原始库重建。

### 双源冲突规则

| 字段类别 | 规则 |
|---------|------|
| 名称 / 时间 / 地点 | jufair 优先 |
| 面积 / 展商数 / 观众数 | 取较大值，差异记入 `notes` |
| 主办方 | 两源都保留，用 `；` 连接 |
| 缺失字段 | 谁有取谁 |

### ⚠️ 治理环节不是可选的

**采集完只跑 merge_engine 是不够的。** 新合并进来的品牌 `industry_l1` 为空，
既不会出现在行业筛选里，也进不了展示池。2026 年 7 月就发生过这个情况：
2,368 个新品牌（占全库 29%）因为没跑分类脚本而在看板上「隐身」。

**`industry_l1` / `industry_l2` 只允许分类脚本和人工打标写入。**
爬虫的原始行业串写在 `industry_raw`，两者不能混。这条约束是硬的——
合并引擎曾经直接把原始串写进 `industry_l1`，导致分类唯一值从 8 涨到 125，
每合并一次污染一次。

---

## 3. 仓库结构

```
app/                    Next.js App Router：页面 + API Routes
  api/                    后端接口（见 §4 表）
components/             React 组件
lib/
  db.ts                   better-sqlite3 连接（只读单例 + 写连接）
  api-guard.ts            服务端鉴权：requireUser / requireWriter
  auth.ts                 客户端 auth state
proxy.ts                Next.js 16 中间件（JWT 验签 + 路由守卫）

crawlers/               采集层
  jufair_crawler.py       Python 版，curl 抓取，支持 --proxy
  jf_shell_crawl.sh       纯 shell 版，慢速安全模式，带熔断
  cnexpo_crawler.py

tools/                  加工与导出
  merge_engine.py         双源合并引擎
  export_exhibitions.py   展会清单导出（月度 / 区间）
  export_for_tagging.py   Phase 3b · 导出待打标 Excel
  import_tags.py          Phase 3b · Excel 写回 + 审计
  research.py             竞争盘面调研 CLI
  geo_dict.py             地理词典（城市 / 省份 / 国家中英对照）
  intel/                  Intel 工具链（企查查、调研报告、客户线索）

scripts/                治理与运维
  classify_all_brands.py  全品牌行业分类
  dedup.py                品牌去重
  check_display_ready.py  展示池标记（每周 cron）
  seed_users.py           播种开发账号
  clean_brands.py         品牌表清洗
  _archive/               已退役脚本，仅供追溯

schema/
  init_db.sql             主 Schema
  migrations/             001–010，由 db.py:init_db() 打开库时自动应用
  db.py                   连接与迁移入口

data/                   数据库与本地数据（.gitignore，不入库）
exports/                Excel 产出（.gitignore）
reports/                调研报告产出
docs/                   PRD、架构、部署、审计报告
tests/                  Python + 前端测试
```

---

## 4. 常见任务命令手册

### 采集与入库

```bash
# 采集（须在大陆 IP 节点执行）
python3 crawlers/jufair_crawler.py --all --detail
python3 crawlers/cnexpo_crawler.py

# 非大陆 IP 时走 Tor（需先启动 Tor，监听 9050）
python3 crawlers/jufair_crawler.py --all --proxy

# 慢速安全模式（纯 shell，间隔更长，连续 3 次封禁自动终止）
bash crawlers/jf_shell_crawl.sh "8 9 10" --detail

# 合并进主库
python3 tools/merge_engine.py --batch ALL
python3 tools/merge_engine.py --batch ALL --dry-run   # 只看统计不写库
```

### 治理（合并后必跑，按此顺序）

```bash
python3 scripts/classify_all_brands.py --dry-run   # 先预览
python3 scripts/classify_all_brands.py

python3 scripts/dedup.py                           # 默认 dry-run，出重复报告
python3 scripts/dedup.py --execute                 # 确认后真实合并

python3 scripts/check_display_ready.py --dry
python3 scripts/check_display_ready.py
```

> `dedup.py --execute` 会删除品牌记录。**执行前务必备份**：
> `sqlite3 data/mwlab.db ".backup data/mwlab_backup_$(date +%Y%m%d).db"`

### 导出

```bash
# 月度中国境内清单（默认合并同期同馆子展）
python3 tools/export_exhibitions.py --month 2026-08

# 任意区间 + 不做地区过滤 + 不合并
python3 tools/export_exhibitions.py --from 2026-01-01 --to 2027-07-31 \
    --region all --no-merge -o /tmp/all.xlsx
```

### Excel 批量打标

用于人工标注 `competition_relation`、`mds_related`、`strategic_relevance` 等
**系统无法推断**的字段。

```bash
python3 tools/export_for_tagging.py --industry_l2 "工业装备" --status untagged
# 人工在 Excel 里填写，空单元格视为「不修改该字段」
python3 tools/import_tags.py --file exports/tagging_batch_YYYYMMDD.xlsx \
    --changed-by you@company.com
```

每条变更都会写入 `manual_tag_history`。

### 调研

```bash
python3 tools/research.py --list-industries
python3 tools/research.py --exhibition "上海劳保展"
python3 tools/intel/db_query.py brand-research "EXPO-0001"
```

### API Routes

鉴权三级由 `lib/api-guard.ts` 统一实施：`requireUser()` 校验登录**并实时查库确认
`is_active`**（账号停用后存量 token 立即失效）；`requireWriter()` 拒绝 `readonly`
角色的写操作。中间件 `proxy.ts` 会先无条件剥离外部传入的 `x-user-*` 头，再按验签
结果注入可信值。

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 公开 | 登录，签发 JWT 写入 httpOnly Cookie |
| POST | `/api/auth/logout` | 公开 | 退出，清除 Cookie |
| GET | `/api/dashboard` | 登录 | 看板数据（KPI + 品牌列表 + 图表） |
| GET | `/api/exhibition/[id]` | 登录 | 品牌详情 + 时间线 + 关系 + 联系人 |
| POST | `/api/exhibition/[id]/timeline` | 写权限 | 新增时间线事件 |
| DELETE | `/api/exhibition/[id]/timeline/[eventId]` | 写权限 | 删除时间线事件 |
| POST | `/api/exhibition/[id]/relations` | 写权限 | 新增展会关系 |
| GET · POST | `/api/people` | 登录 · 写权限 | 人物列表 / 新建 |
| GET | `/api/people/[id]` | 登录 | 人物详情 |
| POST | `/api/people/[id]/contacts` | 写权限 | 新增人物-展会联系 |
| POST | `/api/people/[id]/relations` | 写权限 | 新增人物关系 |
| GET · PATCH | `/api/user/preferences` | 登录 | 读写本人看板筛选偏好 |
| GET | `/api/users` | admin | 用户列表 |
| GET | `/api/setting/status` | admin | 数据状态 + 系统信息 |

---

## 5. 用户与权限

用户存于 `data/mwlab.db` 的 `user` 表，三级角色：

| 角色 | 权限 |
|------|------|
| `admin` | 全部功能 + 设置页（用户管理、数据状态） |
| `manager` | 看板 + 打标写入 |
| `readonly` | 仅看板查看，所有写接口返回 403 |

`scripts/seed_users.py` 播种的三个账号使用**弱口令**（`admin123` 等），
仅供本地开发。部署前必须改密：

```bash
python3 -c "
import bcrypt, sqlite3
pw = bcrypt.hashpw('新密码'.encode(), bcrypt.gensalt()).decode()
conn = sqlite3.connect('data/mwlab.db')
cur = conn.execute('UPDATE user SET password_hash = ? WHERE email = ?', (pw, '账号邮箱'))
print(f'已更新 {cur.rowcount} 行')   # 0 行 = 邮箱不存在，密码没改
conn.commit(); conn.close()
"
```

停用账号：`UPDATE user SET is_active = 0 WHERE email = ?`。
因为 `requireUser()` 每次请求都查库，停用**立即生效**，不必等 token 过期。

---

## 6. 数据模型

```
exhibition_brand（品牌，主键稳定、变化慢）
  brand_id PK · name_cn/en · organizer · city · first_year
  industry_l1/l2 ← 仅分类脚本 + 人工打标可写
  industry_raw   ← 爬虫原始行业串，不直接展示
  competition_relation · mds_related · strategic_relevance · ma_potential
  display_ready  ← 由 check_display_ready.py 维护
    │
    ├── exhibition_edition（届次，时序数据，每年新增）
    │     edition_id PK = "{brand_id}-{year}" · brand_id FK
    │     year · date_start/end · venue · city
    │     area_sqm · exhibitors_count · visitors_count   ← 核心数字
    │     data_source [jufair / cnexpo / jufair+cnexpo]
    │
    ├── data_provenance（溯源）
    │     source_site · source_url · raw_payload(JSON) · crawl_batch_id
    │     UNIQUE(brand_id, source_url)
    │
    ├── manual_tag_history（打标与合并审计）
    │     field_name · old_value · new_value · changed_by
    │
    └── brand_geo_tag（地理标签，派生数据）

crawl_log        爬取批次日志（两个爬虫都写主库，看板设置页读它）
user             系统用户
person / exhibition_contact / contact_relation      人物与联系
exhibition_timeline / exhibition_relation           时间线与关系
intel_report / customer_prospect                    Intel 调研产出
```

**字段来源分野**——这条区分决定了哪些数据能自动补、哪些只能靠人：

- **爬虫可自动填充**：名称、日期、城市、场馆、面积、展商数、观众数、主办方（需核验）
- **必须人工打标**：`competition_relation`、`mds_related`、`strategic_relevance`、
  `ma_potential`、`competitor_group`、`yoy_trend`、`anomaly_flag`

Schema 迁移放在 `schema/migrations/`（001–010），`schema/db.py:init_db()` 在打开
数据库时自动按序应用并登记 `schema_version`。**新增迁移时**：若该列同时也写进了
`init_db.sql`，需在 `db.py:_reconcile_production()` 里加一条版本登记，否则全新库会
因为「列已存在」而 ALTER 失败（002、009、010 都是这么处理的）。

---

## 7. 测试

```bash
npm test                      # 前端 + 中间件（vitest，36 用例）
python3 -m pytest tests/ -q   # Python 工具链（144 用例）
npx tsc --noEmit              # 类型检查
```

三者当前均为全绿。测试全部使用临时数据库或内存库，不触碰 `data/mwlab.db`；
产出文件也一律写临时目录。**如果你新增的测试往仓库里写文件，那是 bug**。

---

## 8. 踩坑清单

按被坑概率排序。这些都是真实发生过、并且排查花了时间的。

**① 数据库路径**
主库是 `data/mwlab.db`，不是根目录。历史上根目录存在过一个同名空库，
导致「脚本跑成功了但数据没变」——因为写进了空库。该文件已删除，
现在路径写错会直接报错而不是静默无效。

**② 合并后忘记跑治理脚本**
见 §2 的警告。症状是新展会在看板上查不到、行业筛选里没有。

**③ `python3 tools/xxx.py` vs `python3 -m tools.xxx`**
`tools/` 下的脚本直接执行时 `sys.path[0]` 是 `tools/`，`import schema` 会失败。
已在 `merge_engine.py` 里补了 `sys.path` 插入，写新脚本时注意同样处理。

**④ 爬虫必须大陆 IP**
jufair 有地理封锁。非大陆环境用 `--proxy`（走本地 Tor 9050）。
两个爬虫都**不做任何来源伪装**（IP 伪造已按合规要求移除），
频率控制仅靠请求间隔 + 熔断，所以跑全量会比较慢，这是有意为之。

**⑤ 迁移与 `init_db.sql` 的重复定义**
见 §6 末尾。

**⑥ `edition_id` 的隐含约定**
格式是 `{brand_id}-{year}`。品牌合并时必须同步重写，否则会留下
`edition_id` 前缀与 `brand_id` 不一致的行（库里还有 87 条历史遗留）。

**⑦ 部署时的 DB 位置**
`lib/db.ts` 解析为 `process.cwd()/data/mwlab.db` 且 `fileMustExist: true`。
放错位置服务直接启动失败，不会降级。详见 `docs/DEPLOY.md`。

---

## 9. 当前状态与已知缺口

**数据规模**（2026-07-28）

| | |
|---|---|
| exhibition_brand | 6,946 |
| exhibition_edition | 7,264 |
| data_provenance | 7,927 |
| display_ready = 1 | 5,954（85.7%） |
| 主库体积 | 22 MB |
| raw_jufair / raw_cnexpo | 5,362 / 4,571 |

**Phase 状态**

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 数据采集（Jufair + cnexpo 爬虫） | ✅ |
| 2 | Schema、合并引擎、打标工具链 | ✅ |
| 3 · 3b | 看板 API、JWT 认证、Excel 批量打标 | ✅ |
| 4 | 前端 UI（筛选看板、日历、地图、设置） | ✅ |
| 5 | Intel 后端（调研报告、DB 查询、企查查接入） | ✅ |
| 6 | 代码审计与合规清理 | ✅ |
| 质检整改 | 脚本质检 + 数据治理，见 `docs/AUDIT-2026-07-27.md` | ✅ |
| **1b** | **全集采集（Jufair 全量 + cnexpo 全量）** | **⏳ 当前任务** |

**已知缺口**

- **无调度器**。`scheduler.py` 在多份历史文档中被标注「✅ 完成」，
  但该文件不存在于仓库——所谓「每周一 02:00 自动增量爬取」从未实现。
  目前唯一的 cron 任务是 `check_display_ready.py`。
- **三个人工打标字段仍为 0 条**：`competition_relation`、`strategic_relevance`、
  `ma_potential`。此前是打标工具链因缺列而崩溃所致，现已修复可用，等待人工投入。
- **33 个品牌无行业分类**：关键词规则覆盖不到的简称/小众品类
  （如「上海阿赫玛展」「临沂门博会」），需人工兜底或补规则。
- **87 条 `edition_id` 前缀错位 + 38 条溯源孤儿**：历史遗留，不影响查询。

---

## 相关文档

| 资源 | 路径 |
|------|------|
| 产品权威定义（PRD） | `docs/MWLAB-2026-PRD-v1.1-merged.md` |
| 架构说明 | `docs/ARCHITECTURE.md` |
| 部署手册 | `docs/DEPLOY.md` |
| 质检审计报告 | `docs/AUDIT-2026-07-27.md` |
| Claude Code 行为约束 | `CLAUDE.md` |
| 项目上下文与文件索引 | `AGENTS.md` |
| 历史规划文档 | `_archive/planning/` |

---

*本项目由 Claude Code（Anthropic）驱动开发。*
