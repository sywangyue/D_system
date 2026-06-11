import { NextResponse, type NextRequest } from 'next/server'
import { getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params

  let body: { event_type?: string; event_date?: string; title?: string; description?: string; counterpart?: string; outcome?: string; source_url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
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
    `).run(id, event_date, event_type, title, description ?? null, counterpart ?? null, outcome ?? null, source_url ?? null, user.email)

    const inserted = db.prepare('SELECT * FROM exhibition_timeline WHERE id = ?').get(result.lastInsertRowid)
    return NextResponse.json(inserted, { status: 201 })
  } finally {
    db.close()
  }
}
