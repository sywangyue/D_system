import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock global fetch for FastAPI proxy
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { PATCH } from "@/app/api/brands/[id]/tags/route"

describe("PATCH /api/brands/[id]/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ brand: { brand_id: "brand-1", competition_relation: "否" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  })

  it("should accept valid tag fields and proxy to FastAPI", async () => {
    const body = JSON.stringify({
      industry_l1: "医疗健康",
      competition_relation: "否",
    })
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body,
      headers: { "x-user-role": "admin", "x-user-email": "admin@mwlab.internal" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty("brand")
  })

  it("should reject invalid tag fields", async () => {
    const body = JSON.stringify({
      name_cn: "hacked",
      competition_relation: "否",
    })
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body,
      headers: { "x-user-role": "admin" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) })

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain("不可打标字段")
  })

  it("should return 403 for readonly role", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body: JSON.stringify({ competition_relation: "否" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) })

    expect(res.status).toBe(403)
  })

  it("should return 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body: "not json",
      headers: { "x-user-role": "admin" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) })

    expect(res.status).toBe(400)
  })

  it("should return 400 for empty tag fields", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "x-user-role": "admin" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) })

    expect(res.status).toBe(400)
  })
})
