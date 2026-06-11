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
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const timeline = db.prepare(`
    SELECT id, brand_id, event_date, event_type, title, description,
           counterpart, outcome, source_url, created_by, created_at
    FROM exhibition_timeline
    WHERE brand_id = ?
    ORDER BY event_date DESC
  `).all(id)

  // Use subquery pattern instead of UNION ORDER BY to avoid old SQLite limitations
  const relations = db.prepare(`
    SELECT * FROM (
      SELECT r.id, r.from_brand_id, r.to_brand_id, r.relation_type, r.notes,
             r.created_at as created_at,
             b.name_cn as to_name_cn, b.city as to_city, b.industry_l1 as to_industry
      FROM exhibition_relation r
      JOIN exhibition_brand b ON b.brand_id = r.to_brand_id
      WHERE r.from_brand_id = ?
      UNION ALL
      SELECT r.id, r.from_brand_id, r.to_brand_id, r.relation_type, r.notes,
             r.created_at as created_at,
             b.name_cn as to_name_cn, b.city as to_city, b.industry_l1 as to_industry
      FROM exhibition_relation r
      JOIN exhibition_brand b ON b.brand_id = r.from_brand_id
      WHERE r.to_brand_id = ?
    ) ORDER BY created_at DESC
  `).all(id, id)

  const contacts = db.prepare(`
    SELECT ec.id, ec.person_id, ec.role, ec.contact_date, ec.notes, ec.created_at,
           p.name, p.title, p.company, p.linkedin, p.email
    FROM exhibition_contact ec
    JOIN person p ON p.person_id = ec.person_id
    WHERE ec.brand_id = ?
    ORDER BY contact_date DESC
  `).all(id)

  return NextResponse.json({ brand, timeline, relations, contacts })
}
