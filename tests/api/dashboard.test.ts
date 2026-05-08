import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/dashboard/route"

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["COALESCE(SUM(e.area_sqm)", "get", { total_area: 10000, total_exhibitors: 500, total_visitors: 100000, total_organizers: 50 }],
        ["SELECT b.* FROM exhibition_brand", "all", []],
        ["industry_l2 as name, COUNT", "all", []],
        ["SELECT e.year", "all", []],
      ]),
    )
  })

  it("should return valid JSON with no filters", async () => {
    const req = new Request("http://localhost:3000/api/dashboard")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(body).toHaveProperty("kpis")
    expect(body).toHaveProperty("brands")
    expect(body).toHaveProperty("industryDistribution")
    expect(body).toHaveProperty("yearTrend")
  })

  it("should handle industry_l2 filter param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?industry_l2=医疗健康")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("kpis")
  })

  it("should handle competition_relation multi-select param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?competition_relation=是,否")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it("should handle mds_related filter param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?mds_related=MFC")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it("should handle all filters combined", async () => {
    const req = new Request(
      "http://localhost:3000/api/dashboard?industry_l2=医疗健康&competition_relation=是&mds_related=MFC",
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
