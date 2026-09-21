# MWLAB-2026 · 部署运维手册

**状态**：生产环境运行中。2026-05-27 首次上线，2026-09-17 旧版整体下架、全新部署（V2-16）  
**域名**：https://mwlaboratory.com  
**服务器**：阿里云轻量应用服务器，Ubuntu 22.04 LTS

---

## 服务器信息

| 项目 | 值 |
|------|-----|
| 公网 IP | 47.79.17.71 |
| 登录用户 | admin |
| SSH Key | `~/.ssh/MWlab.pem`（已移出项目目录） |
| 项目路径 | `/home/admin/dashboard/` |
| RAM | 890MB 物理 + 2GB swap（/etc/fstab 持久化） |
| 磁盘 | 29GB |

```bash
# SSH 登录
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71
```

---

## ⚠️ 2026-09-17 全新部署后的约定（先读这一节）

旧版已整体下架，服务器目录重建。备份：服务器 `~/backups/dashboard-pre-redeploy-20260917-2026.tgz`，
本地 `data/backups/server-20260917-2026/`（旧库 + 线上环境文件）。

**服务器上绝对不要运行 `npm install` / `npm ci`。** 890MB 内存，npm 解析依赖清单就会耗尽内存、
整机失去响应（SSH 握手超时），2026-09-17 连续两次只能在控制台重启。依赖一律在本地按 Linux 平台装好再上传：

```bash
S=$(mktemp -d); cp package.json package-lock.json $S/ && cd $S
npm ci --omit=dev --ignore-scripts --os=linux --cpu=x64 --libc=glibc
# SQLite 驱动：取 Linux + Node 20（ABI 115）的预编译二进制
(cd node_modules/better-sqlite3 && ../.bin/prebuild-install --platform linux --arch x64 --libc glibc --runtime node --target 20.20.2)
file node_modules/better-sqlite3/build/Release/better_sqlite3.node   # 必须是 ELF x86-64
rm -rf node_modules/@next/swc-linux-x64-musl node_modules/@img/*musl*
ssh admin@47.79.17.71 'rm -rf ~/dashboard/node_modules'
COPYFILE_DISABLE=1 tar -czf - node_modules | ssh admin@47.79.17.71 'cd ~/dashboard && nice -n 19 tar -xzf -'
```

只有 `package.json` 依赖变了才需要重做这一步；平时只传 `.next/`。

**上传清单**（服务器 `~/dashboard/` 下只有这些）：

| 内容 | 说明 |
|---|---|
| `.next/` | 排除 `.next/dev`（本地开发缓存，500MB+）与 `.next/cache` |
| `public/` `knowledge/` | 静态资源、知识库 |
| `reports/` `exports/` `research/` | 资源下载接口读这三个目录，缺了下载全 404 |
| `package.json` `package-lock.json` `next.config.ts` | |
| `data/mwlab.db` | 见下 |
| `.env.production.local` | 只有 `JWT_SECRET`，权限 600 |
| `node_modules/` | 见上 |

**数据库**：本地库是唯一数据源（采集管道跑在本机 crontab）。上传前用 `sqlite3 data/mwlab.db ".backup 副本"`
取一致快照；**线上账号密码与本地不同**，上传前把副本里 `user.password_hash` 按 email 换成线上库的值，
否则线上登录密码会变成本地的。服务器上**没有**定时任务（旧的 scheduler.py 定时任务已删）。

**进程**（内存上限是防死机的关键，重建时照抄）：

```bash
pm2 start node_modules/next/dist/bin/next --name mwlab-dashboard --cwd /home/admin/dashboard \
  --node-args="--max-old-space-size=320" --max-memory-restart 450M -- start -p 3000
pm2 save
```

稳定运行约 180MB。`vm.swappiness` 已从 0 改为 10（`/etc/sysctl.conf`，原文件备份为 `.bak-20260917`）：
设为 0 时内核几乎不用交换区，内存一紧就直接卡死。

---

## 完整代码更改流程

> GitHub 与服务器**完全脱钩**，push 到 GitHub 不会触发任何服务器操作，需手动部署。

```
编写代码
  ↓
git add / git commit          # 版本控制：记录变更
  ↓
git push origin main          # 备份到 GitHub（不影响服务器）
  ↓
npm run build                 # 本地 Mac 编译（服务器内存不足）
  ↓
rsync .next/ → 服务器         # 上传构建产物
  ↓
pm2 reload mwlab-dashboard    # 零停机重载
```

**关键约束**：GitHub 仓库是代码备份，服务器运行的是本地编译后上传的产物，两者版本必须手动保持同步。

---

## 日常部署流程

> 服务器内存不足以跑 `npm run build`（OOM），永久策略：**本地 Mac 构建 → rsync 上传**。

