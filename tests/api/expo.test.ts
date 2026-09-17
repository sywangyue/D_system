import { describe, it, expect, vi, beforeEach } from "vitest"
import Database from "better-sqlite3"

/**
 * GET /api/expo —— 连接扇出回归测试（TASK-F §2.5）
 *
 * 这里 mock 的是 `@/lib/db`（不是路由本身），返回的是一份**内存 sqlite**
 * （`:memory:`，绝不碰 data/mwlab.db），并把真实 schema 里本端点用到的列建出来。
 * 这样路由里的 SQL 是被真 SQLite 执行的 —— 连接扇出、MAX(year) 之类的
 * 语义问题会真实暴露，而不是被一个「假 SO 桩」掩盖过去。
 *
 * 历史 bug：`e.year = MAX(year)` 连接会让「同品牌同年两届」扇出成两行，
 * total 从 7,378 膨胀到 7,386。下面的 fixture 故意造了 8 个这样的品牌。
 */

const mockGetDb = vi.fn()

vi.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
  getWritableDb: () => mockGetDb(),
}))

import { GET } from "@/app/api/expo/route"

const DDL = `
CREATE TABLE user (
  email     TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE exhibition_brand (
  brand_id      TEXT PRIMARY KEY,
  name_cn       TEXT    NOT NULL DEFAULT '',
  name_en       TEXT    NOT NULL DEFAULT '',
  city          TEXT    NOT NULL DEFAULT '',
  industry_l1   TEXT    NOT NULL DEFAULT '',
  industry_l2   TEXT    NOT NULL DEFAULT '',
  country_cn    TEXT    NOT NULL DEFAULT '',
  display_ready INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE exhibition_edition (
  edition_id       TEXT PRIMARY KEY,
  brand_id         TEXT NOT NULL,
  year             INTEGER,
  area_sqm         INTEGER,
  exhibitors_count INTEGER,
  visitors_count   INTEGER
);
`

/** 8 个品牌在同一年（2025）有两届 —— 春秋两季。 */
const DUAL_EDITION = ["A", "B", "C", "D", "E", "F", "G", "H"]
/** 双届品牌里打「医疗健康」标签的 4 个（另 4 个是工业机械）。 */
const MEDICAL = ["A", "B", "C", "D"]
/** 各只有一届。 */
const SINGLE_EDITION = ["I", "J"]
/** display_ready = 0，不该出现在盘面上。 */
const HIDDEN = ["K", "L"]

/** 期望返回的品牌数 = display_ready=1 的品牌数 = 10。 */
const EXPECTED_TOTAL = DUAL_EDITION.length + SINGLE_EDITION.length

interface ExpoRow {
  brand_id: string
  name_cn: string
  city: string
  industry_l1: string
  year: number | null
  area_sqm: number | null
  exhibitors_count: number | null
  visitors_count: number | null
}

