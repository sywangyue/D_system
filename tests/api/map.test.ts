import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/map/markers/route"

describe("GET /api/map/markers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["WHERE e.city !=", "all", [
          { city: "上海", count: 2, exhibition_names: "上海国际医疗展, 上海电子展", has_international: 0 },
          { city: "北京", count: 1, exhibition_names: "北京健康展", has_international: 0 },
          { city: "法兰克福", count: 1, exhibition_names: "法兰克福汽车展", has_international: 1 },
          { city: "深圳", count: 1, exhibition_names: "", has_international: 0 },
        ]],
      ]),
    )
  })

  it("should return valid JSON with markers array", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(body).toHaveProperty("markers")
    expect(Array.isArray(body.markers)).toBe(true)
  })

  it("should return 200 status on success", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it("should aggregate editions by city", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    const body = await res.json()

    const shanghai = body.markers.find((m: any) => m.city === "上海")
    const beijing = body.markers.find((m: any) => m.city === "北京")

    expect(shanghai.count).toBe(2)
    expect(shanghai.is_china).toBe(true)
    expect(shanghai.top_exhibitions).toContain("上海国际医疗展")
    expect(beijing.count).toBe(1)
  })

  it("should mark international cities correctly", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    const body = await res.json()

    const frankfurt = body.markers.find((m: any) => m.city === "法兰克福")
    expect(frankfurt.is_china).toBe(false)
  })

  it("should handle missing exhibition_brand gracefully", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    const body = await res.json()

    const shenzhen = body.markers.find((m: any) => m.city === "深圳")
    expect(shenzhen.city).toBe("深圳")
    expect(shenzhen.count).toBe(1)
    expect(shenzhen.top_exhibitions).toEqual([])
    expect(shenzhen.is_china).toBe(true)
  })

  it("should include lat/lng for known cities", async () => {
    const req = new Request("http://localhost:3000/api/map/markers")
    const res = await GET(req)
    const body = await res.json()

    const shanghai = body.markers.find((m: any) => m.city === "上海")
    expect(shanghai.lat).toBeCloseTo(31.23, 1)
    expect(shanghai.lng).toBeCloseTo(121.47, 1)
  })
})
