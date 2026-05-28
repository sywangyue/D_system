import { NextResponse, type NextRequest } from 'next/server'
import { getWritableDb } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, eventId } = await params
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
