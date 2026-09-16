# design/ — 设计产物存放区（不进构建）

`stitch/` 存 Stitch 导出的原始稿，**只作为设计规格，不直接进 `app/`**。

```
design/stitch/
  mwlab_intelligence_workstation/DESIGN.md   ← Stitch 生成的设计系统（含 M3 污染，见 brief P0-4）
  mwlab_public_landing/          code.html + screen.png
  mwlab_overview/                code.html + screen.png
  mwlab_m_a_pipeline/            code.html + screen.png
  mwlab_opportunity_detail/      code.html + screen.png
  mwlab_exhibition_basemap/      code.html + screen.png
  mwlab_sign_in_{default,focused,error,loading}/  code.html + screen.png
```

- `.html` 给机器读 —— 间距、字号、色值的精确数值，用于反向抽 token
- `.png` 给人和模型看整体观感

> ⚠️ Stitch 输出是 Tailwind **v3** 语法（CDN + `tailwind.config`），本项目是 Tailwind **v4**（`@theme`）。
> 不可直接复制进 `app/`。转写在阶段 5.2 由 DeepSeek 做。

**下一步**：`docs/CLAUDE-DESIGN-BRIEF.md` —— 待修问题清单与深度设计要求。
