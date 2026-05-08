---
phase: 04-frontend-architecture
plan: 01
subsystem: infra
tags: ["auth", "bff", "jwt", "bcrypt", "sqlite"]
requires: []
provides: ["auth_api.py", "lib/db.ts", "lib/auth.ts"]
affects: [".env.local"]
tech-stack:
  added: ["pyjwt", "passlib[bcrypt] -> bcrypt", "uvicorn"]
  patterns:
    - "独立 FastAPI 服务（auth_api.py），与 tag_api.py 分离部署"
    - "better-sqlite3 readonly 单例用于 Next.js BFF 层"
    - "localStorage-based JWT 客户端鉴权（无 Supabase）"
key-files:
  created:
    - "auth_api.py — FastAPI JWT 认证服务（login/verify/users）"
    - "lib/db.ts — better-sqlite3 readonly 连接单例"
    - "lib/auth.ts — 客户端认证工具函数（5 个导出）"
    - "scripts/seed_db_users.py — 初始用户种子脚本"
  modified: []
  deleted: []
decisions:
  - "W1 独立 auth_api.py（vs 并入 tag_api.py）— 关注点分离，避免 CORS 冲突"
  - "使用 bcrypt 直接调用（vs passlib）— passlib 1.7.4 与 bcrypt 5.x 不兼容"
metrics:
  duration: "10 minutes"
  completed: "2026-05-08"
  tasks_completed: 3
  commits: 3
---

# Phase 04 Plan 01: Auth & BFF Infrastructure Summary

**Phase 4 基础设施层**：FastAPI JWT 认证后端、前端 SQLite 直连层、客户端认证工具。

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | auth_api.py — FastAPI JWT auth endpoints | 9081be3 | auth_api.py |
| 2 | lib/db.ts + lib/auth.ts + .env.local | a2b415e | lib/db.ts, lib/auth.ts, .env.local |
| 3 | Python deps, seed users, bcrypt fix | 6f707e5 | scripts/seed_db_users.py, auth_api.py |

## Endpoint Verification

All endpoints tested via curl against uvicorn on port 8000:

- **POST /api/auth/login** (success) — returns `{ token, email, role, display_name }` (200)
- **POST /api/auth/login** (wrong password) — returns `{"detail":"邮箱或密码错误"}` (401)
- **GET /api/auth/verify** — returns `{ valid: true, email, role }` (200)
- **GET /api/auth/users** (admin) — returns user list (200)
- **GET /api/auth/users** (readonly) — returns 403 (expected)

## Deviations from Plan

### [Rule 2 - Security] bcrypt/passlib incompatibility

- **Found during:** Task 3
- **Issue:** `passlib 1.7.4` is incompatible with system-installed `bcrypt 5.0.0` (`AttributeError: module 'bcrypt' has no attribute '__about__'`). Seed script and auth_api.py both failed with ValueError.
- **Fix:** Replaced passlib `CryptContext` with direct `bcrypt.checkpw()` / `bcrypt.hashpw()` calls in both auth_api.py and scripts/seed_db_users.py. This removes the passlib dependency entirely.
- **Files modified:** auth_api.py, scripts/seed_db_users.py
- **Commits:** 6f707e5

### [Rule 2 - Quality] PyJWT InsecureKeyLengthWarning

- **Found during:** Task 3 endpoint testing
- **Issue:** Default dev secret "mwlab-dev-secret-2026" (21 bytes) is below the recommended 32 bytes for HS256, triggering warning on every JWT operation.
- **Fix:** Extended default to "mwlab-dev-secret-2026-with-extra-length" (34 bytes). Also synced .env.local.
- **Files modified:** auth_api.py, .env.local
- **Commit:** 6f707e5

### [Rule 3 - Blocking] Database schema not initialized

- **Found during:** Task 1
- **Issue:** mwlab.db was a 0-byte empty file with no tables at all (in main repo). Worktree's mwlab.db had valid schema.
- **Fix:** Ran `sqlite3 mwlab.db < schema/init_db.sql` in the main repo. The worktree's mwlab.db already had proper schema (106KB).
- **Files modified:** mwlab.db (main repo only — not tracked by git)
- **Note:** No schema issue existed in the worktree, only in the empty main-repo mwlab.db.

## Not Committed

- `.env.local` — gitignored; contains JWT_SECRET and FASTAPI_URL config. Created at worktree path.

## Self-Check: PASSED

All 7 verification checks pass:
1. Python deps (jwt, bcrypt) importable
2. auth_api.py imports without error
3. lib/db.ts exports getDb() 
4. lib/auth.ts exports clearAuth()
5. .env.local contains JWT_SECRET
6. .env.local contains FASTAPI_URL
7. 3 git commits on worktree branch
