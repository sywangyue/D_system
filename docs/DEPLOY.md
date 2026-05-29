# MWLAB-2026 · 部署运维手册

**状态**：生产环境运行中（2026-05-27 上线）  
**域名**：https://mwlaboratory.com  
**服务器**：阿里云轻量应用服务器，Ubuntu 22.04 LTS

---

## 服务器信息

| 项目 | 值 |
|------|-----|
| 公网 IP | 47.79.17.71 |
| 登录用户 | admin |
| SSH Key | `MWlab.pem`（项目根目录） |
| 项目路径 | `/home/admin/dashboard/` |
| RAM | 890MB 物理 + 2GB swap（/etc/fstab 持久化） |
| 磁盘 | 29GB |

```bash
# SSH 登录
ssh -i "/Volumes/databoard/AI Project/D_dashboard/MWlab.pem" admin@47.79.17.71
```

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
rsync -avz --delete \
  -e "ssh -i '/Volumes/databoard/AI Project/D_dashboard/MWlab.pem' -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/.next/" \
  admin@47.79.17.71:/home/admin/dashboard/.next/
```

> `--delete` 保证删除服务器上本地已去除的文件。  
> 不要上传 `node_modules`（已在服务器编译 better-sqlite3 原生 addon）。

### 3. 重启服务

```bash
ssh -i "/Volumes/databoard/AI Project/D_dashboard/MWlab.pem" admin@47.79.17.71 \
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
  -e "ssh -i '/Volumes/databoard/AI Project/D_dashboard/MWlab.pem' -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/crawlers/" \
  admin@47.79.17.71:/home/admin/dashboard/crawlers/

rsync -avz \
  -e "ssh -i '/Volumes/databoard/AI Project/D_dashboard/MWlab.pem' -o StrictHostKeyChecking=no" \
  "/Volumes/databoard/AI Project/D_dashboard/scheduler.py" \
  "/Volumes/databoard/AI Project/D_dashboard/requirements.txt" \
  admin@47.79.17.71:/home/admin/dashboard/
```

---

## 爬虫调度

| 任务 | 时间 | 命令 |
|------|------|------|
| 增量爬取（每周） | 周一 02:00 | `scheduler.py --cron` |
| 旧日志清理 | 每月1日 04:00 | `find logs/ -mtime +30 -delete` |

```bash
# 查看 cron 注册
crontab -l

# 手动触发（后台运行）
nohup .venv/bin/python3 scheduler.py --run-now >> logs/scheduler.log 2>&1 &

# 查看最近爬取状态
.venv/bin/python3 scheduler.py --status
```

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
| 中间件不生效，路由无保护 | `proxy.ts` 使用命名导出 `export async function proxy`，Turbopack 不识别 | 删除 `proxy.ts`，新建 `middleware.ts` 使用默认导出 |
| 服务启动即 crash | `@opennextjs/cloudflare` 在 `dependencies` 中，Node.js 环境加载时崩溃 | 移至 `devDependencies` |
| `better-sqlite3` 运行时找不到模块 | 原来在 `devDependencies` | 移至 `dependencies` |
| `.next/static/chunks` 文件缺失（404） | rsync 部分上传，服务器 9 个 chunk 本地 13 个 | 加 `--checksum` 标志强制校验补传 |
| HTTPS 无法访问 | Cloudflare 代理关闭（灰云），SSL 模式为 Off | 开启橙云代理，SSL 设为 Flexible |
| 爬虫 `database is locked` | Python `sqlite3.connect()` 默认 5s timeout，遇 WAL 写锁失败 | 所有 `sqlite3.connect(db_path)` 加 `timeout=30` |
| authorized_keys 损坏无法 SSH | RSA 公钥粘贴时换行，SSH 无法解析 | 服务器用 Python heredoc 写入单行公钥 |

### 关键配置约束

- `mwlab.db` 路径硬编码为 `process.cwd()/mwlab.db` — 必须放在 `/home/admin/dashboard/`
- `better-sqlite3` 是原生 C addon，必须在目标平台编译 — **不能**从本地上传 `node_modules`
- 服务器加了 2GB swap（`/etc/fstab` 持久化）防内存压力，但仍不足以跑 build
- Nginx 配置 `gzip off`（Next.js API 层已手动 gzip 压缩，不重复）

---

## 数据库备份

```bash
# 在服务器上备份（建议每周手动一次或加入 cron）
cp /home/admin/dashboard/mwlab.db \
   /home/admin/dashboard/mwlab_backup_$(date +%Y%m%d).db

# 下载到本地
scp -i "/Volumes/databoard/AI Project/D_dashboard/MWlab.pem" \
  admin@47.79.17.71:/home/admin/dashboard/mwlab.db \
  "/Volumes/databoard/AI Project/D_dashboard/mwlab_backup_$(date +%Y%m%d).db"
```
