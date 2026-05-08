import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: Request) {
  // 1. RBAC check from middleware-injected headers
  const role = request.headers.get('x-user-role') || 'readonly'
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Query users directly from mwlab.db
  const db = getDb()
  const users = db.prepare(`
    SELECT user_id, email, role, is_active, last_login
    FROM user
    ORDER BY email
  `).all()

  return NextResponse.json({ users, total: (users as unknown[]).length })
}
