import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

/**
 * 客户库 —— 一阶列表端点
 *
 * 二阶式：这里只给 6 个字段，全字段与四个关联块（展会品牌 / 资源 / 机会 / 报告）
 * 都留给 /api/company/[id]。
 *
 * ⚠️ company 表**没有 is_archived 列**（四张表里只有 opportunity 有），
 * 所以这里没有软删除过滤，也没有 DELETE 端点。照抄机会端点会直接
 * `no such column: is_archived`。
 */

/** 一阶字段。改这里就等于改列表页的列头。 */
const LIST_COLUMNS = `
  -- city 全表 501 行皆空（prospect_score / name_en / country 同样），列表第五列改用
  -- 法定代表人 oper_name（468/501 有值）。city 仍留在表里，采集到了再说。
  c.company_id, c.name, c.type, c.company_status, c.oper_name, c.updated_at
`

/** 排序白名单：key 是外部可传的值，value 是真实列名。
 *  绝不能把 sort 参数直接拼进 SQL。 */
const SORTABLE: Record<string, string> = {
  updated_at: 'c.updated_at',
  created_at: 'c.created_at',
  name: 'c.name',
  prospect_score: 'c.prospect_score',
}

/** 等值筛选白名单：key 是查询参数名，value 是真实列名。 */
const FILTERS: Record<string, string> = {
  type: 'c.type',
  company_status: 'c.company_status',
  source_type: 'c.source_type',
  brand_id: 'c.brand_id',
  intel_report_id: 'c.intel_report_id',
}

const SOURCE_TYPES = ['qcc_search', 'manual', 'db_match']
const CONTACT_STATUS = ['未接触', '已接触', '谈判中', '合作中', '放弃', '']

/**
 * 写字段白名单。不在表里的键静默忽略。
 *
 * `source_type` 不在这里 —— 它只在建档时定一次（见 POST），PATCH 不接受，
 * 否则一次误改就把记录的来源性质抹了。
 */
const WRITABLE = [
  'name', 'name_en', 'type', 'city', 'country', 'credit_code', 'oper_name',
  'start_date', 'company_status', 'reg_no', 'address', 'email',
  'prospect_score', 'contact_status', 'notes', 'brand_id', 'intel_report_id',
]

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  // 分页：size 上限 200，越界静默截断而不是报错
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(sp.get('size') ?? '50', 10) || 50))

  // 排序：白名单查不到就回退默认，不报错也不拼串
  const sortCol = SORTABLE[sp.get('sort') ?? ''] ?? 'c.updated_at'
  const order = sp.get('order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'

  // 筛选：全部走 ? 占位符
  const where: string[] = []
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
    where.push('(c.name LIKE ? OR c.credit_code LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  // 这张表没有 is_archived，无筛选条件时 where 会是空的 —— WHERE 子句要按有无拼
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const db = getDb()

  // total 是筛选后的总数，不是全表数 —— 同一套 WHERE 再跑一次
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM company c ${whereSql}`
  ).get(...params) as { total: number }

  const items = db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM company c
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
    return NextResponse.json({ error: "badJson" }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: "companyNameRequired" }, { status: 400 })
  }
  if (!SOURCE_TYPES.includes(body.source_type as string)) {
    return NextResponse.json(
      { error: "badSourceType", values: SOURCE_TYPES.join(" / ") },
      { status: 400 }
    )
  }
  if (body.prospect_score != null) {
    const p = Number(body.prospect_score)
    if (!Number.isInteger(p) || p < 1 || p > 5) {
      return NextResponse.json({ error: "badScore" }, { status: 400 })
    }
  }
  if (body.contact_status != null && !CONTACT_STATUS.includes(body.contact_status as string)) {
    return NextResponse.json(
      { error: "badContactStatus", values: CONTACT_STATUS.filter(Boolean).join(" / ") },
      { status: 400 }
    )
  }

  const cols = WRITABLE.filter(c => body[c] !== undefined)
  const insertCols = ['source_type', ...cols]
  const insertVals: unknown[] = [body.source_type, ...cols.map(c => body[c])]
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const wdb = getWritableDb()
  try {
    const info = wdb.prepare(`
      INSERT INTO company (${insertCols.join(', ')}, created_at, updated_at)
      VALUES (${insertCols.map(() => '?').join(', ')}, ?, ?)
    `).run(...(insertVals as never[]), now, now)

    const created = wdb.prepare(
      'SELECT * FROM company WHERE company_id = ?'
    ).get(info.lastInsertRowid)

    return NextResponse.json({ company: created }, { status: 201 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('FOREIGN KEY')) {
      return NextResponse.json({ error: "badBrand" }, { status: 400 })
    }
    if (msg.includes('CHECK')) {
      return NextResponse.json({ error: "invalidValue" }, { status: 400 })
    }
    if (msg.includes('NOT NULL')) {
      return NextResponse.json({ error: "requiredField" }, { status: 400 })
    }
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 })
    }
    throw e
  } finally {
    wdb.close()   // 不 close 会泄漏 WAL 连接
  }
}
