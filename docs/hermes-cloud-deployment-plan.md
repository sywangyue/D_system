# MWLAB-2026 · Hermes 云端部署方案 v1.0

**作者**: Hermes Agent
**日期**: 2026-05-13
**状态**: 待评审

---

## 1. 目标

将 Hermes Agent 部署到阿里云，通过企业微信网关让 100 名内部同事使用自然语言进行展会调研。

```
用户在企业微信 @Agent:
  "查一下上海劳保展的竞争盘面"
  "新能源赛道有什么新展会"
  "列出所有机械和设备类的展会"

Hermes → research.py → mwlab.db → 格式化回复
```

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    阿里云 ECS (大陆节点)                    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Hermes Agent (常驻进程)                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │ CIOSH    │  │ MWLAB    │  │ (其他 Profile) │  │   │
│  │  │ Profile  │  │ Profile  │  │                │  │   │
│  │  └──────────┘  └──────────┘  └────────────────┘  │   │
│  │                                                     │   │
│  │  Skills: exhibition-research, ...                   │   │
│  │  Tools: terminal, file, web, browser, ...           │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                 │
│  ┌──────────────────────┴───────────────────────────┐   │
│  │              WeCom Gateway (企业微信)               │   │
│  │  - 接收消息 → 路由到 Hermes → 返回回复             │   │
│  │  - 100 个同事通过企业微信身份鉴权                   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                 │
│  ┌──────────────────────┴───────────────────────────┐   │
│  │              mwlab.db (只读)                       │   │
│  │  - 从 Mac Mini 定期 rsync 同步                     │   │
│  │  - 5,941 brands / 6,084 editions                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  API 调用: DeepSeek / MiniMax / Kimi（国内直连）          │
└─────────────────────────────────────────────────────────┘

         ▲ rsync (每周一凌晨)
         │
┌────────┴─────────────────────────────────────────────┐
│              Mac Mini 北京办公室                        │
│  - jufair_crawler.py (需要大陆IP)                     │
│  - cnexpo_crawler.py                                  │
│  - merge_engine.py                                    │
│  - scheduler.py (每周一增量 / 月初全量)                │
└──────────────────────────────────────────────────────┘
```

---

## 3. 关键决策

### 3.1 服务器选型

| 方案 | 配置 | 月费 | 推荐度 |
|------|------|------|--------|
| A. 已有 CIOSH 项目服务器 | 复用 | 0 | ⭐⭐⭐ 最优 |
| B. 新开 ECS 2C4G | 约 ¥200/月 | ¥200 | ⭐⭐ 够用 |
| C. 新开 ECS 4C8G | 约 ¥400/月 | ¥400 | ⭐ 有余量 |

**建议**: 如果 CIOSH 项目已有阿里云服务器，直接复用。Hermes Agent 本身轻量（Python 进程，100-300MB 内存），research.py 只是 SQLite 查询，CPU 压力极小。

### 3.2 数据库同步

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 服务器直接跑爬虫 | 数据实时 | jufair 需要大陆 IP（阿里云国内节点满足），但爬虫可能被反爬影响服务器稳定性 |
| B. Mac Mini 爬 → rsync 到服务器 | 爬虫隔离，稳定 | 数据有延迟（最长一周） |
| C. 服务器做所有事（爬虫+查询） | 简单 | 单点故障，反爬风险 |

**建议**: 方案 B。爬虫在 Mac Mini 跑（已验证可行），数据库通过 rsync 同步到服务器。调研场景对实时性要求不高（一周延迟可接受）。

### 3.3 鉴权

不需要额外账号系统。企业微信网关自带身份识别：
- 每个同事在企业微信里 @Agent，Hermes 自动获取企业微信 user_id
- 不需要用户名密码
- 不需要 JWT token
- 100 人无额外管理成本

### 3.4 API 提供商

Hermes 支持国内直连的提供商：

| 提供商 | 模型 | 成本 | 推荐度 |
|--------|------|------|--------|
| DeepSeek | v4-pro / v4-flash | 低 | ⭐⭐⭐ 主力 |
| MiniMax | abab6.5s | 中 | ⭐⭐ 备选 |
| Kimi (Moonshot) | moonshot-v1 | 中 | ⭐⭐ 备选 |
| 阿里 DashScope | qwen-max | 中 | ⭐⭐ 备选 |

**建议**: 主力 DeepSeek v4-flash（便宜、够用），复杂分析切 v4-pro。设 credential pool 自动切换防限流。

---

## 4. 实施步骤（6 步）

### Step 1: 服务器准备（30 分钟）

```bash
# SSH 到目标服务器
ssh root@<阿里云服务器IP>

