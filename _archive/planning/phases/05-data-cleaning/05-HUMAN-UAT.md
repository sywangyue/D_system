---
status: partial
phase: 05-data-cleaning
source: [05-VERIFICATION.md]
started: 2026-05-07T17:50:00Z
updated: 2026-05-07T17:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run all 4 subcommands without --dry-run
expected: name-en, industry, mds, jufair-l2 --import execute successfully against mwlab.db, transforming real data. Backup tables created before writes. No runtime errors.
result: [pending]

### 2. Deploy jufair-l2 --export on Mac Mini and --import result
expected: jufair_l2_crawler.py successfully crawls jufair.com categories from Mac Mini (mainland China IP). JSON output imports correctly, fuzzy matching sets industry_l1 + industry_l2 on exhibition_brand rows.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
