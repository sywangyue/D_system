# V2-18 落地页改版 · 材料

喂给 Stitch 的全部材料在这里 + `docs/DESIGN.md`。截图日期 2026-09-18，取自线上 https://mwlaboratory.com。

## 给 Stitch 的清单

| # | 材料 | 位置 |
|---|---|---|
| 1 | 7 条改动规格 | `docs/DESIGN.md` 第 6 节 |
| 2 | Design Token 表 | `docs/DESIGN.md` 第 1 节 —— 不给它就会用自己的配色 |
| 3 | 中文排版 7 条 | `docs/DESIGN.md` 第 2 节 —— 不给它中文会挤成团、还会套负字距 |
| 4 | 落地页现状 | `current/01-landing-now.png` |
| 5 | Hero 里要放的 dashboard | `current/02-expo-hero.png` |
| 6 | 完整界面框架 | `current/03-expo-full.png` |
| 7 | Linear 参考 | 自行截图：首屏 + 「Build, review, and ship」段 |

**Prompt 在 `stitch-prompt.md`** —— 已把第 6 节的视觉要求提炼成 Stitch 能吃的形式，
并带上真实文案与数字（上一轮 Stitch 编了 43 条假展会名，必须给原文）。

## 截图说明

| 文件 | 内容 |
|---|---|
| `01-landing-now.png` | 落地页全页，1440 宽。当前六段：导航 / 首屏 / 数字带 / 数据切面 / 三条业务线 / 页脚 |
| `02-expo-hero.png` | `/expo` 主内容区。**已裁掉侧栏**（侧栏底部有账号邮箱）、**已清除行业筛选**（所以是全量 7,378 而不是某一类的 2,543） |
| `03-expo-full.png` | `/expo` 完整界面，含侧栏，给 Stitch 看整体框架用 |

## 两件容易搞错的

**Hero 不是从零做。** 落地页现在已经有产品截图框了 —— `components/landing/ProductShot.tsx`
读 `public/landing/product.webp`，截的正是 `/expo`。第 6.2 条是**把这个框升级成
Linear 那种「渐变背景 + 悬浮 + 投影」**，不是推倒重做一个组件。

**不要给 Stitch 看 `/overview`。** 那一页现在只有 1 条机会、大片空白（`opportunity` 表
就 1 行）。给了它会以为界面本来就这么空，照着设计出来的东西灌进真实数据会散架。
要展示 dashboard 就用 `/expo` —— 它是全站数据最密的一页。

## 落地时的两个坑

- **渐变 / 毛玻璃 / 投影现在一个 Token 都没有**（`globals.css` 里没有任何 shadow / gradient /
  blur 变量）。Stitch 出稿后先定 Token 再落地，组件里写死会直接撞「无硬编码色值」门禁。
- **页脚那两个合作方 logo 是印刷素材**：`public/logo-mds.jpg` / `logo-mdc.jpg`，
  990×999、**CMYK**、各 2.2MB。CMYK 的 JPG 在浏览器里颜色会偏，必须转 sRGB + 压缩 + 转 WebP。

> Stitch 输出是 Tailwind v3 语法，本项目是 v4（`@theme`），**不可直接复制进 `app/`**，
> 转写由 DeepSeek 做。同 `../README.md` 的规矩。
