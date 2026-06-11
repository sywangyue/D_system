import { NextResponse, type NextRequest } from 'next/server'
import { getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const user = requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id, eventId } = await params
  if (!Number.isInteger(Number(eventId))) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const db = getWritableDb()
  try {
    const result = db.prepare(
      'DELETE FROM exhibition_timeline WHERE id = ? AND brand_id = ?'
    ).run(Number(eventId), id)

    if (result.changes === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } finally {
    db.close()
  }
}
