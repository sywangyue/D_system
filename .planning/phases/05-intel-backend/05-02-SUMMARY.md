# 05-02 SUMMARY — 企查查 API 客户端

**Status:** Complete  
**Completed:** 2026-06-09

## Self-Check: PASSED

## What Was Built

### tools/intel/qcc_client.py
- `fuzzy_search(keyword, page_index, page_size)` → 企查查 FuzzySearch/GetList
- `_make_token(app_key, secret_key)` → MD5(AppKey+Timespan+SecretKey).upper()
- `_is_configured()` → 检查环境变量是否为占位符
- `format_search_results(result)` → 可读文本格式化
- 降级模式：QCC_APP_KEY/QCC_SECRET_KEY 未配置时返回 PLACEHOLDER 状态，不抛出异常

## Verification
- `python3 tools/intel/qcc_client.py "格力电器"` → `[企查查未配置] QCC_APP_KEY / QCC_SECRET_KEY 未配置...` ✓
- Token 生成逻辑：`hashlib.md5(f"{key}{timespan}{secret}".encode()).hexdigest().upper()` ✓
