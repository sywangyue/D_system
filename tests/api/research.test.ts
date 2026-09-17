import { describe, it, expect, vi, beforeEach } from "vitest"
import zh from "@/locales/zh.json"
import { buildMockDb, type FakeDb } from "./_db-mock"

/**
 * /api/research（intel_report 列表 + 建档）与 /api/research/[id]（详情 + PATCH）
 *
 * 本文件的重头戏是二阶式原则：一阶列表**只有 6 个字段 + 160 字摘要**，
 * `report_md`（可能几万字）与 `params_json`（整包输入参数）**绝不能**出现在
 * 列表响应里。所以这里既断言响应键集合，也断言路由真正下发的 SELECT 列清单 ——
 * 后者才能在「mock 恰好没喂那两个字段」时依然守住底线。
 *
 * 全部 mock @/lib/db（读 getDb / 写 getWritableDb），绝不碰 data/mwlab.db。
 */

const mockGetDb = vi.fn()
const mockGetWritableDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetWritableDb(),
}))

import { GET as listReports, POST as createReport } from "@/app/api/research/route"
import { GET as getReport, PATCH as patchReport } from "@/app/api/research/[id]/route"

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const AUTH = { "x-user-email": "test@mwlab.internal", "x-user-role": "admin" }
const READONLY = { "x-user-email": "test@mwlab.internal", "x-user-role": "readonly" }
const BASE = "http://localhost:3000/api/research"

function authed(url: string, headers: Record<string, string> = AUTH): Request {
  return new Request(url, { headers })
}

