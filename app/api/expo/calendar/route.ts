import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getExpoCalendar, currentMonth, localToday } from '@/lib/queries/expo'

/**
 * 我的行动日历 —— 事项来自机会台（opportunity_event 的会议 + opportunity 的下一步），
 * **不受展会筛选影响**（§4.2）。
 *
 * month 必须是 'YYYY-MM'；不合法回 badRequest（E-2 的错误码），由前端查字典显示。
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const month = (sp.get('month') ?? currentMonth()).trim()

  if (!MONTH_RE.test(month)) {
    // 注意别 echo 客户端传来的 month —— 它已经证明是不可信输入
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  const today = localToday()
  return NextResponse.json({ month, today, days: getExpoCalendar(month, today) })
}