### 1. 本地构建

```bash
cd "/Volumes/databoard/AI Project/D_dashboard"
npm run build
```

### 2. 上传 .next

```bash
rm -rf .next/dev                       # ⚠️ 先删，见下
rsync -avz --delete --exclude 'cache' \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/.next/" \
  admin@47.79.17.71:/home/admin/dashboard/.next/
```

> `--delete` 保证删除服务器上本地已去除的文件。  
> 不要上传 `node_modules`（已在服务器编译 better-sqlite3 原生 addon）。
>
> ⚠️ **跑过 `npm run dev` 就必须先 `rm -rf .next/dev`**。上面「上传清单」里写了要排除它，
> 但这条命令原先没带 —— 2026-09-21 实测 `.next/dev` 有 **481MB**，照抄就会把它推上
> 890MB 内存的机器。删掉后实际传的 `.next/` 只有 19MB。`cache` 同理，用 `--exclude` 挡掉。

### 3. 重启服务

```bash
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 \
  "source ~/.nvm/nvm.sh && pm2 reload mwlab-dashboard"
```

> 必须先 `source ~/.nvm/nvm.sh` 才能找到 pm2，否则报 `command not found`。

### 4. 验证

```bash
curl -s https://mwlaboratory.com/api/setting/status | head -c 200
```

---

## 同步 Python 爬虫

爬虫文件修改后，单独 rsync：

```bash
rsync -avz \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/crawlers/" \
  admin@47.79.17.71:/home/admin/dashboard/crawlers/

rsync -avz \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/requirements.txt" \
  admin@47.79.17.71:/home/admin/dashboard/
```

---

## 同步知识库内容

知识库是**文件即数据源**（见 `docs/archive/V2-task-specs.md`（V2-10））：正文与文档在 `knowledge/`，
图片在 `public/knowledge/`。**两个目录都要单独同步** —— 少一个的话，
线上这一页是空的（读不到 index.md）、图是裂的（静态文件不在）。

```bash
rsync -avz \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/knowledge/" \
  admin@47.79.17.71:/home/admin/dashboard/knowledge/

rsync -avz \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/public/knowledge/" \
  admin@47.79.17.71:/home/admin/dashboard/public/knowledge/
```

> 加项目 / 换图之后都要重跑这两条。只改 `.next/`（第 2 步）不会带上内容文件 ——
> 它们是运行时读的原始文件，不在构建产物里。

> ⚠️ **`knowledge/*/docs/` 不在 git 里**（`.gitignore`，2026-09-18 加）。那里放的是
> 合同、董事会审批件、商业条件这类东西，而 **GitHub 仓库是 PUBLIC 的** —— 进 git
> 等于全网可见，且 git 历史永久留存。正文 `index.md` 与 `public/knowledge/` 的图片
> 照常进 git，只有 `docs/` 例外。
>
> 后果是：**从干净克隆部署会静默少掉全部附件**（页面右栏「文档」整块消失，不报错）。
> 上面第一条 rsync 是这些文件到线上的唯一通道，本地那份是唯一副本，别当它能从 git 恢复。

## 同步落地页产品图

官网落地页 `/` 首屏的截图是 `public/landing/product.webp`，同样不在构建产物里：

```bash
rsync -avz \
  -e "ssh -i ~/.ssh/MWlab.pem -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/public/landing/" \
  admin@47.79.17.71:/home/admin/dashboard/public/landing/
```

> 这张图是公开的（落地页不需要登录）。重截时只能截 `/expo`，
> 且要先清空筛选、把日历翻到没有事项的月份、裁掉侧栏 —— 侧栏有账号邮箱，日历里是机会名称。

---

## 爬虫调度

**采集不在服务器上跑。** jufair 只认大陆 IP，服务器在阿里云，所以采集与治理整条管道
跑在 Max 本机 Mac Mini 的 crontab 上，产出 `data/mwlab.db` 后随部署上传。
**这一节只是提示它在哪，完整说明在 `AGENTS.md`「定时任务」**，改动以那边为准。

| 任务 | 时间 | 位置 |
|------|------|------|
| 月度全流程（采集→合并→分类→状态→展示池→复核表） | 每月 7/27 号 03:00 | 本机 · `scripts/run_pipeline.sh` |
| 展示池标记 | 每周一 02:00 | 本机 · `scripts/check_display_ready.py` |

```bash
crontab -l                     # 本机查看；本项目的段在 MWLAB-PIPELINE-BEGIN/END 之间
bash scripts/run_pipeline.sh   # 手动补跑（cron 不补跑错过的那次）

# 查看最近爬取状态
sqlite3 data/mwlab.db "SELECT batch_id, source_site, status, started_at, finished_at,
                              total_fetched, total_inserted
                       FROM crawl_log ORDER BY started_at DESC LIMIT 5;"
```

