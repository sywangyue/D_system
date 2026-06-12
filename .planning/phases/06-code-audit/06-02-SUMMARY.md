# 06-02 Data Integrity — SUMMARY

**状态**: ✅ 完成（2026-06-12）

## 执行概况

| 任务 | 变更 | 状态 |
|------|------|------|
| CORE-01 next_brand_id | merge_engine.py: 数值子集 MAX 替代正则 | done |
| CORE-02 upsert_edition | Python 侧 data_source dict.fromkeys 去重 | done |
| CORE-03 normalize_city | CN_PROVINCES 白名单避免截断 | done |
| CORE-05b raw_payload | cnexpo_index 存储 (norm, raw) 元组 | done |
| CORE-06 match_brand | 双门限模糊匹配 (≥0.90 + margin ≥0.05) | done |
| CORE-07 edition_id | year=None 时回退 date_start/undated | done |
| CORE-08 parse_date_pair | 跨年 + 同月 day-only 格式处理 | done |
| CORE-10 dry-run | 始终连接真实目标库，rollback 替代 | done |
| **修复脚本** | `tools/fix_audit_data.py` | done |
| 007 迁移 | data_provenance 14,625 重复行删除 + 唯一索引 | done |
| 备份 | `backups/mwlab_pre_wave2_20260612_093929.db` | done |

## 数据清洗结果

| 修复项 | 行数 | 说明 |
|--------|------|------|
| fix_data_source | 6,049 | data_source 重复段去重（最大 38 段→2） |
| fix_truncated_cities | 87 | 乌鲁木齐/呼和浩特/鄂尔多斯等修复，0 歧义 |
| provenance 删除 | 14,625 | 6,326 重复组，保留最小 rowid |

## 遗留

- mwlab.db 已从 git 历史移除（git-filter-repo），不再跟踪
- 密码已随机化（admin/manager/readonly 各一个）