function write(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = AUTH,
): Request {
  return new Request(url, {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const ID_CTX = { params: Promise.resolve({ id: "7" }) }

/** 路由声明的一阶列清单（顺序即 SELECT 顺序）。 */
const LIST_SELECT = [
  "r.id",
  "r.title",
  "r.report_type",
  "r.status",
  "r.company_id",
  "r.updated_at",
  "SUBSTR(r.report_md, 1, 160) AS excerpt",
  "COALESCE(c.name, r.target_company) AS company_name",
]
const LIST_KEYS = [
  "id",
  "title",
  "report_type",
  "status",
  "company_id",
  "updated_at",
  "excerpt",
  "company_name",
]

const SAMPLE_ROW = {
  id: 7,
  title: "某会展公司尽调",
  report_type: "company_research",
  status: "draft",
  company_id: 1,
  updated_at: "2026-05-01 10:00:00",
  excerpt: "该公司成立于……",
  company_name: "某某会展有限公司",
}

function sqlFor(db: FakeDb, snippet: string): string {
  const call = db.prepare.mock.calls.find((c) => c[0].includes(snippet))
  if (!call) throw new Error(`no prepare() call containing "${snippet}"`)
  return call[0]
}

function stmtFor(db: FakeDb, snippet: string) {
  const i = db.prepare.mock.calls.findIndex((c) => c[0].includes(snippet))
  if (i < 0) throw new Error(`no prepare() call containing "${snippet}"`)
  return db.prepare.mock.results[i].value
}

function selectList(sql: string): string[] {
  const bare = sql.replace(/--[^\n]*/g, "")
  const m = bare.match(/SELECT([\s\S]*?)FROM/)
  if (!m) throw new Error(`no SELECT..FROM found in: ${sql}`)
  return splitTopLevel(m[1])
}

/** 按顶层逗号切分：括号内的逗号（SUBSTR(a, 1, 160)）不算分隔符。 */
function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    else if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ""
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function insertColumns(sql: string): string[] {
  const m = sql.replace(/--[^\n]*/g, "").match(/INSERT INTO \w+\s*\(([^)]*)\)/)
  if (!m) throw new Error(`no INSERT column list found in: ${sql}`)
  return splitTopLevel(m[1])
}

const ERROR_CODES = Object.keys(zh.error)

function expectKnownErrorCode(code: unknown) {
  expect(typeof code).toBe("string")
  expect(ERROR_CODES).toContain(code as string)
}

const ITEMS_SNIPPET = "AS company_name"
const COUNT_SNIPPET = "COUNT(*) AS total FROM intel_report r"

function listDb(opts: { total?: number; items?: Record<string, unknown>[] } = {}): FakeDb {
  return buildMockDb([
    ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
    [COUNT_SNIPPET, "get", { total: opts.total ?? 11 }],
    [ITEMS_SNIPPET, "all", opts.items ?? [SAMPLE_ROW]],
  ])
}

function authOnlyDb(): FakeDb {
  return buildMockDb([["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }]])
}

function withThrowingRun(db: FakeDb, snippet: string, message: string): FakeDb {
  const impl = db.prepare.getMockImplementation()!
  db.prepare.mockImplementation((sql: string) => {
    const stmt = impl(sql)
    if (sql.includes(snippet)) {
      stmt.run = vi.fn(() => {
        throw new Error(message)
      })
    }
    return stmt
  })
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDb.mockReturnValue(listDb())
  mockGetWritableDb.mockReturnValue(authOnlyDb())
})

// ---------------------------------------------------------------------------
// GET /api/research
// ---------------------------------------------------------------------------

describe("GET /api/research — 一阶列表", () => {
  it("未带可信头 → 401，且不查库", async () => {
    const res = await listReports(new Request(BASE))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "unauthorized" })
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  it("响应顶层键恰好是 items/page/size/total，默认 page=1 size=50", async () => {
    const res = await listReports(authed(BASE))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(["items", "page", "size", "total"])
    expect(body.page).toBe(1)
    expect(body.size).toBe(50)
  })

  it("size=9999 静默截断为 200，并据此算 offset（page=2 → 200）", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listReports(authed(`${BASE}?page=2&size=9999`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.size).toBe(200)
    expect(body.page).toBe(2)
    expect(stmtFor(db, ITEMS_SNIPPET).all.mock.calls[0].slice(-2)).toEqual([200, 200])
  })

  it("sort 传注入串不报错：回退 r.updated_at，且串不进 SQL", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listReports(authed(`${BASE}?sort=${encodeURIComponent("1;DROP TABLE x")}`))
    expect(res.status).toBe(200)

    const sql = sqlFor(db, ITEMS_SNIPPET)
    expect(sql).toContain("ORDER BY r.updated_at DESC")
    expect(sql).not.toContain("DROP TABLE")
    expect(sql).not.toContain("1;")
  })

  it("sort 白名单命中 + order=asc 才改方向", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    await listReports(authed(`${BASE}?sort=report_type&order=asc`))
    expect(sqlFor(db, ITEMS_SNIPPET)).toContain("ORDER BY r.report_type ASC")
  })

  it("total 是筛选后的数：WHERE 与占位符同时进 COUNT 查询", async () => {
    const unfiltered = listDb({ total: 11 })
    mockGetDb.mockReturnValue(unfiltered)
    const bare = await (await listReports(authed(BASE))).json()
    expect(bare.total).toBe(11)
    expect(sqlFor(unfiltered, COUNT_SNIPPET)).not.toContain("WHERE")

    const filtered = listDb({ total: 3 })
    mockGetDb.mockReturnValue(filtered)
    const res = await listReports(
      authed(`${BASE}?report_type=company_research&q=${encodeURIComponent("储能")}`),
    )
    const body = await res.json()

    expect(body.total).toBe(3)
    expect(body.total).not.toBe(bare.total)

    const countSql = sqlFor(filtered, COUNT_SNIPPET)
    expect(countSql).toContain("WHERE r.report_type = ?")
    expect(countSql).toContain("(r.title LIKE ? OR r.target_company LIKE ?)")
    expect(countSql).not.toContain("company_research") // 值走占位符
    expect(countSql).not.toContain("储能")
    expect(stmtFor(filtered, COUNT_SNIPPET).get).toHaveBeenCalledWith(
      "company_research",
      "%储能%",
      "%储能%",
    )
    expect(stmtFor(filtered, ITEMS_SNIPPET).all).toHaveBeenCalledWith(
      "company_research",
      "%储能%",
      "%储能%",
      50,
      0,
    )
  })

  it("⚠️ 列表一阶字段与声明完全一致，且绝无 report_md / params_json", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listReports(authed(BASE))
    const body = await res.json()

    const sql = sqlFor(db, ITEMS_SNIPPET)
    expect(sql).not.toMatch(/SELECT\s+\*/)
    // 列清单一个不多一个不少 —— 多一个字段（尤其 report_md/params_json）即失败
    expect(selectList(sql)).toEqual(LIST_SELECT)
    expect(selectList(sql)).not.toContain("r.report_md")
    expect(selectList(sql)).not.toContain("r.params_json")
    expect(sql).not.toContain("params_json")

    const keys = Object.keys(body.items[0])
    expect(keys.sort()).toEqual([...LIST_KEYS].sort())
    expect(keys).not.toContain("report_md")
    expect(keys).not.toContain("params_json")
    expect(keys).not.toContain("report_file")
    expect(body.items[0].excerpt).toBeDefined()
  })

  it("report_md 只允许以 SUBSTR 片段形式出现一次（整列外泄即失败）", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    await listReports(authed(BASE))
    const sql = sqlFor(db, ITEMS_SNIPPET)
    const hits = sql.match(/report_md/g) ?? []
    expect(hits).toHaveLength(1)
    expect(sql).toContain("SUBSTR(r.report_md, 1, 160) AS excerpt")
  })
})

