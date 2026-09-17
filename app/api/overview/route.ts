import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getOverview } from '@/lib/queries/overview'

/**
 * 盘面聚合端点。查询主体在 lib/queries/overview.ts，
 * 与服务端组件 app/overview/page.tsx 共用同一份，避免口径漂移。
 */
export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(getOverview())
}
