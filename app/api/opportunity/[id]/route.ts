import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

/**
 * 机会详情 —— 二阶端点（参考实现）
 *
 * 一阶只给 5 个字段，全部细节在这里一次取齐：
 * 机会全字段 + 关联公司 + 关联展会 + 关联资源 + 时间线 + 关联报告。
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
  const db = getDb()

  const row = db.prepare('SELECT * FROM opportunity WHERE opp_id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // detail_json 存的是字符串，出口解析成对象，前端不必再 parse 一次
  let detail: unknown = {}
  try {
    detail = JSON.parse((row.detail_json as string) || '{}')
  } catch {
    detail = {}   // 脏数据不应让整个详情页 500
  }
  const opportunity = { ...row, detail_json: detail }

  const company = row.company_id
    ? db.prepare('SELECT * FROM company WHERE company_id = ?').get(row.company_id)
    : null

  const brand = row.brand_id
    ? db.prepare(`
        SELECT b.brand_id, b.name_cn, b.name_en, b.city, b.organizer,
               b.industry_l1, b.industry_l2, b.is_ufi_certified,
               e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e
          ON e.brand_id = b.brand_id
         AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
        WHERE b.brand_id = ?
      `).get(row.brand_id)
    : null

  // 资源：直接挂在本机会上的，加上挂在其关联公司上的
  const resources = db.prepare(`
    SELECT resource_id, kind, title, file_path, mime, size_bytes, collected_at, source
    FROM resource
    WHERE opp_id = ? OR (company_id IS NOT NULL AND company_id = ?)
    ORDER BY collected_at DESC
  `).all(id, row.company_id ?? -1)

  const events = db.prepare(`
    SELECT event_id, event_type, content, file_path, occurred_at, created_by, created_at
    FROM opportunity_event
    WHERE opp_id = ?
    ORDER BY created_at DESC
  `).all(id)

  const reports = db.prepare(`
    SELECT id, title, report_type, status, updated_at
    FROM intel_report
    WHERE opp_id = ? OR (company_id IS NOT NULL AND company_id = ?)
    ORDER BY updated_at DESC
  `).all(id, row.company_id ?? -1)

  return NextResponse.json({ opportunity, company, brand, resources, events, reports })
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
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  if (body.stage != null && !STAGES.includes(body.stage as string)) {
    return NextResponse.json({ error: `阶段只能是 ${STAGES.join(' / ')}` }, { status: 400 })
  }
  if (body.deal_type != null && !DEAL_TYPES.includes(body.deal_type as string)) {
    return NextResponse.json({ error: `交易形式只能是 ${DEAL_TYPES.join(' / ')}` }, { status: 400 })
  }
  if (body.priority != null) {
    const p = Number(body.priority)
    if (!Number.isInteger(p) || p < 1 || p > 5) {
      return NextResponse.json({ error: '优先级需为 1–5 的整数' }, { status: 400 })
    }
  }
  if (body.detail_json != null && typeof body.detail_json === 'object') {
    body.detail_json = JSON.stringify(body.detail_json)
  }

  // 只更新请求体里出现的字段，缺省的不动 —— 不做整行覆盖
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  if (cols.length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
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
      return NextResponse.json({ error: '关联的公司或展会品牌不存在' }, { status: 400 })
    }
    if (msg.includes('CHECK')) {
      return NextResponse.json({ error: '字段取值不符合约束' }, { status: 400 })
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
