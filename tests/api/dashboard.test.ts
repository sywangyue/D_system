import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/dashboard/route"

// 构造带合法认证头的 Request（middleware 已在集成层剥离外部头，单元测试直接注入可信头）
function authedRequest(url: string): Request {
  return new Request(url, {
    headers: { "x-user-email": "test@example.com", "x-user-role": "admin" },
  })
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        // requireUser 的 is_active 查询
        ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
        ["COALESCE(SUM(e.area_sqm)", "get", { total_area: 10000, total_exhibitors: 500, total_visitors: 100000, total_organizers: 50 }],
        ["SELECT b.* FROM exhibition_brand", "all", []],
        ["industry_l2 as name, COUNT", "all", []],
        ["SELECT e.year", "all", []],
      ]),
    )
  })

  it("should return 401 without authentication", async () => {
    const req = new Request("http://localhost:3000/api/dashboard")
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it("should return valid JSON with no filters", async () => {
    const res = await GET(authedRequest("http://localhost:3000/api/dashboard") as any)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(body).toHaveProperty("kpis")
    expect(body).toHaveProperty("brands")
    expect(body).toHaveProperty("industryDistribution")
    expect(body).toHaveProperty("yearTrend")
  })

  it("should handle industry_l2 filter param", async () => {
    const res = await GET(authedRequest("http://localhost:3000/api/dashboard?industry_l2=医疗健康") as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("kpis")
  })

  it("should handle competition_relation multi-select param", async () => {
    const res = await GET(authedRequest("http://localhost:3000/api/dashboard?competition_relation=是,否") as any)
    expect(res.status).toBe(200)
  })

  it("should handle mds_related filter param", async () => {
    const res = await GET(authedRequest("http://localhost:3000/api/dashboard?mds_related=MFC") as any)
    expect(res.status).toBe(200)
  })

  it("should handle all filters combined", async () => {
    const res = await GET(
      authedRequest("http://localhost:3000/api/dashboard?industry_l2=医疗健康&competition_relation=是&mds_related=MFC") as any,
    )
    expect(res.status).toBe(200)
  })
})
