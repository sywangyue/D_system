# 06-04 爬虫修复 — SUMMARY

**状态**: ✅ 完成（2026-06-12）

## 执行概况

| Task | 修复项 | 涉及文件 | 状态 |
|------|--------|---------|------|
| 1 | 空串覆盖修复 + detail_crawled=0 补爬 [CRWL-01][CRWL-02] | jufair_crawler.py | ✅ |
| 2 | 固定 UA / 429/503 退避 / 软封禁检测 / 计数器保留 / 批间长休止 [CRWL-05][CRWL-09][CRWL-11] | jufair + cnexpo | ✅ |
| 3 | 全局熔断 + cnexpo continue 前补 sleep [CRWL-03] | jufair + cnexpo | ✅ |
| 4 | crawl_log 写入 + 失败退出码 + 真实插入计数 [CRWL-06][CRWL-07][CRWL-10] | jufair + cnexpo | ✅ |
| 5 | cnexpo 标签锚定详情解析 + 日期正则放宽 + venue 校验 [CRWL-04][CRWL-14] | cnexpo_crawler.py | ✅ |
| 6 | 关键词不匹配仍落库 + 编码兜底 + 代理失败退出 [CRWL-08][CRWL-12][CRWL-13] | jufair + cnexpo | ✅ |
| 7 | 单位校验 + --year 参数 + 时间戳日志 [CRWL-15][CRWL-16][CRWL-17] | jufair + cnexpo | ✅ |
| 8 | 编译检查 + pytest 全绿 | — | ✅ |

## 关键变更

- **空串覆盖修复**: 详情页缺字段时仅更新非空键（动态 SET 子句），列表页已采集值不被清空
- **反爬指纹**: 删除 `_rotate_ua()`，运行全程固定 UA + Session Cookie；429/503 并入 403 退避分支，尊重 `Retry-After` 头；每 50 请求 60-120s 长休止
- **全局熔断**: `_global_consecutive_fail` ≥ 5 → `[ABORT]` 终止，jufair 和 cnexpo 同步实现
- **爬虫日志**: 每次运行写入 `crawl_log`（running→success/failed/partial），含 batch_id、计数、起止时间
- **退出码**: 全部失败 exit(1)，部分失败 exit(2)，成功 exit(0)
- **cnexpo 解析**: 按标签文本关键词锚定（非 paragraph[2..5] 位置索引）；venue 校验含"馆/中心/会展/广场/展览/展厅"关键词
- **关键词过滤**: 不匹配的记录同样 INSERT（避免重跑反复请求同一详情页）
- **时间戳日志**: 两爬虫 `print` → `_log("[YYYY-mm-dd HH:MM:SS] msg")`
- **代理**: jufair `--proxy` 验证失败 `sys.exit(1)`，不再静默回退直连

## 测试结果

- 两文件 `py_compile` 通过
- `pytest` 113 passed, 0 failed
- 零外网请求验证

## 声明

✅ 爬虫已具备恢复采集前提（反爬友好、可熔断、可续爬、可观测）。
⏳ 实际恢复采集属于 Phase 1b 范围，由该阶段决定何时启动。
