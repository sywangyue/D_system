import { NextResponse } from 'next/server'
import { getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'
import { localDateTime } from '@/lib/time'
import { STAGES as STAGE_DEFS, DEAL_TYPES } from '@/app/opportunity/types'
import { getOpportunityDetail } from '@/lib/queries/opportunity'

/**
 * 机会详情 —— 二阶端点（参考实现）
 *
 * 一阶只给 5 个字段，全部细节在这里一次取齐：
 * 机会全字段 + 关联公司 + 关联展会 + 关联资源 + 时间线 + 关联报告。
 *
 * GET 的六块查询走 lib/queries/opportunity.ts —— 与详情页共用一份，
 * 避免「页面一套 SQL、接口一套 SQL」改一处漏一处。
 *
 * resources 是必须带的 —— 本系统的核心是存储报告与采集资源，
 * 任何详情页都要能看到并下载该对象名下的资源。
 */

// 取值只有一处来源：app/opportunity/types.ts
const STAGES: string[] = STAGE_DEFS.map(s => s.key)

const WRITABLE = [
  'title', 'title_en', 'stage', 'deal_type', 'company_id', 'brand_id',
  'md_brand', 'priority', 'owner', 'next_action', 'next_action_due', 'detail_json',
]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const detail = getOpportunityDetail(id)
  if (!detail) return NextResponse.json({ error: 'notFound' }, { status: 404 })

  return NextResponse.json(detail)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "badJson" }, { status: 400 })
  }

  // title / stage / detail_json 是 NOT NULL 列。PATCH 只校验「传了什么」，所以显式传 null
  // 或空标题必须在这里拦下：前者会撞约束变成 500，后者会存出一条没有名字的机会（POST 不允许）。
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
    return NextResponse.json({ error: "titleRequired" }, { status: 400 })
  }
  if (body.stage !== undefined && !STAGES.includes(body.stage as string)) {
    return NextResponse.json({ error: "badStage", values: STAGES.join(" / ") }, { status: 400 })
  }
  if (body.deal_type != null && !(DEAL_TYPES as string[]).includes(body.deal_type as string)) {
    return NextResponse.json({ error: "badDealType", values: DEAL_TYPES.join(" / ") }, { status: 400 })
  }
  if (body.priority != null) {
    const p = Number(body.priority)
    if (!Number.isInteger(p) || p < 1 || p > 5) {
      return NextResponse.json({ error: "badPriority" }, { status: 400 })
    }
  }
  if (body.detail_json === null) {
    return NextResponse.json({ error: "invalidValue" }, { status: 400 })
  }
  if (body.detail_json != null && typeof body.detail_json === 'object') {
    body.detail_json = JSON.stringify(body.detail_json)
  }

  // 只更新请求体里出现的字段，缺省的不动 —— 不做整行覆盖
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  if (cols.length === 0) {
    return NextResponse.json({ error: "noFields" }, { status: 400 })
  }

  const now = localDateTime()
  const wdb = getWritableDb()
  try {
    const before = wdb.prepare('SELECT stage FROM opportunity WHERE opp_id = ?').get(id) as
      { stage: string } | undefined
    if (!before) return NextResponse.json({ error: 'notFound' }, { status: 404 })

    // 更新与阶段留痕放在同一个事务里：留痕是日后算阶段驻留天数与转化率的唯一数据来源，
    // 不能出现「阶段改了、事件没写上」的半成功状态。
    wdb.transaction(() => {
      wdb.prepare(`
        UPDATE opportunity
        SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ?
        WHERE opp_id = ?
      `).run(...cols.map(c => body[c] as never), now, id)

      if (body.stage !== undefined && body.stage !== before.stage) {
        wdb.prepare(`
          INSERT INTO opportunity_event (opp_id, event_type, content, created_by, created_at)
          VALUES (?, 'stage_change', ?, ?, ?)
        `).run(id, `${before.stage} → ${body.stage}`, user.email, now)
      }
    })()

    const updated = wdb.prepare('SELECT * FROM opportunity WHERE opp_id = ?').get(id)
    return NextResponse.json({ opportunity: updated })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('FOREIGN KEY')) {
      return NextResponse.json({ error: "badCompanyOrBrand" }, { status: 400 })
    }
    if (msg.includes('CHECK')) {
      return NextResponse.json({ error: "invalidValue" }, { status: 400 })
    }
    throw e
  } finally {
    wdb.close()
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const now = localDateTime()

  // 软删除。机会记录着尽调过程，物理删除会连带丢掉 opportunity_event 里的时间线。
  const wdb = getWritableDb()
  try {
    const info = wdb.prepare(
      'UPDATE opportunity SET is_archived = 1, updated_at = ? WHERE opp_id = ? AND is_archived = 0'
    ).run(now, id)
    if (info.changes === 0) {
      return NextResponse.json({ error: 'notFound' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, archived: Number(id) })
  } finally {
    wdb.close()
  }
}
