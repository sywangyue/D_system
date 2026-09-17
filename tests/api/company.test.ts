import { describe, it, expect, vi, beforeEach } from "vitest"
import zh from "@/locales/zh.json"
import { buildMockDb, type FakeDb } from "./_db-mock"

/**
 * /api/company（列表 + 建档）与 /api/company/[id]（详情 + PATCH）
 *
 * 全部走 mock，绝不碰 data/mwlab.db：
 *   - 读端点用 getDb()，写端点用 getWritableDb()，两个都要 mock。
 *   - 断言的是「路由自己产出的东西」：SQL 列清单、WHERE 占位符、SET 子句、
 *     响应键集合、错误码。不是把自己喂进去的 mock 行再读回来。
 */

const mockGetDb = vi.fn()
const mockGetWritableDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetWritableDb(),
}))

import { GET as listCompanies, POST as createCompany } from "@/app/api/company/route"
import { GET as getCompany, PATCH as patchCompany } from "@/app/api/company/[id]/route"

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const AUTH = { "x-user-email": "test@mwlab.internal", "x-user-role": "admin" }
const READONLY = { "x-user-email": "test@mwlab.internal", "x-user-role": "readonly" }
const BASE = "http://localhost:3000/api/company"

/** 带可信认证头（middleware 已在集成层剥离外部头）。 */
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

const ID_CTX = { params: Promise.resolve({ id: "1" }) }

/** 路由声明的一阶字段（顺序即 SELECT 顺序）。 */
const LIST_SELECT = [
  "c.company_id",
  "c.name",
  "c.type",
  "c.company_status",
  "c.oper_name",
  "c.updated_at",
]
const LIST_KEYS = ["company_id", "name", "type", "company_status", "oper_name", "updated_at"]

const SAMPLE_ROW = {
  company_id: 1,
  name: "某某会展有限公司",
  type: "exhibitor",
  company_status: "存续",
  oper_name: "张三",
  updated_at: "2026-05-01 10:00:00",
}

/** 取出 prepare() 收到的 SQL 原文；找不到就抛错（避免断言悄悄落空）。 */
function sqlFor(db: FakeDb, snippet: string): string {
  const call = db.prepare.mock.calls.find((c) => c[0].includes(snippet))
  if (!call) throw new Error(`no prepare() call containing "${snippet}"`)
  return call[0]
}

/** 取出对应的 statement mock，用来断言 get/all/run 的实参。 */
function stmtFor(db: FakeDb, snippet: string) {
  const i = db.prepare.mock.calls.findIndex((c) => c[0].includes(snippet))
  if (i < 0) throw new Error(`no prepare() call containing "${snippet}"`)
  return db.prepare.mock.results[i].value
}

/** 从 SELECT 语句里解析出列清单（去掉 -- 注释）。 */
function selectList(sql: string): string[] {
  const bare = sql.replace(/--[^\n]*/g, "")
  const m = bare.match(/SELECT([\s\S]*?)FROM/)
  if (!m) throw new Error(`no SELECT..FROM found in: ${sql}`)
  return splitTopLevel(m[1])
}

/** 按顶层逗号切分：括号内的逗号（如 COUNT(*)、SUBSTR(a, 1, 160)）不算分隔符。 */
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

const ERROR_CODES = Object.keys(zh.error)

/** 从 INSERT 语句里解析出列清单。 */
function insertColumns(sql: string): string[] {
  const m = sql.replace(/--[^\n]*/g, "").match(/INSERT INTO \w+\s*\(([^)]*)\)/)
  if (!m) throw new Error(`no INSERT column list found in: ${sql}`)
  return splitTopLevel(m[1])
}

function expectKnownErrorCode(code: unknown) {
  expect(typeof code).toBe("string")
  expect(ERROR_CODES).toContain(code as string)
}

function listDb(opts: { total?: number; items?: Record<string, unknown>[] } = {}): FakeDb {
  return buildMockDb([
    ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
    ["COUNT(*) AS total FROM company c", "get", { total: opts.total ?? 501 }],
    ["c.oper_name", "all", opts.items ?? [SAMPLE_ROW]],
  ])
}

