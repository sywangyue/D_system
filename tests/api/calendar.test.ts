import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/calendar/events/route"

describe("GET /api/calendar/events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["date_start IS NOT NULL", "all", [
          {
            edition_id: "ed-001",
            date_start: "2026-06-15",
            date_end: "2026-06-18",
            venue: "国家会展中心",
            city: "上海",
            exhibitors_count: 500,
            brand_id: "b-001",
            name_cn: "上海国际医疗展",
            competition_relation: "竞争对手",
          },
        ]],
      ]),
    )
  })

  it("should return valid JSON with events array", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = await res.json()
    expect(body).toHaveProperty("events")
    expect(Array.isArray(body.events)).toBe(true)
  })

  it("should return 200 status on success", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it("should map edition fields to event shape when data exists", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events")
    const res = await GET(req)
    const body = await res.json()
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      edition_id: "ed-001",
      name_cn: "上海国际医疗展",
      venue: "国家会展中心",
      city: "上海",
      exhibitors_count: 500,
      competition_relation: "竞争对手",
    })
  })
})
