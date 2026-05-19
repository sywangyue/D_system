# MWLAB-2026 Dashboard — Claude Design 完整重设计指令

> **使用方式**：将本文件全文粘贴至 Claude Code 对话框，作为单次完整指令执行。
> **目标文件**：`public/dashboard.html`（主看板）、`app/login/page.tsx`（登录页）、`components/layout/Sidebar.tsx`（侧边栏）、`app/globals.css`（全局样式）

## ⚠️ 铁律约束（违反即终止任务）

1. **禁止删除任何现有组件或功能**，包括但不限于 `MatrixCanvas`、`TypewriterLine`、日历、地图。
2. **禁止改变任何模块的结构位置**：日历和地图保持当前嵌套在 dashboard 主体内的方式，禁止拆分为独立选项卡或页面。
3. **只允许修改**：CSS 样式、颜色值、间距、字号、动画。JS 逻辑和 HTML 结构仅在色彩替换和展会概览横向滚动两处有限修改（见 §4.5 和 §4.6）。
4. 每改完一个文件，必须用 `/taste` 做视觉审查后再继续。

---

## 0. 先决条件：安装 taste-skill

在执行任何代码修改之前，先运行：

```bash
npx skills add https://github.com/Leonxlnx/taste-skill
```

安装完成后，使用 `/taste` 指令对每个改动的文件进行视觉质感评审，确保输出符合 Apple 极简风格。

---

## 1. 全局设计约束（所有文件必须遵守）

### 1.1 字体
- **唯一字体**：`Montserrat`（已通过 Google Fonts 引入），禁止更改。
- 中文 fallback 保持 `system-ui, -apple-system, sans-serif`。

### 1.2 色彩系统（严格执行）

```css
/* ✅ 允许使用 */
--orange-500: #FE5C00;   /* 主色，唯一彩色 */
--orange-400: #FF7A2F;   /* 橙色 -20% */
--orange-300: #FF9A60;   /* 橙色 -40% */
--orange-200: #FFBF99;   /* 橙色 -60%（hover 背景） */
--orange-100: #FFF2EC;   /* 橙色 -80%（tag 背景） */
--orange-50:  #FFF8F5;   /* 橙色 -90%（极淡背景） */

--black:      #1D1D1F;   /* 主文本 */
--gray-80:    #3D3D3F;   /* 次级标题 */
--gray-60:    #6E6E73;   /* 正文辅助 */
--gray-40:    #AEAEB2;   /* placeholder / disabled */
--gray-20:    #D1D1D6;   /* 分割线 */
--gray-10:    #F2F2F7;   /* 页面背景 */
--white:      #FFFFFF;   /* 卡片背景 */

/* ❌ 完全禁止使用 */
/* 蓝色系：#3B82F6 / #1A6B3A / #0EA5E9 / #2563EB 等 */
/* 绿色系：#10B981 / #1A6B3A / #16A34A 等 */
/* 红色系（非橙）：#EF4444 / #C0392B / #DC2626 等 */
/* 黄色系：#F59E0B / #EAB308 / #FFC500 等 */
/* Magenta / Purple / Teal 等 */
```

### 1.3 语言统一
- **所有 UI 标签统一为中文**，消灭中英混杂：
  - `Dashboard` → `看板`
  - `KEY METRICS` → `核心指标`
  - `Settings` → `设置`
  - `Profile` → `个人资料`
  - 按钮、标签、列头全部中文
- 品牌名、专有名词（如 `MWLAB`、`UFI`、`MDS`）保持英文缩写不变。

---

## 2. 登录页视觉优化（`app/login/page.tsx`）

### 2.1 布局：黄金分割双栏 + F 型动线

当前问题：右侧表单元素堆砌，无留白层次；错误提示用红色违反色彩约束。

> ⚠️ `MatrixCanvas` 和 `TypewriterLine` 组件**保留不动**，仅调整外层布局比例和右侧表单视觉。

**布局比例调整（仅改 className，不改组件内容）：**

```
┌─────────────────────────────┬──────────────────┐
│                             │                  │
│   LEFT  61.8%               │  RIGHT  38.2%    │
│   保留现有 MatrixCanvas      │  表单区（仅调样式）│
│   + TypewriterLine          │                  │
│   + 品牌文字排版             │                  │
└─────────────────────────────┴──────────────────┘
```