// ---------------------------------------------------------------------------
// POST /api/research
// ---------------------------------------------------------------------------

describe("POST /api/research — 建档", () => {
  it("未带头 → 401；readonly → 403 且不碰可写库", async () => {
    const anon = await createReport(
      write(BASE, "POST", { title: "T", report_type: "company_research" }, {}),
    )
    expect(anon.status).toBe(401)

    const ro = await createReport(
      write(BASE, "POST", { title: "T", report_type: "company_research" }, READONLY),
    )
    expect(ro.status).toBe(403)
    expect(await ro.json()).toEqual({ error: "forbidden" })
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("非法 JSON → 400 badJson（字典码）", async () => {
    const res = await createReport(write(BASE, "POST", "}{"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badJson")
    expectKnownErrorCode(body.error)
  })

  it("title 缺失/空白 → 400 reportTitleRequired（字典码）", async () => {
    for (const payload of [
      { report_type: "company_research" },
      { title: "  ", report_type: "company_research" },
    ]) {
      const res = await createReport(write(BASE, "POST", payload))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("reportTitleRequired")
      expectKnownErrorCode(body.error)
    }
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("report_type 枚举非法 → 400 badReportType，values 列全枚举", async () => {
    const res = await createReport(
      write(BASE, "POST", { title: "T", report_type: "bogus" }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badReportType")
    expectKnownErrorCode(body.error)
    expect(body.values).toBe(
      "industry_research / brand_research / batch_prospect / single_prospect / company_research",
    )
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("status 枚举非法 → 400 badReportStatus（字典码）", async () => {
    const res = await createReport(
      write(BASE, "POST", { title: "T", report_type: "company_research", status: "done" }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badReportStatus")
    expectKnownErrorCode(body.error)
    expect(body.values).toBe("draft / published / archived")
  })

  it("白名单外的键被静默忽略，created_by 取会话用户而非请求体，时间戳服务端盖章", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const res = await createReport(
      write(BASE, "POST", {
        title: "某公司尽调",
        report_type: "company_research",
        id: 999,
        created_by: "evil@example.com",
        created_at: "1999-01-01 00:00:00",
        updated_at: "1999-01-01 00:00:00",
      }),
    )
    expect(res.status).toBe(201)

    const sql = sqlFor(db, "INSERT INTO intel_report")
    expect(insertColumns(sql)).toEqual([
      "title",
      "report_type",
      "created_by",
      "created_at",
      "updated_at",
    ])
    expect(sql).not.toContain("999")

    const args = stmtFor(db, "INSERT INTO intel_report").run.mock.calls[0]
    expect(args.slice(0, 2)).toEqual(["某公司尽调", "company_research"])
    expect(args[2]).toBe("test@mwlab.internal") // created_by = 会话用户
    expect(args).not.toContain("evil@example.com")
    expect(args).not.toContain("1999-01-01 00:00:00")
    const serverNow = args[3] as string
    expect(serverNow).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(args[4]).toBe(serverNow)
  })

  it("params_json 传对象时序列化成字符串再入库", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const res = await createReport(
      write(BASE, "POST", {
        title: "批量尽调",
        report_type: "batch_prospect",
        params_json: { industry_l1: "工业", year: 2026 },
      }),
    )
    expect(res.status).toBe(201)

    const args = stmtFor(db, "INSERT INTO intel_report").run.mock.calls[0]
    expect(args[2]).toBe('{"industry_l1":"工业","year":2026}')
    expect(args[3]).toBe("test@mwlab.internal")
  })

  it("外键不存在（company_id/brand_id/opp_id）→ 400 badCompanyBrandOrOpp", async () => {
    const db = withThrowingRun(
      authOnlyDb(),
      "INSERT INTO intel_report",
      "SqliteError: FOREIGN KEY constraint failed",
    )
    mockGetWritableDb.mockReturnValue(db)

    const res = await createReport(
      write(BASE, "POST", { title: "T", report_type: "company_research", company_id: 424242 }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badCompanyBrandOrOpp")
    expectKnownErrorCode(body.error)
  })

  it("成功 → 201 且回 { report }，并关闭可写连接", async () => {
    const db = buildMockDb([
      ["INSERT INTO intel_report", "run", []],
      ["SELECT * FROM intel_report WHERE id", "get", { id: 7, title: "T", status: "draft" }],
    ])
    mockGetWritableDb.mockReturnValue(db)

    const res = await createReport(
      write(BASE, "POST", { title: "T", report_type: "company_research" }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["report"])
    expect(body.report).toMatchObject({ id: 7, status: "draft" })
    expect(db.close).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// GET / PATCH /api/research/[id]
// ---------------------------------------------------------------------------

describe("GET /api/research/[id]", () => {
  it("未带头 → 401", async () => {
    const res = await getReport(new Request(`${BASE}/7`), ID_CTX)
    expect(res.status).toBe(401)
  })

  it("详情才给全文：返回 report / company / resources 三块", async () => {
    const db = buildMockDb([
      ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
      [
        "SELECT * FROM intel_report WHERE id",
        "get",
        { id: 7, title: "T", company_id: 1, report_md: "# 全文", params_json: "{}" },
      ],
      ["SELECT * FROM company WHERE company_id", "get", { company_id: 1, name: "甲" }],
      ["FROM resource", "all", [{ resource_id: 3, title: "原始财报.pdf" }]],
    ])
    mockGetDb.mockReturnValue(db)

    const res = await getReport(authed(`${BASE}/7`), ID_CTX)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(["company", "report", "resources"])
    expect(body.report.report_md).toBe("# 全文")
    expect(body.report.params_json).toBe("{}")
  })

  it("未找到 → 404", async () => {
    mockGetDb.mockReturnValue(authOnlyDb())
    const res = await getReport(authed(`${BASE}/999`), {
      params: Promise.resolve({ id: "999" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })
})

describe("PATCH /api/research/[id]", () => {
  it("未带头 → 401；readonly → 403 且不发 UPDATE", async () => {
    const anon = await patchReport(write(`${BASE}/7`, "PATCH", { status: "published" }, {}), ID_CTX)
    expect(anon.status).toBe(401)

    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)
    const ro = await patchReport(
      write(`${BASE}/7`, "PATCH", { status: "published" }, READONLY),
      ID_CTX,
    )
    expect(ro.status).toBe(403)
    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("id 不存在 → 404", async () => {
    mockGetWritableDb.mockReturnValue(authOnlyDb())
    const res = await patchReport(write(`${BASE}/999`, "PATCH", { status: "published" }), {
      params: Promise.resolve({ id: "999" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })

  it("只更新请求体里出现的字段，未传的字段保持原值", async () => {
    const db = buildMockDb([
      ["SELECT id FROM intel_report", "get", { id: 7 }],
      [
        "SELECT * FROM intel_report WHERE id",
        "get",
        { id: 7, title: "原标题", status: "published", report_type: "company_research" },
      ],
    ])
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchReport(write(`${BASE}/7`, "PATCH", { status: "published" }), ID_CTX)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.title).toBe("原标题") // 未传 → 不动
    expect(body.report.report_type).toBe("company_research")

    const updateSql = sqlFor(db, "UPDATE intel_report")
    const setClause = updateSql.match(/SET([\s\S]*?)WHERE/)![1]
    expect(setClause).toContain("status = ?")
    expect(setClause).toContain("updated_at = ?")
    expect(setClause).not.toContain("title = ?")
    expect(setClause).not.toContain("report_md = ?")

    const args = stmtFor(db, "UPDATE intel_report").run.mock.calls[0]
    expect(args[0]).toBe("published")
    expect(args).not.toContain("原标题")
    expect(args[args.length - 1]).toBe("7")
  })

  it("PATCH 也能落 report_md / params_json，且 params_json 对象被序列化", async () => {
    const db = buildMockDb([
      ["SELECT id FROM intel_report", "get", { id: 7 }],
      ["SELECT * FROM intel_report WHERE id", "get", { id: 7, report_md: "# 新全文" }],
    ])
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchReport(
      write(`${BASE}/7`, "PATCH", { report_md: "# 新全文", params_json: { year: 2026 } }),
      ID_CTX,
    )
    expect(res.status).toBe(200)

    const updateSql = sqlFor(db, "UPDATE intel_report")
    const setClause = updateSql.match(/SET([\s\S]*?)WHERE/)![1]
    expect(setClause).toContain("report_md = ?")
    expect(setClause).toContain("params_json = ?")

    const args = stmtFor(db, "UPDATE intel_report").run.mock.calls[0]
    expect(args[0]).toBe("# 新全文")
    expect(args[1]).toBe('{"year":2026}')
  })

  it("只传白名单外的键 → 400 noFields，不发 UPDATE", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchReport(write(`${BASE}/7`, "PATCH", { id: 8, hacked: true }), ID_CTX)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("noFields")
    expectKnownErrorCode(body.error)
    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("report_type / status 枚举非法 → 400 且是字典码，不发 UPDATE", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const type = await patchReport(write(`${BASE}/7`, "PATCH", { report_type: "bogus" }), ID_CTX)
    expect(type.status).toBe(400)
    const tb = await type.json()
    expect(tb.error).toBe("badReportType")
    expectKnownErrorCode(tb.error)

    const status = await patchReport(write(`${BASE}/7`, "PATCH", { status: "bogus" }), ID_CTX)
    expect(status.status).toBe(400)
    const sb = await status.json()
    expect(sb.error).toBe("badReportStatus")
    expectKnownErrorCode(sb.error)

    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("report_type 合法枚举全部放行（5 类都在白名单内）", async () => {
    for (const t of [
      "industry_research",
      "brand_research",
      "batch_prospect",
      "single_prospect",
      "company_research",
    ]) {
      const db = buildMockDb([
        ["SELECT id FROM intel_report", "get", { id: 7 }],
        ["SELECT * FROM intel_report WHERE id", "get", { id: 7 }],
      ])
      mockGetWritableDb.mockReturnValue(db)
      const res = await patchReport(write(`${BASE}/7`, "PATCH", { report_type: t }), ID_CTX)
      expect(res.status).toBe(200)
    }
  })
})
