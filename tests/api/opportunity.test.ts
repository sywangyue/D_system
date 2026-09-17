import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  buildRecordingMockDb,
  type MatcherResolver,
  type RecordingMockDb,
  type RunResolver,
} from "./_db-mock"
import zh from "@/locales/zh.json"

/**
 * /api/opportunity（列表 + POST）与 /api/opportunity/[id]（详情 + PATCH + DELETE）
 *
 * 只 mock @/lib/db —— 读端用 getDb()、写端用 getWritableDb()，**两个都要 mock**，
 * 否则写测试会拿到 lib/db.ts 里的真实只读连接（data/mwlab.db 是 Max 正在录的真实数据）。
 *
 * 认证：middleware 已在集成层剥离外部注入的 x-user-* 头，单元测试直接注入可信头。
 */

const mockGetDb = vi.fn()
const mockGetWritableDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetWritableDb(),
}))

import { GET as listGET, POST as listPOST } from "@/app/api/opportunity/route"
import {
  GET as detailGET,
  PATCH as detailPATCH,
  DELETE as detailDELETE,
} from "@/app/api/opportunity/[id]/route"

// ---------------------------------------------------------------- 工具

const BASE = "http://localhost:3000/api/opportunity"
/** 服务端写的时间戳格式：'YYYY-MM-DD HH:MM:SS' 本地时间（lib/i18n-shared.ts parseLocal 的语义） */
const SERVER_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const FAKE_TS = "1999-01-01 00:00:00"

const ERROR_CODES = new Set(Object.keys(zh.error))

function authed(
  path: string,
  init: { method?: string; body?: unknown; raw?: string; role?: string; email?: string } = {},
): Request {
  const headers: Record<string, string> = {
    "x-user-email": init.email ?? "test@example.com",
    "x-user-role": init.role ?? "admin",
  }
  const payload =
    init.raw !== undefined ? init.raw : init.body !== undefined ? JSON.stringify(init.body) : undefined
  if (payload !== undefined) headers["content-type"] = "application/json"
  return new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(payload !== undefined ? { body: payload } : {}),
  })
}

/** 无认证头 —— 应 401 */
function anon(path: string, method = "GET"): Request {
  return new Request(`${BASE}${path}`, { method })
}

/** Next 16 动态路由：params 是 Promise */
function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function useDb(rec: RecordingMockDb) {
  mockGetDb.mockReturnValue(rec.db)
  mockGetWritableDb.mockReturnValue(rec.db)
  return rec
}

/** 错误码断言：必须是字典 error.* 里存在的 slug，且不能是中文句子（返工单 E-2） */
function expectDictError(body: { error?: string }, code: string) {
  expect(body.error).toBe(code)
  expect(ERROR_CODES.has(code)).toBe(true)
  expect(/[\u4e00-\u9fff]/.test(body.error ?? "")).toBe(false)
}

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim()

/** 路由里 UPDATE 是多行模板串，片段匹配不能跨行写 "SET" */
const UPDATE_SNIPPET = "UPDATE opportunity"

// ---------------------------------------------------------------- 数据

/** 一阶字段：改这里就等于改列表页的列头（route.ts 的 LIST_COLUMNS） */
const LIST_FIELDS = ["o.opp_id", "o.title", "o.type", "o.stage", "o.owner", "o.updated_at"]
/** 二阶字段，绝不允许出现在列表响应里 */
const SECOND_ORDER_FIELDS = [
  "detail_json", "title_en", "deal_type", "company_id", "brand_id",
  "md_brand", "priority", "next_action", "next_action_due", "is_archived",
]

const LIST_ROWS = [
  { opp_id: 1, title: "收购德国 A 展", type: "ma", stage: "contact", owner: "max", updated_at: "2026-09-01 10:00:00" },
  { opp_id: 2, title: "印尼 B 展合作", type: "greenfield", stage: "intent", owner: "max", updated_at: "2026-09-02 10:00:00" },
]

const USER_OK = ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }] as const

function listDb(countSource: Record<string, unknown> | MatcherResolver = { total: 137 }): RecordingMockDb {
  return buildRecordingMockDb([
    [...USER_OK],
    ["SELECT COUNT(*) AS total FROM opportunity", "get", countSource],
    ["ORDER BY", "all", LIST_ROWS],
  ])
}

