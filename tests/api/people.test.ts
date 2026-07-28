import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()
const mockGetWritableDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetWritableDb(),
}))

import { GET, POST } from "@/app/api/people/route"

describe("GET /api/people", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 without auth header", async () => {
    const req = new Request("http://localhost:3000/api/people")
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it("should return people list with auth header", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["SELECT is_active", "get", { is_active: 1 }],
        ["FROM person p", "all", [
          { person_id: 1, name: "张三", exhibition_count: 3 },
        ]],
      ]),
    )
    const req = new Request("http://localhost:3000/api/people", {
      headers: { "x-user-email": "admin@mwlab.com", "x-user-role": "admin" },
    })
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})

describe("POST /api/people", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 without auth header", async () => {
    const req = new Request("http://localhost:3000/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "李四" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it("should return 400 when name is missing", async () => {
    mockGetWritableDb.mockReturnValue(buildMockDb([]))
    mockGetDb.mockReturnValue(
      buildMockDb([["SELECT is_active", "get", { is_active: 1 }]]),
    )
    const req = new Request("http://localhost:3000/api/people", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
        "x-user-email": "admin@mwlab.com",
        "x-user-role": "admin",
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  // AUDIT P0-3 回归：readonly 角色不得写入
  it("should return 403 for readonly role", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([["SELECT is_active", "get", { is_active: 1 }]]),
    )
    const req = new Request("http://localhost:3000/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "李四" }),
      headers: {
        "content-type": "application/json",
        "x-user-email": "ro@mwlab.com",
        "x-user-role": "readonly",
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(403)
  })

  // AUDIT P0-3 回归：账号被停用后，存量 token 立即失效
  it("should return 401 when account is deactivated", async () => {
    mockGetDb.mockReturnValue(
      buildMockDb([["SELECT is_active", "get", { is_active: 0 }]]),
    )
    const req = new Request("http://localhost:3000/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "李四" }),
      headers: {
        "content-type": "application/json",
        "x-user-email": "banned@mwlab.com",
        "x-user-role": "admin",
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it("should create person and return 201", async () => {
    mockGetWritableDb.mockReturnValue(
      buildMockDb([
        ["INSERT INTO person", "run", { lastInsertRowid: 1 }],
      ]),
    )
    mockGetDb.mockReturnValue(
      buildMockDb([
        ["SELECT is_active", "get", { is_active: 1 }],
        ["SELECT * FROM person WHERE person_id", "get", { person_id: 1, name: "李四" }],
      ]),
    )
    const req = new Request("http://localhost:3000/api/people", {
      method: "POST",
      body: JSON.stringify({ name: "李四" }),
      headers: {
        "content-type": "application/json",
        "x-user-email": "admin@mwlab.com",
        "x-user-role": "admin",
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("person_id")
    expect(body.name).toBe("李四")
  })
})
