---
phase: 4
slug: frontend-architecture
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react（Next.js 项目标配） |
| **Config file** | vitest.config.ts — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + Cloudflare Workers preview 手动验证
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-middleware | — | 1 | UI-POOL-AUTH | T-4-01 | 未登录访问 /dashboard 重定向到 /login | integration | `npx vitest run tests/middleware.test.ts` | ✅ Wave 1 | ✅ covered |
| 04-role-guard | — | 1 | UI-POOL-AUTH | T-4-02 | admin 访问 /setting 成功，manager 重定向 | integration | `npx vitest run tests/middleware.test.ts` | ✅ Wave 1 | ✅ covered |
| 04-api-dashboard | — | 2 | UI-POOL-DASH | — | /api/dashboard 返回正确聚合数据（三参数过滤） | unit | `npx vitest run tests/api/dashboard.test.ts` | ✅ Wave 1 | ✅ covered |
| 04-api-tags | — | 2 | UI-POOL-TAGS | T-4-03 | PATCH /api/brands/[id]/tags 写入主表 + manual_tag_history | unit | `npx vitest run tests/api/tags.test.ts` | ✅ Wave 1 | ✅ covered |
| 04-seed | — | 1 | UI-POOL-SEED | — | seed-users.ts 创建30用户无报错 | manual-only | — | ✅ Wave 1 | ✅ covered |

*Status: ✅ covered · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/middleware.test.ts` — 路由守卫 + 角色权限测试
- [ ] `tests/api/dashboard.test.ts` — 聚合查询 API 单元测试
- [ ] `tests/api/tags.test.ts` — 打标 API 单元测试
- [ ] `vitest.config.ts` — 测试框架配置
- [ ] Framework install: `npm install -D vitest @testing-library/react @vitejs/plugin-react`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| seed-users.ts 创建30用户无报错 | UI-POOL-SEED | Supabase Admin API 需 live 环境 | 运行 `npx tsx scripts/seed-users.ts` 检查控制台无 error |
| Cloudflare Workers preview 页面加载正常 | UI-POOL | 需 wrangler preview 环境 | `wrangler pages dev .open-next/worker.js`，验证 /login /dashboard /calendar /map |
| Leaflet 地图热力点正常渲染 | UI-POOL | 浏览器渲染无法自动化 | 访问 /map，确认展会点位显示，无 SSR hydration 报错 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
