# 任务 E · 返工单（第 1 轮）

**日期**：2026-09-17
**质检依据**：`docs/TASK-E-i18n-wiring.md` §3 / §4 / §5 + `DEV-ORDER-AND-QC.md` §2.2 通用门禁
**结论**：**不合格，三条返工。** 主体做得扎实，返工的三条里有一条是规格自身的缺口，不全怪 DS。

按 `DEV-ORDER-AND-QC.md` §2.3，本单只写「哪条失败、期望是什么、实际是什么」，不给实现。

---

## 先说过了的（不用再动）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` / `npm run build` | 零错误零告警 |
| `npm test` / `pytest` | 29 passed / 135 passed |
| 配色三条 grep | 干净 |
| §5.2 两份字典键对齐 | zh 413 = en 413，缺失 0，多余 0 |
| §5.3 `en.json` 中文残留 | 无 |
| §5.1 两条 grep | 只命中 5 处**注释**，规格明确说注释不算 |
| §4.3 数字与日期走 Intl | 日期显示 `Sep 17`；`research-*.tsx` 里两处 `.slice` 是解析失败的兜底路径，不是硬切 |
| §4.4 `lib/i18n.ts` 未进客户端包 | 所有 import 都在 `page.tsx` / `layout.tsx` |
| §4.5 `.lat` 保留 | 8 个文件仍在用 |
| §3 英文取短式 | 「录入机会」→ `New`、`MD BRAND` 而非 `MD Benchmark Brand`，合格 |
| EN 下逐页扫中文 | `/overview` `/opportunity` `/company` `/research` `/expo` `/setting` 的**界面文案**全英文，残留的都是数据（公司名、报告标题、法定代表人、`display_name`） |

另外确认：任务 C 里修过的「注销」筛选没被这次重构带坏。
`lib/enums.ts` 用两条同 slug + 去重取后者处理了带日期后缀的原值，点下去仍出 1 条 —— 这一手比返工单当初要求的到位。

---

## E-1 · 个人资料页有 8 个中文复选框

**失败的验收条目**：§4.2「英文版不得出现任何中文字符」。

**期望**：EN 下这一页没有中文界面元素。

**实际**：整页英文，中间一整块中文。

```
Customize dashboard industry filter
  □ 休闲       □ 农业与畜牧    □ 化工与能源   □ 医疗和健康
  ☑ 机械和设备  □ 生活方式      □ 科技+        □ 零售贸易和服务
  [ Save preferences ]   1 sectors selected
```

`app/profile/profile-content.tsx:120` 的注释写着「行业名是数据（库里的 `industry_l1`），原样显示」。
按 §4.1 这是一种合理读法，**但和同一批改动里对 `company_status` 的处理不一致**：

- `company_status`（存续 / 在业 / 注销…）同样是「库里的值」，DS 把它放进了 `lib/enums.ts`，
  value 保持中文原值发给接口、标签按 locale 取；
- `industry_l1` 是 `scripts/classify_all_brands.py` 派生的**闭集，全库就 8 个取值**，
  与 `company_status` 完全同性质，却按自由文本处理了。

`lib/enums.ts` 自己的注释定了判断标准：「界面上这些是**闭集**（六七种取值），不是用户录入的自由文本」→ 翻。
行业符合这条。

**要求**：照 `COMPANY_STATUS` 的形态在 `lib/enums.ts` 加一份 `INDUSTRY_L1`，
value 保持库里的中文原值（`/api/user/preferences` 存的就是它，改了会存错），
标签进 `locales/*.json` 的 `enum.industryL1`。

**英文译名由 Max 定**，下面这张表等他填，**别自己编**：

| 库里的值 | 条数 | `en` 标签 |
|---|--:|---|
| 机械和设备 | 2,551 | _待 Max 定_ |
| 生活方式 | 1,710 | _待 Max 定_ |
| 休闲 | 854 | _待 Max 定_ |
| 化工与能源 | 676 | _待 Max 定_ |
| 科技+ | 668 | _待 Max 定_ |
| 医疗和健康 | 435 | _待 Max 定_ |
| 零售贸易和服务 | 279 | _待 Max 定_ |
| 农业与畜牧 | 228 | _待 Max 定_ |

> 「科技+」带一个 `+`，写进 JSON 和 slug 时注意别被当特殊字符处理。

---

## E-2 · 接口错误文案只有中文，英文界面会原样显示

**失败的验收条目**：§4.2。

**期望**：EN 下报错也是英文。

**实际**（`mwlab_locale=en` 实测）：

```bash
POST /api/opportunity  -d '{"type":"ma","title":""}'
  → {"error":"机会名称必填"}
PATCH /api/opportunity/1 -d '{"stage":"zzz"}'
  → {"error":"阶段只能是 contact / intent / dd / audit / closing"}
POST /api/opportunity  -d '{"company_id":999999}'
  → {"error":"关联的公司或展会品牌不存在"}
```

