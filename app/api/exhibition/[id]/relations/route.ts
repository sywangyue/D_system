import { NextResponse, type NextRequest } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { to_brand_id, relation_type, notes } = body

  if (!to_brand_id || !relation_type) {
    return NextResponse.json({ error: 'to_brand_id and relation_type are required' }, { status: 400 })
  }
  if (to_brand_id === id) {
    return NextResponse.json({ error: 'cannot relate exhibition to itself' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    db.prepare(`
      INSERT INTO exhibition_relation (from_brand_id, to_brand_id, relation_type, notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, to_brand_id, relation_type, notes ?? null, userEmail)

    const rdb = getDb()
    const relation = rdb.prepare(`
      SELECT r.*, b.name_cn as to_name_cn, b.city as to_city, b.industry_l1 as to_industry
      FROM exhibition_relation r
      JOIN exhibition_brand b ON b.brand_id = r.to_brand_id
      WHERE r.from_brand_id = ? AND r.to_brand_id = ? AND r.relation_type = ?
    `).get(id, to_brand_id, relation_type)

    return NextResponse.json(relation, { status: 201 })
  } finally {
    db.close()
  }
}
