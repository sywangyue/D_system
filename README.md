![MWLAB 万象 · BD Database](docs/readme-hero-mds.png)

# MWLAB 万象 · 杜塞尔多夫展览上海 BD 工作台

**一句话**：以**公司**为中心的 BD 工作台 —— 公司库、机会台、调研库、知识库，
展会数据降级为被引用的底图。生产环境 https://mwlaboratory.com

> 本文件写给接手项目的开发者，只讲「怎么跑起来、东西在哪、常用命令」。
> 架构决策在 `docs/ARCHITECTURE.md`，数据层与采集管道在 `AGENTS.md`，
> 两者都不在这里重复。

---

## 1. 跑起来

**前提**：Node.js 20+、Python 3.12+

```bash
npm install
pip install -r requirements.txt

# JWT_SECRET 必填，否则服务启动即抛错
cat > .env.local <<'ENV'
JWT_SECRET=本地随便一串足够长的随机字符串
ENV

# data/mwlab.db 不入库。手上没有现成的库时，
# schema/db.py 会按 init_db.sql + migrations/ 自动建表
python3 -c "import sys; sys.path.insert(0,'.'); from schema.db import init_db; init_db('data/mwlab.db').close()"

python3 scripts/seed_users.py    # 幂等，已存在则跳过
npm run dev
```

打开 http://localhost:3000，用 `admin@mwlab.internal` / `admin123` 登录。
另有 `manager@` 与 `readonly@`（密码同前缀 + 123）用于验权限分级。

> 局域网其他设备访问要在 `next.config.ts` 的 `allowedDevOrigins` 里加该设备 IP。

---

## 2. 仓库结构

代码之外的目录都不入库：`data/` `exports/` `logs/` `output/` `reports/` `research/`
是本地运营资料，靠 rsync 直接同步到服务器（见 `docs/DEPLOY.md`「上传清单」）。

```
app/            Next.js App Router：页面壳 + API Routes
components/     共用组件
lib/            db.ts（只读单例 + 写连接）· api-guard.ts（鉴权）· queries/（聚合查询）
proxy.ts        中间件：JWT 验签 + 路由守卫
locales/        zh.json · en.json，两份键必须完全对齐

crawlers/       jufair_crawler.py（须大陆 IP）· jf_shell_crawl.sh · cnexpo_crawler.py
tools/          merge_engine.py（双源合并）· export_*.py · import_tags.py · intel/（企查查与调研）
scripts/        run_pipeline.sh（月度管道）· classify_all_brands.py · dedup.py 等治理脚本
schema/         init_db.sql + migrations/（由 db.py:init_db() 打开库时自动应用）

_archive/       一次性治理脚本与历史产物，本地留档不入库（onetime/ 下按原目录分放）
knowledge/      知识库正文（文件即数据源，图在 public/knowledge/）
design/         设计稿与预览页
tests/          vitest（接口，模拟库）+ pytest（Python 工具）
docs/           现行文档 7 份 + archive/ 历史原文
```

---

## 3. 常用命令

### 采集与治理

日常走 cron（每月 7/27 号 `scripts/run_pipeline.sh`）。手动等价流程见 `AGENTS.md`，
其中两条不能省：`merge_engine.py` 必须传具体 `batch_id`（`ALL` 是 O(N²)），
爬虫必须带 `--refresh`（否则源站改档期同步不进来）。

**合并之后治理脚本必跑**，漏跑的症状是新展会在看板上查不到、行业筛选里没有。

### 导出与打标

```bash
python3 tools/export_exhibitions.py --month 2026-08          # 月度境内清单
python3 tools/export_exhibitions.py --from 2026-01-01 --to 2027-07-31 \
    --region all --no-merge -o /tmp/all.xlsx

python3 tools/export_for_tagging.py --industry_l2 "工业装备" --status untagged
python3 tools/import_tags.py --file exports/tagging_batch_YYYYMMDD.xlsx \
    --changed-by you@company.com                              # 每条变更写 manual_tag_history
```

### 测试与门禁

```bash
npx tsc --noEmit                 # 类型
npm run build                    # 构建（Turbopack 告警也算失败）
npm test                         # vitest，197 用例
python3 -m pytest tests/ -q      # pytest，135 用例
```

四项当前全绿。测试一律用临时库或内存库，产出写临时目录 ——
**新增的测试如果往仓库里写文件，那是 bug**。完整质检协议与数据基线见 `docs/QC.md`。

---

## 4. 踩坑清单

按被坑概率排序，都是真实发生过且排查花了时间的。

**① 数据库路径**：主库是 `data/mwlab.db`，不是根目录。根目录曾有同名空库，
导致「脚本跑成功了但数据没变」，该文件已删，现在路径写错会直接报错。

**② 合并后忘记跑治理**：见上。

**③ `python3 tools/xxx.py` vs `python3 -m tools.xxx`**：直接执行时 `sys.path[0]`
是 `tools/`，`import schema` 会失败。写新脚本要照 `merge_engine.py` 的写法补 `sys.path`。

**④ 爬虫必须大陆 IP**：jufair 有地理封锁，非大陆用 `--proxy`（本地 Tor 9050）。
两个爬虫都不做来源伪装，靠请求间隔 + 熔断控频，跑全量慢是有意为之。

**⑤ `edition_id` 的隐含约定**：格式 `{brand_id}-{year}`，品牌合并时必须同步重写。

**⑥ 部署时的 DB 位置**：`lib/db.ts` 解析为 `process.cwd()/data/mwlab.db` 且
`fileMustExist: true`，放错位置服务直接启动失败，不降级。

**⑦ 服务器上绝不能跑 `npm install`**：890MB 内存，解析依赖清单就会耗尽内存整机失联。
依赖在本地按 Linux 平台装好上传，见 `docs/DEPLOY.md` 顶部约定。

---

## 5. 文档索引

| 内容 | 路径 |
|---|---|
| 文档总索引与编码规则 | `docs/README.md` |
| 架构：数据模型、鉴权、写接口约定 | `docs/ARCHITECTURE.md` |
| 质检协议与数据基线 | `docs/QC.md` |
| 部署运维 | `docs/DEPLOY.md` |
| 设计规范（Token · 排版 · 品牌 · i18n） | `docs/DESIGN.md` |
| 全部历史步骤（V1-xx / V2-xx） | `docs/HISTORY.md` |
| 待办 | `docs/ROADMAP.md` |
| 数据层、采集管道、技术约束 | `AGENTS.md` |
| Claude Code 行为约束 | `CLAUDE.md` |
| PRD、审计、任务规格原文 | `docs/archive/` |

---

*本项目由 Claude Code（Anthropic）驱动开发。*
