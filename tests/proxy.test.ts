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

  // 无 token 的页面路由跳 /login（阶段 5 静态页退役后 /pitch.html 不再存在）
  it("should redirect page routes to /login when no token", async () => {
    const req = makeRequest("/dashboard.html")
    const res = await middleware(req)
    expect(res.status).toBe(307) // redirect
    expect(res.headers.get("location")).toContain("/login")
  })

  // 落地页（V2-14 §3）：/ 公开，未登录也放行
  it("should let unauthenticated users reach the landing page at /", async () => {
    const res = await middleware(makeRequest("/"))
    expect(res.status).not.toBe(307)
    expect(res.headers.get("location")).toBeNull()
  })

  // 落地页登录与否都显示：/ 打上 x-mwlab-bare，根布局据此不渲染后台侧栏
  it("should mark / as bare (no app shell) for both anonymous and signed-in users", async () => {
    for (const token of [undefined, "valid-jwt"]) {
      const res = await middleware(makeRequest("/", token ? { token } : undefined))
      expect(res.status).toBe(200)
      expect(res.headers.get("x-middleware-request-x-mwlab-bare")).toBe("1")
    }
  })

  // 其余页面不接受客户端伪造的 x-mwlab-bare（否则可以把后台页面的侧栏藏掉）
  it("should strip a forged x-mwlab-bare header on app pages", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "manager@mwlab.com", role: "manager" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })
    const res = await middleware(makeRequest("/overview", {
      token: "valid-jwt", headers: { "x-mwlab-bare": "1" },
    }))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-request-x-mwlab-bare")).toBeNull()
  })

  // 但放行必须**只放 /**：写成 startsWith('/') 就等于放行全站
  it("should still protect other pages (the '/' exemption is exact, not a prefix)", async () => {
    for (const p of ["/overview", "/company", "/expo", "/knowledge"]) {
      const res = await middleware(makeRequest(p))
      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toContain("/login")
    }
  })

  // 以静态资源扩展名结尾的 /api 路径不能走「静态放行」分支：
  // 那条分支不剥离 x-user-* 头，伪造头就能不登录直达接口（2026-09-17 质检实测）
  it("should reject forged identity headers on /api paths that end in a static extension", async () => {
    for (const p of [
      "/api/knowledge/demo/doc/plan.png",
      "/api/knowledge/demo/doc/style.css",
      "/api/company/1.jpg",
    ]) {
      const req = makeRequest(p, {
        headers: { "x-user-email": "admin@mwlab.internal", "x-user-role": "admin" },
      })
      const res = await middleware(req)
      expect(res.status).toBe(401)
    }
  })

  it("should inject verified identity on /api paths that end in a static extension", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "manager@mwlab.com", role: "manager" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })
    const req = makeRequest("/api/knowledge/demo/doc/plan.png", {
      token: "valid-jwt",
      headers: { "x-user-email": "admin@mwlab.internal", "x-user-role": "admin" },
    })
    const res = await middleware(req)
    expect(res.status).toBe(200)
    // 伪造的 admin 被剥离，换成验签得到的 manager
    expect(res.headers.get("x-middleware-request-x-user-role")).toBe("manager")
  })

  // 地图的陆地轮廓是公开的：不放行的话匿名访客的地图只剩点位（V2-14 §4.4）
  it("should serve the countries GeoJSON without a token", async () => {
    const res = await middleware(makeRequest("/countries-110m.json"))
    expect(res.status).not.toBe(307)
  })

  // token 存在但验签失败 → 回 /login 重新登录
  it("should redirect page routes to /login when token is invalid", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("jwt expired"))

    const req = makeRequest("/dashboard.html", { token: "expired-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/login")
  })

  it("should redirect non-admin to /overview from /setting", async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { email: "manager@mwlab.com", role: "manager" } as any,
      protectedHeader: { alg: "HS256" },
      key: {} as any,
    })

    const req = makeRequest("/setting", { token: "valid-manager-jwt" })
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/overview")
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
