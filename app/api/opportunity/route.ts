import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

/**
 * 机会台 —— 一阶列表端点（参考实现，其余资源照此套）
 *
 * 二阶式：这里只给 5 个字段，其余全部留给 /api/opportunity/[id]。
 * 分页与筛选一律在 SQL 里做，不把全表丢给前端过滤。
 */

/** 一阶字段。改这里就等于改列表页的列头。 */
const LIST_COLUMNS = `
  o.opp_id, o.title, o.type, o.stage, o.owner, o.updated_at
`

/** 排序白名单：key 是外部可传的值，value 是真实列名。
 *  绝不能把 sort 参数直接拼进 SQL。 */
const SORTABLE: Record<string, string> = {
  updated_at: 'o.updated_at',
  created_at: 'o.created_at',
  title: 'o.title',
  stage: 'o.stage',
  priority: 'o.priority',
  due: 'o.next_action_due',
}

/** 等值筛选白名单：key 是查询参数名，value 是真实列名。 */
const FILTERS: Record<string, string> = {
  type: 'o.type',
  stage: 'o.stage',
  owner: 'o.owner',
  priority: 'o.priority',
  company_id: 'o.company_id',
}

const TYPES = ['ma', 'greenfield', 'project_support']
const STAGES = ['contact', 'intent', 'dd', 'audit', 'closing']
const DEAL_TYPES = ['收购', '并购', '参股', '承办', '孵化']

/** POST 接受的字段白名单。不在表里的键静默忽略。 */
const WRITABLE = [
  'type', 'title', 'title_en', 'stage', 'deal_type', 'company_id', 'brand_id',
  'md_brand', 'priority', 'owner', 'next_action', 'next_action_due', 'detail_json',
]

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  // 分页：size 上限 200，越界静默截断而不是报错
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(sp.get('size') ?? '50', 10) || 50))

  // 排序：白名单查不到就回退默认，不报错也不拼串
  const sortCol = SORTABLE[sp.get('sort') ?? ''] ?? 'o.updated_at'
  const order = sp.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  // 筛选：全部走 ? 占位符
  const where: string[] = ['o.is_archived = 0']
  const params: unknown[] = []
  for (const [param, col] of Object.entries(FILTERS)) {
    const v = sp.get(param)
    if (v !== null && v !== '') {
      where.push(`${col} = ?`)
      params.push(v)
    }
  }
  const q = sp.get('q')?.trim()
  if (q) {
    where.push('(o.title LIKE ? OR o.md_brand LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  const db = getDb()

  // total 是筛选后的总数，不是全表数 —— 同一套 WHERE 再跑一次
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM opportunity o ${whereSql}`
  ).get(...params) as { total: number }

  const items = db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM opportunity o
    ${whereSql}
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, size, (page - 1) * size)

  return NextResponse.json({ items, page, size, total })
}

export async function POST(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!requireWriter(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: '机会名称必填' }, { status: 400 })
  }
  if (!TYPES.includes(body.type as string)) {
    return NextResponse.json({ error: `业务线只能是 ${TYPES.join(' / ')}` }, { status: 400 })
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

  // detail_json 允许传对象或字符串，统一存成字符串
  if (body.detail_json != null && typeof body.detail_json === 'object') {
    body.detail_json = JSON.stringify(body.detail_json)
  }

  const cols = WRITABLE.filter(c => body[c] !== undefined)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const wdb = getWritableDb()
  try {
    const info = wdb.prepare(`
      INSERT INTO opportunity (${cols.join(', ')}, created_by, created_at, updated_at)
      VALUES (${cols.map(() => '?').join(', ')}, ?, ?, ?)
    `).run(...cols.map(c => body[c] as never), user.email, now, now)

    const created = wdb.prepare(
      'SELECT * FROM opportunity WHERE opp_id = ?'
    ).get(info.lastInsertRowid)

    return NextResponse.json({ opportunity: created }, { status: 201 })
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
    wdb.close()   // 不 close 会泄漏 WAL 连接
  }
}
