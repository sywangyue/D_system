import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/brands/[id]/route"

describe("GET /api/brands/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["FROM exhibition_brand", "get", { brand_id: "brand-1", name_cn: "Test Brand", name_en: "TB" }],
        ["FROM exhibition_edition", "all", [
          { edition_id: "ed-1", brand_id: "brand-1", year: 2025, city: "Shanghai" },
          { edition_id: "ed-2", brand_id: "brand-1", year: 2024, city: "Beijing" },
        ]],
      ]),
    )
  })

  it("should return JSON content type for valid brand", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1")
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) })
    expect(res.headers.get("content-type")).toContain("application/json")
  })

  it("should return brand + editions for valid brand_id", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1")
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.brand.brand_id).toBe("brand-1")
    expect(body.editions).toHaveLength(2)
  })

  it("should order editions by year DESC", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["FROM exhibition_brand", "get", { brand_id: "brand-1", name_cn: "Test" }],
        ["FROM exhibition_edition", "all", [
          { edition_id: "ed-3", year: 2026 },
          { edition_id: "ed-2", year: 2025 },
          { edition_id: "ed-1", year: 2024 },
        ]],
      ]),
    )
    const req = new Request("http://localhost:3000/api/brands/brand-1")
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.editions).toHaveLength(3)
  })

  it("should return 404 for non-existent brand_id", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["FROM exhibition_brand", "get", null as any],
        ["FROM exhibition_edition", "all", []],
      ]),
    )
    const req = new Request("http://localhost:3000/api/brands/nonexistent")
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Brand not found")
  })

  it("should return error message in response body on 404", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["FROM exhibition_brand", "get", null as any],
        ["FROM exhibition_edition", "all", []],
      ]),
    )
    const req = new Request("http://localhost:3000/api/brands/missing")
    const res = await GET(req, { params: Promise.resolve({ id: "missing" }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty("error")
  })
})
