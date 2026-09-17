import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

/**
 * 展会盘面 —— 一阶列表端点（**只读**）
 *
 * 取代旧看板那个「一次吐回全部品牌、由前端过滤」的端点（已随本任务删除，见 TASK-I §4）。
 * 这里把分页、筛选、排序全部压进 SQL，只给 9 个字段。
 *
 * 每个品牌只取**最新一届**的届次数据（MAX(year)），下面 areas/展商/观众三个数字
 * 都是那一届的。
 */

/** 一阶字段。展会品牌 + 最新一届的数字。 */
const LIST_COLUMNS = `
  b.brand_id, b.name_cn, b.name_en, b.city, b.industry_l1,
  e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
`

/** 品牌 → 最新一届届次的连接条件。COUNT 与 SELECT 必须是同一个 FROM。 */
const FROM = `
  FROM exhibition_brand b
  LEFT JOIN exhibition_edition e
    ON e.brand_id = b.brand_id
   -- 取「最新一届」必须锁定到单行：有 8 个品牌在同一年有两届（春秋两季那种），
   -- 用 e.year = MAX(year) 会让 LEFT JOIN 扇出，列表里重复出现、total 也多算。
   AND e.edition_id = (SELECT edition_id FROM exhibition_edition
                       WHERE brand_id = b.brand_id
                       ORDER BY year DESC, edition_id DESC LIMIT 1)
`

/** 排序白名单：key 是外部可传的值，value 是真实列名。
 *  绝不能把 sort 参数直接拼进 SQL。 */
const SORTABLE: Record<string, string> = {
  area_sqm: 'e.area_sqm',
  exhibitors_count: 'e.exhibitors_count',
  visitors_count: 'e.visitors_count',
  name_cn: 'b.name_cn',
  year: 'e.year',
}

/** 等值筛选白名单：key 是查询参数名，value 是真实列名。 */
const FILTERS: Record<string, string> = {
  industry_l1: 'b.industry_l1',
  industry_l2: 'b.industry_l2',
  city: 'b.city',
  country_cn: 'b.country_cn',
}

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  // 分页：size 上限 200，越界静默截断而不是报错
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(sp.get('size') ?? '50', 10) || 50))

  // 排序：白名单查不到就回退默认，不报错也不拼串
  const sortCol = SORTABLE[sp.get('sort') ?? ''] ?? 'e.area_sqm'
  const order = sp.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  // 只有进了展示池的品牌才出现在盘面上
  const where: string[] = ['b.display_ready = 1']
  const params: unknown[] = []
  for (const [param, col] of Object.entries(FILTERS)) {
    const v = sp.get(param)
    if (v !== null && v !== '') {
      where.push(`${col} = ?`)
      params.push(v)
    }
  }
  const q = sp.get('q')?.trim()
  if (q) {
    where.push('(b.name_cn LIKE ? OR b.name_en LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  const db = getDb()

  // total 是筛选后的总数，不是全表数 —— 同一套 FROM/WHERE 再跑一次
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total ${FROM} ${whereSql}`
  ).get(...params) as { total: number }

  const items = db.prepare(`
    SELECT ${LIST_COLUMNS}
    ${FROM}
    ${whereSql}
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, size, (page - 1) * size)

  return NextResponse.json({ items, page, size, total })
}
