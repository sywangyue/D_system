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
  const { to_person_id, relation_type, notes } = body

  if (!to_person_id) {
    return NextResponse.json({ error: 'to_person_id is required' }, { status: 400 })
  }
  if (Number(to_person_id) === Number(id)) {
    return NextResponse.json({ error: 'cannot relate person to themselves' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    db.prepare(`
      INSERT INTO contact_relation (from_person_id, to_person_id, relation_type, notes)
      VALUES (?, ?, ?, ?)
    `).run(Number(id), Number(to_person_id), relation_type ?? null, notes ?? null)

    const rdb = getDb()
    const relation = rdb.prepare(`
      SELECT cr.*, p.name, p.title, p.company
      FROM contact_relation cr
      JOIN person p ON p.person_id = cr.to_person_id
      WHERE cr.from_person_id = ? AND cr.to_person_id = ?
    `).get(Number(id), Number(to_person_id))

    return NextResponse.json(relation, { status: 201 })
  } finally {
    db.close()
  }
}
