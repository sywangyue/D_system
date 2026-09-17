---
title: 示例项目（模板，不会出现在页面上）
title_en: Example Project (template, never rendered)
type: ma
year: 2024
status: active
summary: 这一行是列表卡片上的说明，两行以内最合适。
summary_en: One line of card copy; keep it within about two lines.
cover: images/01-cover.jpg
---

> **这是模板，不是内容。** 目录名 `_example` 以下划线开头，按 `lib/knowledge.ts`
> 的 slug 规则（只允许 `[a-z0-9-]`）会被自动跳过，**不会出现在列表里**。
>
> 新建项目：把整个目录复制成 `knowledge/<你的 slug>/`（slug 用 `2024-litai-acquisition`
> 这种形式），改掉上面 frontmatter，删掉这段引用块。

## 项目背景

这个项目是什么、为什么做、当时是什么状态。

## 流程

按时间写关键节点。时序表用 GFM 表格就行（`remark-gfm` 已开）：

| 时间 | 事件 |
|---|---|
| 2024-03 | 初次接洽 |
| 2024-07 | 尽调 |
| 2025-02 | 交割 |

## 结果

最后变成了什么样，以及留下了什么可复用的东西。

插图的写法与 `cover` 一致 —— 写相对路径，页面会自动改写成
`/knowledge/<slug>/images/...`（见 `lib/knowledge-url.ts`）：

![现场照片](images/01-site.jpg)

---

**文件放哪**（分界线只有一条：能被陌生人看到也无所谓的，才放 `public/`）：

```
knowledge/<slug>/                ← 不对外，走鉴权
  index.md
  docs/2024-协议签署版.pdf         ← 合同、估值表这类

public/knowledge/<slug>/         ← 公开静态，Next 直接发
  images/01-site.jpg             ← 展会现场照片
```
