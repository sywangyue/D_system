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

  const person = db.prepare('SELECT * FROM person WHERE person_id = ?').get(Number(id))
  if (!person) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const exhibitions = db.prepare(`
    SELECT ec.id, ec.role, ec.contact_date, ec.notes, ec.created_at,
           b.brand_id, b.name_cn, b.city, b.industry_l1, b.organizer
    FROM exhibition_contact ec
    JOIN exhibition_brand b ON b.brand_id = ec.brand_id
    WHERE ec.person_id = ?
    ORDER BY ec.contact_date DESC
  `).all(Number(id))

  const relations = db.prepare(`
    SELECT * FROM (
      SELECT cr.id, cr.relation_type, cr.notes, cr.created_at as created_at,
             p.person_id, p.name, p.title, p.company
      FROM contact_relation cr
      JOIN person p ON p.person_id = cr.to_person_id
      WHERE cr.from_person_id = ?
      UNION ALL
      SELECT cr.id, cr.relation_type, cr.notes, cr.created_at as created_at,
             p.person_id, p.name, p.title, p.company
      FROM contact_relation cr
      JOIN person p ON p.person_id = cr.from_person_id
      WHERE cr.to_person_id = ?
    ) ORDER BY created_at DESC
  `).all(Number(id), Number(id))

  return NextResponse.json({ person, exhibitions, relations })
}
