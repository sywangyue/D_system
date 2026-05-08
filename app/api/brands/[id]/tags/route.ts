import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // 1. RBAC check from middleware-injected headers
  const role = request.headers.get('x-user-role') || 'readonly'
  const userEmail = request.headers.get('x-user-email') || ''

  if (role === 'readonly') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Validate only allowed tag fields
  const TAG_FIELDS = [
    'competition_relation',
    'mds_related',
    'strategic_relevance',
    'ma_potential',
    'competitor_group',
    'industry_l1',
    'industry_l2',
    'notes',
  ]

  const entries = Object.entries(body).filter(
    ([, v]) => v !== undefined && v !== null,
  )
  const invalidFields = entries
    .filter(([k]) => !TAG_FIELDS.includes(k))
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

  // 4. Proxy to FastAPI tag_api.py
  const fastapiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'
  const tagPayload = {
    field_name: entries[0][0],
    new_value: entries[0][1],
    changed_by: userEmail,
  }

  try {
    const res = await fetch(`${fastapiUrl}/api/brands/${id}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagPayload),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: '打标服务暂不可用' },
      { status: 503 },
    )
  }
}
