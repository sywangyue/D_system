import { NextResponse } from 'next/server'
import { TAG_FIELDS } from '@/lib/types'
import { getWritableDb } from '@/lib/db'

const INT_FIELDS = new Set(['strategic_relevance', 'ma_potential'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const role = request.headers.get('x-user-role') || 'readonly'
  const userEmail = request.headers.get('x-user-email') || ''

  if (role === 'readonly') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const entries = Object.entries(body).filter(([, v]) => v !== undefined && v !== null)
  const invalidFields = entries
    .filter(([k]) => !(TAG_FIELDS as readonly string[]).includes(k))
    .map(([k]) => k)

  if (invalidFields.length > 0) {
    return NextResponse.json(
      { error: `不可打标字段: ${invalidFields.join(', ')}` },
      { status: 422 },
    )
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No valid tag fields provided' }, { status: 400 })
  }

  const [fieldName, rawValue] = entries[0]
  const newValue = INT_FIELDS.has(fieldName) ? Number(rawValue) : String(rawValue)

  const db = getWritableDb()
  try {
    const brand = db.prepare(
      'SELECT * FROM exhibition_brand WHERE brand_id = ?'
    ).get(id) as Record<string, unknown> | undefined

    if (!brand) {
      return NextResponse.json({ error: `品牌不存在: ${id}` }, { status: 404 })
    }

    const oldValue = String(brand[fieldName] ?? '')

    db.prepare(
      `UPDATE exhibition_brand SET ${fieldName} = ?, updated_at = datetime('now','localtime') WHERE brand_id = ?`
    ).run(newValue, id)

    db.prepare(
      `INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, reason)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, fieldName, oldValue, String(newValue), userEmail, '')

    return NextResponse.json({
      brand_id: id,
      field_name: fieldName,
      old_value: oldValue,
      new_value: String(newValue),
      changed_by: userEmail,
    })
  } finally {
    db.close()
  }
}