> 早期版本这里写着 `scheduler.py --cron` 与「旧日志清理 每月1日 04:00」，
> 两者都不存在：`scheduler.py` 从未进过仓库，日志清理那条 crontab 里也没有。
> 命令里的 `.venv/bin/python3` 同样失效 —— 本机没有 venv，cron 用的是系统 `python3`。

---

## PM2 常用命令

> 所有 PM2 命令需在服务器上先执行 `source ~/.nvm/nvm.sh`，或直接用完整路径 `/home/admin/.nvm/versions/node/v20.20.2/bin/pm2`。

```bash
# 远程执行示例（从本地 Mac）
ssh -i "MWlab.pem" admin@47.79.17.71 "source ~/.nvm/nvm.sh && pm2 status"

pm2 status                     # 查看进程状态
pm2 logs mwlab-dashboard       # 实时日志
pm2 logs mwlab-dashboard --lines 100  # 最近 100 行
pm2 restart mwlab-dashboard    # 重启（有短暂停机）
pm2 reload mwlab-dashboard     # 零停机重载（推荐）
```

---

## 环境变量

位置：`/home/admin/dashboard/.env.production.local`

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥（HS256） |

---

## Cloudflare 配置

| 项目 | 值 |
|------|-----|
| DNS 记录 | A 记录 → 47.79.17.71 |
| 代理状态 | **橙云（Proxy ON）** — 不能关闭，否则 HTTPS 失效 |
| SSL 模式 | **Flexible**（Cloudflare 终止 TLS，HTTP 转发到服务器） |
| Universal SSL | Active |

---

## 技术变更记录（迁移过程关键修复）

### Railway → 阿里云迁移（2026-05-27）

| 问题 | 原因 | 修复 |
|------|------|------|
| `npm run build` OOM 崩溃 | 服务器仅 512MB RAM，Next.js build 需 1-1.5GB | 改为本地 Mac 构建，rsync 上传 `.next` |
| 中间件不生效，路由无保护 | 命名导出 `export async function proxy`，Turbopack 不识别 | 改用**默认导出**。当时顺带把文件改名为 `middleware.ts`，但根因是导出方式、不是文件名 —— Next.js 16 的中间件文件就叫 `proxy.ts`，现在仓库里是 `proxy.ts` + `export default`，不要再去建 `middleware.ts` |
| 服务启动即 crash | `@opennextjs/cloudflare` 在 `dependencies` 中，Node.js 环境加载时崩溃 | 移至 `devDependencies` |
| `better-sqlite3` 运行时找不到模块 | 原来在 `devDependencies` | 移至 `dependencies` |
| `.next/static/chunks` 文件缺失（404） | rsync 部分上传，服务器 9 个 chunk 本地 13 个 | 加 `--checksum` 标志强制校验补传 |
| HTTPS 无法访问 | Cloudflare 代理关闭（灰云），SSL 模式为 Off | 开启橙云代理，SSL 设为 Flexible |
| 爬虫 `database is locked` | Python `sqlite3.connect()` 默认 5s timeout，遇 WAL 写锁失败 | 所有 `sqlite3.connect(db_path)` 加 `timeout=30` |
| authorized_keys 损坏无法 SSH | RSA 公钥粘贴时换行，SSH 无法解析 | 服务器用 Python heredoc 写入单行公钥 |

### 关键配置约束

- `lib/db.ts` 解析路径为 `process.cwd()/data/mwlab.db` — 数据库必须放在 `/home/admin/dashboard/data/`
  （且 `fileMustExist: true`，放错位置服务会直接启动失败，不会静默降级）
- `better-sqlite3` 是原生 C addon，必须是 Linux x64 的二进制。**但不能在服务器上编译或
  `npm install`**（890MB 内存会被打满、整机失联）—— 正确做法是在本地用 `prebuild-install`
  取 Linux 预编译二进制后连同 `node_modules` 一起上传，见顶部「2026-09-17 约定」。
  本节此前写的「不能从本地上传 node_modules」是 05-27 迁移时的判断，已被推翻
- 服务器加了 2GB swap（`/etc/fstab` 持久化）防内存压力，但仍不足以跑 build
- Nginx 配置 `gzip off`（Next.js API 层已手动 gzip 压缩，不重复）

---

## 同步数据库到服务器

本地库是唯一数据源。改过数据（跑 pipeline、改密码）后要同步才在线上生效。

