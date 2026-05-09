---
phase: 05
slug: data-cleaning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | none — Wave 0 installs test fixtures |
| **Quick run command** | `pytest tests/ -x -q -k "clean"` |
| **Full suite command** | `pytest tests/` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -x -q -k "clean"`
- **After every plan wave:** Run `pytest tests/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CLEAN-NAME-EN | — | N/A (data transform) | unit | `pytest tests/test_clean_brands.py::test_name_en -q` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CLEAN-INDUSTRY | — | N/A (data transform) | unit | `pytest tests/test_clean_brands.py::test_industry_l1 -q` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | CLEAN-MDS | — | N/A (data transform) | unit | `pytest tests/test_clean_brands.py::test_mds_related -q` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | CLEAN-JUFAIR-L2 | — | N/A (data transform) | unit | `pytest tests/test_clean_brands.py::test_jufair_l2 -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_clean_brands.py` — stubs for all 4 CLEAN requirements
- [ ] `tests/conftest.py` — shared fixtures (in-memory SQLite with sample exhibition_brand rows)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| English name translation quality | CLEAN-NAME-EN | AI translation output needs human review | Spot-check 50 random rows for translation accuracy |
| Jufair L2 fuzzy match quality | CLEAN-JUFAIR-L2 | Fuzzy matching may produce false positives | Review boundary cases where confidence < 0.8 |
| MD brand supplement completeness | CLEAN-MDS | New brands from Excel need manual review before insert | Verify all new exhibition_brand rows in DB against Excel source |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
