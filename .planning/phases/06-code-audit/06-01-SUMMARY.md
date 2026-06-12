# 06-01 Wave 1 安全止血 — 执行总结

## 状态

| 组件 | 状态 |
|------|------|
| Tasks 1–5 | ✅ 全部提交 |
| Task 6 (CKPT) | ✅ proceed — 立即执行三步 |
| Task 7 历史清理 | ✅ `git filter-repo --invert-paths --path mwlab.db` 本地完成 |
| Task 7 force push | ⏸️ 暂缓 — 网络无法连接 GitHub，用户后续手动补推 |
| Task 7 改密 | ✅ 3 个账号已重置 |
| Task 8 测试 | ✅ `npm test` 20 全绿 |
| **整体** | **8/8 完成（force push 暂缓）** |

## 改密交付

> 新口令仅在此处输出，未写入任何文件。

| 邮箱 | 新口令（16 位随机） |
|------|-------------------|
| `admin@mwlab.internal` | `ouWfTmWPebkHKHv5` |
| `manager@mwlab.internal` | `HGxWBEWoC25RqPIJ` |
| `readonly@mwlab.internal` | `envhRM2W1NEz2MXa` |

## 资产迁移

| 资产 | 旧路径 | 新路径 |
|------|--------|--------|
| SSH 私钥 | `MWlab.pem`（根目录） | `~/.ssh/MWlab.pem`（`chmod 600`） |
| `mwlab.db` | git 跟踪 | `git rm --cached` | 

后续 SSH 连接需更新 `-i` 参数：`ssh -i ~/.ssh/MWlab.pem ...`

## HYG-01 执行状态

- ✅ `git rm --cached mwlab.db` — 索引移除
- ✅ `git filter-repo --path mwlab.db --invert-paths` — 本地历史清除
- ⏸️ `git push --force origin main` — 暂缓（网络不通），用户后续补推
- ✅ 3 账号改密（含备份 `_archive/mwlab_pre_pwreset_20260612.db`）
- ✅ `MWlab.pem` 移至 `~/.ssh/MWlab.pem` 并 `chmod 600`
- ✅ 修改 `user` 表密码哈希，旧口令全部失效

## 波及范围

- **检测到的改动**：middleware.ts、lib/api-guard.ts（新建）、lib/auth.ts、app/api/auth/login/route.ts、app/login/page.tsx、app/api/dashboard/route.ts、app/api/people/route.ts、app/api/people/[id]/route.ts、app/api/exhibition/[id]/route.ts、app/api/people/[id]/contacts/route.ts、app/api/people/[id]/relations/route.ts、app/api/exhibition/[id]/relations/route.ts、app/api/exhibition/[id]/timeline/route.ts、app/api/exhibition/[id]/timeline/[eventId]/route.ts、tests/api/dashboard.test.ts、.gitignore
- **测试覆盖**：20 项测试全绿
- **待补推的远端**：`git push --force origin main && git push --force origin ralph/phase-4-frontend`
