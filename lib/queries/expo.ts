import { getDb } from '@/lib/db'
import { resolvePoint, type GeoPoint } from '@/lib/geo'

/**
 * 展会底图的三个聚合。被 /api/expo/stats、/api/expo/calendar 与 app/expo/page.tsx 共用 ——
 * 服务端壳直接调它拿首屏（§6.2），客户端只在筛选变化/翻月时打接口。
 *
 * 口径与 /api/expo 完全一致（§3）：只统计 display_ready=1，每个品牌只取**最新一届**，
 * 且「最新一届」必须锁定到单行（有 8 个品牌同一年办两届，用 year = MAX(year) 会扇出重复计数）。
 * 下面的 FROM 与 app/api/expo/route.ts 的 FROM 是同一段逻辑，改一处要改两处。
 */

/** 品牌 → 最新一届。COUNT 与 SELECT 必须是同一个 FROM。 */
const FROM = `
  FROM exhibition_brand b
  LEFT JOIN exhibition_edition e
    ON e.brand_id = b.brand_id
   AND e.edition_id = (SELECT edition_id FROM exhibition_edition
                       WHERE brand_id = b.brand_id
                       ORDER BY year DESC, edition_id DESC LIMIT 1)
`

/** 规模四档。既是筛选的取值，也是小图的档位顺序。
 *  客户端只能传 key（lt1w / 1w-5w / 5w-10w / gte10w），区间由服务端映射 ——
 *  不接受客户端传数字区间（§5）。 */
export const SCALE_BUCKETS = [
  { key: 'lt1w',   min: 0,      max: 10_000 },
  { key: '1w-5w',  min: 10_000, max: 50_000 },
  { key: '5w-10w', min: 50_000, max: 100_000 },
  { key: 'gte10w', min: 100_000, max: Number.MAX_SAFE_INTEGER },
] as const

export type ScaleKey = (typeof SCALE_BUCKETS)[number]['key']

/** SQL 里的分档表达式。面积为空的行**不进任何一档**（它既不是小展也不是大展），
 *  所以小图各档之和 ≤ 品牌数；大数字下方那行「N 个品牌」给的是品牌数，两处口径不同但都真实。 */
const SCALE_CASE = `
  CASE WHEN e.area_sqm IS NULL THEN NULL
       WHEN e.area_sqm < 10000  THEN 'lt1w'
       WHEN e.area_sqm < 50000  THEN '1w-5w'
       WHEN e.area_sqm < 100000 THEN '5w-10w'
       ELSE 'gte10w' END
`

export interface ExpoFilters {
  /** 行业一级，多选 */
  industry_l1?: string[]
  /** 国内城市（城市筛选与地图点位共用这一个参数） */
  city?: string
  /** 海外国家 */
  country_cn?: string
  /** 规模档位 key */
  scale?: string
}

/** 把筛选条件编成 WHERE 片段 + 绑定参数。全部走 ? 占位符，值一律不拼串。 */
function buildWhere(f: ExpoFilters): { sql: string; params: unknown[] } {
  const where: string[] = ['b.display_ready = 1']
  const params: unknown[] = []

  const l1s = (f.industry_l1 ?? []).filter(Boolean)
  if (l1s.length) {
    where.push(`b.industry_l1 IN (${l1s.map(() => '?').join(', ')})`)
    params.push(...l1s)
  }
  if (f.city) { where.push('b.city = ?'); params.push(f.city) }
  if (f.country_cn) { where.push('b.country_cn = ?'); params.push(f.country_cn) }

  // 规模档位只认 key，区间在服务端查表
  const bucket = SCALE_BUCKETS.find(b => b.key === f.scale)
  if (bucket) {
    where.push('e.area_sqm >= ? AND e.area_sqm < ?')
    params.push(bucket.min, bucket.max)
  }

  return { sql: `WHERE ${where.join(' AND ')}`, params }
}

export interface MapPoint extends GeoPoint { count: number }

export interface ExpoStats {
  points: MapPoint[]
  /** 查不到坐标的品牌数 —— 地图角落要显示，不许静默丢（§4.1） */
  unlocated: number
  totals: { brands: number; visitors: number; area: number; exhibitors: number }
  scale: { key: string; count: number }[]
  industry: { key: string; count: number }[]
}

/**
 * 地图点位 + 四宫格。一次调用拿齐，因为两者跟随同一套筛选。
 * 地图**在 SQL 里聚合**（GROUP BY 城市/国家），约 120 个点，
 * 不是把 7,378 行拉到前端再分组（§6.1）。
 */
