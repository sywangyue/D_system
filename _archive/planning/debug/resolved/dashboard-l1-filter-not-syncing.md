---
status: resolved
trigger: "Dashboard点选1级行业分类后下面的所有数据都应该进行相应的变动 比如展览面积/展商数量/观众数量/主办数量/年比年趋势/行业细分分类。以及品牌列表都应该相应的展示筛选后的数据"
created: 2026-05-09T10:40:00+08:00
updated: 2026-05-09T11:16:00+08:00
---

## Symptoms

**Expected:** 在 Dashboard 点击 SlicerBar 的 L1 行业分类按钮后，所有下游数据组件应联动筛选：
- KpiCardRow（展览面积/展商数量/观众数量/主办方数）
- TrendChart（年比年趋势）
- IndustryPieChart（行业细分分类，L2 分布）
- BrandTable（品牌列表）

**Actual:** 点击 L1 按钮后部分数据不同步更新，渲染与筛选状态不一致。

**Reproduction:** Dashboard 页面 → 点击 SlicerBar L1 按钮 → 观察 KPI/图表/品牌表是否更新

## Root Cause

三个层级的断裂导致 L1 筛选不生效：

1. **`buildQueryString()` 未包含 `industry_l1`** (`dashboard-content.tsx` line 71-78) — `selectedL1` 没有被序列化到 API 查询参数中。

2. **`useEffect` 依赖数组缺失 `selectedL1`** (`dashboard-content.tsx` line 128-135) — 当 `selectedL1` 变化时不会触发数据重新拉取。

3. **API route `/api/dashboard/route.ts` 未处理 `industry_l1` 参数** — 后端 SQL 查询没有 `b.industry_l1 = ?` 过滤条件。

## Fix

Commit: `08e530f`

Three-part fix:

### Part A — `buildQueryString()` 添加 `industry_l1`
```typescript
if (selectedL1) params.set("industry_l1", selectedL1);
```

### Part B — `useEffect` 依赖数组添加 `selectedL1`
```typescript
}, [selectedL1, selectedL2, selectedRelations, selectedMds]);
```

### Part C — API route 添加 `industry_l1` 过滤
```typescript
const industryL1 = searchParams.get('industry_l1');
if (industryL1) {
  where += ' AND b.industry_l1 = ?';
  params.push(industryL1);
}
```

## Files Changed
- `app/dashboard/dashboard-content.tsx`
- `app/api/dashboard/route.ts`

## Verification
- Build: PASSED
- Tests: 38/38 PASSED