**F 型动线：用户视线路径**
- 第一横：MWLAB logo（左栏顶部）→ 欢迎回来标题（右栏顶部）
- 第二横：描述文字 → 邮箱输入框
- 竖轴：密码输入框 → 登录按钮

**具体修改（仅样式层）：**

1. 左栏宽度从 `lg:w-[58%]` 改为 `lg:w-[61.8%]`（黄金分割）——**只改这一个 className，其余左栏内容不动**

2. 右栏 form 区域的样式修改：
   - Input 聚焦边框 `focus:ring-orange-500/20` → 保留，颜色正确；`focus:border-accent` → 确保已正确指向 `#FE5C00`
   - Error 提示：将 `text-red-600 bg-red-50` 改为 `style="color:#FE5C00; background:rgba(254,92,0,0.06)"`
   - 登录按钮保持 `bg-accent`（已是橙色 `#FE5C00`），确认正确，无需修改
   - 在邮箱和密码 label 下增加 `margin-bottom: 8px` 留白（当前 `mb-2` 改为 `mb-2.5`）

3. 右栏整体增加顶部 padding：将 `justify-center` 的容器增加 `pt-8`，让表单视觉上偏上居中而非绝对居中

---

## 3. Sidebar 重设计（`components/layout/Sidebar.tsx`）

### 当前问题
- 宽度 220px 偏宽，占用内容区；
- 激活态用 `border-l-4` 色块，视觉笨重；
- 中英混杂（`Dashboard`）。

### 新方案：Apple 极简 Sidebar

**尺寸**：宽度收窄至 `200px`，在 `globals.css` 中修改 `--spacing-sidebar: 200px`。

**视觉风格：**

```tsx
// Logo 区域
<div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #F2F2F7' }}>
  <span style={{ fontSize: '15px', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.3px' }}>
    MWLAB
  </span>
  <span style={{ fontSize: '11px', fontWeight: 500, color: '#AEAEB2', marginLeft: '6px' }}>
    2026
  </span>
</div>

// Nav item — 激活态：橙色小点 + 背景 #FFF8F5，无左边框
// 非激活态：透明背景，灰色图标

// 激活态样式（替换原 border-l-4）:
// background: #FFF8F5
// 左侧无粗边框，改为图标色变橙色 + 文字颜色变 #FE5C00

// 底部 user area
// 邮箱文字 truncate，退出按钮小号灰色
```

**导航标签（全中文）：**

```tsx
const NAV_ITEMS = [
  { href: '/dashboard.html', label: '看板',   icon: <LayoutDashboard size={18} /> },
  { href: '/profile',        label: '个人资料', icon: <User size={18} /> },
  { href: '/setting',        label: '设置',    icon: <Settings size={18} />, adminOnly: true },
]
```

---

## 4. Dashboard 主体重设计（`public/dashboard.html`）

### 4.1 顶部导航栏

**当前问题**：Nav 中仅有 logo + 头像，中间空旷；语言混杂。

**新 Nav 方案（Z 型动线起点）：**

```
[MWLAB · 2026]     [筛选条件摘要（当前激活的行业/关系标签）]     [清除 · 头像]
   ← Z 第一眼          ← Z 中间信息扫描 →                        → Z 操作区
```

具体 CSS 修改：
```css
/* Nav 高度从 56px 提升至 60px，增加呼吸感 */
:root { --nav-h: 60px; }

/* Logo 字号从 17px 降至 15px，更克制 */
.nav-logo { font-size: 15px; font-weight: 700; }

/* 移除 nav-badge 的背景色块，改为纯文字 */
.nav-badge {
  font-size: 11px; color: #AEAEB2;
  background: none; padding: 0; margin-left: 4px;
}

/* 新增：筛选摘要区（显示当前激活的 L1/关系标签） */
.nav-filter-summary {
  flex: 1;
  display: flex; align-items: center; gap: 6px;
  overflow: hidden; padding: 0 16px;
}
.nav-filter-tag {
  height: 24px; padding: 0 10px; border-radius: 20px;
  background: #FFF2EC; color: #FE5C00;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
```

### 4.2 筛选器（Slicer）重设计

**当前问题**：三行筛选器密度过高，视觉层级不清；关系 pill 用红/绿颜色区分，违反色彩约束。

**新方案：**

1. Slicer 背景改为 `#FFFFFF`，`border: 1px solid #F2F2F7`，取消 box-shadow
2. `行业` label 从 `width: 40px` 改为内联标题，字号 `10px` `letter-spacing: 0.5em`
3. **关系标签改为单色体系**：

