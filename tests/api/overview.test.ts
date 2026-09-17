import { describe, it, expect, vi, beforeEach } from "vitest"
import Database from "better-sqlite3"

/**
 * GET /api/overview —— 聚合端点 + lib/queries/overview.ts 的回归测试（TASK-F §2.6）
 *
 * 只 mock `@/lib/db`（返回一份 `:memory:` sqlite，绝不碰 data/mwlab.db）。
 * 查询主体 `lib/queries/overview.ts` 是**没被 mock 的真实模块** ——
 * /api/overview 与 app/overview/page.tsx 共用它，所以这里必须把它一起测到。
 *
 * 重点：funnel 五档齐全（无数据补 0）、resources.total 与 resource 表行数一致、
 * 顶层键恰为六个。
 */

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/overview/route"

const DDL = `
CREATE TABLE user (
  email     TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE company (
  company_id INTEGER PRIMARY KEY,
  name       TEXT
);
CREATE TABLE opportunity (
  opp_id          INTEGER PRIMARY KEY,
  title           TEXT,
  type            TEXT,
  stage           TEXT,
  owner           TEXT,
  next_action     TEXT,
  next_action_due TEXT,
  is_archived     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE intel_report (
  id          INTEGER PRIMARY KEY,
  title       TEXT,
  report_type TEXT,
  status      TEXT,
  updated_at  TEXT,
  company_id  INTEGER,
  report_md   TEXT
);
CREATE TABLE resource (
  resource_id INTEGER PRIMARY KEY,
  kind        TEXT,
  size_bytes  INTEGER
);
`

/** 本周待办里被 LIMIT 10 截掉的那批（故意放 12 条）。 */
const OVERDUE_COUNT = 12
/** 五档里只有两档有数据，其余必须补 0。 */
const FUNNEL_EXPECTED = [
  { stage: "contact", count: 2 },
  { stage: "intent", count: OVERDUE_COUNT },
  { stage: "dd", count: 1 },
  { stage: "audit", count: 0 },
  { stage: "closing", count: 0 },
]

