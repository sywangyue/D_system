---
status: partial
phase: 04-frontend-architecture
source: [04-VERIFICATION.md]
started: 2026-05-08T14:10:00Z
updated: 2026-05-08T14:10:00Z
---

## Current Test

Status: **complete** (2026-05-08)

Bug found & fixed during testing:
- `/api/map/markers` 500 error — `GROUP_CONCAT(DISTINCT col, separator)` 在 SQLite 中不支持两个参数，改为 `GROUP_CONCAT(DISTINCT col)`，JS 侧用 `.split(',').map(n => n.trim())` 处理

## Tests

### 1. 登录流程端到端测试
expected: 访问 /login → 输入 admin@mwlab.internal / admin123 → POST FastAPI → JWT 保存到 localStorage + cookie → 重定向到 /dashboard
result: [pass] JWT 签发成功 (FastAPI 200), cookie (session=JWT) 写入浏览器, middleware 验证通过, 重定向 /dashboard 正常

### 2. 4 层 Dashboard 导航切换
expected: 点击 概览/分析/地理/明细 Layer Tab 可切换 → 每层内 SubTab 可切换 → FilterTabs 过滤联动所有层 → 概览-趋势 Tab 显示 TrendChart 柱状图
result: [pass] 4 层切换正常: 概览(总览/趋势/集团/快照), 分析(行业分布/竞争关系/MDS相关/热力矩阵/标签摘要), 地理(城市分布/场馆列表/国内外对比/城市排名/场馆排名), 明细(品牌列表/届次列表/搜索/导出). BrandTable 渲染正常 (品牌名称/行业/主办方/竞争关系/MDS相关). FilterTabs 全部联动

### 3. MD 品牌视觉外观
expected: 全局橙色系 (#fe5c00) → KPI 卡片 hover 橙色阴影 → FilterTabs 选中态橙色 → 图表使用 MD 色板 (橙/品红/浅橙/红/灰/黄)
result: [pass] 侧边栏激活态 #fff3ec 背景 + #fe5c00 边框 + #e55300 文字. 图表 #fe5c00 填充. 0 处绿色残留 (仅 setting-content.tsx 中 \"活跃\" 徽章为语义 UX 绿, 非品牌色残留)

### 4. 地图标记 MD 橙色
expected: 国内城市标记使用 #fe5c00 填充 → 国际城市标记使用 #ff8c00 填充 → Popup 中点颜色一致 → 无蓝色 (#3B82F6) 残留
result: [pass] 独立 /map 页面 + Dashboard 地理层均加载 Leaflet 地图. 108 个标记全部 #fe5c00 填充. 图例显示\"国内展会\"/\"国际展会\". 0 处蓝色残留. /api/map/markers 返回 200

### 5. 日历事件 MD 橙色样式
expected: "潜在伙伴" 事件使用橙色边框 (#fe5c00) + 浅橙背景 (#fff3ec) → "竞争对手" 保留红色 → 无绿色 (#22C55E/#DCFCE7) 残留
result: [pass] 日历页面渲染 2026年5月事件. 月/周视图切换正常. 侧边栏\"日历\"激活态 #fff3ec/#fe5c00/#e55300. 0 处绿色残留. /api/calendar/events 返回 200

### 6. TrendChart 年比趋势图
expected: 概览层-趋势 Tab 显示柱状图 → 数据来自 API yearTrend 字段 → 柱状图使用 #fe5c00 填充 → 非空状态
result: [pass] \"年比趋势\" heading 显示, X 轴 2022-2028, Y 轴 0-18000 万㎡, recharts BarChart 正常渲染, 非空状态

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Bugs Found & Fixed

1. **`/api/map/markers` 500 error** — `GROUP_CONCAT(DISTINCT b.name_cn, ', ')` 在 SQLite 中不支持 DISTINCT 与双参数同时使用。修复: 改为 `GROUP_CONCAT(DISTINCT b.name_cn)` + JS 侧 `split(',').map(n => n.trim())`。

## Gaps

(none)
