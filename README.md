![MWLAB-2026 · BD Database · Exhibition Competitive Dashboard · 80s terminal pixel style](docs/readme-hero-mds.png)

# MWLAB-2026 · Exhibition Competitive Dashboard

**代号**：MWLAB-2026  
**客户语境**：杜塞尔多夫展览上海（BD 总监）  
**一句话**：结构化展会数据库 + 竞争盘面看板——选品类，看竞争对手 / 潜在伙伴 / 新进入者，附规模信号（品牌数 / 展商 / 观众 / 面积）。

---

## 项目定位

- **核心场景**：评估是否进入某个新展会市场，三步点选内给出竞争结构与规模信号。
- **服务对象**：中国总经理（决策者优先，非技术用户）。
- **原则内不做**：上游产业链指数、下游 AI 建议、自由文字录入为主交互。

---

## 技术架构

```
Browser
  └── Next.js 16（前端 + API Routes）
        └── better-sqlite3 → mwlab.db（SQLite）
```

**单进程，无外部服务依赖。** 认证、查询、写入全部在 Next.js API Routes 内完成。

| 层 | 技术 |
|----|------|
| 前端框架 | Next.js 16 App Router + React 18 |
| 样式 | Tailwind CSS |
| 数据库 | SQLite（`mwlab.db`），`better-sqlite3` 读写 |
| 认证 | JWT（`jose` 签发/验签）+ bcryptjs 密码哈希，Cookie 存储 |
| 鉴权 | `proxy.ts`（Next.js 16 中间件）全局路由守卫 |
| 数据采集 | Python 爬虫（`crawlers/`），手动触发 |
| 打标工具 | `tools/export_for_tagging.py` + `tools/import_tags.py`（openpyxl） |

---

## 本地启动

**前提**：Node.js 18+、Python 3.12+

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev
```

访问 `http://localhost:3000`，使用内部账号登录。

> **注意**：若从局域网其他设备访问，需在 `next.config.ts` 的 `allowedDevOrigins` 中添加该设备 IP。

---

## 用户体系

用户存储于 `mwlab.db` 的 `user` 表，角色三级：

| 角色 | 权限 |
|------|------|
| `admin` | 全部功能 + 设置页（用户管理、数据状态） |
| `manager` | 看板 + 打标写入 |
| `readonly` | 仅看板查看 |

重置密码（Python 直接操作 SQLite）：

```bash
python3 -c "
import bcrypt, sqlite3
pw = bcrypt.hashpw('新密码'.encode(), bcrypt.gensalt()).decode()
conn = sqlite3.connect('mwlab.db')
conn.execute('UPDATE user SET password_hash = ? WHERE email = ?', (pw, '账号邮箱'))
conn.commit(); conn.close()
"
```

---

## 数据库结构

**主库**：`mwlab.db`（SQLite，WAL 模式）

```
exhibition_brand        展会品牌（主表）
  ├── exhibition_edition    届次数据（面积/展商/观众等）
  ├── data_provenance       数据溯源
  └── manual_tag_history    人工打标历史

crawl_log               爬取批次日志
user                    系统用户
```

Schema 完整定义：`schema/init_db.sql`

**双源合并规则（摘要）**：名称/时间/地点以 jufair 为准；展商数/观众数/面积取较大值；主办方双源保留；缺失字段谁有取谁。

---

## 数据采集

Jufair 爬虫须在**大陆 IP** 环境执行。

```bash
# Jufair 全量采集
python3 crawlers/jufair_crawler.py

# cnexpo 全量采集
python3 crawlers/cnexpo_crawler.py

# 合并到主库
python3 merge_engine.py
```

---

## Excel 批量打标

用于人工标注 `competition_relation`、`industry_l1/l2`、`mds_related` 等字段。

```bash
# 导出待打标 Excel
python3 tools/export_for_tagging.py --industry_l2 "机床" --status untagged

# 导入打标结果
python3 tools/import_tags.py \
  --file exports/tagging_batch_YYYYMMDD.xlsx \
  --changed-by you@company.com
```

依赖：`pip install openpyxl`

---

## API Routes 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/logout` | 退出，清除 Cookie |
| GET | `/api/dashboard` | 看板数据（KPI + 品牌列表 + 图表数据） |
| GET | `/api/filter-options` | 筛选项（行业 L1/L2、MDS 关联） |
| GET | `/api/brands/[id]` | 单个品牌详情 |
| PATCH | `/api/brands/[id]/tags` | 更新打标字段 |
| GET | `/api/users` | 用户列表（admin） |
| GET | `/api/setting/status` | 数据状态 + 系统信息（admin） |
| GET | `/api/calendar/events` | 展会日历数据 |
| GET | `/api/map/markers` | 展会地理分布数据 |

---

## 测试

```bash
# 前端 API 测试
npm test

# Python 工具测试
python3 -m pytest tests/ -v
```

---

## 权威文档

| 资源 | 路径 |
|------|------|
| 整合 PRD（唯一产品权威） | `docs/MWLAB-2026-PRD-v1.1-merged.md` |
| 架构说明 | `docs/ARCHITECTURE.md` |
| Claude Code 行为约束 | `CLAUDE.md` |
| 项目上下文与文件索引 | `AGENTS.md` |
| 历史规划文档 | `_archive/planning/` |

---

## Phase 状态

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 数据采集（Jufair + cnexpo 爬虫） | ✅ |
| 2 | Schema、合并引擎、人工打标工具链 | ✅ |
| 3 | 看板 API、JWT 认证、前端基础架构 | ✅ |
| 3b | Excel 批量打标工具 | ✅ |
| 4 | 前端 UI（筛选看板、日历、地图、设置） | ✅ |
| 架构整改 | 移除 Supabase 和 FastAPI，统一到 Next.js 单进程 | ✅ |
| 5 | Intel 后端（调研报告存储、DB 查询、企查查 API 接入） | ✅ |
| 6 | 代码审计与合规清理（68 项修复，去除 XFF 绕过等） | ✅ |
| **1b** | **全集采集（Jufair ~8.4K + cnexpo 全量）** | **⏳** |

---

*本项目由 Claude Code（Anthropic）驱动开发。*