function buildOverviewDb(): Database.Database {
  const db = new Database(":memory:")
  db.exec(DDL)

  db.prepare("INSERT INTO user (email, is_active) VALUES (?, 1)").run("test@example.com")
  db.prepare("INSERT INTO company (company_id, name) VALUES (1, '甲公司'), (2, '乙公司')").run()

  const insOpp = db.prepare(`
    INSERT INTO opportunity
      (opp_id, title, type, stage, owner, next_action, next_action_due, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // 1/2 在 contact，3 在 dd（到期日远在将来 → 不算本周待办）
  insOpp.run(1, "并购甲", "ma", "contact", "max", "打电话", "2020-01-01", 0)
  insOpp.run(2, "新建厂", "greenfield", "contact", "max", "发邮件", "2020-02-01", 0)
  insOpp.run(3, "并购乙", "ma", "dd", "lynn", "看财报", "2099-12-31", 0)
  // 4 已归档 → 完全不参与统计（audit 档因此应为 0）
  insOpp.run(4, "归档的审计", "ma", "audit", "max", null, "2019-01-01", 1)
  // 5 阶段值不在五档之内 → 不该让 funnel 长出第六档
  insOpp.run(5, "阶段异常", "ma", "bogus", "max", null, null, 0)
  for (let i = 0; i < OVERDUE_COUNT; i++) {
    const day = String(i + 1).padStart(2, "0")
    insOpp.run(100 + i, `逾期待办${i}`, "ma", "intent", "max", "跟进", `2019-01-${day}`, 0)
  }

  const insReport = db.prepare(`
    INSERT INTO intel_report (id, title, report_type, status, updated_at, company_id, report_md)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  for (let i = 1; i <= 7; i++) {
    const md = i === 6 ? "x".repeat(200) : `短正文${i}`
    const companyId = i === 7 ? null : i % 2 === 0 ? 1 : 2
    insReport.run(i, `报告${i}`, "company", "draft", `2026-01-0${i}`, companyId, i === 7 ? null : md)
  }

  const insResource = db.prepare("INSERT INTO resource (resource_id, kind, size_bytes) VALUES (?, ?, ?)")
  insResource.run(1, "report", 100)
  insResource.run(2, "report", 200)
  insResource.run(3, "contract", 300)
  insResource.run(4, "prospect", 400)

  return db
}

function authed(email = "test@example.com"): Request {
  return new Request("http://localhost:3000/api/overview", {
    headers: { "x-user-email": email, "x-user-role": "admin" },
  })
}

interface OverviewBody {
  kpi: { active: number; ma: number; greenfield: number; due_this_week: number }
  tasks: Array<{ opp_id: number; stage: string; next_action_due: string; overdue: number }>
  reports: Array<{ id: number; updated_at: string; company_name: string | null; excerpt: string | null }>
  funnel: Array<{ stage: string; count: number }>
  resources: { by_kind: Array<{ kind: string; n: number; bytes: number }>; total: { n: number; bytes: number } }
  week_end: string
}

describe("GET /api/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(buildOverviewDb())
  })

  it("should return 401 without authentication headers", async () => {
    const res = await GET(new Request("http://localhost:3000/api/overview"))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "unauthorized" })
  })

  it("should return exactly the six top-level keys kpi/tasks/reports/funnel/resources/week_end", async () => {
    const res = await GET(authed())
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")

    const body = (await res.json()) as OverviewBody
    expect(Object.keys(body).sort()).toEqual(["funnel", "kpi", "reports", "resources", "tasks", "week_end"])
    expect(Object.keys(body)).toHaveLength(6)
    expect(Object.keys(body.kpi).sort()).toEqual(["active", "due_this_week", "greenfield", "ma"])
  })

  it("should always return all five funnel stages, zero-filling the empty ones", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    // 只有 contact / intent / dd 有数据，audit 与 closing 必须是 0 而不是缺失
    expect(body.funnel).toEqual(FUNNEL_EXPECTED)
    expect(body.funnel.map((f) => f.stage)).toEqual(["contact", "intent", "dd", "audit", "closing"])

    // 非空转证明：GROUP BY 原生只吐出 4 档（还多一个不在五档内的 bogus），
    // 五档、顺序与那两个 0 都是查询模块补出来的，不是数据里自带的
    const db = mockGetDb.mock.results[0].value as Database.Database
    const counted = db
      .prepare("SELECT stage, COUNT(*) AS n FROM opportunity WHERE is_archived = 0 GROUP BY stage")
      .all() as Array<{ stage: string; n: number }>
    expect(counted).toHaveLength(4)
    expect(counted.map((r) => r.stage)).toContain("bogus") // 数据里有，漏斗里不该有
    expect(counted.map((r) => r.stage)).not.toContain("audit") // 归档行不参与分组

    // 归档行不进漏斗；不在五档内的 stage 也不会让 funnel 多出一档
    expect(body.funnel.find((f) => f.stage === "audit")?.count).toBe(0)
    expect(body.funnel).toHaveLength(5)
    expect(body.funnel.some((f) => (f.stage as string) === "bogus")).toBe(false)
  })

  it("should report resources.total consistent with the resource table", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    // 与表里的真实行数/字节数对齐（同一份 fixture，不是手填的常量）
    const db = mockGetDb.mock.results[0].value as Database.Database
    const real = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM resource").get() as {
      n: number
      bytes: number
    }
    expect(body.resources.total.n).toBe(real.n)
    expect(body.resources.total.bytes).toBe(real.bytes)
    expect(body.resources.total).toEqual({ n: 4, bytes: 1000 })

    // by_kind 分组与 total 自洽
    const reportKind = body.resources.by_kind.find((k) => k.kind === "report")!
    expect(reportKind).toEqual({ kind: "report", n: 2, bytes: 300 })
    expect(body.resources.by_kind.reduce((s, k) => s + k.n, 0)).toBe(body.resources.total.n)
    expect(body.resources.by_kind.reduce((s, k) => s + k.bytes, 0)).toBe(body.resources.total.bytes)
  })

  it("should compute the KPI row from non-archived opportunities", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    // 活跃 = 4 条非归档 + 12 条逾期待办 = 16；归档那条不计
    expect(body.kpi.active).toBe(4 + OVERDUE_COUNT)
    expect(body.kpi.ma).toBe(3 + OVERDUE_COUNT) // opp 1/3/5 是 ma，greenfield 只有 opp 2
    expect(body.kpi.greenfield).toBe(1)
    // 到期日 <= 本周日：opp1(2020-01-01) + opp2(2020-02-01) + 12 条逾期；
    // opp3 到期日在 2099 不算，opp5 到期日为空不算
    expect(body.kpi.due_this_week).toBe(2 + OVERDUE_COUNT)
  })

  it("should return at most 10 tasks ordered by due date and flag overdue ones", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    expect(body.tasks).toHaveLength(10)
    expect(body.tasks[0].next_action_due).toBe("2019-01-01")
    expect(body.tasks.every((t) => t.overdue === 1)).toBe(true)
    // 升序
    const dues = body.tasks.map((t) => t.next_action_due)
    expect([...dues].sort()).toEqual(dues)
    // 都在本周日之前（2099 那条被排除）
    for (const t of body.tasks) expect(t.next_action_due <= body.week_end).toBe(true)
  })

  it("should return the 5 most recent reports with a 160-char excerpt and joined company name", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    expect(body.reports).toHaveLength(5)
    expect(body.reports[0].updated_at).toBe("2026-01-07") // 最近的一条
    expect(body.reports[0].id).toBe(7)
    expect(body.reports[0].company_name).toBeNull() // LEFT JOIN 无公司
    expect(body.reports[0].excerpt).toBeNull() // report_md 为空

    const withBody = body.reports.find((r) => r.id === 6)!
    expect(withBody.excerpt).toHaveLength(160) // SUBSTR(md, 1, 160)
    expect(withBody.company_name).toBe("甲公司")

    // 只给摘要，不给整篇 report_md
    expect(body.reports.every((r) => !("report_md" in r))).toBe(true)

    // updated_at 降序
    const times = body.reports.map((r) => r.updated_at)
    expect([...times].sort().reverse()).toEqual(times)
  })

  it("should set week_end to an ISO date falling on a Sunday not before today", async () => {
    const res = await GET(authed())
    const body = (await res.json()) as OverviewBody

    expect(body.week_end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(`${body.week_end}T00:00:00`).getDay()).toBe(0) // 周日
    const today = new Date().toISOString().slice(0, 10)
    expect(body.week_end >= today).toBe(true)
  })
})