```css
/* 移除所有绿/红/橙/黄的关系色 */
/* 统一改为橙色梯度区分 */

.s-pill.rel-c.active {
  background: #1D1D1F;   /* 竞争对手：黑色（最重要/威胁） */
  border-color: #1D1D1F;
  color: #fff;
}
.s-pill.rel-p.active {
  background: #FE5C00;   /* 潜在伙伴：橙色主色 */
  border-color: #FE5C00;
  color: #fff;
}
.s-pill.rel-n.active {
  background: #FF9A60;   /* 新进入者：橙色 -40% */
  border-color: #FF9A60;
  color: #fff;
}
```

4. L1 slicer 激活态保持橙色主色
5. L2 panel 背景改为 `#FFF8F5`，border-radius `8px`

### 4.3 主体布局：黄金分割 + F 型动线

> ⚠️ 日历和地图保持现有嵌套结构，禁止改为独立选项卡。`top-row` 的 `grid-template-columns: 1.618fr 1fr` 保持不变（已是黄金比例）。

**布局结构（自上而下 F 型流）：**

```
F第一横：[核心指标 KPI × 4] ← 全宽，最重要数字首先捕获注意力
F第二横：[日历（61.8%）] [地图（38.2%）] ← 黄金分割（现有结构，仅确认不被改动）
F纵轴：  [趋势图 × 4]
         [展会概览（平滑滚动叙事区）]
         [完整品牌列表]
```

**唯一结构性修改**：将 KPI Row 从当前位置（`top-row` 之后）移至 `slicer` 之下、`top-row` 之前：

```html
<!-- slicer 之后，插入 KPI（F 型第一横） -->
<div class="mag-label" style="margin-top:0">核心指标</div>
<div class="kpi-row" id="kpiRow"><!-- 原有内容整体移动，不修改内部结构 --></div>

<!-- top-row 保持原位 -->
<div class="top-row">
  <!-- 日历 + 地图：原有内容完全不动 -->
</div>
```

### 4.4 KPI 卡片颜色修正

**当前问题**：四张 KPI 卡分别用 accent/red/green/blue 四色，违反色彩约束。

**修复方案：**
```css
/* 移除所有 .kpi-num.red / .kpi-num.green / .kpi-num.blue */
/* 统一改为单色梯度表达层级 */

.kpi-num           { color: #1D1D1F; }   /* 展会品牌（总数）：黑色最重 */
.kpi-num.accent    { color: #FE5C00; }   /* 保留橙色仅用于最核心指标 */
/* 其余三张 KPI（竞争/伙伴/新进入）全部使用 #1D1D1F */
```

修改 HTML：
```html
<div class="kpi-num accent" id="k-total">—</div>   <!-- 保留橙色 -->
<div class="kpi-num" id="k-comp">—</div>            <!-- 改为黑色 -->
<div class="kpi-num" id="k-part">—</div>            <!-- 改为黑色 -->
<div class="kpi-num" id="k-new">—</div>             <!-- 改为黑色 -->
```

KPI 卡片增加底部细线区分：
```css
.kpi-card:nth-child(2)::after { content:''; display:block; height:2px; background:#1D1D1F; border-radius:2px; margin-top:16px; width:24px; }
.kpi-card:nth-child(3)::after { content:''; display:block; height:2px; background:#FE5C00; border-radius:2px; margin-top:16px; width:24px; }
.kpi-card:nth-child(4)::after { content:''; display:block; height:2px; background:#AEAEB2; border-radius:2px; margin-top:16px; width:24px; }
```

### 4.5 关系标签（Brand Cards + Map Legend）颜色修正

**品牌卡片关系 pill：**

```css
/* 移除 --c-bg / --c-tx / --p-bg / --p-tx / --n-bg / --n-tx 所有绿红黄 */

.rel-c { background: #1D1D1F; color: #FFFFFF; }         /* 竞争对手 = 黑 */
.rel-p { background: #FFF2EC; color: #FE5C00; }         /* 潜在伙伴 = 橙浅 */
.rel-n { background: #F2F2F7; color: #6E6E73; }         /* 新进入者 = 灰 */
```

**日历事件 chips：**
```css
.ev-c { background: rgba(29,29,31,0.08);  color: #3D3D3F; }   /* 竞争 = 深灰 */
.ev-p { background: rgba(254,92,0,0.10); color: #FE5C00; }    /* 伙伴 = 橙浅 */
.ev-n { background: #F2F2F7;             color: #6E6E73; }    /* 新进 = 灰 */
```

