import { describe, it, expect, vi, beforeEach } from "vitest"
import { statSync } from "fs"
import { buildMockDb, type FakeDb } from "./_db-mock"
import zh from "@/locales/zh.json"

/**
 * 任务 F §2.1 / §2.4 —— /api/resource 列表（只读）与 /api/resource/[id]/download。
 *
 * download 这一段是本任务优先级最高的：`resource.file_path` 来自数据库，
 * 而数据库是可写的，所以它**不是可信输入** —— 一条 `../../.env.local`
 * 就能读走 JWT_SECRET 与企查查密钥。六种穿越姿势必须全被拦。
 */

const mockGetDb = vi.fn()
let db: FakeDb

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET as listGET } from "@/app/api/resource/route"
import { GET as downloadGET } from "@/app/api/resource/[id]/download/route"

/** 一阶字段声明（必须与路由里的 LIST_COLUMNS 逐字一致） */
const FIRST_ORDER = [
  "r.resource_id", "r.kind", "r.title", "r.mime", "r.size_bytes",
  "r.collected_at", "r.source", "r.company_id", "r.opp_id", "r.brand_id",
]

/** 盘上真实存在、且被 git 跟踪的固定文件（中文名，顺带验 RFC 5987） */
const REAL_FILE = "reports/industry/FPackAsia_深度调研报告_2026-08-24.docx"

const ERROR_CODES = new Set(Object.keys(zh.error))

function authed(url: string, role = "admin"): Request {
  return new Request(url, {
    headers: { "x-user-email": "test@example.com", "x-user-role": role },
  })
}

function mockDb(opts: {
  row?: Record<string, unknown> | undefined
  total?: number
  items?: Record<string, unknown>[]
} = {}) {
  db = buildMockDb([
    ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
    ["SELECT title, file_path, mime, size_bytes FROM resource", "get",
      opts.row === undefined ? undefined as never : opts.row],
    ["SELECT COUNT(*) AS total FROM resource", "get", { total: opts.total ?? 0 }],
    ["SELECT r.resource_id", "all", opts.items ?? []],
  ])
  mockGetDb.mockReturnValue(db)
  return db
}

/** 取出所有 prepare 过的 SQL，便于断言「拼串了没有」「列对不对」 */
const allSql = (): string[] => db.prepare.mock.calls.map(c => String(c[0]))

/** 列表项那条查询（LIST_COLUMNS 模板串开头带换行，所以用 LIMIT 片段认它） */
const itemsSqlOf = (): string => allSql().find(s => s.includes("LIMIT ? OFFSET ?"))!

beforeEach(() => {
  vi.clearAllMocks()
  mockDb()
})

// ─────────────────────────────────────────────────────────────
describe("GET /api/resource（一阶列表）", () => {
  it("未带认证头 → 401", async () => {
    const res = await listGET(new Request("http://localhost:3000/api/resource") as never)
    expect(res.status).toBe(401)
  })

  it("size=9999 → 静默截断为 200，不报错", async () => {
    const res = await listGET(authed("http://localhost:3000/api/resource?size=9999") as never)
    expect(res.status).toBe(200)
    expect((await res.json()).size).toBe(200)
  })

  it("size=0 / 负数 → 回落到 1，不报错", async () => {
    for (const bad of ["0", "-5", "abc"]) {
      const res = await listGET(authed(`http://localhost:3000/api/resource?size=${bad}`) as never)
      expect(res.status).toBe(200)
      expect((await res.json()).size).toBeGreaterThanOrEqual(1)
    }
  })

  it("page/size 缺省为 1 / 50", async () => {
    const body = await (await listGET(authed("http://localhost:3000/api/resource") as never)).json()
    expect(body.page).toBe(1)
    expect(body.size).toBe(50)
  })

  it("sort 传注入串 → 不报错，且**没有任何拼接**，回退到默认列", async () => {
    const res = await listGET(authed(
      "http://localhost:3000/api/resource?sort=" + encodeURIComponent("1;DROP TABLE x")) as never)
    expect(res.status).toBe(200)
    const itemsSql = itemsSqlOf()
    expect(itemsSql).toContain("ORDER BY r.collected_at DESC")
    expect(itemsSql).not.toContain("DROP TABLE")
    expect(itemsSql).not.toContain("1;")
  })

  it("sort 白名单内的值才生效（title）", async () => {
    await listGET(authed("http://localhost:3000/api/resource?sort=title&order=asc") as never)
    const itemsSql = itemsSqlOf()
    expect(itemsSql).toContain("ORDER BY r.title ASC")
  })

  it("一阶字段与规格逐字一致，且**不含 file_path**（它是下载端点的输入，不是展示字段）", async () => {
    await listGET(authed("http://localhost:3000/api/resource") as never)
    const itemsSql = itemsSqlOf()
    for (const col of FIRST_ORDER) expect(itemsSql).toContain(col)
    expect(itemsSql).not.toContain("file_path")
  })

  it("total 是筛选后的数，不是全表数", async () => {
    mockDb({ total: 50 })
    const all = await (await listGET(authed("http://localhost:3000/api/resource") as never)).json()
    mockDb({ total: 11 })
    const filtered = await (await listGET(
      authed("http://localhost:3000/api/resource?kind=report") as never)).json()
    expect(all.total).toBe(50)
    expect(filtered.total).toBe(11)
    expect(all.total).not.toBe(filtered.total)
  })

  it("筛选值走占位符绑定，不拼进 SQL", async () => {
    await listGET(authed("http://localhost:3000/api/resource?kind=report&source=qcc") as never)
    const countSql = allSql().find(s => s.includes("COUNT(*)"))!
    expect(countSql).toContain("r.kind = ?")
    expect(countSql).toContain("r.source = ?")
    expect(countSql).not.toContain("= report")
    expect(countSql).not.toContain("= qcc")
  })

  it("无筛选条件时不生成空 WHERE，也不加 is_archived（这张表没有这列）", async () => {
    await listGET(authed("http://localhost:3000/api/resource") as never)
    const countSql = allSql().find(s => s.includes("COUNT(*)"))!
    expect(countSql).not.toContain("WHERE")
    expect(countSql).not.toContain("is_archived")
  })

  it("q 搜索同时匹配 title 与 file_path，且为模糊绑参", async () => {
    await listGET(authed("http://localhost:3000/api/resource?q=%E5%8A%B1%E6%B3%B0") as never)
    const countSql = allSql().find(s => s.includes("COUNT(*)"))!
    expect(countSql).toContain("(r.title LIKE ? OR r.file_path LIKE ?)")
  })

  it("响应形状恰为 items/page/size/total", async () => {
    const body = await (await listGET(authed("http://localhost:3000/api/resource") as never)).json()
    expect(Object.keys(body).sort()).toEqual(["items", "page", "size", "total"])
  })
})

