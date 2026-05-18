import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'mwlab-dev-secret-2026'
)

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // 完全公开路径——始终放行，不注入头部
  if (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // API 路由：有 token 则注入用户信息，无 token 则放行（返回 401 由 handler 处理）
  if (pathname.startsWith('/api/')) {
    if (!token) return NextResponse.next()
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-email', payload.email as string)
      requestHeaders.set('x-user-role', payload.role as string)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      return NextResponse.next()
    }
  }

  // 页面路由：无 token → 重定向到 /login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    const requestHeaders = new Headers(request.headers)
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
