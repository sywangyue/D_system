import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/users/route"

describe("GET /api/users", () => {
  const mockUsers = [
    {
      user_id: "user-1",
      email: "admin@mwlab.internal",
      role: "admin",
      is_active: 1,
      last_login: "2026-05-06T10:00:00Z",
    },
    {
      user_id: "user-2",
      email: "manager@mwlab.internal",
      role: "manager",
      is_active: 1,
      last_login: "2026-05-05T08:00:00Z",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(
      buildMockDb([
        // requireUser 的 is_active 查询（须排在宽泛的 "FROM user" 之前）
        ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
        ["FROM user", "all", mockUsers],
      ]),
    )
  })

  it("should return user list for admin", async () => {
    const req = new Request("http://localhost:3000/api/users", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "admin" },
    })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty("users")
    expect(json).toHaveProperty("total")
    expect(json.users).toHaveLength(2)
    expect(json.total).toBe(2)
    expect(json.users[0]).toHaveProperty("email")
    expect(json.users[0]).toHaveProperty("role")
  })

  it("should return 401 without auth headers", async () => {
    const req = new Request("http://localhost:3000/api/users")
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it("should return 403 for non-admin role", async () => {
    const req = new Request("http://localhost:3000/api/users", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "manager" },
    })
    const res = await GET(req)

    expect(res.status).toBe(403)
  })

  it("should return 403 for readonly role", async () => {
    const req = new Request("http://localhost:3000/api/users", {
      headers: { "x-user-email": "t@mwlab.internal", "x-user-role": "readonly" },
    })
    const res = await GET(req)

    expect(res.status).toBe(403)
  })
})