// ─────────────────────────────────────────────────────────────
describe("GET /api/resource/[id]/download（安全）", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it("未带认证头 → 401", async () => {
    mockDb({ row: { title: "x", file_path: REAL_FILE, mime: null, size_bytes: 1 } })
    const res = await downloadGET(
      new Request("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(401)
  })

  it("库里没有这条记录 → 404", async () => {
    mockDb({ row: undefined })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/999/download") as never, params("999"))
    expect(res.status).toBe(404)
  })

  // §2.4 —— 六种穿越姿势，全部必须 400
  const TRAVERSALS = [
    "../../../../etc/passwd",
    "reports/../../.env.local",
    ".env.local",
    "/etc/passwd",
    "reports/./../.env.local",
    "reports\\..\\..\\.env.local",
  ]

  it.each(TRAVERSALS)("穿越姿势 %s → 400 badResourcePath", async (filePath) => {
    mockDb({ row: { title: "x", file_path: filePath, mime: null, size_bytes: 1 } })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badResourcePath")
    // 不回显越界路径，也不回显业务错误句
    expect(JSON.stringify(body)).not.toContain(filePath)
  })

  it("根目录不在白名单（data/mwlab.db）→ 400", async () => {
    mockDb({ row: { title: "x", file_path: "data/mwlab.db", mime: null, size_bytes: 1 } })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("badResourcePath")
  })

  it("只剩根目录、没有文件名（reports/）→ 400", async () => {
    mockDb({ row: { title: "x", file_path: "reports/", mime: null, size_bytes: 1 } })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(400)
  })

  it("合法路径但磁盘上没这个文件 → 404 fileMissing（**不是 400**，证明 resolveSafe 放行了）", async () => {
    mockDb({
      row: { title: "x", file_path: "reports/definitely-not-here-20260917.pdf", mime: null, size_bytes: 1 },
    })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("fileMissing")
  })

  it("正向：合法路径返回文件流，Content-Type 正确，中文文件名走 filename*", async () => {
    const real = statSync(REAL_FILE)
    mockDb({
      row: {
        title: "FPackAsia 调研报告",
        file_path: REAL_FILE,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes: real.size,
      },
    })
    const res = await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("wordprocessingml.document")
    expect(res.headers.get("content-length")).toBe(String(real.size))
    expect(res.headers.get("cache-control")).toBe("private, no-store")

    const cd = res.headers.get("content-disposition")!
    expect(cd).toContain("attachment")
    // RFC 5987：filename= 只能是 ASCII 回退，真名走 filename*
    expect(cd).toMatch(/filename="[\x20-\x7E]*"/)
    expect(cd).toContain("filename*=UTF-8''" + encodeURIComponent("FPackAsia_深度调研报告_2026-08-24.docx"))
    // docx 是 zip，头两个字节应为 PK
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.length).toBe(real.size)
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK")
  })

  it("路径越界返回的错误码在字典 error.* 里存在", async () => {
    mockDb({ row: { title: "x", file_path: "../../.env.local", mime: null, size_bytes: 1 } })
    const body = await (await downloadGET(
      authed("http://localhost:3000/api/resource/1/download") as never, params("1"))).json()
    expect(ERROR_CODES.has(body.error)).toBe(true)
  })
})
