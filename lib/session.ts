import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { getDb } from '@/lib/db'

/**
 * 登录态的唯一真源。
 *
 * 此前有两套并存：客户端页面读 localStorage.mwlab_auth，中间件验 session cookie。
 * 两者会不同步 —— 实测出现过「前端以为已登录、所有接口 401」的状态。
 * 现在只保留 cookie：服务端组件在这里读，一路 props 往下传，
 * 客户端不再自己判断登录与否。lib/auth.ts 已删除。
 */

export interface SessionUser {
  email: string
  role: string
  display_name: string
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

/** 服务端组件专用。未登录、token 失效、账号被禁用一律返回 null。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get('session')?.value
  if (!token) return null

  let email: string
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    email = payload.email as string
    if (!email) return null
  } catch {
    return null
  }

  // 查库拿 display_name，同时校验 is_active ——
  // 让被禁用账号的存量 token 立即失效，不必等 token 过期
  const row = getDb().prepare(
    'SELECT email, role, display_name, is_active FROM user WHERE email = ?'
  ).get(email) as { email: string; role: string; display_name: string; is_active: number } | undefined

  if (!row || row.is_active === 0) return null
  return { email: row.email, role: row.role, display_name: row.display_name }
}
