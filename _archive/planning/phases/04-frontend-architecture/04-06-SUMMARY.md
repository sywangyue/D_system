# 04-06 SUMMARY — Page Updates (JWT Auth + MD Branding)

**Status**: complete
**Date**: 2026-05-08
**Execution**: inline (worktree agent failed, re-executed on main)

## Tasks Completed

### Task 1: Login page — JWT + cookie
- Added `document.cookie = \`session=${data.token}; path=/; max-age=86400; SameSite=Lax\`` (was missing from Wave 1 minimal fix)
- Email normalized: `email.trim().toLowerCase()` before POST
- Uses `process.env.NEXT_PUBLIC_FASTAPI_URL` (not hardcoded)
- Zero Supabase references

### Task 2: Calendar — MD orange event styles
- "潜在伙伴" events: `#fff3ec` background, `#fe5c00` border, `#e55300` text (was green #DCFCE7/#22C55E/#16A34A)
- "竞争对手" events: kept semantic red (#FEE2E2/#EF4444)
- No green color残留

### Task 3: Map + Setting
**Map (map-view.tsx)**:
- chinaStyle: `#fe5c00` fill, `#e55300` stroke (was blue #3B82F6/#2563EB)
- intlStyle: `#ff8c00` fill, `#e55300` stroke (was orange #F97316/#EA580C)
- Popup dot colors updated to match
- No blue残留

**Setting (setting-content.tsx)**:
- UserEntry interface updated: `user_id`, `is_active`, `last_login` (was Supabase-era `id`, `confirmed_at`, `last_sign_in_at`)
- getUserStatus: uses `is_active` and `last_login` fields
- Table key: `user.user_id`
- Zero Supabase references
- Already uses `getUserInfo` from `@/lib/auth` (done in Wave 1)

## Verification
- TypeScript: passes (no new errors)
- Build: `next build` succeeds
- Tests: 38/38 pass
- All pages: `grep -c "supabase"` = 0