function authOnlyDb(): FakeDb {
  return buildMockDb([["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }]])
}

/** 让某个 SQL 片段上的 run() 抛错，用来驱动路由的 catch 分支。 */
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
// GET /api/company
// ---------------------------------------------------------------------------

describe("GET /api/company — 一阶列表", () => {
  it("未带可信头 → 401，且不查库", async () => {
    const res = await listCompanies(new Request(BASE))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "unauthorized" })
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  it("响应顶层键恰好是 items/page/size/total", async () => {
    const res = await listCompanies(authed(BASE))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(["items", "page", "size", "total"])
    expect(body.page).toBe(1)
    expect(body.size).toBe(50)
  })

  it("size=9999 被静默截断为 200，并据此算 offset（page=3 → 400）", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listCompanies(authed(`${BASE}?page=3&size=9999`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.size).toBe(200)
    expect(body.page).toBe(3)

    const allArgs = stmtFor(db, "c.oper_name").all.mock.calls[0]
    expect(allArgs.slice(-2)).toEqual([200, 400])
  })

  it("sort 传非白名单值（SQL 注入串）不报错，回退默认排序且不拼进 SQL", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listCompanies(
      authed(`${BASE}?sort=${encodeURIComponent("1;DROP TABLE x")}`),
    )
    expect(res.status).toBe(200)

    const sql = sqlFor(db, "c.oper_name")
    expect(sql).toContain("ORDER BY c.updated_at DESC")
    expect(sql).not.toContain("DROP TABLE")
    expect(sql).not.toContain("1;")
  })

  it("sort 白名单命中 + order=asc 才改排序方向", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    await listCompanies(authed(`${BASE}?sort=name&order=asc`))
    expect(sqlFor(db, "c.oper_name")).toContain("ORDER BY c.name ASC")
  })

  it("total 是筛选后的数：WHERE 与占位符必须同时进 COUNT 查询", async () => {
    const unfiltered = listDb({ total: 501 })
    mockGetDb.mockReturnValue(unfiltered)
    const bare = await (await listCompanies(authed(BASE))).json()
    expect(bare.total).toBe(501)
    expect(sqlFor(unfiltered, "COUNT(*) AS total FROM company c")).not.toContain("WHERE")

    const filtered = listDb({ total: 7 })
    mockGetDb.mockReturnValue(filtered)
    const res = await listCompanies(authed(`${BASE}?type=exhibitor&q=${encodeURIComponent("医疗")}`))
    const body = await res.json()

    expect(body.total).toBe(7)
    expect(body.total).not.toBe(bare.total)

    const countSql = sqlFor(filtered, "COUNT(*) AS total FROM company c")
    expect(countSql).toContain("WHERE c.type = ?")
    expect(countSql).toContain("(c.name LIKE ? OR c.credit_code LIKE ?)")
    // 值走占位符，绝不内联进 SQL 字符串
    expect(countSql).not.toContain("exhibitor")
    expect(countSql).not.toContain("医疗")
    expect(stmtFor(filtered, "COUNT(*) AS total FROM company c").get).toHaveBeenCalledWith(
      "exhibitor",
      "%医疗%",
      "%医疗%",
    )
    // items 用的是同一套 WHERE + 分页参数
    expect(stmtFor(filtered, "c.oper_name").all).toHaveBeenCalledWith(
      "exhibitor",
      "%医疗%",
      "%医疗%",
      50,
      0,
    )
  })

  it("一阶字段与路由声明完全一致：多余列、SELECT * 都算失败", async () => {
    const db = listDb()
    mockGetDb.mockReturnValue(db)

    const res = await listCompanies(authed(BASE))
    const body = await res.json()

    const sql = sqlFor(db, "c.oper_name")
    expect(sql).not.toMatch(/SELECT\s+\*/)
    expect(selectList(sql)).toEqual(LIST_SELECT)

    // 响应里的键就是规格列名，一个不多一个不少
    expect(Object.keys(body.items[0]).sort()).toEqual([...LIST_KEYS].sort())
  })
})

// ---------------------------------------------------------------------------
// POST /api/company
// ---------------------------------------------------------------------------

describe("POST /api/company — 建档", () => {
  it("未带头 → 401；readonly → 403 且不碰可写库", async () => {
    const anon = await createCompany(write(BASE, "POST", { name: "X", source_type: "manual" }, {}))
    expect(anon.status).toBe(401)

    const ro = await createCompany(
      write(BASE, "POST", { name: "X", source_type: "manual" }, READONLY),
    )
    expect(ro.status).toBe(403)
    expect(await ro.json()).toEqual({ error: "forbidden" })
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("非法 JSON → 400 badJson", async () => {
    const res = await createCompany(write(BASE, "POST", "{not json"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badJson")
    expectKnownErrorCode(body.error)
  })

  it("name 缺失/空白 → 400 companyNameRequired（码在字典里）", async () => {
    for (const payload of [{ source_type: "manual" }, { name: "   ", source_type: "manual" }]) {
      const res = await createCompany(write(BASE, "POST", payload))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("companyNameRequired")
      expectKnownErrorCode(body.error)
    }
    expect(mockGetWritableDb).not.toHaveBeenCalled()
  })

  it("source_type 枚举非法 → 400 badSourceType（列白名单值）", async () => {
    const res = await createCompany(write(BASE, "POST", { name: "甲", source_type: "bogus" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badSourceType")
    expectKnownErrorCode(body.error)
    expect(body.values).toBe("qcc_search / manual / db_match")
  })

  it("contact_status / prospect_score 非法 → 400 且是字典码", async () => {
    const bad = await createCompany(
      write(BASE, "POST", { name: "甲", source_type: "manual", contact_status: "瞎写" }),
    )
    expect(bad.status).toBe(400)
    expectKnownErrorCode((await bad.json()).error)

    const score = await createCompany(
      write(BASE, "POST", { name: "甲", source_type: "manual", prospect_score: 99 }),
    )
    expect(score.status).toBe(400)
    const sb = await score.json()
    expect(sb.error).toBe("badScore")
    expectKnownErrorCode(sb.error)
  })

  it("白名单外的键被静默忽略，created_at/updated_at 由服务端盖章", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const res = await createCompany(
      write(BASE, "POST", {
        name: "新公司",
        source_type: "manual",
        contact_status: "未接触",
        // 以下全是白名单外 / 服务端字段，必须被丢掉
        company_id: "999",
        city: undefined,
        created_at: "1999-01-01 00:00:00",
        updated_at: "1999-01-01 00:00:00",
        hacked: true,
      }),
    )
    expect(res.status).toBe(201)

    const sql = sqlFor(db, "INSERT INTO company")
    expect(sql).not.toContain("hacked")
    expect(sql).not.toContain("company_id")
    expect(insertColumns(sql)).toEqual([
      "source_type",
      "name",
      "contact_status",
      "created_at",
      "updated_at",
    ])

    const args = stmtFor(db, "INSERT INTO company").run.mock.calls[0]
    expect(args.slice(0, 3)).toEqual(["manual", "新公司", "未接触"])
    expect(args).not.toContain("1999-01-01 00:00:00")
    expect(args).not.toContain(999)
    const serverNow = args[3] as string
    expect(serverNow).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(args[4]).toBe(serverNow)
  })

  it("同名同源已存在（UNIQUE 约束）→ 409 duplicate", async () => {
    const db = withThrowingRun(
      authOnlyDb(),
      "INSERT INTO company",
      "SqliteError: UNIQUE constraint failed: company.name, company.source_type",
    )
    mockGetWritableDb.mockReturnValue(db)

    const res = await createCompany(write(BASE, "POST", { name: "甲", source_type: "manual" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("duplicate")
    expectKnownErrorCode(body.error)
  })

  it("外键不存在的 brand_id → 400 badBrand", async () => {
    const db = withThrowingRun(
      authOnlyDb(),
      "INSERT INTO company",
      "SqliteError: FOREIGN KEY constraint failed",
    )
    mockGetWritableDb.mockReturnValue(db)

    const res = await createCompany(
      write(BASE, "POST", { name: "甲", source_type: "manual", brand_id: 424242 }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badBrand")
    expectKnownErrorCode(body.error)
  })

  it("成功 → 201 且回 { company }", async () => {
    const db = buildMockDb([
      ["INSERT INTO company", "run", []],
      ["SELECT * FROM company WHERE company_id", "get", { company_id: 1, name: "新公司" }],
    ])
    mockGetWritableDb.mockReturnValue(db)

    const res = await createCompany(
      write(BASE, "POST", { name: "新公司", source_type: "manual" }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["company"])
    expect(body.company).toMatchObject({ company_id: 1, name: "新公司" })
    expect(db.close).toHaveBeenCalled() // 不 close 会泄漏 WAL 连接
  })
})

// ---------------------------------------------------------------------------
// GET / PATCH /api/company/[id]
// ---------------------------------------------------------------------------

describe("GET /api/company/[id]", () => {
  it("未带头 → 401", async () => {
    const res = await getCompany(new Request(`${BASE}/1`), ID_CTX)
    expect(res.status).toBe(401)
  })

  it("存在 → 200，返回 company + 四个关联块；关联报告不含 report_md", async () => {
    const db = buildMockDb([
      ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
      ["SELECT * FROM company WHERE company_id", "get", { ...SAMPLE_ROW, brand_id: 9 }],
      ["FROM exhibition_brand b", "get", { brand_id: 9, name_cn: "某展" }],
      ["FROM resource", "all", [{ resource_id: 5, kind: "report" }]],
      ["FROM opportunity o", "all", []],
      ["FROM intel_report", "all", []],
    ])
    mockGetDb.mockReturnValue(db)

    const res = await getCompany(authed(`${BASE}/1`), ID_CTX)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual([
      "brand",
      "company",
      "opportunities",
      "reports",
      "resources",
    ])
    expect(selectList(sqlFor(db, "FROM intel_report"))).toEqual([
      "id",
      "title",
      "report_type",
      "status",
      "updated_at",
    ])
  })

  it("未找到 → 404", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }]]),
    )
    const res = await getCompany(authed(`${BASE}/999`), { params: Promise.resolve({ id: "999" }) })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })
})

describe("PATCH /api/company/[id]", () => {
  it("未带头 → 401；readonly → 403 且不发 UPDATE", async () => {
    const anon = await patchCompany(write(`${BASE}/1`, "PATCH", { notes: "x" }, {}), ID_CTX)
    expect(anon.status).toBe(401)

    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)
    const ro = await patchCompany(write(`${BASE}/1`, "PATCH", { notes: "x" }, READONLY), ID_CTX)
    expect(ro.status).toBe(403)
    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("id 不存在 → 404", async () => {
    mockGetWritableDb.mockReturnValue(authOnlyDb())
    const res = await patchCompany(write(`${BASE}/999`, "PATCH", { notes: "x" }), {
      params: Promise.resolve({ id: "999" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("notFound")
  })

  it("只更新请求体里出现的字段，未传字段不进 SET（整行覆盖防线）", async () => {
    const before = {
      company_id: 1,
      name: "原名字",
      notes: "原备注",
      contact_status: "未接触",
      updated_at: "2026-05-01 10:00:00",
    }
    const db = buildMockDb([
      ["SELECT company_id FROM company", "get", { company_id: 1 }],
      ["SELECT * FROM company WHERE company_id", "get", { ...before, contact_status: "已接触" }],
    ])
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchCompany(write(`${BASE}/1`, "PATCH", { contact_status: "已接触" }), ID_CTX)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.company.name).toBe("原名字") // 未传 → 保持原值
    expect(body.company.notes).toBe("原备注")

    const updateSql = sqlFor(db, "UPDATE company")
    const setClause = updateSql.match(/SET([\s\S]*?)WHERE/)![1]
    expect(setClause).toContain("contact_status = ?")
    expect(setClause).toContain("updated_at = ?")
    expect(setClause).not.toContain("name = ?")
    expect(setClause).not.toContain("notes = ?")

    const args = stmtFor(db, "UPDATE company").run.mock.calls[0]
    expect(args[0]).toBe("已接触")
    expect(args).not.toContain("原名字")
    expect(args[args.length - 1]).toBe("1")
  })

  it("白名单外的键被静默忽略：只传 source_type/未知键 → 400 noFields", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchCompany(
      write(`${BASE}/1`, "PATCH", { source_type: "db_match", hacked: 1 }),
      ID_CTX,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("noFields")
    expectKnownErrorCode(body.error)
    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("枚举非法 → 400（badScore / badContactStatus），不发 UPDATE", async () => {
    const db = authOnlyDb()
    mockGetWritableDb.mockReturnValue(db)

    const score = await patchCompany(write(`${BASE}/1`, "PATCH", { prospect_score: 99 }), ID_CTX)
    expect(score.status).toBe(400)
    expect((await score.json()).error).toBe("badScore")

    const status = await patchCompany(
      write(`${BASE}/1`, "PATCH", { contact_status: "瞎写" }),
      ID_CTX,
    )
    expect(status.status).toBe(400)
    const sb = await status.json()
    expect(sb.error).toBe("badContactStatus")
    expectKnownErrorCode(sb.error)
    expect(db.prepare.mock.calls.some((c) => c[0].includes("UPDATE"))).toBe(false)
  })

  it("PATCH 里改 brand_id 撞外键 → 400 badBrand", async () => {
    const db = withThrowingRun(
      buildMockDb([["SELECT company_id FROM company", "get", { company_id: 1 }]]),
      "UPDATE company",
      "SqliteError: FOREIGN KEY constraint failed",
    )
    mockGetWritableDb.mockReturnValue(db)

    const res = await patchCompany(write(`${BASE}/1`, "PATCH", { brand_id: 424242 }), ID_CTX)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badBrand")
    expectKnownErrorCode(body.error)
  })
})