function postDb(opts: { run?: Record<string, unknown> | RunResolver } = {}): RecordingMockDb {
  const created = { opp_id: 42, title: "新机会", type: "ma", stage: "contact", owner: null as string | null, updated_at: "2026-09-17 12:00:00" }
  return buildRecordingMockDb([
    [...USER_OK],
    ["INSERT INTO opportunity", "run", opts.run ?? { changes: 1, lastInsertRowid: 42 }],
    ["SELECT * FROM opportunity WHERE opp_id", "get", created],
  ])
}

const DETAIL_OPP = {
  opp_id: 1,
  type: "ma",
  title: "收购德国 A 展",
  title_en: "Acquire Expo A",
  stage: "contact",
  deal_type: "收购",
  company_id: 7,
  brand_id: "B001",
  md_brand: "A 展",
  priority: 2,
  owner: "max",
  next_action: "发 NDA",
  next_action_due: "2026-09-30",
  detail_json: '{"score": 4}',
  is_archived: 0,
  created_by: "max@mwlab.com",
  created_at: "2026-08-01 09:00:00",
  updated_at: "2026-09-01 10:00:00",
}

function patchDb(before: { stage: string } | null = { stage: "contact" }): RecordingMockDb {
  return buildRecordingMockDb([
    [...USER_OK],
    ["SELECT stage FROM opportunity", "get", before ?? []],
    ["UPDATE opportunity", "run", { changes: 1 }],
    ["SELECT * FROM opportunity WHERE opp_id", "get", { ...DETAIL_OPP, stage: "intent" }],
    ["INSERT INTO opportunity_event", "run", { changes: 1 }],
  ])
}

function detailDb(opp: Record<string, unknown> | null = DETAIL_OPP): RecordingMockDb {
  return buildRecordingMockDb([
    [...USER_OK],
    ["SELECT * FROM opportunity WHERE opp_id", "get", opp ?? []],
    ["FROM company WHERE company_id", "get", { company_id: 7, name: "德方 A 公司" }],
    ["FROM exhibition_brand b", "get", { brand_id: "B001", name_cn: "A 展", city: "科隆" }],
    ["FROM resource", "all", [{ resource_id: 9, kind: "report", title: "尽调报告", file_path: "reports/a.pdf", mime: "application/pdf", size_bytes: 100, collected_at: "2026-09-01 00:00:00", source: "qcc" }]],
    ["FROM opportunity_event", "all", [{ event_id: 3, event_type: "stage_change", content: "未接触 → 接触", file_path: null, occurred_at: null, created_by: "max@mwlab.com", created_at: "2026-09-01 10:00:00" }]],
    ["FROM intel_report", "all", [{ id: 5, title: "A 展尽调", report_type: "dd", status: "draft", updated_at: "2026-09-02 00:00:00" }]],
  ])
}

