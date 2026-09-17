# 任务 I · 设置 / 个人资料收尾

**前置**：E（i18n）、H（`/expo` 是个人资料偏好的新消费方）
**涉及**：`app/profile/*`、`app/setting/*`、`components/settings/*`、`app/api/setting/status/route.ts`、
`app/api/dashboard/route.ts`
**验收**：见 §6

---

## 1. 这是一个「收尾」任务，不是「新功能」任务

两页都已存在、已接好 i18n。本任务只修**旧架构留下的断头**：
`public/dashboard.html` 在阶段 5 删掉了，但这两页还在指向它、为它供数。

**不做**：用户新增 / 禁用 / 重置密码的界面，新的设置分区，头像上传。
全系统 3 个账号，这些没有需求（IA §1.2：设置页「沿用现有」）。

---

## 2. 个人资料 `/profile` —— 三个断头

### 2.1 保存后跳到一个不存在的页面

```
app/profile/profile-content.tsx:64   setTimeout(() => router.push("/dashboard.html"), 1500)
app/profile/profile-content.tsx:87   onClick={() => router.push("/dashboard.html")}
```

`/dashboard.html` 已删。**现在保存偏好之后 1.5 秒会跳到 404。**「返回」按钮同样。

**要求**：
- 「返回」回到 `/overview`，文案改为「返回盘面」（`profile.back`，两份字典都改；
  英文现在是什么就对应改，不要保留 Dashboard 字样）。
- 保存成功**不再自动跳转**。原地显示「已保存」，停留在本页 ——
  自动跳走是为旧看板设计的（保存完回去看效果），现在偏好作用在 `/expo`，
  页面上给一个「去展会底图查看」的文字链接即可，让用户自己决定。
- `profile.saving`（「已保存，正在跳转…」）随之不再成立，改成「已保存」。

### 2.2 为了取 8 个行业名，把 7,401 个品牌全拉了一遍

```
app/profile/profile-content.tsx:27   fetch("/api/dashboard")
```

然后在前端 `Set` 去重得到 8 个 `industry_l1`。这 8 个值 E 返工时已经进了
`lib/enums.ts` 的 `INDUSTRY_L1`。

**要求**：复选框列表直接用 `INDUSTRY_L1`，删掉对 `/api/dashboard` 的请求。
页面首屏只剩一个请求（`GET /api/user/preferences`），或者由服务端壳直接读库传下来 ——
二选一，后者更好（与其他页面的服务端壳一致，且没有加载闪烁）。

复选框的**顺序按 `INDUSTRY_L1` 数组顺序**，不要再 `.sort()` —— 对中文原值排序在两种语言下
都没有意义，而数组本身是按品牌数从多到少排的。

### 2.3 保存失败时静默当成功

```ts
await fetch("/api/user/preferences", { method: "PATCH", ... })
setSaved(true)
```

没检查 `res.ok`。接口 400 / 401 也会显示「已保存」。

**要求**：检查 `res.ok`，失败时用 `errorText(t, body.error, body.values, …)` 显示错误
（E-2 之后的统一写法），不显示「已保存」。

### 2.4 说明文案改指向

`profile.industryFilter`（「定制 Dashboard 行业筛选」）与 `profile.industryFilterHint`
（「下次登录 Dashboard 将自动应用…」）说的是旧看板。改为说明它作用于**展会底图的默认行业筛选**。
措辞自己定，两份字典同步，英文不出现 Dashboard。

---

## 3. 设置 `/setting` —— 数据状态只讲了旧主角

`DataStatusCard` 现在显示：品牌总数、展会届次、最近采集状态、最近采集耗时。
新架构的中心实体是**公司**（`REBUILD-2026-09-PLAN.md` §0 判断 2），这张卡只讲了降级后的展会。

**要求**：`/api/setting/status` 的 `data_status` 增加四个计数，卡片上并列显示：

| 键 | 取值 | 字典标签（zh） |
|---|---|---|
| `total_companies` | `company` 行数 | 公司 |
| `total_opportunities` | `opportunity` 中 `is_archived = 0` 的行数 | 在跟进机会 |
| `total_reports` | `intel_report` 行数 | 调研报告 |
| `total_resources` | `resource` 行数 | 资源文件 |

原有的品牌 / 届次 / 采集三项保留，排在新四项之后。
数字走 `fmtNum`，加 `.num`。

`tests/api/setting.test.ts` 测的就是这个接口，改完同步更新它的断言，别让测试掉。

### 3.1 构建时间在说谎

```ts
build_time: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
```

