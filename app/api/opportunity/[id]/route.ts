import { NextResponse } from 'next/server'
import { getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'
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

const STAGES = ['contact', 'intent', 'dd', 'audit', 'closing']
const DEAL_TYPES = ['收购', '并购', '参股', '承办', '孵化']

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
  if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 })

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

  if (body.stage != null && !STAGES.includes(body.stage as string)) {
    return NextResponse.json({ error: "badStage", values: STAGES.join(" / ") }, { status: 400 })
  }
  if (body.deal_type != null && !DEAL_TYPES.includes(body.deal_type as string)) {
    return NextResponse.json({ error: "badDealType", values: DEAL_TYPES.join(" / ") }, { status: 400 })
  }
  if (body.priority != null) {
    const p = Number(body.priority)
    if (!Number.isInteger(p) || p < 1 || p > 5) {
      return NextResponse.json({ error: "badPriority" }, { status: 400 })
    }
  }
  if (body.detail_json != null && typeof body.detail_json === 'object') {
    body.detail_json = JSON.stringify(body.detail_json)
  }

  // 只更新请求体里出现的字段，缺省的不动 —— 不做整行覆盖
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  if (cols.length === 0) {
    return NextResponse.json({ error: "noFields" }, { status: 400 })
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const wdb = getWritableDb()
  try {
    const before = wdb.prepare('SELECT stage FROM opportunity WHERE opp_id = ?').get(id) as
      { stage: string } | undefined
    if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 })

    wdb.prepare(`
      UPDATE opportunity
      SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ?
      WHERE opp_id = ?
    `).run(...cols.map(c => body[c] as never), now, id)

    // 阶段变更留痕 —— 这是日后算阶段驻留天数与转化率的唯一数据来源
    if (body.stage != null && body.stage !== before.stage) {
      wdb.prepare(`
        INSERT INTO opportunity_event (opp_id, event_type, content, created_by, created_at)
        VALUES (?, 'stage_change', ?, ?, ?)
      `).run(id, `${before.stage} → ${body.stage}`, user.email, now)
    }

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
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  // 软删除。机会记录着尽调过程，物理删除会连带丢掉 opportunity_event 里的时间线。
  const wdb = getWritableDb()
  try {
    const info = wdb.prepare(
      'UPDATE opportunity SET is_archived = 1, updated_at = ? WHERE opp_id = ? AND is_archived = 0'
    ).run(now, id)
    if (info.changes === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, archived: Number(id) })
  } finally {
    wdb.close()
  }
}
