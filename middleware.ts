import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export default async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // 完全公开路径——始终放行，不注入头部
  if (
    pathname === '/login' ||
    pathname === '/pitch.html' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2|woff|ttf)$/)
  ) {
    return NextResponse.next()
  }

  // API 路由：无条件先剥离外部传入的 x-user-* 头，再按验签结果注入可信值
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-email')
    requestHeaders.delete('x-user-role')
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      requestHeaders.set('x-user-email', payload.email as string)
      requestHeaders.set('x-user-role', payload.role as string)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // 页面路由：无 token → 重定向到 /pitch.html（主入口）
  if (!token) {
    return NextResponse.redirect(new URL('/pitch.html', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-email')
    requestHeaders.delete('x-user-role')
    requestHeaders.set('x-user-email', payload.email as string)
    requestHeaders.set('x-user-role', payload.role as string)

    // admin-only 路由守卫：/setting
    if (pathname.startsWith('/setting') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard.html', request.url))
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
