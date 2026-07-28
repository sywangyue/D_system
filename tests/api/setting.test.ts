import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/setting/status/route"

describe("GET /api/setting/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        // requireUser 的 is_active 查询
        ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
        ["SELECT COUNT(*) as count FROM exhibition_brand", "get", { count: 3400 }],
        ["SELECT COUNT(*) as count FROM exhibition_edition", "get", { count: 12000 }],
        ["FROM crawl_log", "get", {
          started_at: "2026-05-05T08:00:00Z",
          finished_at: "2026-05-05T08:15:00Z",
          status: "success",
        }],
      ]),
    )
  })

  it("should return data_status and system_info for admin", async () => {
    const req = new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "admin" },
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty("data_status")
    expect(json).toHaveProperty("system_info")
    expect(json.data_status.total_brands).toBe(3400)
    expect(json.data_status.total_editions).toBe(12000)
    expect(json.data_status.last_crawl_status).toBe("success")
    expect(json.system_info).toHaveProperty("node_version")
    expect(json.system_info).toHaveProperty("next_version")
  })

  it("should return 401 without auth headers", async () => {
    const req = new Request("http://localhost:3000/api/setting/status")
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it("should return 403 for manager role", async () => {
    const req = new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "manager" },
    })
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it("should return 403 for readonly role", async () => {
    const req = new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "readonly" },
    })
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it("should return null crawl data when no crawl logs exist", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
        ["SELECT COUNT(*) as count FROM exhibition_brand", "get", { count: 3400 }],
        ["SELECT COUNT(*) as count FROM exhibition_edition", "get", { count: 12000 }],
        ["FROM crawl_log", "get", null as any],
      ]),
    )
    const req = new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "admin" },
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data_status.last_crawl_status).toBeNull()
    expect(json.data_status.last_crawl_started_at).toBeNull()
  })

  it("should include system_info properties", async () => {
    const req = new Request("http://localhost:3000/api/setting/status", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "admin" },
    })
    const res = await GET(req)
    const json = await res.json()

    expect(json.system_info).toHaveProperty("db_type")
    expect(json.system_info).toHaveProperty("build_time")
  })
})
