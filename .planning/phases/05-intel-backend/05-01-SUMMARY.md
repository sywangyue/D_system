# 05-01 SUMMARY — DB 迁移 + 目录初始化

**Status:** Complete  
**Completed:** 2026-06-09

## Self-Check: PASSED

## What Was Built

### 新增表：intel_report
统一存储四类调研报告（industry_research / brand_research / batch_prospect / single_prospect）

字段清单：id, report_type, brand_id, industry_l1, industry_l2, target_company, params_json, report_md, report_file, status, created_by, created_at, updated_at

索引：type+created_at, brand_id, industry_l1+l2

### 新增表：customer_prospect
存储批量客户挖掘结果，关联 exhibition_brand

字段清单：id, intel_report_id, brand_id, source_type, qcc_key_no, company_name, credit_code, oper_name, start_date, company_status, reg_no, address, prospect_score, contact_status, notes, created_at, updated_at

索引：brand_id, company_name, qcc_key_no, intel_report_id

### 迁移文件
- `schema/migrations/005_intel_tables.sql` — 幂等 DDL，可安全重复执行
- 执行方式：`sqlite3 mwlab.db < schema/migrations/005_intel_tables.sql`

### 目录结构
- `tools/intel/` — 情报脚本目录（Python 包，含 __init__.py）
- `reports/industry/` — 行业调研报告输出
- `reports/brand/` — 品牌调研报告输出
- `reports/customer/` — 客户画像报告输出

## Verification
- `sqlite3 mwlab.db ".tables"` 包含 intel_report 和 customer_prospect ✓
- CHECK 约束正确拒绝 'invalid_type' ✓
- 迁移文件幂等重复执行无错误 ✓
