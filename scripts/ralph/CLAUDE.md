# Ralph Agent · MWLAB-2026 Phase 4

You are an autonomous coding agent. Each invocation is one iteration of a loop.
You have NO memory of previous iterations — all context comes from files.

## Your Task (10 steps)

1. Read `prd.json` (same directory) — understand project, branch, and all user stories
2. Read `progress.txt` — check **Codebase Patterns** section FIRST, then latest progress
3. Check branch from PRD `branchName`. If not on it, checkout or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that ONE single user story
6. Run quality checks — typecheck, lint, test (whatever the project uses)
7. Update CLAUDE.md / AGENTS.md files IF you discover reusable patterns (see below)
8. If checks pass, commit ALL changes with: `feat: [Story ID] - [Story Title]`
9. Update `prd.json` — set `passes: true` for the completed story
10. APPEND progress report to `progress.txt`

## Project Context

**MWLAB-2026**: Exhibition Competitive Dashboard. Phase 4 is a full-stack migration:
- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS 4.x
- **Backend**: Next.js API Routes (replaces FastAPI)
- **Database**: Supabase PostgreSQL (replaces SQLite)
- **Auth**: Supabase Auth email+password (replaces JWT)
- **Deploy**: Cloudflare Workers via `@opennextjs/cloudflare`

**Style rules** (from CLAUDE.md):
- snake_case filenames, snake_case DB fields
- API endpoints: `/api/resource-name/action`, lowercase hyphens
- DB tables: snake_case singular (exhibition_brand, exhibition_edition)
- No backward-compat code, no premature abstraction

**Data architecture** (from AGENTS.md):
- 6 tables: exhibition_brand → exhibition_edition, data_provenance, manual_tag_history + crawl_log, users
- Dual-source conflict rules: name/date/location → jufair wins; exhibitors/visitors/area → take larger value
- Fields needing manual tagging: competition_relation, mds_related, strategic_relevance, ma_potential, competitor_group, industry_l1/l2, yoy_trend, anomaly_flag

**Key references:**
- PRD: `MWLAB-2026-PRD-v1.1-merged.md`
- Schema: `schema/init_db.sql`
- UI spec: `.planning/phases/04-frontend-architecture/04-UI-SPEC.md`
- Phase 4 context: `.planning/phases/04-frontend-architecture/04-CONTEXT.md`
- Research: `.planning/phases/04-frontend-architecture/04-RESEARCH.md`

## Quality Requirements (GSD Gate)

BEFORE committing, you MUST verify:
- `npm run build` passes (or `npx tsc --noEmit` if Next.js not yet set up)
- `npx vitest run` passes (all tests green)
- No TypeScript errors in any file
- No hardcoded secrets in committed files

## Browser Verification (Required for UI Stories)

For any story that changes UI components or pages:
1. Start dev server: `npm run dev`
2. Navigate to the relevant page
3. Verify the UI works as expected
4. Note verification result in progress.txt

If browser tools are unavailable, mark the story as needing manual verification.

## Progress Report Format

APPEND to progress.txt (never replace):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Quality check results (typecheck/lint/test)
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

If you discover a **reusable pattern**, add it to `## Codebase Patterns` at the TOP of progress.txt:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
```

Only patterns that are **general and reusable**, not story-specific details.

## Update CLAUDE.md / AGENTS.md

After implementing, check if any edited directories would benefit from updated CLAUDE.md or AGENTS.md files:

**Good additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running"
- "Field names must match the template exactly"

**Do NOT add:** story-specific details, debugging notes, info already in progress.txt

## Stop Condition

After completing a story, check if ALL stories have `passes: true`.
If ALL complete: reply with `<promise>COMPLETE</promise>`
If stories remain: end normally (the loop will invoke you again)

## Important

- ONE story per iteration
- Commit frequently, keep CI green
- Read Codebase Patterns section in progress.txt before starting
- If you hit a blocker you can't resolve, note it in progress.txt and mark story `notes` with the blocker
