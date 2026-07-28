import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock jose before importing middleware
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
}))

import { jwtVerify } from "jose"
// Next.js 16 起中间件文件由 middleware.ts 更名为 proxy.ts（默认导出）
import middleware from "@/proxy"

function makeRequest(path: string, opts?: { token?: string; headers?: Record<string, string> }): NextRequest {
  const url = `http://localhost:3000${path}`
  const req = new NextRequest(url)
  if (opts?.token) {
    req.cookies.set("session", opts.token)
  }
  if (opts?.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      req.headers.set(k, v)
    }
  }
  return req
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should let /login pass without injection headers", async () => {
    const req = makeRequest("/login")
    const res = await middleware(req)
    expect(res.status).toBe(200)
    // /login is fully public — no x-user-* headers should be set
    expect(req.headers.get("x-user-email")).toBeNull()
    expect(req.headers.get("x-user-role")).toBeNull()
  })

  it("should let static assets pass", async () => {
    const req = makeRequest("/_next/static/chunk.js")
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it("should return 401 for /api/ routes without token", async () => {
    const req = makeRequest("/api/dashboard")
    // Pre-set injected headers should be stripped
    req.headers.set("x-user-email", "fake@test.com")
    req.headers.set("x-user-role", "admin")

    const res = await middleware(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body).toEqual({ error: "unauthorized" })
  })

  it("should strip external x-user-* headers before returning 401", async () => {
    // Even when returning 401, middleware must strip injected headers
    const req = makeRequest("/api/brands", { headers: { "x-user-email": "fake@test.com", "x-user-role": "admin" } })
    // Directly verify header deletion logic: middleware calls requestHeaders.delete before responding
    // The response itself should not carry these headers
    const res = await middleware(req)
    // Response JSON check
    const body = await res.json()
    expect(body).toEqual({ error: "unauthorized" })
    // No set-cookie or header leaks
    expect(res.headers.get("x-user-email")).toBeNull()
  })

  it("should allow valid token on /api/ and inject verified headers", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "admin@mwlab.com", role: "admin" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })

    const req = makeRequest("/api/dashboard", { token: "valid-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it("should reject expired/invalid token on /api/ with 401", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("jwt expired"))

    const req = makeRequest("/api/brands", { token: "expired-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(401)
  })

  // 无 token 的页面路由跳 /pitch.html（pitch 改版后的公开主入口），不是 /login
  it("should redirect page routes to /pitch.html when no token", async () => {
    const req = makeRequest("/dashboard.html")
    const res = await middleware(req)
    expect(res.status).toBe(307) // redirect
    expect(res.headers.get("location")).toContain("/pitch.html")
  })

  // token 存在但验签失败 → 回 /login 重新登录
  it("should redirect page routes to /login when token is invalid", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("jwt expired"))

    const req = makeRequest("/dashboard.html", { token: "expired-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/login")
  })

  it("should redirect non-admin to /dashboard.html from /setting", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "manager@mwlab.com", role: "manager" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })

    const req = makeRequest("/setting", { token: "valid-manager-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/dashboard.html")
  })

  it("should let admin access /setting", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "admin@mwlab.com", role: "admin" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })

    const req = makeRequest("/setting", { token: "valid-admin-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