**地图 legend HTML（移除绿/红）：**
```html
<div class="leg-row"><div class="leg-dot" style="background:#1D1D1F"></div>竞争对手</div>
<div class="leg-row"><div class="leg-dot" style="background:#FE5C00"></div>潜在伙伴</div>
<div class="leg-row"><div class="leg-dot" style="background:#AEAEB2"></div>新进入者</div>
```

**地图 SVG 国家着色（JS 中搜索 `fill` 颜色赋值，逐一替换）：**
- 有展会城市的国家底色：`#F2F2F7`（浅灰），保持现有逻辑，仅替换颜色值
- 竞争对手所在国：`#1D1D1F`（黑色）代替原红色 `#C0392B`
- 潜在伙伴所在国：`rgba(254,92,0,0.20)`（橙色透明）代替原绿色 `#1A6B3A`
- 新进入者所在国：`#D1D1D6`（灰色）代替原黄/琥珀
- 无数据国家：`#E8E8EC`（极浅灰）
- 城市圆点（`.cities` group）：颜色规则与上方 legend 一致
- 地图背景 `rect fill="#F0F4F8"` → 改为 `fill="#F2F2F7"`（统一页面背景色）
- 地图 graticule 线条颜色改为 `rgba(0,0,0,0.04)`（当前可能是蓝灰）

**行业分布环形图（Donut）颜色：**
```js
// 当前
const PIE_COLORS = ['#FE5C00','#1A6B3A','#C0392B','#F59E0B','#B45309','#6B7280','#374151'];
// 替换为橙色梯度 + 灰阶
const PIE_COLORS = ['#FE5C00','#FF7A2F','#FF9A60','#FFBF99','#1D1D1F','#6E6E73','#AEAEB2'];
```

**趋势柱状图颜色：**
- 在 JS 渲染 `trendVisitors` / `trendArea` / `trendExhibitors` 的地方，将柱子颜色统一为：
  - 当前年：`#FE5C00`
  - 历史年：`#D1D1D6`（灰色）

### 4.6 展会概览：平滑页面滚动叙事

**目标**：将「展会概览」卡片区改造为 **横向平滑滚动的叙事轨道**，用户左右滑动浏览，每张卡是一个「幻灯片帧」，形成时间轴叙事感。

**具体修改：**

1. 修改 `.main` 和 `.card-grid` 为横向滚动容器：

```css
/* 新增 */
.card-scroll-track {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 20px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.card-scroll-track::-webkit-scrollbar { display: none; }

/* 卡片变为固定宽度，不再自适应 */
.brand-card {
  flex: 0 0 280px;           /* 固定宽 */
  scroll-snap-align: start;  /* 磁吸对齐 */
}
```

2. 在 section-title 右侧增加翻页控件：

```html
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
  <div class="section-title" style="margin-bottom:0">展会概览</div>
  <div style="display:flex; gap:6px">
    <button class="cal-nav-btn" id="scrollPrev" onclick="scrollCards(-1)">‹</button>
    <button class="cal-nav-btn" id="scrollNext" onclick="scrollCards(1)">›</button>
    <span style="font-size:11px;color:#AEAEB2;display:flex;align-items:center;padding-left:4px" id="cardPageIndicator"></span>
  </div>
</div>
<div class="card-scroll-track" id="cardGrid"></div>
```

3. 滚动 JS（添加到 script 末尾）：

```js
function scrollCards(dir) {
  const track = document.getElementById('cardGrid');
  const cardW = 280 + 20; // card width + gap
  track.scrollBy({ left: dir * cardW * 3, behavior: 'smooth' });
}
```

4. **移除原有的分页控件**（`.pager` / `CARDS_PER_PAGE` 逻辑），改为一次性渲染全部卡片到横向滚动轨道（无需分页，因为横向滚动本身就是"翻页"）。

5. 卡片增加 **入场动画**（纯 CSS，滚动到视口时触发）：

```css
@keyframes cardFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.brand-card {
  animation: cardFadeUp 0.3s ease both;
}
.brand-card:nth-child(1)  { animation-delay: 0.00s; }
.brand-card:nth-child(2)  { animation-delay: 0.04s; }
.brand-card:nth-child(3)  { animation-delay: 0.08s; }
.brand-card:nth-child(4)  { animation-delay: 0.12s; }
.brand-card:nth-child(5)  { animation-delay: 0.16s; }
/* ... 依此类推最多 12 个 */
```