```bash
# 1. 生成一致性副本（直接 cp 会漏掉 WAL 里未合并的事务）
sqlite3 data/mwlab.db ".backup /tmp/mwlab_upload.db"
sqlite3 /tmp/mwlab_upload.db "PRAGMA integrity_check;"    # 必须回 ok

# 2. 服务器先备份
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 \
  "cp ~/dashboard/data/mwlab.db ~/backups/mwlab_pre-sync-$(date +%Y%m%d-%H%M).db"

# 3. 上传到临时名，避免覆盖到一半服务读到残缺文件
rsync -avz -e "ssh -i ~/.ssh/MWlab.pem" /tmp/mwlab_upload.db \
  admin@47.79.17.71:/home/admin/dashboard/data/mwlab.db.new

# 4. 停服务 → 换库 → 清旧 WAL → 起服务
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 'source ~/.nvm/nvm.sh
  pm2 stop mwlab-dashboard
  cd ~/dashboard/data && mv mwlab.db.new mwlab.db && rm -f mwlab.db-wal mwlab.db-shm
  pm2 start mwlab-dashboard'
```

> **必须停服务再换。** better-sqlite3 持有旧库的文件句柄，热替换会读出不一致的数据。
> **`-wal` / `-shm` 必须删。** 它们属于旧库，留着会让新库读出旧事务。

### ⚠️ 换完库要重新构建，否则页面还是旧数字

落地页的数据在**构建时**烘进产物。只换库不重新 build，页面不会变。
而且 **`.next/cache` 会让 build 复用上一次的预渲染结果** —— 2026-09-18 就踩了这个：
库换了、服务重启了、`cf-cache-status` 也确认没走 CDN 缓存，页面照样是旧数字。

```bash
rm -rf .next && npm run build                      # 本地：清掉 Full Route Cache 重建
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 "rm -rf ~/dashboard/.next/cache"
rsync -avz --delete --exclude dev -e "ssh -i ~/.ssh/MWlab.pem" \
  .next/ admin@47.79.17.71:/home/admin/dashboard/.next/
ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 \
  "source ~/.nvm/nvm.sh && pm2 reload mwlab-dashboard"
```

---

## 安全配置

### 已做的（2026-09-18）

| 项 | 位置 |
|---|---|
| 会话 cookie `secure`（仅 HTTPS 传输） | `app/api/auth/login/route.ts`，按 `NODE_ENV` 区分 |
| 登出清除属性与种下时对齐 | `app/api/auth/logout/route.ts` |
| X-Frame-Options / nosniff / Referrer-Policy / Permissions-Policy / COOP | `next.config.ts` 的 `headers()` |
| pm2 显式 `NODE_ENV=production` | `NODE_ENV=production pm2 restart mwlab-dashboard --update-env` |

> `secure` 依赖 `NODE_ENV`。`next start` 虽然默认 production，但别赌 ——
> 万一它不是 production，`secure` 就是 false，会话令牌会在 HTTP 上明文传输。
> 重启服务时保持 `--update-env` 带上这个变量。

### ⚠️ 还没做：HSTS 要去 Cloudflare 开

线上 `strict-transport-security: max-age=0` —— **这个头不是 Next 发的**
（Next 默认不发），是 Cloudflare 边缘发的。`next.config.ts` 里那条设置会被它覆盖，
实测部署后线上仍是 `max-age=0`。

要真正生效：Cloudflare 控制台 → SSL/TLS → Edge Certificates → HSTS → Enable，
建议 max-age 6 个月起、勾 includeSubDomains。
**开之前确认所有子域都能上 HTTPS**，开启后浏览器会拒绝任何 HTTP 访问，且有缓存期，
配错了要等 max-age 过期才能恢复。

### 还没做：CSP

本站有内联样式（令牌变量、SVG 的 style 属性）与 Next 的水合引导脚本，
直接上强制模式会白屏。要加的话先 `Content-Security-Policy-Report-Only` 观察上报。

---

## 改账号密码

系统里**没有改密码的界面或接口**。用脚本改本地库，再按上面的流程同步：

```bash
python3 scripts/set_password.py --list                    # 看有哪些账号
python3 scripts/set_password.py admin@mwlab.internal      # 交互式输入，不留 shell 历史
```

密码短于 8 位会被挡（线上是公网可访问的）；确实要用短的加 `--force`。

---

## 数据库备份

```bash
# 在服务器上备份
cp /home/admin/dashboard/data/mwlab.db \
   ~/backups/mwlab_backup_$(date +%Y%m%d).db

# 下载到本地 —— 落进 data/backups/，不要丢在仓库根目录
scp -i ~/.ssh/MWlab.pem \
  admin@47.79.17.71:/home/admin/dashboard/data/mwlab.db \
  "/Volumes/databoard/AI Project/D_dashboard/data/backups/mwlab_server_$(date +%Y%m%d).db"
```
