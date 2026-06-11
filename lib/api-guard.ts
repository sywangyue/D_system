import { type NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export interface AuthUser {
  email: string
  role: string
}

/**
 * 从 middleware 注入的请求头中提取已验证用户。
 * 同时查库校验 is_active，使被禁用用户的存量 token 即时失效。
 * 返回 null 表示未认证或已禁用，调用方应返回 401。
 */
export function requireUser(request: NextRequest): AuthUser | null {
  const email = request.headers.get('x-user-email')
  const role = request.headers.get('x-user-role')
  if (!email || !role) return null
  const db = getDb()
  const user = db.prepare('SELECT is_active FROM user WHERE email = ?').get(email) as { is_active: number } | undefined
  if (!user || user.is_active === 0) return null
  return { email, role }
}

/** readonly 角色不可执行写操作，返回 false 时调用方应返回 403。 */
export function requireWriter(user: AuthUser): boolean {
  return user.role !== 'readonly'
}
