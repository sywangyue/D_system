import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = user.email

  const db = getDb()
  const row = db.prepare(
    'SELECT dashboard_prefs FROM user WHERE email = ?'
  ).get(email) as { dashboard_prefs: string | null } | undefined

  if (!row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let l1s: string[] = []
  if (row.dashboard_prefs) {
    try {
      const parsed = JSON.parse(row.dashboard_prefs)
      l1s = Array.isArray(parsed.l1s) ? parsed.l1s : []
    } catch {}
  }

  return NextResponse.json({ l1s })
}

export async function PATCH(request: Request) {
  // 仅 requireUser：看板筛选偏好属于用户自身 UI 状态，readonly 角色也应可保存
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = user.email

  let body: { l1s?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  const l1s = Array.isArray(body.l1s) ? (body.l1s as string[]).filter(v => typeof v === 'string') : []

  const db = getWritableDb()
  try {
    db.prepare(
      'UPDATE user SET dashboard_prefs = ? WHERE email = ?'
    ).run(JSON.stringify({ l1s }), email)
    return NextResponse.json({ ok: true })
  } finally {
    db.close()
  }
}
