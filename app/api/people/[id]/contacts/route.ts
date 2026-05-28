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
  const { brand_id, role, contact_date, notes } = body

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    const result = db.prepare(`
      INSERT INTO exhibition_contact (person_id, brand_id, role, contact_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(id), brand_id, role ?? null, contact_date ?? null, notes ?? null, userEmail)

    const rdb = getDb()
    const contact = rdb.prepare(`
      SELECT ec.*, b.name_cn, b.city, b.industry_l1
      FROM exhibition_contact ec
      JOIN exhibition_brand b ON b.brand_id = ec.brand_id
      WHERE ec.id = ?
    `).get(result.lastInsertRowid)

    return NextResponse.json(contact, { status: 201 })
  } finally {
    db.close()
  }
}
