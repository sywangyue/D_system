import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export default async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // 官网落地页（TASK-J）：公开，登录与否都显示落地页（2026-09-17 Max 定）。
  // ⚠️ 必须写成精确相等 —— 写成 startsWith('/') 等于放行全站。
  // 打上 x-mwlab-bare 标记：根布局据此不渲染后台侧栏，已登录用户看到的也是完整落地页。
  if (pathname === '/') {
    const bareHeaders = new Headers(request.headers)
    bareHeaders.set('x-mwlab-bare', '1')
    return NextResponse.next({ request: { headers: bareHeaders } })
  }

  // 完全公开路径——始终放行，不注入头部
  if (
    pathname === '/login' ||
    // 地图的陆地轮廓 GeoJSON（public/countries-110m.json）。
    // 纯静态世界地图数据、不含任何业务信息，但扩展名不在下面 matcher 的负向预查里
    // （那里只排除了图片），所以必须显式放行 —— 否则匿名访客的地图只有点位、
    // 没有陆地轮廓（TASK-J §4.4 第 1 块）。
    pathname === '/countries-110m.json' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    // 静态资源按扩展名放行 —— 但**绝不能作用于 /api/**。
    // 这个分支直接 next()、不剥离 x-user-* 头；若对 /api 生效，
    // 以 .png/.css 等结尾的接口路径（如知识库文档 /api/knowledge/<slug>/doc/平面图.png）
    // 就能带着伪造的 x-user-email / x-user-role 不登录直达接口（2026-09-17 质检实测为 200）。
    (!pathname.startsWith('/api/') &&
      pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2|woff|ttf)$/))
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

  // 页面路由：无 token → 回登录页。
  // （原先重定向到 /pitch.html，该静态页已随阶段 5 退役）
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-email')
    requestHeaders.delete('x-user-role')
    requestHeaders.delete('x-mwlab-bare')   // 只有 / 由上面打这个标记，其余页面不接受客户端传入
    requestHeaders.set('x-user-email', payload.email as string)
    requestHeaders.set('x-user-role', payload.role as string)

    // admin-only 路由守卫：/setting
    if (pathname.startsWith('/setting') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/overview', request.url))
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    // /api 单列一条、不带任何扩展名排除：下一条的负向预查会把 .png/.jpg 结尾的路径
    // 整个排除在中间件之外，而接口路径也可能以这些扩展名结尾（见上方静态资源分支的注释）。
    // 两条任一命中即运行中间件。
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