### 4.7 趋势图区域留白优化

```css
/* 趋势 section 增加更多上下间距，呼吸感 */
.trend-row {
  gap: 20px;
  margin-bottom: 32px;
  margin-top: 8px;
}
.trend-card {
  padding: 24px 24px 20px;
}
.trend-title {
  font-size: 12px;
  font-weight: 600;
  color: #AEAEB2;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}
```

### 4.8 数据表格优化

```css
/* 表格头部去掉彩色，统一灰色 */
th { background: #FAFAFA; color: #AEAEB2; }
th.sorted { color: #1D1D1F; }  /* 排序列用黑色，移除橙色 */

/* 行 hover 改为极淡橙底 */
tr:hover td { background: #FFF8F5; }

/* 关系列 pill 与 brand card 保持一致 */
```

---

## 5. globals.css 清理

1. 删除 `--color-md-red`, `--color-md-magenta`, `--color-md-light-orange`, `--color-md-yellow` 变量（防止开发者误用）
2. 删除 `--c-bg / --c-tx / --p-bg / --p-tx / --n-bg / --n-tx`（已被单色方案取代）
3. 保留并扩充橙色梯度变量：

```css
@theme {
  /* 主色梯度 */
  --color-orange-500: #FE5C00;
  --color-orange-400: #FF7A2F;
  --color-orange-300: #FF9A60;
  --color-orange-200: #FFBF99;
  --color-orange-100: #FFF2EC;
  --color-orange-50:  #FFF8F5;

  /* 中性色 */
  --color-black:   #1D1D1F;
  --color-gray-80: #3D3D3F;
  --color-gray-60: #6E6E73;
  --color-gray-40: #AEAEB2;
  --color-gray-20: #D1D1D6;
  --color-gray-10: #F2F2F7;
  --color-white:   #FFFFFF;

  /* 语义 token */
  --color-surface:       var(--color-gray-10);
  --color-surface-card:  var(--color-white);
  --color-accent:        var(--color-orange-500);
  --color-accent-dark:   #E55300;
  --color-accent-surface: var(--color-orange-50);
  --color-border:        var(--color-gray-20);
  --color-text-primary:  var(--color-black);
  --color-text-secondary: var(--color-gray-60);
  --color-text-tertiary:  var(--color-gray-40);

  /* 禁用的 destructive 红色，改为橙色警示 */
  --color-destructive: var(--color-orange-500);

  /* Layout */
  --spacing-sidebar: 200px;
  --spacing-nav-item: 44px;
}
```

---

## 6. 执行顺序与验证

### 执行顺序
1. `globals.css` — 清理色彩变量（其他文件依赖它）
2. `app/login/page.tsx` — 重建登录页布局
3. `components/layout/Sidebar.tsx` — 侧边导航
4. `public/dashboard.html` — 主体（最复杂，分段执行）：
   a. 先改 CSS 变量和颜色（`:root` 块）
   b. 再改 KPI / 关系 pill 颜色
   c. 再改 Slicer
   d. 再改布局顺序（KPI 移顶部）
   e. 最后改展会概览横向滚动

### 验证清单（每步完成后用 `/taste` 检查）

- [ ] 登录页：MatrixCanvas 和 TypewriterLine 保留，左栏 61.8% 黄金比例，无红色报错
- [ ] Sidebar：200px 宽，无左粗边框，全中文标签
- [ ] Dashboard Nav：语言统一，筛选摘要标签显示
- [ ] KPI 区：无蓝/绿/红，仅黑 + 橙色主色
- [ ] 关系 pill：无绿/红，仅黑/橙/灰三种
- [ ] 日历事件：无绿/红背景
- [ ] 地图 legend：无绿/红点
- [ ] 环形图：橙梯度 + 灰阶
- [ ] 趋势柱图：橙色当年 + 灰色历史年
- [ ] 展会概览：横向磁吸滚动，入场动画流畅
- [ ] 整体：无 `#1A6B3A` / `#C0392B` / `#F59E0B` / `#3B82F6` 等禁色残留

---

*文档生成于 2026-05-18 · MWLAB-2026 UI Redesign Spec v1.1 — 修订：保留 MatrixCanvas，禁止改动日历/地图结构，补充地图着色规则*