function deleteDb(run: Record<string, unknown> | RunResolver = { changes: 1 }): RecordingMockDb {
  return buildRecordingMockDb([
    [...USER_OK],
    ["UPDATE opportunity SET is_archived = 1", "run", run],
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ================================================================ GET 列表

describe("GET /api/opportunity（一阶列表）", () => {
  it("无 x-user-* 头 → 401，且不碰库", async () => {
    const res = await listGET(anon(""))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe("unauthorized")
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  it("size=9999 → 静默截断为 200，不是报错", async () => {
    const db = useDb(listDb())
    const res = await listGET(authed("?size=9999"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.size).toBe(200)
    const itemsCall = db.log.all.find((c) => c.sql.includes("ORDER BY"))!
    expect(itemsCall.args).toEqual([200, 0]) // LIMIT 200 OFFSET 0
  })

  it("size 非法（size=abc）→ 回落默认 50", async () => {
    const db = useDb(listDb())
    const res = await listGET(authed("?size=abc&page=-5"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.size).toBe(50)
    expect(body.page).toBe(1)
    expect(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.args).toEqual([50, 0])
  })

  it("page=3&size=10 → OFFSET 20", async () => {
    const db = useDb(listDb())
    const body = await (await listGET(authed("?page=3&size=10"))).json()
    expect(body.page).toBe(3)
    expect(body.size).toBe(10)
    expect(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.args).toEqual([10, 20])
  })

  it("sort 传 1;DROP TABLE x → 不报错，回退默认排序且不拼串", async () => {
    const db = useDb(listDb())
    const res = await listGET(authed("?sort=" + encodeURIComponent("1;DROP TABLE x")))
    expect(res.status).toBe(200)
    const itemsSql = norm(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.sql)
    expect(itemsSql).toContain("ORDER BY o.updated_at DESC")
    expect(db.log.prepared.every((s) => !/DROP\s+TABLE/i.test(s))).toBe(true)
  })

  it("sort=title&order=asc（白名单内）→ 按映射列排序", async () => {
    const db = useDb(listDb())
    await listGET(authed("?sort=title&order=asc"))
    expect(norm(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.sql))
      .toContain("ORDER BY o.title ASC")
  })

  it("total 来自筛选后的 COUNT，不是 items.length、不是全表数", async () => {
    useDb(listDb({ total: 137 }))
    const body = await (await listGET(authed(""))).json()
    expect(body.total).toBe(137)
    expect(body.items.length).toBe(2) // 分页只回了一页
    expect(body.total).not.toBe(body.items.length)
  })

  it("带筛选时 total 变（走同一套 WHERE），且筛选值走占位符", async () => {
    const db = useDb(listDb((_sql, args) => ({ total: args.includes("dd") ? 4 : 137 })))
    const body = await (await listGET(authed("?stage=dd"))).json()
    expect(body.total).toBe(4)

    const countCall = db.log.get.find((c) => c.sql.includes("COUNT(*)"))!
    expect(norm(countCall.sql)).toBe(
      "SELECT COUNT(*) AS total FROM opportunity o WHERE o.is_archived = 0 AND o.stage = ?",
    )
    expect(countCall.args).toEqual(["dd"])
    // 值不进 SQL 文本
    expect(norm(countCall.sql)).not.toContain("dd")
    expect(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.args).toEqual(["dd", 50, 0])
  })

  it("q 搜索把通配符拼在值上、仍是占位符", async () => {
    const db = useDb(listDb())
    await listGET(authed("?q=" + encodeURIComponent("医疗")))
    const itemsCall = db.log.all.find((c) => c.sql.includes("ORDER BY"))!
    expect(norm(itemsCall.sql)).toContain("(o.title LIKE ? OR o.md_brand LIKE ?)")
    expect(itemsCall.args).toEqual(["%医疗%", "%医疗%", 50, 0])
  })

  it("一阶字段与路由声明完全一致：多一个字段就算失败", async () => {
    const db = useDb(listDb())
    const res = await listGET(authed(""))
    const body = await res.json()

    const itemsSql = norm(db.log.all.find((c) => c.sql.includes("ORDER BY"))!.sql)
    const cols = itemsSql.match(/SELECT (.+?) FROM opportunity/)![1].trim()
    expect(cols).toBe(LIST_FIELDS.join(", "))
    // 二阶字段一个都不许漏进列表
    for (const f of SECOND_ORDER_FIELDS) expect(cols).not.toContain(f)
    expect(JSON.stringify(body)).not.toContain("detail_json")

    // 响应体里也只有这 6 个键
    expect(Object.keys(body.items[0]).sort()).toEqual([
      "opp_id", "owner", "stage", "title", "type", "updated_at",
    ])
  })

  it("响应形状：items / page / size / total，JSON content-type", async () => {
    useDb(listDb())
    const res = await listGET(authed(""))
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(["items", "page", "size", "total"])
    expect(Array.isArray(body.items)).toBe(true)
  })
})

// ================================================================ POST

describe("POST /api/opportunity", () => {
  it("无 x-user-* 头 → 401，未写库", async () => {
    const db = useDb(postDb())
    const res = await listPOST(anon("", "POST"))
    expect(res.status).toBe(401)
    expect(db.log.run).toHaveLength(0)
  })

  it("role=readonly → 403，未写库", async () => {
    const db = useDb(postDb())
    const res = await listPOST(authed("", { method: "POST", role: "readonly", body: { title: "X", type: "ma" } }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("forbidden")
    expect(db.log.prepared.some((s) => s.includes("INSERT INTO"))).toBe(false)
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("type 非法 → 400 且 error 是字典里的码", async () => {
    const db = useDb(postDb())
    const res = await listPOST(authed("", { method: "POST", body: { title: "X", type: "bogus" } }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badBizLine")
    expect(db.log.run).toHaveLength(0)
  })

  it("priority=99 → 400 badPriority（不是 500）", async () => {
    const db = useDb(postDb())
    const res = await listPOST(authed("", { method: "POST", body: { title: "X", type: "ma", priority: 99 } }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badPriority")
    expect(db.log.run).toHaveLength(0)
  })

  it("stage 非法 → 400 badStage", async () => {
    const res = await listPOST(authed("", { method: "POST", body: { title: "X", type: "ma", stage: "bogus" } }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badStage")
  })

  it("deal_type 非法 → 400 badDealType", async () => {
    const res = await listPOST(authed("", { method: "POST", body: { title: "X", type: "ma", deal_type: "bogus" } }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badDealType")
  })

  it("title 缺失 / 全空格 / 非字符串 → 400 titleRequired", async () => {
    useDb(postDb())
    for (const title of [undefined, "   ", 123]) {
      const res = await listPOST(authed("", { method: "POST", body: { type: "ma", title } }))
      expect(res.status).toBe(400)
      expectDictError(await res.json(), "titleRequired")
    }
  })

  it("请求体不是合法 JSON → 400 badJson", async () => {
    useDb(postDb())
    const res = await listPOST(authed("", { method: "POST", raw: "{ oops" }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badJson")
  })

  it("白名单外的键被静默忽略（不报错、不进 SQL）", async () => {
    const db = useDb(postDb())
    const res = await listPOST(authed("", {
      method: "POST",
      body: {
        title: "新机会", type: "ma",
        is_archived: 1, opp_id: 999, created_by: "attacker@evil.com", owner_evil: "x",
      },
    }))
    expect(res.status).toBe(201)
    const insert = db.runsMatching("INSERT INTO opportunity")[0]
    const sql = norm(insert.sql)
    expect(sql).not.toContain("is_archived")
    expect(sql).not.toContain("opp_id")
    expect(sql).not.toContain("owner_evil")
    expect(insert.args).not.toContain(999)
    expect(insert.args).not.toContain("attacker@evil.com")
    // created_by 取会话身份，不取请求体
    expect(insert.args).toContain("test@example.com")
  })

  it("成功 → 201：写入白名单列 + created_by/created_at/updated_at 由服务端写", async () => {
    const db = useDb(postDb())
    const res = await listPOST(authed("", {
      method: "POST",
      body: { title: "新机会", type: "ma", company_id: 7, detail_json: { a: 1 } },
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("opportunity")
    expect(body.opportunity.opp_id).toBe(42)

    const insert = db.runsMatching("INSERT INTO opportunity")[0]
    expect(norm(insert.sql)).toBe(
      "INSERT INTO opportunity (type, title, company_id, detail_json, created_by, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    expect(insert.args[0]).toBe("ma")
    expect(insert.args[1]).toBe("新机会")
    expect(insert.args[2]).toBe(7)
    expect(insert.args[3]).toBe('{"a":1}') // detail_json 对象统一存字符串
    expect(insert.args[4]).toBe("test@example.com")
    expect(insert.args[5]).toMatch(SERVER_TS)
    expect(insert.args[6]).toMatch(SERVER_TS)
    expect(insert.args[5]).toBe(insert.args[6])
    // 写连接用完即关（否则泄漏 WAL 连接）
    expect(db.db.close).toHaveBeenCalled()
  })

  it("外键约束失败 → 400 badCompanyOrBrand（不是 500）", async () => {
    useDb(postDb({ run: () => { throw new Error("FOREIGN KEY constraint failed") } }))
    const res = await listPOST(authed("", { method: "POST", body: { title: "X", type: "ma", company_id: 99999 } }))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badCompanyOrBrand")
  })
})

// ================================================================ GET 详情

describe("GET /api/opportunity/[id]（二阶详情）", () => {
  it("无 x-user-* 头 → 401", async () => {
    useDb(detailDb())
    const res = await detailGET(anon("/1"), ctx("1"))
    expect(res.status).toBe(401)
  })

  it("六块齐全，顶层键恰好六个；id 从 Promise<params> 取出且走占位符", async () => {
    const db = useDb(detailDb())
    const res = await detailGET(authed("/1"), ctx("1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual([
      "brand", "company", "events", "opportunity", "reports", "resources",
    ])
    expect(body.opportunity.title).toBe("收购德国 A 展")
    expect(Array.isArray(body.resources)).toBe(true)
    expect(Array.isArray(body.events)).toBe(true)
    expect(Array.isArray(body.reports)).toBe(true)

    const oppCall = db.log.get.find((c) => c.sql.includes("SELECT * FROM opportunity"))!
    expect(oppCall.args).toEqual(["1"])
    expect(norm(oppCall.sql)).toContain("WHERE opp_id = ?")
  })

  it("detail_json 出口已 JSON.parse 成对象", async () => {
    useDb(detailDb())
    const body = await (await detailGET(authed("/1"), ctx("1"))).json()
    expect(body.opportunity.detail_json).toEqual({ score: 4 })
  })

  it("detail_json 是脏数据 → 降级为 {}，不 500", async () => {
    useDb(detailDb({ ...DETAIL_OPP, detail_json: "{ oops" }))
    const res = await detailGET(authed("/1"), ctx("1"))
    expect(res.status).toBe(200)
    expect((await res.json()).opportunity.detail_json).toEqual({})
  })

  it("机会不存在 → 404 not found", async () => {
    useDb(detailDb(null))
    const res = await detailGET(authed("/999"), ctx("999"))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })

  it("company_id 为 null → company 为 null，且不去查 company 表", async () => {
    const db = useDb(detailDb({ ...DETAIL_OPP, company_id: null }))
    const body = await (await detailGET(authed("/1"), ctx("1"))).json()
    expect(body.company).toBeNull()
    expect(db.log.prepared.some((s) => s.includes("FROM company WHERE company_id"))).toBe(false)
    // 公司级资源仍要查（company_id 缺失时用 -1，不能退化成查全部）
    const resCall = db.log.all.find((c) => c.sql.includes("FROM resource"))!
    expect(resCall.args).toEqual(["1", -1])
  })

  it("关联资源/事件/报告按机会（及所属公司）过滤，参数带 id", async () => {
    const db = useDb(detailDb())
    const body = await (await detailGET(authed("/1"), ctx("1"))).json()
    expect(body.resources[0].resource_id).toBe(9)
    expect(body.reports[0].id).toBe(5)

    const ev = db.log.all.find((c) => c.sql.includes("FROM opportunity_event"))!
    expect(ev.args).toEqual(["1"])
    // 时间线排序键 = 页面显示的键（occurred_at 回退 created_at），NULLIF 挡空串
    expect(norm(ev.sql)).toContain("ORDER BY COALESCE(NULLIF(occurred_at, ''), created_at) DESC")
  })
})

// ================================================================ PATCH

describe("PATCH /api/opportunity/[id]", () => {
  it("无 x-user-* 头 → 401", async () => {
    useDb(patchDb())
    const res = await detailPATCH(anon("/1", "PATCH"), ctx("1"))
    expect(res.status).toBe(401)
  })

  it("role=readonly → 403，未写库", async () => {
    const db = useDb(patchDb())
    const res = await detailPATCH(
      authed("/1", { method: "PATCH", role: "readonly", body: { title: "X" } }),
      ctx("1"),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("forbidden")
    expect(db.log.prepared.some((s) => s.includes(UPDATE_SNIPPET))).toBe(false)
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("只更新请求体里出现的字段：未传的列不进 SET（整行覆盖的防线）", async () => {
    const db = useDb(patchDb())
    const res = await detailPATCH(authed("/1", { method: "PATCH", body: { title: "改名" } }), ctx("1"))
    expect(res.status).toBe(200)

    const update = db.runsMatching(UPDATE_SNIPPET)[0]
    expect(norm(update.sql)).toBe("UPDATE opportunity SET title = ?, updated_at = ? WHERE opp_id = ?")
    for (const col of ["owner", "stage", "priority", "detail_json", "is_archived", "next_action"]) {
      expect(norm(update.sql)).not.toContain(`${col} = ?`)
    }
    expect(update.args).toEqual(["改名", expect.stringMatching(SERVER_TS), "1"])
    // 未改阶段 → 不写 stage_change
    expect(db.runsMatching("opportunity_event")).toHaveLength(0)
    expect((await res.json()).opportunity).toEqual({ ...DETAIL_OPP, stage: "intent" })
  })

  it("priority 单独改：只带 priority，白名单外的键静默忽略", async () => {
    const db = useDb(patchDb())
    const res = await detailPATCH(
      authed("/1", { method: "PATCH", body: { priority: 3, is_archived: 1, opp_id: 999 } }),
      ctx("1"),
    )
    expect(res.status).toBe(200)
    const update = db.runsMatching(UPDATE_SNIPPET)[0]
    expect(norm(update.sql)).toBe("UPDATE opportunity SET priority = ?, updated_at = ? WHERE opp_id = ?")
    expect(update.args).toEqual([3, expect.stringMatching(SERVER_TS), "1"])
  })

  it("更新后回读整条记录", async () => {
    const db = useDb(patchDb())
    await detailPATCH(authed("/1", { method: "PATCH", body: { title: "改名" } }), ctx("1"))
    const reread = db.log.get.filter((c) => norm(c.sql).startsWith("SELECT * FROM opportunity"))
    expect(reread).toHaveLength(1)
    expect(reread[0].args).toEqual(["1"])
  })

  it("§2.3 阶段变更写一条 opportunity_event：event_type='stage_change'、content='A → B'", async () => {
    const db = useDb(patchDb({ stage: "contact" }))
    const res = await detailPATCH(authed("/1", { method: "PATCH", body: { stage: "intent" } }), ctx("1"))
    expect(res.status).toBe(200)

    const update = db.runsMatching(UPDATE_SNIPPET)[0]
    expect(norm(update.sql)).toBe("UPDATE opportunity SET stage = ?, updated_at = ? WHERE opp_id = ?")
    expect(update.args[0]).toBe("intent")

    // 这条事件是日后算驻留天数与转化率的唯一数据源，丢了不会报错
    const events = db.runsMatching("INSERT INTO opportunity_event")
    expect(events).toHaveLength(1)
    const evSql = norm(events[0].sql)
    expect(evSql).toContain("opportunity_event")
    expect(evSql).toContain("'stage_change'")
    expect(evSql).toContain("(opp_id, event_type, content, created_by, created_at)")
    expect(events[0].args).toEqual([
      "1", "contact → intent", "test@example.com", expect.stringMatching(SERVER_TS),
    ])
    // 事件时间与 UPDATE 的 updated_at 同一次取时，不各写各的
    expect(events[0].args[3]).toBe(update.args[1])
  })

  it("stage 传了但与现值相同 → 不写重复事件", async () => {
    const db = useDb(patchDb({ stage: "contact" }))
    const res = await detailPATCH(authed("/1", { method: "PATCH", body: { stage: "contact" } }), ctx("1"))
    expect(res.status).toBe(200)
    expect(db.runsMatching(UPDATE_SNIPPET)).toHaveLength(1)
    expect(db.runsMatching("opportunity_event")).toHaveLength(0)
  })

  it("updated_at 由服务端写：客户端传假时间与 created_at/opp_id 一律被忽略", async () => {
    const db = useDb(patchDb())
    const res = await detailPATCH(
      authed("/1", {
        method: "PATCH",
        body: { title: "改名", updated_at: FAKE_TS, created_at: FAKE_TS, opp_id: 999 },
      }),
      ctx("1"),
    )
    expect(res.status).toBe(200)
    const update = db.runsMatching(UPDATE_SNIPPET)[0]
    const sql = norm(update.sql)
    expect(sql.match(/updated_at = \?/g)).toHaveLength(1)
    expect(sql).not.toContain("created_at")
    expect(update.args).not.toContain(FAKE_TS)
    expect(update.args).not.toContain(999)
    expect(update.args[1]).toMatch(SERVER_TS)
    expect(update.args[1]).not.toBe(FAKE_TS)
  })

  it("空 body / 只含白名单外的键 → 400 noFields，未写库", async () => {
    const db = useDb(patchDb())
    for (const body of [{}, { is_archived: 1, nonsense: "x" }]) {
      const res = await detailPATCH(authed("/1", { method: "PATCH", body }), ctx("1"))
      expect(res.status).toBe(400)
      expectDictError(await res.json(), "noFields")
    }
    expect(db.log.run).toHaveLength(0)
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  // NOT NULL 列显式传 null / 空标题：原先会撞约束变成 500，或存出没有名字的机会（2026-09-17 代码质检）
  it.each([
    [{ title: null }, "titleRequired"],
    [{ title: "   " }, "titleRequired"],
    [{ stage: null }, "badStage"],
    [{ detail_json: null }, "invalidValue"],
  ])("PATCH %j → 400 %s，未写库", async (body, code) => {
    const db = useDb(patchDb())
    const res = await detailPATCH(authed("/1", { method: "PATCH", body }), ctx("1"))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), code)
    expect(db.log.run).toHaveLength(0)
  })

  it("stage 非法 → 400 badStage，未执行 UPDATE", async () => {
    const db = useDb(patchDb())
    const res = await detailPATCH(authed("/1", { method: "PATCH", body: { stage: "bogus" } }), ctx("1"))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badStage")
    expect(db.log.prepared.some((s) => s.includes(UPDATE_SNIPPET))).toBe(false)
  })

  it("priority=99 → 400 badPriority", async () => {
    useDb(patchDb())
    const res = await detailPATCH(authed("/1", { method: "PATCH", body: { priority: 99 } }), ctx("1"))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badPriority")
  })

  it("请求体不是合法 JSON → 400 badJson", async () => {
    useDb(patchDb())
    const res = await detailPATCH(authed("/1", { method: "PATCH", raw: "{ oops" }), ctx("1"))
    expect(res.status).toBe(400)
    expectDictError(await res.json(), "badJson")
  })

  it("目标不存在 → 404，且不写 UPDATE / 不写事件", async () => {
    const db = useDb(patchDb(null))
    const res = await detailPATCH(authed("/999", { method: "PATCH", body: { stage: "intent" } }), ctx("999"))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
    expect(db.runsMatching(UPDATE_SNIPPET)).toHaveLength(0)
    expect(db.runsMatching("opportunity_event")).toHaveLength(0)
  })
})

// ================================================================ DELETE

describe("DELETE /api/opportunity/[id]", () => {
  it("无 x-user-* 头 → 401", async () => {
    useDb(deleteDb())
    const res = await detailDELETE(anon("/1", "DELETE"), ctx("1"))
    expect(res.status).toBe(401)
  })

  it("role=readonly → 403，未写库", async () => {
    const db = useDb(deleteDb())
    const res = await detailDELETE(authed("/1", { method: "DELETE", role: "readonly" }), ctx("1"))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("forbidden")
    expect(db.log.run).toHaveLength(0)
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("软删除：只置 is_archived=1，绝不物理删除（时间线要留着）", async () => {
    const db = useDb(deleteDb({ changes: 1 }))
    const res = await detailDELETE(authed("/1", { method: "DELETE" }), ctx("1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, archived: 1 })

    const call = db.runsMatching("is_archived = 1")[0]
    expect(norm(call.sql)).toBe(
      "UPDATE opportunity SET is_archived = 1, updated_at = ? WHERE opp_id = ? AND is_archived = 0",
    )
    expect(call.args).toEqual([expect.stringMatching(SERVER_TS), "1"])
    expect(db.log.prepared.every((s) => !/DELETE\s+FROM/i.test(s))).toBe(true)
    expect(db.db.close).toHaveBeenCalled()
  })

  it("已不存在或已归档（changes=0）→ 404 not found", async () => {
    useDb(deleteDb({ changes: 0 }))
    const res = await detailDELETE(authed("/999", { method: "DELETE" }), ctx("999"))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })
})
