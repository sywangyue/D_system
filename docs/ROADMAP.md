# 路线图 · 待办

编号接续 `HISTORY.md`。

**V2-18 → V2-20 的分工、交接契约与门禁见 `WORKFLOW.md`**，下表只记范围与状态。

| 编码 | 内容 | 说明 |
|---|---|---|
| V2-18 | ~~落地页 + 登录页改版~~ | **已完成上线**，见 `HISTORY.md`。剩 A2 展示缺口盘点 —— 等 Max 挑出要上传的内容并给样本 |
| **🔴 待 Max 操作** | **Cloudflare 开 HSTS** | 线上 `strict-transport-security: max-age=0`，这个头是 Cloudflare 边缘发的，`next.config.ts` 里的设置会被覆盖（已实测）。路径：SSL/TLS → Edge Certificates → HSTS → Enable。开前确认子域都能上 HTTPS，配错要等 max-age 过期。详见 `DEPLOY.md`「安全配置」 |
| — | CSP 响应头 | 需先跑 `Content-Security-Policy-Report-Only` 观察：本站有内联样式与 Next 水合脚本，直接上强制模式会白屏 |
| — | Chrome 密码泄露提示 | 若仍在报：多半是 Chrome 密码管理器里存着旧的 `admin123`。去 `chrome://password-manager/passwords` 删掉 mwlaboratory.com 的旧记录再重存 |
| V2-19 | **展示能力补齐 + 项目归档**（阶段 B/C） | 先收敛重复小组件（Tag 8 份、Pill 4 份、Empty 4 份），再补展示缺口（如知识库图片样式）与导入脚本；然后 Max 灌真实数据 |
| V2-20 | **数据看板设计 + 筛选项**（阶段 D） | 在真实数据之上做一次成型，含筛选器与表头。设计规范见 `DESIGN.md` |
| — | 去重复核 | 1,925 对候选待 Max 过完（每跑一次 pipeline 重出）；完成后落地页「规模排名」可改回品牌榜（见 archive 任务 J） |
| — | 地图坐标表扩充 | 837 个品牌（约 11%）无坐标，坐标表只覆盖 33 个国内城市 |
| — | 德文界面 | 待人工翻译 `locales/de.json` |
| — | 阶段驻留天数 / 转化率 | 需 stage_change 事件积累 |
| V1-11 | ExpoFinder 线索接入 | 方案已收敛，待展查查提供接口文档（archive/V1-prd-audits.md） |
| V1-12 | 全集采集 | 未执行 |
