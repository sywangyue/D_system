import { NextResponse, type NextRequest } from 'next/server'
import { getWritableDb } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { event_type, event_date, title, description, counterpart, outcome, source_url } = body

  if (!event_type || !event_date || !title) {
    return NextResponse.json({ error: 'event_type, event_date, title are required' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    const result = db.prepare(`
      INSERT INTO exhibition_timeline
        (brand_id, event_date, event_type, title, description, counterpart, outcome, source_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, event_date, event_type, title, description ?? null, counterpart ?? null, outcome ?? null, source_url ?? null, userEmail)

    const inserted = db.prepare('SELECT * FROM exhibition_timeline WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(inserted, { status: 201 })
  } finally {
    db.close()
  }
}