环境变量没设（仓库里没有任何地方设它），于是「构建时间」显示的是**每次请求的当前时间**。

**要求**：`next.config` 里在构建时把时间写进 `NEXT_PUBLIC_BUILD_TIME`
（`env: { NEXT_PUBLIC_BUILD_TIME: new Date().toISOString() }` 这类写法）。
取不到时显示「—」，**不要回退成当前时间**。

`next_version` 同理：`process.env.__NEXT_VERSION__` 不是 Next 提供的变量，永远走回退值 `'16.x'`。
改为读 `next/package.json` 的 `version`，或者直接删掉这一行 —— 选删掉更省事，Node 版本已经够判断环境了。
删掉的话 `components/settings/SystemInfoBlock.tsx` 里对应的一行与字典键 `settings.nextVersion` 一并删。

---

## 4. 退役 `/api/dashboard`

2.2 做完后，`/api/dashboard` **没有任何调用方了**
（`grep -rn "api/dashboard" app components lib` 只剩注释）。它是旧看板的供数端点，
一次吐回全部品牌，且里面有 `relation !== '全部'` 这种跟中文字面量比较的写法
（`TASK-E-REWORK.md`「提及不改」那一条）。

**要求**：

1. 删除 `app/api/dashboard/`；
2. 删除 `tests/api/dashboard.test.ts`（它只测这个端点）—— **在 commit 里写明删了哪个测试、为什么**，
   `npm test` 的用例数会从 29 降下来，这是预期；
3. `app/api/expo/route.ts` 顶部注释里「/api/dashboard 仍在给… 供数」那句改掉；
4. `grep -rn "api/dashboard\|dashboard\.html" app components lib docs/DEPLOY.md` 应只剩历史文档。

> 删之前再 grep 一遍确认没有调用方。如果 H 或别的任务新引用了它，停下来问，不要删。

---

## 5. ⚠️ 陷阱

### 5.1 偏好存的是中文原值

`user.dashboard_prefs` 存的是 `{"l1s": ["机械和设备", …]}`。
复选框的 value 必须是 `INDUSTRY_L1` 里的 **value**（中文原值），不是 slug。
改成存 slug 会让已保存的偏好全部失配，且 H 的 `/expo` 按原值筛选会筛出 0 条。

**列名 `dashboard_prefs` 不要改**。它是库里的列，改名要迁移，收益为零。

### 5.2 ~~`requireUser` 那句注释是错的~~（本条作废，2026-09-17 质检更正）

初稿说「`requireUser` 不查 `is_active`」，**这是规格写错了**：`lib/api-guard.ts` 第 19–21 行
查了库，被禁用账号会被拒。原注释「requireUser 同时校验 is_active」是对的，已改回。

### 5.3 设置页只有 admin 能看

`/setting` 的两个接口都是 admin 专用（403），中间件也挡了非 admin 进页面。
新增的四个计数放进同一个接口，**不要新开一个不设权限的接口**。

---

## 6. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # npm test 用例数比 29 少，少的正好是 dashboard.test.ts 那几条

# /api/dashboard 已退役
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/api/dashboard     # 404
grep -rn "api/dashboard\|dashboard\.html" app components lib                              # 应为空（注释也算，一并清掉）

# 设置接口新增四项
curl -s -b "session=$T" localhost:3000/api/setting/status | jq '.data_status | keys'
#   含 total_companies / total_opportunities / total_reports / total_resources
curl -s -b "session=$T" localhost:3000/api/setting/status | jq '.data_status.total_companies'   # 501

# 构建时间不随请求变化：连取两次，值相同
for i in 1 2; do curl -s -b "session=$T" localhost:3000/api/setting/status | jq -r .system_info.build_time; sleep 1; done

# 偏好保存失败要能看出来：readonly 以外的错误路径，例如发一个非 JSON 的体
curl -s -b "session=$T" -X PATCH localhost:3000/api/user/preferences -d 'x' | jq .error       # "badRequest"
```

人工检查：

- `/profile` 首屏在 Network 面板里**只有一个或零个**接口请求，没有 `/api/dashboard`
- 勾选两个行业保存 → 停留在本页、显示「已保存」、**不跳转**；再打开 `/expo`，这两个行业已预选
- 「返回」回到 `/overview`
- `/setting` 数据状态卡显示公司 501、在跟进机会、调研报告 13、资源文件 50，以及原有三项
- 切 EN：两页无中文界面文案，不出现 Dashboard 字样
- 数据基线：`user.dashboard_prefs` 验收后恢复原值（验收时改过就改回去）