export function getExpoStats(f: ExpoFilters = {}): ExpoStats {
  const db = getDb()
  const { sql: whereSql, params } = buildWhere(f)

  // ── 地图：按 (国家, 城市) 聚合。海外的 city 是「日本东京」这种拼接写法，
  //    所以海外靠 country_cn 落点，这里先把两种粒度一起取出来再在 TS 里归一。
  const grouped = db.prepare(`
    SELECT b.country_cn, b.city, COUNT(*) AS count
    ${FROM}
    ${whereSql}
    GROUP BY b.country_cn, b.city
  `).all(...params) as { country_cn: string | null; city: string | null; count: number }[]

  const byPoint = new Map<string, MapPoint>()
  let unlocated = 0
  for (const g of grouped) {
    const hit = resolvePoint(g)
    if (!hit) { unlocated += g.count; continue }
    const key = `${hit.lon},${hit.lat}`
    const prev = byPoint.get(key)
    if (prev) prev.count += g.count
    else byPoint.set(key, { ...hit, count: g.count })
  }
  const points = [...byPoint.values()].sort((a, b) => b.count - a.count)

  // ── 四宫格大数字。数字为空不计入求和，但仍计入品牌数（SUM 天然忽略 NULL）。
  const totals = db.prepare(`
    SELECT COUNT(*) AS brands,
           COALESCE(SUM(e.visitors_count), 0) AS visitors,
           COALESCE(SUM(e.area_sqm), 0)       AS area,
           COALESCE(SUM(e.exhibitors_count), 0) AS exhibitors
    ${FROM}
    ${whereSql}
  `).get(...params) as { brands: number; visitors: number; area: number; exhibitors: number }

  // ── 规模四档：SQL 里分档，缺的档在 TS 里补 0（三块小图共用这一份数据）
  const countedScale = db.prepare(`
    SELECT ${SCALE_CASE} AS bucket, COUNT(*) AS count
    ${FROM}
    ${whereSql}
    GROUP BY bucket
  `).all(...params) as { bucket: string | null; count: number }[]
  const scaleMap = Object.fromEntries(countedScale.filter(r => r.bucket).map(r => [r.bucket, r.count]))
  const scale = SCALE_BUCKETS.map(b => ({ key: b.key, count: scaleMap[b.key] ?? 0 }))

  // ── 行业分布：8 个标签的数据来自这里，中文/英文名由页面对字典取。
  //    行业为空的品牌不计入（否则会出现一个空标签的段）。
  const industry = db.prepare(`
    SELECT b.industry_l1 AS key, COUNT(*) AS count
    ${FROM}
    ${whereSql} AND b.industry_l1 IS NOT NULL AND b.industry_l1 <> ''
    GROUP BY b.industry_l1
    ORDER BY count DESC
  `).all(...params) as { key: string; count: number }[]

  return { points, unlocated, totals, scale, industry }
}

/**
 * 「今天」按**本地时间**算好再往下传（§6.3）。
 * 库里存的就是本地时间无时区；客户端自己算会在跨日时与服务端不一致，报 hydration 警告。
 */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** 当月，'YYYY-MM'。 */
export function currentMonth(now: Date = new Date()): string {
  return localToday(now).slice(0, 7)
}

export interface CalendarItem {
  kind: 'meeting' | 'next_action'
  opp_id: number
  title: string
  text: string
  /** 'HH:MM'，库里没带时间就是 null */
  time: string | null
  overdue: boolean
}

export interface CalendarDay {
  /** 'YYYY-MM-DD' */
  date: string
  items: CalendarItem[]
}

/**
 * 我的行动日历。事项只来自机会台，**不受展会筛选影响**（§4.2）。
 *
 * - `opportunity_event` 里 event_type='meeting' 且有日期、所属机会未归档的 → 落在 occurred_at 那天
 * - `opportunity.next_action_due`（未归档）→ 落在那天，逾期用红色
 *
 * ⚠️ occurred_at 库里可能是 NULL 也可能是 ''，两种都当「没有日期」（G-2 踩过）；
 *    格式也不统一（'2026-09-20 14:00' 或只有日期），所以统一 substr(...,1,10) 取日期。
 * ⚠️ today 由服务端算好传进来（§6.3）：客户端算会在跨日时与服务端不一致，报 hydration 警告。
 */
export function getExpoCalendar(month: string, today: string): CalendarDay[] {
  const db = getDb()

  const events = db.prepare(`
    SELECT e.opp_id, o.title, e.content, e.occurred_at
    FROM opportunity_event e
    JOIN opportunity o ON o.opp_id = e.opp_id
    WHERE e.event_type = 'meeting'
      AND o.is_archived = 0
      AND e.occurred_at IS NOT NULL AND e.occurred_at <> ''
      AND substr(e.occurred_at, 1, 7) = ?
    ORDER BY e.occurred_at ASC
  `).all(month) as { opp_id: number; title: string; content: string | null; occurred_at: string }[]

  const actions = db.prepare(`
    SELECT opp_id, title, next_action, next_action_due
    FROM opportunity
    WHERE is_archived = 0
      AND next_action_due IS NOT NULL AND next_action_due <> ''
      AND substr(next_action_due, 1, 7) = ?
    ORDER BY next_action_due ASC
  `).all(month) as { opp_id: number; title: string; next_action: string | null; next_action_due: string }[]

  const byDate = new Map<string, CalendarItem[]>()
  const push = (date: string, item: CalendarItem) => {
    const list = byDate.get(date)
    if (list) list.push(item)
    else byDate.set(date, [item])
  }

  for (const e of events) {
    push(e.occurred_at.slice(0, 10), {
      kind: 'meeting', opp_id: e.opp_id, title: e.title,
      text: e.content ?? '',
      // 时间部分有就显示、没有不显示
      time: e.occurred_at.length > 10 ? e.occurred_at.slice(11, 16) : null,
      overdue: false,
    })
  }
  for (const a of actions) {
    const date = a.next_action_due.slice(0, 10)
    push(date, {
      kind: 'next_action', opp_id: a.opp_id, title: a.title,
      text: a.next_action ?? '',
      time: null,
      overdue: date < today,
    })
  }

  return [...byDate.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([date, items]) => ({ date, items }))
}
