import { unstable_cache } from 'next/cache'
import { getDb } from '@/lib/db'
import { BRAND_LATEST_FROM } from '@/lib/queries/edition'
import { getExpoStats, type ExpoStats } from '@/lib/queries/expo'

/**
 * 落地页取数。**服务端专用**，且不开任何公开 `/api/*` 端点 ——
 * `/api/*` 在中间件里一律要 token，为公开页开例外等于在 API 层挖一个不需要登录的洞（V2-14 §3）。
 *
 * 缓存加在**查询函数**上，不是加在页面上：`app/page.tsx` 要读 cookie 判断登录态，
 * 页面本身必然是动态的；而十几条聚合查询的数据每月才更新两次，每次请求全跑一遍没意义（§5）。
 */

// 「最新一届」的连接条件只有一份：lib/queries/edition.ts
const FROM = BRAND_LATEST_FROM

/** 强调哪一条集团：杜塞尔多夫展览自己的那一行（§4.4 第 2 块 / §6.4）。 */
const HIGHLIGHT_ORG = '杜塞尔多夫展览'

export interface Coverage {
  brands: number
  groups: number
  editions: number
  geoTags: number
  companies: number
  verified: number
}

export interface OrgRow {
  canonical: string
  count: number
  highlight: boolean
}

/** 规模排名按**城市**汇总，不列具体品牌 —— 见 readTopCities 的说明。 */
export interface CityRow {
  city: string
  brands: number
  area: number
}

export interface MonthBucket {
  month: number
  count: number
  highlight: boolean
}

export interface No2026 {
  withCount: number
  withoutCount: number
}

export interface LandingData {
  coverage: Coverage
  organizers: OrgRow[]
  topCities: CityRow[]
  schedule: MonthBucket[]
  no2026: No2026
  /** 地图点位 + 行业分布，直接复用 H 的聚合（§4.4 第 1、3 块「复用」而不是重写一份口径） */
  expo: ExpoStats
}

/** 覆盖带六个数。全部实时算，**不在 JSX 或字典里写死任何计数**（§2）。 */
function readCoverage(db = getDb()): Coverage {
  const q = (sql: string) => (db.prepare(sql).get() as { n: number }).n
  return {
    brands: q('SELECT COUNT(*) AS n FROM exhibition_brand WHERE display_ready = 1'),
    // 去重后的集团数，不是 brand_organizer 的行数（一个品牌有多个主办方，行数是 9,740）
    groups: q('SELECT COUNT(DISTINCT canonical) AS n FROM brand_organizer'),
    editions: q('SELECT COUNT(*) AS n FROM exhibition_edition'),
    geoTags: q('SELECT COUNT(*) AS n FROM brand_geo_tag'),
    companies: q('SELECT COUNT(*) AS n FROM company'),
    verified: q('SELECT COUNT(*) AS n FROM manual_tag_history'),
  }
}

/** 按集团统计 display_ready 品牌数，前 6。 */
function readOrganizers(db = getDb()): OrgRow[] {
  const rows = db.prepare(`
    SELECT o.canonical AS canonical, COUNT(DISTINCT o.brand_id) AS n
    FROM brand_organizer o
    JOIN exhibition_brand b ON b.brand_id = o.brand_id
    WHERE o.org_type = '企业' AND b.display_ready = 1
    GROUP BY o.canonical
    ORDER BY n DESC
    LIMIT 6
  `).all() as { canonical: string; n: number }[]
  return rows.map(r => ({
    canonical: r.canonical,
    count: r.n,
    highlight: r.canonical.includes(HIGHLIGHT_ORG),
  }))
}

/**
 * 规模排名：按城市汇总，前 6（按品牌数）。
 *
 * 原规格是「按最新一届面积列品牌前 6」，2026-09-17 质检时 Max 改为按城市：
 * 库里的重复品牌还没合并完（去重复核进行中），按品牌列榜时前 6 里有 4 条古镇灯饰近似重复、
 * 广交会以「(广交会)概况」这种脏名字出现 —— 这是公开页面，不能露出来。
 * 按城市汇总不点名任何品牌；排序用品牌数而不是合计面积，因为重复记录会让面积成倍放大
 * （中山的 4 条古镇灯饰各记 150 万㎡）。去重复核完成后可改回品牌榜。
 */
function readTopCities(db = getDb()): CityRow[] {
  return db.prepare(`
    SELECT b.city AS city, COUNT(*) AS brands, COALESCE(SUM(e.area_sqm), 0) AS area
    ${FROM}
    WHERE b.display_ready = 1 AND b.city IS NOT NULL AND b.city <> ''
    GROUP BY b.city
    ORDER BY brands DESC
    LIMIT 6
  `).all() as CityRow[]
}

/** 2026 年届次按 date_start 月份计数，补齐 1–12（缺日期的届次不计，§4.4 第 5 块）。
 *  与本页其他数字同一口径：只算 display_ready 品牌的届次。 */
function readSchedule(db = getDb()): MonthBucket[] {
  const rows = db.prepare(`
    SELECT CAST(SUBSTR(e.date_start, 6, 2) AS INTEGER) AS m, COUNT(*) AS n
    FROM exhibition_edition e
    JOIN exhibition_brand b ON b.brand_id = e.brand_id AND b.display_ready = 1
    WHERE e.date_start LIKE '2026-%'
    GROUP BY m
  `).all() as { m: number; n: number }[]
  const byMonth = new Map(rows.map(r => [r.m, r.n]))
  const filled = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    count: byMonth.get(i + 1) ?? 0,
  }))
  const max = Math.max(...filled.map(f => f.count))
  // 最密的月份用强调样式；并列时都强调（不随便挑一个）
  return filled.map(f => ({ ...f, highlight: f.count === max && max > 0 }))
}

/**
 * 有 / 无 2026 及以后届次的品牌。
 * ⚠️ 标签只能写「无 2026 年届次」这种**事实描述** —— 这是公开页面，
 * 写「停办」等于对两千多个真实展会品牌下了公开判断（§2）。
 */
function readNo2026(db = getDb()): No2026 {
  const exists = `EXISTS (SELECT 1 FROM exhibition_edition x
                           WHERE x.brand_id = b.brand_id AND x.year >= 2026)`
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM exhibition_brand b WHERE b.display_ready = 1 AND ${exists}) AS w,
      (SELECT COUNT(*) FROM exhibition_brand b WHERE b.display_ready = 1 AND NOT ${exists}) AS wo
  `).get() as { w: number; wo: number }

  // 不列样例品牌：公开页上点名「某展会无 2026 年届次」，在重复记录未合并前可能是错的
  // （广交会在库里有 9 条记录，其中一条只采到 2025 年）。2026-09-17 Max 定。
  return { withCount: counts.w, withoutCount: counts.wo }
}

/** 一小时的缓存。数据每月更新两次，公开页谁都能刷，没必要每次请求跑十几条聚合。 */
export const getLandingData = unstable_cache(
  async (): Promise<LandingData> => ({
    coverage: readCoverage(),
    organizers: readOrganizers(),
    topCities: readTopCities(),
    schedule: readSchedule(),
    no2026: readNo2026(),
    expo: getExpoStats(),
  }),
  ['landing-data'],
  { revalidate: 3600, tags: ['landing'] },
)
