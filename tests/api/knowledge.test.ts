import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import path from "path"
import { buildMockDb } from "./_db-mock"
import zh from "@/locales/zh.json"

/**
 * 任务 F §6 —— /api/knowledge/[slug]/doc/[...path] 的安全测试。
 *
 * 这是仓库里第二个直接读文件系统的端点（第一个是 resource 的 download）。
 * 与那个端点不同的是：这里的路径由 **URL** 拼成，而 `[...path]` 是完全可控的字符串。
 *
 * 断言口径：全部非 200。能被字符串层拒的就断言 400；剩下那些「拒绝了但先撞上
 * ENOENT」的断言 404 —— 同样不能是 200。
 */

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/knowledge/[slug]/doc/[...path]/route"

const ERROR_CODES = new Set(Object.keys(zh.error))

function authed(url: string): Request {
  return new Request(url, {
    headers: { "x-user-email": "test@example.com", "x-user-role": "admin" },
  })
}

const call = (slug: string, segments: string[]) =>
  GET(authed(`http://localhost:3000/api/knowledge/${slug}/doc/${segments.join("/")}`) as never,
      { params: Promise.resolve({ slug, path: segments }) })

// 正向用例的夹具：目录名是合法 slug 但**没有 index.md**，
// 所以即便清理失败也不会出现在列表页上（列表只认有 index.md 的目录）。
// 测完自己删掉。
const PROBE_DIR = path.join(process.cwd(), "knowledge", "zz-test-probe")
const PROBE_DOC = path.join(PROBE_DIR, "docs", "probe.txt")
const PROBE_TEXT = "knowledge doc endpoint probe\n"

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDb.mockReturnValue(buildMockDb([
    ["SELECT is_active FROM user WHERE email", "get", { is_active: 1 }],
  ]))
})

afterAll(() => {
  rmSync(PROBE_DIR, { recursive: true, force: true })
})

describe("GET /api/knowledge/[slug]/doc/[...path]", () => {
  it("未带认证头 → 401", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/knowledge/demo/doc/x.pdf") as never,
      { params: Promise.resolve({ slug: "demo", path: ["x.pdf"] }) })
    expect(res.status).toBe(401)
  })

  it("slug 本身是 `..` → 400（slug 也是路径的一段，必须同样校验）", async () => {
    const res = await call("..", ["x.pdf"])
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("badResourcePath")
  })

  it("slug 是编码后的 `..%2f..%2f` → 400（% 不在 slug 白名单里）", async () => {
    const res = await call("..%2f..%2f", ["x.pdf"])
    expect(res.status).toBe(400)
  })

  it("slug 以下划线开头（_example）→ 400，即模板目录取不到", async () => {
    const res = await call("_example", ["index.md"])
    expect(res.status).toBe(400)
  })

  it.each([
    [["..", "..", ".env.local"], "多段 .."],
    [["..", "index.md"], "越到 index.md"],
    [["/etc/passwd"], "绝对路径"],
    [["reports\\..\\..\\.env.local"], "反斜杠穿越"],
    [["."], "单点段"],
  ])("path 段 %j（%s）→ 400", async (segments) => {
    const res = await call("demo", segments as string[])
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("badResourcePath")
    // 不回显越界内容
    expect(JSON.stringify(body)).not.toContain("env.local")
    expect(JSON.stringify(body)).not.toContain("etc/passwd")
  })

  it("编码后的 ..%2f 段（单测里不会被解码）→ 同样非 200", async () => {
    const res = await call("demo", ["..%2f..%2f.env.local"])
    expect(res.status).not.toBe(200)
  })

  it("直接请求 index.md → 404，**不会**越出 docs/ 去读项目的 index.md", async () => {
    const res = await call("demo", ["index.md"])
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("fileMissing")
  })

  it("docs/ 下没有这个文件 → 404 fileMissing", async () => {
    const res = await call("demo", ["nope.pdf"])
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("fileMissing")
  })

  it("拒绝时返回的码都在字典 error.* 里存在", async () => {
    const res = await call("demo", ["..", "x"])
    const body = await res.json()
    expect(ERROR_CODES.has(body.error)).toBe(true)
  })

  it("正向：docs/ 下的真实文件返回文件流与正确的 disposition", async () => {
    mkdirSync(path.dirname(PROBE_DOC), { recursive: true })
    writeFileSync(PROBE_DOC, PROBE_TEXT)

    const res = await call("zz-test-probe", ["probe.txt"])
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    expect(res.headers.get("content-length")).toBe(String(PROBE_TEXT.length))
    expect(res.headers.get("cache-control")).toBe("private, no-store")

    const cd = res.headers.get("content-disposition")!
    expect(cd).toContain("attachment")
    expect(cd).toContain('filename="probe.txt"')

    expect(await res.text()).toBe(PROBE_TEXT)
  })

  it("正向：目录（不是普通文件）→ 400 notRegularFile", async () => {
    mkdirSync(path.join(PROBE_DIR, "docs", "subdir"), { recursive: true })
    const res = await call("zz-test-probe", ["subdir"])
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("notRegularFile")
  })
})
