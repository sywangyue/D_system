import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildMockDb } from "./_db-mock"

const mockGetWritableDb = vi.fn()
const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getWritableDb: () => mockGetWritableDb(),
  getDb: () => mockGetDb(),
}))

// Mock bcryptjs and jose
vi.mock("bcryptjs", () => ({
  default: {
    compareSync: vi.fn(),
  },
  compareSync: vi.fn(),
}))

import { POST } from "@/app/api/auth/login/route"
import bcrypt from "bcryptjs"

// Mock jose SignJWT for login token creation
vi.mock("jose", () => {
  const mockSign = { setProtectedHeader: vi.fn().mockReturnThis(), setExpirationTime: vi.fn().mockReturnThis(), sign: vi.fn().mockResolvedValue("mock-jwt-token") }
  return { SignJWT: vi.fn(() => mockSign), jwtVerify: vi.fn() }
})

describe("POST /api/auth/login", () => {
  const mockUser = {
    user_id: "user-1",
    email: "admin@mwlab.com",
    role: "admin",
    display_name: "Admin",
    password_hash: "$2a$10$hashedpassword",
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 on wrong password", async () => {
    mockGetWritableDb.mockReturnValue(
      buildMockDb([
        ["SELECT * FROM user WHERE email", "get", mockUser],
        ["UPDATE user SET last_login", "run", {}],
      ]),
    )
    vi.mocked(bcrypt.compareSync).mockReturnValue(false)

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@mwlab.com", password: "wrong" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).not.toHaveProperty("token")
  })

  it("should return 400 on missing fields", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("should return 200 with set-cookie on correct credentials", async () => {
    mockGetWritableDb.mockReturnValue(
      buildMockDb([
        ["SELECT * FROM user WHERE email", "get", mockUser],
        ["UPDATE user SET last_login", "run", {}],
      ]),
    )
    vi.mocked(bcrypt.compareSync).mockReturnValue(true)

    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@mwlab.com", password: "correct" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    // Body should NOT contain token (HttpOnly cookie instead)
    const body = await res.json()
    expect(body).not.toHaveProperty("token")
    expect(body).toHaveProperty("email")
    expect(body).toHaveProperty("role")
    expect(body).toHaveProperty("display_name")
  })
})
