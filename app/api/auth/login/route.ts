import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { getWritableDb } from '@/lib/db'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
  }

  const db = getWritableDb()
  try {
    const user = db.prepare(
      'SELECT * FROM user WHERE email = ? AND is_active = 1'
    ).get(email) as {
      user_id: string
      email: string
      role: string
      display_name: string
      password_hash: string
    } | undefined

    // 统一 401，不泄露用户名是否存在
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    db.prepare(
      "UPDATE user SET last_login = datetime('now','localtime') WHERE user_id = ?"
    ).run(user.user_id)

    const token = await new SignJWT({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(JWT_SECRET)

    const response = NextResponse.json({
      email: user.email,
      role: user.role,
      display_name: user.display_name,
    })
    response.cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    })
    return response
  } finally {
    db.close()
  }
}
