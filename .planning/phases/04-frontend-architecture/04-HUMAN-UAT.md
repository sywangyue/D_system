---
status: partial
phase: 04-frontend-architecture
source: [04-VERIFICATION.md]
started: 2026-05-08T14:10:00Z
updated: 2026-05-08T14:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 登录流程端到端测试
expected: 访问 /login → 输入 admin@mwlab.internal / admin123 → POST FastAPI → JWT 保存到 localStorage + cookie → 重定向到 /dashboard
result: [pending]

### 2. 4 层 Dashboard 导航切换
expected: 点击 概览/分析/地理/明细 Layer Tab 可切换 → 每层内 SubTab 可切换 → FilterTabs 过滤联动所有层 → 概览-趋势 Tab 显示 TrendChart 柱状图
result: [pending]

### 3. MD 品牌视觉外观
expected: 全局橙色系 (#fe5c00) → KPI 卡片 hover 橙色阴影 → FilterTabs 选中态橙色 → 图表使用 MD 色板 (橙/品红/浅橙/红/灰/黄)
result: [pending]

### 4. 地图标记 MD 橙色
expected: 国内城市标记使用 #fe5c00 填充 → 国际城市标记使用 #ff8c00 填充 → Popup 中点颜色一致 → 无蓝色 (#3B82F6) 残留
result: [pending]

### 5. 日历事件 MD 橙色样式
expected: "潜在伙伴" 事件使用橙色边框 (#fe5c00) + 浅橙背景 (#fff3ec) → "竞争对手" 保留红色 → 无绿色 (#22C55E/#DCFCE7) 残留
result: [pending]

### 6. TrendChart 年比趋势图
expected: 概览层-趋势 Tab 显示柱状图 → 数据来自 API yearTrend 字段 → 柱状图使用 #fe5c00 填充 → 非空状态
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
