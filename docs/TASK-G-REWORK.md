# 任务 G · 返工单（第 1 轮）

**日期**：2026-09-17
**质检依据**：`docs/TASK-G-opportunity-detail.md` §4 验收 + §3 陷阱 + `DEV-ORDER-AND-QC.md` §2.2 通用门禁
**结论**：**不合格，四条返工。** 功能主线是通的，最关键一条（挂了公司的机会能看到并下载该公司资源）已过。

按 `DEV-ORDER-AND-QC.md` §2.3，本单只写「哪条失败、期望是什么、实际是什么」，不给实现。

---

## 先说过了的（不用再动）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 零错误 |
| `npm run build` | 零错误零告警 |
| `npm test` / `pytest` | 29 passed / 135 passed |
| 硬编码色值、Tailwind 内置灰、`color-brand` 三条 grep | 全部干净 |
| 数据基线 §3 十一项 | 全部吻合（`intel_report` 13、`schema_version` 17） |
| §4 关联公司显示 上海励泰 / 桂芳金 / 存续 | 过 |
| §4 资源 2 份，下载到文件不是 HTML | 过（docx 回 OOXML 45,828 B；json 回 JSON 8,615 B） |
| §4 深度调研 tab 列出任务 D 回填的报告 | 过 |
| §4 PATCH 推进阶段写 `stage_change` | 过 |
| §3.1～§3.6 六个陷阱 | 全部没踩 |
| 只读账号 | PATCH 返回 403，界面禁用步进器并提示，正确 |

把六块 SQL 抽到 `lib/queries/opportunity.ts` 让页面与接口共用 —— 规格写的是「接口已就绪」，
严格讲动了不该动的文件，但逐句比对过 SQL 一字未改，且 `lib/queries/overview.ts` 早有同样先例，
服务端组件本来就不该对自己发一次 HTTP。**这个改动认可，保留。**

---

## G-1 · 验收数据没清理，且留下一个活的管理员账号

**失败的验收条目**：规格 §4 最后一条命令（清理验收数据）。

**期望**：验收跑完后库里不留任何验收痕迹。

**实际**：

```
opportunity        opp_id=2「验收用」               仍在
opportunity_event  opp_id=2 名下 7 条                仍在
user               qc-taskg-admin@mwlab.internal    role=admin     is_active=1
                   qc-taskg-ro@mwlab.internal       role=readonly  is_active=1
```

两点要注意：

1. `user` 表不在 `DEV-ORDER-AND-QC.md` §3 的数据基线里，所以行数核对发现不了这个污染。
   以后自建验收账号，**必须连账号一起清**。
2. `qc-taskg-admin` 是 **role=admin、is_active=1 的活账号**，密码只有 DS 知道。
   留在库里等于多了一把管理员钥匙，这是本单里唯一的安全类缺陷，**优先处理**。

`opportunity_event` 里 `event_id=7`（`closing → audit`）是质检时 PATCH 产生的，不是 DS 的，一并删。

**做完自查**：`user` 表应只剩 3 行（admin / manager / readonly），`opportunity` 只剩 `opp_id=1`。

---

## G-2 · 时间线的排序字段和显示字段不是同一个

**失败的验收条目**：规格 §2.2「时间线 tab：`events[]` 倒序」。

**期望**：时间线上从上到下，显示出来的时间递减。

**实际**：查询按 `created_at DESC` 排序，界面显示的是 `occurred_at || created_at`
（`app/opportunity/[id]/opportunity-detail.tsx:403`）。两个字段不是一个，于是：

```
记录        2026-09-17 15:33:22
会议        2026-09-20 14:00      ← 排在第二，时间却是全列表最晚的
上传附件    2026-09-17 15:33:22
已完成      2026-09-17 15:33:22
交割 → 审计  2026-09-17 07:38:04
```

只要有人填了 `occurred_at`（补记上周开过的会、预排下周的会），顺序就是乱的。
`occurred_at` 存在的意义就是让事件能脱离录入时间，所以这不是极端情况，是常态。

**要求**：排序键与显示键改成同一个。往哪边统一由 DS 定，但要在 PR 里写明选了哪边、为什么。

注：`ORDER BY created_at DESC` 是原接口带过来的，不是 DS 写的；
显示 `occurred_at` 是 DS 的选择。两者配在一起才出的这个问题。

---

## G-3 · 删掉右栏的「规模数据」区块

**这不是 DS 的错，是规格重复了** —— §2.2 让关联展会 tab 显示「最新一届的面积/展商/观众」，
§2.3 又让右栏显示「规模数据」，是同样三个数。DS 两处都做了，照规格是对的。

**实际效果**：同一屏上 `110,000 / 1,035 / 54,000` 出现两次。

**Max 已定**：**删右栏那一块，保留「关联展会」tab 里的「最新一届规模」。**
理由是右栏其余三块（关联公司 / 对标 MD 品牌 / 资源）是常驻的，
而规模数据只在 `brand` 存在时才有内容，挂在 tab 里更合适。

规格 §2.3 的「规模数据」条目作废，本单即为修订依据。

---

## G-4 · 右栏「关联公司」的右上角塞了中文，且内容重复

**失败的验收条目**：无对应验收条目，属界面一致性问题。

**期望**：右栏每个区块右上角是拉丁小字标签，同列节奏一致
—— 现在是 `ENTITY` / `BENCHMARK` / `RESOURCES`。

**实际**：`CompanyRail` 给 `Section` 传了 `note={company.company_status}`，
右上角显示成「存续（在营、开业、在册）」。两个问题：

1. 打断了那一列全拉丁小字的规律，一串中文长文案挤在那儿；
2. 下面「经营状态」行已经显示了同一个值，同一区块里重复了一遍。

**要求**：右上角回到拉丁标签，经营状态只在下面那行出现一次。

---

## G-5 · 把资源列表提成共用组件

**这也不是 DS 的错** —— 规格里没写过共用要求，`ResourceList` 定义在
`app/opportunity/[id]/opportunity-detail.tsx:542`，是这个文件的局部组件，合理。

但下一个任务 **C（公司库 + 调研库）的公司详情页要的是同一个东西**：
`TASK-C-list-detail-pages.md` §56 的资源区规格与 `TASK-G` §2.3 逐字对得上
—— 同样按 `collected_at` 倒序、同样 kind 徽标 + 标题 + 大小 + 下载按钮。
分两次写就是两份实现，之后要么长期并存要么返工合一份。

**要求**：把它提到 `components/` 下成为共用组件，`app/opportunity/[id]` 改为引用。
组件只接收资源数组，不夹带机会或公司的业务判断 —— 任务 C 要原样复用它。

空态文案是唯一需要留口子的地方：机会详情页现在写的是
「这一机会及其关联公司名下还没有资源」，公司详情页说法不一样。

---

## 交回前自查

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # 两套全绿

sqlite3 data/mwlab.db "SELECT COUNT(*) FROM user"                     # 3
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM opportunity"              # 1
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM opportunity_event WHERE opp_id=2"   # 0
```

界面上再看三眼：时间线时间是否递减、右栏是否只剩三块、关联公司右上角是否回到拉丁标签。

**改库前一律** `cp data/mwlab.db data/backups/mwlab_pre-taskG-rework-$(date +%Y%m%d).db`。
