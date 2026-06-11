import { NextResponse, type NextRequest } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params

  let body: { to_brand_id?: string; relation_type?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
  const { to_brand_id, relation_type, notes } = body

  if (!to_brand_id || !relation_type) {
    return NextResponse.json({ error: 'to_brand_id and relation_type are required' }, { status: 400 })
  }
  if (to_brand_id === id) {
    return NextResponse.json({ error: 'cannot relate exhibition to itself' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    const result = db.prepare(`
      INSERT INTO exhibition_relation (from_brand_id, to_brand_id, relation_type, notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, to_brand_id, relation_type, notes ?? null, user.email)

    const rdb = getDb()
    const relation = rdb.prepare(`
      SELECT r.*, b.name_cn as to_name_cn, b.city as to_city, b.industry_l1 as to_industry
      FROM exhibition_relation r
      JOIN exhibition_brand b ON b.brand_id = r.to_brand_id
      WHERE r.id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json(relation, { status: 201 })
  } finally {
    db.close()
  }
}
