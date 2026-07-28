import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

export async function GET(request: Request) {
  // 1. RBAC check — requireUser 同时校验 is_active
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Query users directly from data/mwlab.db
  const db = getDb()
  const users = db.prepare(`
    SELECT user_id, email, role, is_active, last_login
    FROM user
    ORDER BY email
  `).all()

  return NextResponse.json({ users, total: (users as unknown[]).length })
}