# 安装依赖
apt update && apt install -y python3 python3-pip git curl sqlite3

# 安装 Hermes
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

### Step 2: 上传项目文件（10 分钟）

```bash
# 从 Mac Mini 上传
rsync -avz "/Volumes/databoard/AI Project/D_dashboard/mwlab.db" root@<服务器>:/opt/mwlab/
rsync -avz "/Volumes/databoard/AI Project/D_dashboard/research.py" root@<服务器>:/opt/mwlab/
```

### Step 3: 配置 Hermes（20 分钟）

```bash
# 在服务器上
hermes setup model        # 选 DeepSeek v4-flash
hermes config set terminal.cwd /opt/mwlab
hermes setup gateway      # 选 WeCom

# 安装 skill
# (将 exhibition-research skill 复制到服务器 ~/.hermes/skills/)
```

### Step 4: 配置企业微信网关（30 分钟）

按照 Hermes 文档配置 WeCom 自建应用：
1. 企业微信管理后台 → 创建自建应用
2. 获取 CorpID / AgentID / Secret
3. 配置回调 URL 指向服务器
4. 在 Hermes 中填入凭证

参考文档: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

### Step 5: 设置数据库同步（15 分钟）

在 Mac Mini 上添加 cron：
```bash
# 每周一凌晨 2:00 同步数据库到服务器
0 2 * * 1 rsync -avz "/Volumes/databoard/AI Project/D_dashboard/mwlab.db" root@<服务器>:/opt/mwlab/
```

### Step 6: 验证（30 分钟）

1. 在企业微信里 @Agent 发送：「列出所有行业大类」
2. 验证返回行业分类列表
3. 发送：「查一下上海劳保展」
4. 验证返回 CIOSH 盘面数据
5. 发送：「新能源赛道有什么展会」
6. 验证返回行业扫描报告

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 企业微信回调 URL 配置失败 | 高 | Hermes 文档有详细步骤，WeCom 是已支持平台 |
| 数据库同步中断 | 中 | cron 加告警（失败发邮件/企业微信通知） |
| API 限流（DeepSeek 并发限制） | 中 | credential pool 多 key 轮换；100 人并发低 |
| 服务器被反爬（如果用服务器爬） | 低 | 方案 B 避免此问题 |
| 同事不会用（不知道怎么 @Agent） | 中 | 写一个简单使用指南，3 句话 |

---

## 6. 成本估算（月）

| 项目 | 月费 |
|------|------|
| 阿里云 ECS 2C4G（如新开） | ~¥200 |
| DeepSeek API（100人，假设每人每天2次查询） | ~¥50-100 |
| 企业微信 | 免费（已有） |
| **合计** | **~¥250-300/月** |

---

## 7. 后续扩展

部署跑通后可逐步加入：
- **周报自动生成**: cronjob 每周一自动扫描重点品类变化
- **自媒体信号采集**: 集成 OpenCLI 抓取小红书/抖音展会讨论
- **展商匹配**: 将调研结果与 MDS 展商数据库交叉匹配
- **多 Profile**: CIOSH Profile（劳保）+ MWLAB Profile（通用展会调研）

---

*待评审。确认方案后进入 Step 1。*
