import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireUser(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const db = getDb()

  const brand = db.prepare(`
    SELECT b.*,
           e.year, e.date_start, e.date_end, e.venue, e.area_sqm,
           e.exhibitors_count, e.visitors_count, e.heat_score, e.yoy_trend, e.status as edition_status
    FROM exhibition_brand b
    LEFT JOIN exhibition_edition e
      ON e.brand_id = b.brand_id
     AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
    WHERE b.brand_id = ?
  `).get(id)

  if (!brand) {
    return NextResponse.json({ error: 'notFound' }, { status: 404 })
  }

  // 014 迁移删除了 exhibition_timeline / exhibition_relation /
  // exhibition_contact / person 四张零行空表，对应的时间线、展会关系、
  // 相关人员三个区块已从前端移除。机会维度的时间线由 opportunity_event 承载。
  return NextResponse.json({ brand })
}
