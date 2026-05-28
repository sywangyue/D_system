import { NextResponse, type NextRequest } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const people = db.prepare(`
    SELECT p.*,
           COUNT(ec.id) as exhibition_count
    FROM person p
    LEFT JOIN exhibition_contact ec ON ec.person_id = p.person_id
    GROUP BY p.person_id
    ORDER BY p.updated_at DESC
  `).all()

  return NextResponse.json(people)
}

export async function POST(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, title, company, linkedin, email, phone, notes } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    const result = db.prepare(`
      INSERT INTO person (name, title, company, linkedin, email, phone, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      title ?? null, company ?? null, linkedin ?? null,
      email ?? null, phone ?? null, notes ?? null
    )

    const rdb = getDb()
    const person = rdb.prepare('SELECT * FROM person WHERE person_id = ?').get(result.lastInsertRowid)
    return NextResponse.json(person, { status: 201 })
  } finally {
    db.close()
  }
}