这些串会直接进界面：`app/opportunity/new-drawer.tsx:96` 把接口的 `error` 接过来，
`:118` 原样渲染；`opportunity-detail.tsx` 的阶段推进、公司库/调研库详情的错误态同理。

**规格 §5 的两条 grep 抓不到它** —— 那两条只扫 `--include="*.tsx"`，
而错误串在 `.ts` 路由里。**这是验收条款的缺口，不全怪 DS。**

### Max 已定：接口回错误码，前端查字典

接口不再返回中文句子，改返回 slug；前端按 slug 查 `t.error.*`，查不到时回退到
通用的「操作失败」，**不要把 slug 裸露给用户**。

涉及 9 个路由、26 条去重后的文案：

```
app/api/opportunity/route.ts        8 条
app/api/company/route.ts            9 条
app/api/company/[id]/route.ts       8 条
app/api/opportunity/[id]/route.ts   7 条
app/api/research/route.ts           7 条
app/api/research/[id]/route.ts      7 条
app/api/auth/login/route.ts         3 条
app/api/resource/[id]/download/route.ts  3 条
app/api/user/preferences/route.ts   1 条
```

去重后的全量文案（自己去对应路由里找位置）：

```
请求体不是合法 JSON / 请求格式错误 / 没有可更新的字段 / 字段取值不符合约束 / 必填字段不能为空
机会名称必填 / 企业名称必填 / 报告标题必填
业务线只能是… / 阶段只能是… / 交易形式只能是… / 报告类型只能是… / 报告状态只能是…
接触状态只能是… / 来源类型只能是…
优先级需为 1–5 的整数 / 意向评分需为 1–5 的整数
关联的公司或展会品牌不存在 / 关联的展会品牌不存在 / 关联的公司、展会品牌或机会不存在
已存在同名同源的记录
邮箱和密码不能为空 / 邮箱或密码错误
资源路径非法 / 资源不是普通文件 / 文件已不在磁盘上，请重新索引
```

三个注意点：

1. **「只能是 X / Y / Z」这类带枚举的**，枚举值本身是英文 slug（`ma / greenfield / …`），
   不用翻，但句子结构要走字典的插值（`{values}`），别再拼串 —— §3「禁止字符串拼接」。
2. **登录页的两条**（邮箱和密码不能为空 / 邮箱或密码错误）已经是英文界面能看到的，
   优先级最高。注意 `邮箱或密码错误` 是**故意不区分**用户名是否存在的统一文案，
   改成错误码时别顺手拆成两种。
3. `资源路径非法` 那条是路径越界的响应，**不要在错误码里回显路径**，
   原注释写了「不告诉调用方越到了哪里」，这个性质要保留。

---

## E-3 · 日期与插值助手被复制了三份

**失败的验收条目**：无对应条目，属同一批改动内部的重复。

**期望**：一个助手一份实现。

**实际**：`lib/i18n-shared.ts` 里已经导出

```
parseLocal / fmtDate / fmtMonthDay / fmtDateTime / fmtNum / fill
```

`app/opportunity/[id]/opportunity-detail.tsx` 正确地 import 了它们。但同一批改动里：

```
app/research/research-list.tsx:49        又写了一个 fmtDate
app/research/[id]/research-detail.tsx:55 又写了一个 fill
app/research/[id]/research-detail.tsx:64 又写了一个 fmtDateTime
```

三份都带着同一段「Safari 解析不了空格分隔的时间串」的注释 —— 那正是**只该有一份**的信号。
以后修这个坑会改一处漏两处。

**要求**：`research-list.tsx` 与 `research-detail.tsx` 改为从 `lib/i18n-shared.ts` 引，
删掉本地副本。注意两边的**参数顺序不同**（本地版是 `(s, locale)`，共享版是 `(locale, s)`），
换的时候别调反。

---

## 提及不改

`app/api/dashboard/route.ts:42` 有 `relation && relation !== '全部'` 这种跟中文字面量比较的写法
（同一文件里 `mds` 那行也是）。一旦有前端在英文下传值过来就会失效。
但目前没有任何前端调这个端点，且是 E 之前就有的代码，**本轮不动，只记一笔**。

---

## 交回前自查

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # 两套全绿

# 补上规格 §5 漏掉的那条：路由层不该再有中文错误文案
grep -rnE "error: [\`'\"][^\`'\"]*[一-鿿]" app/api/     # 应为空

# 字典仍对齐
python3 -c "
import json
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('缺失:',set(z)-set(e) or '无'); print('多余:',set(e)-set(z) or '无')"

# en.json 仍无中文
python3 -c "
import json,re
print('残留:', re.findall(r'[一-鿿]+', open('locales/en.json',encoding='utf-8').read()) or '无')"
```

人工再看三眼：

- EN 下 `/profile` 的 8 个行业复选框是英文
- EN 下在录入抽屉里触发一次保存失败（例如挂一个已删除的公司），错误提示是英文
- ZH 下这三处仍与原来一致，公司库的「注销」药丸仍能筛出 1 条