function buildExpoDb(): Database.Database {
  const db = new Database(":memory:")
  db.exec(DDL)

  db.prepare("INSERT INTO user (email, is_active) VALUES (?, 1)").run("test@example.com")
  db.prepare("INSERT INTO user (email, is_active) VALUES (?, 0)").run("disabled@example.com")

  const insBrand = db.prepare(`
    INSERT INTO exhibition_brand
      (brand_id, name_cn, name_en, city, industry_l1, industry_l2, country_cn, display_ready)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insEdition = db.prepare(`
    INSERT INTO exhibition_edition
      (edition_id, brand_id, year, area_sqm, exhibitors_count, visitors_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  for (const letter of DUAL_EDITION) {
    const id = `EXPO-${letter}`
    const medical = MEDICAL.includes(letter)
    insBrand.run(
      id,
      medical ? `国际医疗器械展${letter}` : `工业自动化展${letter}`,
      medical ? `Medical Expo ${letter}` : `Automation Expo ${letter}`,
      "上海",
      medical ? "医疗健康" : "工业机械",
      medical ? "医疗器械" : "工厂自动化",
      "中国",
      1,
    )
    insEdition.run(`${id}-2024-1`, id, 2024, 90000, 500, 40000)
    insEdition.run(`${id}-2025-1`, id, 2025, 100000, 600, 50000) // 春季
    insEdition.run(`${id}-2025-2`, id, 2025, 120000, 700, 60000) // 秋季（同年第二届）
  }
  for (const letter of SINGLE_EDITION) {
    const id = `EXPO-${letter}`
    insBrand.run(id, `工业博览会${letter}`, `Industry Expo ${letter}`, "北京", "工业机械", "机床", "中国", 1)
    insEdition.run(`${id}-2025-1`, id, 2025, 55000, 300, 30000)
  }
  for (const letter of HIDDEN) {
    const id = `EXPO-${letter}`
    insBrand.run(id, `未入池展会${letter}`, `Hidden Expo ${letter}`, "广州", "医疗健康", "医疗器械", "中国", 0)
    insEdition.run(`${id}-2025-1`, id, 2025, 999999, 9999, 9999999)
  }

  return db
}

/** 路由签名只要 Request；认证靠 middleware 注入的可信头。 */
function authed(url: string, email = "test@example.com", role = "admin"): Request {
  return new Request(url, { headers: { "x-user-email": email, "x-user-role": role } })
}

const BASE = "http://localhost:3000/api/expo"

describe("GET /api/expo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDb.mockReturnValue(buildExpoDb())
  })

  it("should return 401 without authentication headers", async () => {
    const res = await GET(new Request(BASE))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "unauthorized" })
  })

  it("should return 401 for a disabled (is_active=0) or unknown user", async () => {
    const disabled = await GET(authed(BASE, "disabled@example.com"))
    expect(disabled.status).toBe(401)

    const unknown = await GET(authed(BASE, "ghost@example.com"))
    expect(unknown.status).toBe(401)
  })

  it("should count display_ready=1 brands once: total is not fanned out by same-year double editions", async () => {
    const res = await GET(authed(BASE))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 8 个品牌 × 同年两届 + 2 个单届品牌 = 10，而不是 18
    expect(body.total).toBe(EXPECTED_TOTAL)

    // fixture 非空转：把它喂给历史 bug 的写法（e.year = MAX(year)）确实会扇出到 18，
    // 说明这批数据真的能抓住那个回归，而不是「怎么改都通过」。
    const db = mockGetDb.mock.results[0].value as Database.Database
    const buggy = db
      .prepare(
        `SELECT COUNT(*) AS total FROM exhibition_brand b
         LEFT JOIN exhibition_edition e
           ON e.brand_id = b.brand_id
          AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
         WHERE b.display_ready = 1`,
      )
      .get() as { total: number }
    expect(buggy.total).toBe(18)
    expect(buggy.total).not.toBe(body.total)
  })

  it("should return each brand at most once — brand_id has no duplicates in items", async () => {
    const res = await GET(authed(BASE))
    const body = (await res.json()) as { items: ExpoRow[]; total: number }

    const ids = body.items.map((r) => r.brand_id)
    expect(ids).toHaveLength(EXPECTED_TOTAL)
    expect(new Set(ids).size).toBe(ids.length) // 无重复行
    expect(ids).toHaveLength(body.total) // size 足够时 items 与 total 对齐

    // display_ready=0 的品牌不能出现（它们有 3 届、面积离谱，最好辨认）
    expect(ids).not.toContain("EXPO-K")
    expect(ids).not.toContain("EXPO-L")
    expect(body.items.some((r) => r.area_sqm === 999999)).toBe(false)
  })

  it("should pick exactly one latest edition per brand (year DESC, edition_id DESC)", async () => {
    const res = await GET(authed(BASE))
    const body = (await res.json()) as { items: ExpoRow[] }

    const a = body.items.find((r) => r.brand_id === "EXPO-A")!
    // 2025 年两届里取 edition_id 更大的秋季那届，而不是 2024 或春季
    expect(a.year).toBe(2025)
    expect(a.area_sqm).toBe(120000)
    expect(a.exhibitors_count).toBe(700)
    expect(a.visitors_count).toBe(60000)

    const single = body.items.find((r) => r.brand_id === "EXPO-I")!
    expect(single.area_sqm).toBe(55000)
  })

  it("should clamp size=9999 to 200 instead of erroring", async () => {
    const res = await GET(authed(`${BASE}?size=9999`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ExpoRow[]; size: number; page: number; total: number }
    expect(body.size).toBe(200)
    expect(body.page).toBe(1)
    expect(body.total).toBe(EXPECTED_TOTAL)
    expect(body.items).toHaveLength(EXPECTED_TOTAL)
  })

  it("should fall back to the default sort for a non-whitelisted sort value, without running injected SQL", async () => {
    const res = await GET(authed(`${BASE}?sort=${encodeURIComponent("1;DROP TABLE x")}`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ExpoRow[] }

    // 默认排序 e.area_sqm DESC
    expect(body.items[0].area_sqm).toBe(120000)
    expect(body.items[body.items.length - 1].area_sqm).toBe(55000)

    // 注入串没有被当作 SQL 执行：品牌表还在，行数没变
    const db = mockGetDb.mock.results[0].value as Database.Database
    const stillThere = db.prepare("SELECT COUNT(*) AS n FROM exhibition_brand").get() as { n: number }
    expect(stillThere.n).toBe(EXPECTED_TOTAL + HIDDEN.length)
  })

  it("should honour a whitelisted sort key and order", async () => {
    const res = await GET(authed(`${BASE}?sort=name_cn&order=asc`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ExpoRow[] }
    // sqlite 默认 BINARY 排序：国(U+56FD) < 工(U+5DE5)，博(U+535A) < 自(U+81EA)
    expect(body.items.map((r) => r.name_cn)).toEqual([
      "国际医疗器械展A",
      "国际医疗器械展B",
      "国际医疗器械展C",
      "国际医疗器械展D",
      "工业博览会I",
      "工业博览会J",
      "工业自动化展E",
      "工业自动化展F",
      "工业自动化展G",
      "工业自动化展H",
    ])
  })

  it("should report a filtered total that differs from the unfiltered total", async () => {
    const all = (await (await GET(authed(BASE))).json()) as { total: number }
    const filteredRes = await GET(authed(`${BASE}?industry_l1=${encodeURIComponent("医疗健康")}`))
    expect(filteredRes.status).toBe(200)
    const filtered = (await filteredRes.json()) as { items: ExpoRow[]; total: number }

    expect(filtered.total).toBe(MEDICAL.length) // 4，只有 display_ready=1 且打标「医疗健康」的那 4 个
    expect(filtered.total).not.toBe(all.total)
    expect(filtered.items.every((r) => r.industry_l1 === "医疗健康")).toBe(true)
  })

  it("should filter by q against name_cn / name_en", async () => {
    const res = await GET(authed(`${BASE}?q=${encodeURIComponent("医疗器械")}`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ExpoRow[]; total: number }
    expect(body.total).toBe(MEDICAL.length)
    expect(body.items).toHaveLength(MEDICAL.length)

    const latin = (await (await GET(authed(`${BASE}?q=${encodeURIComponent("Medical Expo")}`))).json()) as { total: number }
    expect(latin.total).toBe(MEDICAL.length)
  })

  it("should paginate while keeping total as the pre-pagination count", async () => {
    const res = await GET(authed(`${BASE}?page=2&size=4`))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ExpoRow[]; page: number; size: number; total: number }
    expect(body.page).toBe(2)
    expect(body.size).toBe(4)
    expect(body.items).toHaveLength(4)
    expect(body.total).toBe(EXPECTED_TOTAL)

    const page2Ids = new Set(body.items.map((r) => r.brand_id))
    const page1 = (await (await GET(authed(`${BASE}?page=1&size=4`))).json()) as { items: ExpoRow[] }
    for (const r of page1.items) expect(page2Ids.has(r.brand_id)).toBe(false) // 两页不重叠
  })
})
