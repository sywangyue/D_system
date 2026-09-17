import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"
import zh from "@/locales/zh.json"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/setting/status/route"

/** 四项新计数 + 原有品牌/届次 + 采集日志。V2-13 §3 要求四项排在前。 */
const BASE_MATCHERS = [
  ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
  ["SELECT COUNT(*) as count FROM company", "get", { count: 501 }],
  ["SELECT COUNT(*) as count FROM opportunity WHERE is_archived = 0", "get", { count: 1 }],
  ["SELECT COUNT(*) as count FROM intel_report", "get", { count: 13 }],
  ["SELECT COUNT(*) as count FROM resource", "get", { count: 50 }],
  ["SELECT COUNT(*) as count FROM exhibition_brand", "get", { count: 3400 }],
  ["SELECT COUNT(*) as count FROM exhibition_edition", "get", { count: 12000 }],
  ["FROM crawl_log", "get", {
    started_at: "2026-05-05T08:00:00Z",
    finished_at: "2026-05-05T08:15:00Z",
    status: "success",
  }],
] as const

const adminReq = () =>
  new Request("http://localhost:3000/api/setting/status", {
    headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "admin" },
  })

describe("GET /api/setting/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(buildMockDb(BASE_MATCHERS as never))
  })

  it("should return data_status and system_info for admin", async () => {
    const res = await GET(adminReq())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty("data_status")
    expect(json).toHaveProperty("system_info")
    expect(json.data_status.total_brands).toBe(3400)
    expect(json.data_status.total_editions).toBe(12000)
    expect(json.data_status.last_crawl_status).toBe("success")
    expect(json.system_info).toHaveProperty("node_version")
  })

  it("§3 四项新计数都在，且公司/在跟进机会/调研报告/资源文件取值正确", async () => {
    const res = await GET(adminReq())
    const json = await res.json()

    expect(json.data_status.total_companies).toBe(501)
    expect(json.data_status.total_opportunities).toBe(1)
    expect(json.data_status.total_reports).toBe(13)
    expect(json.data_status.total_resources).toBe(50)
  })

  it("§3 在跟进机会只数未归档的（SQL 里必须带 is_archived = 0）", async () => {
    const db = mockGetDb()
    await GET(adminReq())

    const sqls = db.prepare.mock.calls.map((c: unknown[]) => String(c[0]))
    const oppSql = sqls.find((s: string) => s.includes("FROM opportunity"))
    expect(oppSql).toContain("is_archived = 0")
  })

  it("§3.1 top 的五项顺序：四项新计数排在品牌/届次之前", async () => {
    const res = await GET(adminReq())
    const json = await res.json()

    const keys = Object.keys(json.data_status)
    expect(keys.indexOf("total_companies")).toBeLessThan(keys.indexOf("total_brands"))
    expect(keys.indexOf("total_resources")).toBeLessThan(keys.indexOf("total_brands"))
  })

  it("§3.1 构建时间不随请求变化（连取两次必须相同）", async () => {
    const a = await (await GET(adminReq())).json()
    const b = await (await GET(adminReq())).json()

    expect(a.system_info.build_time).toBe(b.system_info.build_time)
  })

  it("§3.1 取不到构建时间时给破折号，不回退成当前时间", async () => {
    const saved = process.env.NEXT_PUBLIC_BUILD_TIME
    delete process.env.NEXT_PUBLIC_BUILD_TIME
    try {
      const json = await (await GET(adminReq())).json()
      expect(json.system_info.build_time).toBe("—")
      // 原来这里是 `|| new Date().toISOString()`，会让「构建时间」每次请求都变
      expect(json.system_info.build_time).not.toMatch(/^\d{4}-\d{2}-\d{2}T/)
    } finally {
      if (saved !== undefined) process.env.NEXT_PUBLIC_BUILD_TIME = saved
    }
  })

  it("§3.1 next_version 已删除（它读的 __NEXT_VERSION__ 不是 Next 提供的变量）", async () => {
    const json = await (await GET(adminReq())).json()

    expect(json.system_info).not.toHaveProperty("next_version")
  })

  it("should return 401 without auth headers", async () => {
    const res = await GET(new Request("http://localhost:3000/api/setting/status"))

    expect(res.status).toBe(401)
  })

  it("403 的错误码要在字典里（否则前端只会显示通用的「操作失败」）", async () => {
    const res = await GET(new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "manager" },
    }))

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("forbidden")
    expect(Object.keys(zh.error)).toContain(json.error)
  })

  it("401 的错误码也要在字典里", async () => {
    const res = await GET(new Request("http://localhost:3000/api/setting/status"))

    const json = await res.json()
    expect(Object.keys(zh.error)).toContain(json.error)
  })

  it("should return null crawl data when no crawl logs exist", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
        ["SELECT COUNT(*) as count FROM company", "get", { count: 501 }],
        ["SELECT COUNT(*) as count FROM opportunity WHERE is_archived = 0", "get", { count: 1 }],
        ["SELECT COUNT(*) as count FROM intel_report", "get", { count: 13 }],
        ["SELECT COUNT(*) as count FROM resource", "get", { count: 50 }],
        ["SELECT COUNT(*) as count FROM exhibition_brand", "get", { count: 3400 }],
        ["SELECT COUNT(*) as count FROM exhibition_edition", "get", { count: 12000 }],
        ["FROM crawl_log", "get", null as never],
      ]),
    )
    const res = await GET(adminReq())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data_status.last_crawl_status).toBeNull()
    expect(json.data_status.last_crawl_started_at).toBeNull()
  })

  it("should include system_info properties", async () => {
    const res = await GET(adminReq())
    const json = await res.json()

    expect(json.system_info).toHaveProperty("db_type")
    expect(json.system_info).toHaveProperty("build_time")
  })
})
