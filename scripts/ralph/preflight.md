# Ralph Pre-Flight Checklist · MWLAB-2026 Phase 4

Run through this BEFORE starting `ralph.sh`. Each unchecked item is a potential blocker.

## 1. Cloud Services (Manual Setup)

- [ ] **Supabase project created** at [supabase.com](https://supabase.com)
  - Project URL: `https://<ref>.supabase.co`
  - Got `anon` key (public) and `service_role` key (secret)
  - Auth enabled (Email provider, no confirm required for dev)
- [ ] **Cloudflare Workers** account active at [dash.cloudflare.com](https://dash.cloudflare.com)
  - Workers & Pages enabled (free tier is fine)

## 2. Local Environment

- [ ] `.env.local` populated with real values:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```
- [ ] Node.js 20+ installed: `node --version`
- [ ] npm 10+ installed: `npm --version`

## 3. Git State

- [ ] Working directory clean: `git status`
- [ ] On main branch (ralph.sh creates `ralph/phase-4-frontend` from main)
- [ ] No uncommitted changes that could conflict

## 4. Ralph Files

- [ ] `scripts/ralph/prd.json` — user stories correct and prioritized
- [ ] `scripts/ralph/CLAUDE.md` — agent instructions up to date
- [ ] `scripts/ralph/ralph.sh` — executable (`chmod +x`)

## 5. Dry Run (Recommended)

Before the full autonomous run, test one iteration manually:

```bash
cd "/Volumes/databoard/AI Project/D_dashboard"
cat scripts/ralph/CLAUDE.md | claude --dangerously-skip-permissions --print
```

Verify that Claude:
1. Reads prd.json successfully
2. Identifies the first story (US-4-01-01)
3. Attempts implementation
4. Commits with correct message format

## 6. Launch

```bash
cd "/Volumes/databoard/AI Project/D_dashboard"
./scripts/ralph/ralph.sh --tool claude 20
```

- `--tool claude`: Use Claude Code (not Amp)
- `20`: Max 20 iterations (one per user story + 1 buffer)
- Loop survives session disconnects — each iteration is a fresh `claude` process
- Check progress: `cat scripts/ralph/progress.txt`
- Check story status: `cat scripts/ralph/prd.json | jq '.userStories[] | {id, passes}'`

## 7. Monitoring While Running

Run in a separate terminal to watch progress:

```bash
watch -n 30 "cat scripts/ralph/progress.txt | tail -20"
```

Or check git log for commit cadence:

```bash
watch -n 60 "git log --oneline -10"
```

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Supabase credentials not set | Story US-4-02-02 will skip itself, others use types only |
| `npm install` hangs | Check network; may need npm registry mirror in China |
| TypeScript errors accumulate | Each iteration runs `npx tsc --noEmit` before commit |
| Claude Code session limit | ralph.sh creates new process each iteration, no limit |
| UI stories need browser verify | Browser tools may not be available; stories marked for manual check |
