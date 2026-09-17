import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'
import { localDateTime } from '@/lib/time'
import { REPORT_TYPE, REPORT_STATUS } from '@/lib/enums'

/**
 * 调研报告（intel_report）—— 一阶列表端点
 *
 * 二阶式在这里最要紧：report_md 可以是几万字、params_json 是整包输入参数，
 * 两个都**绝不能**进列表。列表只给 6 个字段 + 160 字的摘要片段，
 * 全文留给 /api/research/[id]。
 *
 * ⚠️ 这张表的主键是裸 `id`，不是 opp_id / company_id / resource_id。
 * ⚠️ 这张表没有 is_archived，所以没有软删除过滤，也没有 DELETE 端点。
 */

/**
 * 一阶字段。excerpt 是 SUBSTR 出来的片段，不是整列。
 *
 * company_name 是解析后的公司名（V2-08 §3.1 的列表要「关联公司」这一列）。
 * 为什么不是 target_company：014 把 intel_report 扶正为公司尽调的落库主体时
 * 定了方向 ——「target_company 是自由文本，保留可回溯性，但**新数据一律写
 * company_id**」（见 schema/migrations/014_rebuild.sql §3）。实测库里
 * target_company 只有 1 条非空、company_id 有 9 条，所以列要展示的是公司名。
 * 仍 COALESCE 回 target_company 兜住重构前的老行。
 */
const LIST_COLUMNS = `
  r.id, r.title, r.report_type, r.status, r.company_id, r.updated_at,
  SUBSTR(r.report_md, 1, 160) AS excerpt,
  COALESCE(c.name, r.target_company) AS company_name
`

/** 排序白名单：key 是外部可传的值，value 是真实列名。
 *  绝不能把 sort 参数直接拼进 SQL。 */
const SORTABLE: Record<string, string> = {
  updated_at: 'r.updated_at',
  created_at: 'r.created_at',
  report_type: 'r.report_type',
}

/** 等值筛选白名单：key 是查询参数名，value 是真实列名。 */
const FILTERS: Record<string, string> = {
  report_type: 'r.report_type',
  status: 'r.status',
  company_id: 'r.company_id',
  brand_id: 'r.brand_id',
  industry_l1: 'r.industry_l1',
  opp_id: 'r.opp_id',
}

// 取值只有一处来源：lib/enums.ts（与 intel_report.report_type / status 的 CHECK 约束一致）
const REPORT_TYPES = REPORT_TYPE.map(o => o.value)
const STATUSES = REPORT_STATUS.map(o => o.value)

/** 写字段白名单。不在表里的键静默忽略。 */
const WRITABLE = [
  'title', 'report_type', 'status', 'report_md', 'report_file',
  'params_json', 'company_id', 'brand_id', 'opp_id',
  'industry_l1', 'industry_l2', 'target_company',
]

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  // 分页：size 上限 200，越界静默截断而不是报错
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(sp.get('size') ?? '50', 10) || 50))

  // 排序：白名单查不到就回退默认，不报错也不拼串
  const sortCol = SORTABLE[sp.get('sort') ?? ''] ?? 'r.updated_at'
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
    where.push('(r.title LIKE ? OR r.target_company LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  // 这张表没有 is_archived，无筛选条件时 where 会是空的 —— WHERE 子句要按有无拼
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const db = getDb()

  // total 是筛选后的总数，不是全表数 —— 同一套 WHERE 再跑一次
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM intel_report r ${whereSql}`
  ).get(...params) as { total: number }

  const items = db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM intel_report r
    LEFT JOIN company c ON c.company_id = r.company_id
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

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: "reportTitleRequired" }, { status: 400 })
  }
  if (!REPORT_TYPES.includes(body.report_type as string)) {
    return NextResponse.json(
      { error: "badReportType", values: REPORT_TYPES.join(" / ") },
      { status: 400 }
    )
  }
  if (body.status != null && !STATUSES.includes(body.status as string)) {
    return NextResponse.json({ error: "badReportStatus", values: STATUSES.join(" / ") }, { status: 400 })
  }

  // params_json 允许传对象或字符串，统一存成字符串
  if (body.params_json != null && typeof body.params_json === 'object') {
    body.params_json = JSON.stringify(body.params_json)
  }

  // 只挑出请求体里出现的字段：params_json / report_md / report_file / status
  // 都是 NOT NULL，未提供时让列默认值（'{}' / '' / '' / 'draft'）兜底，
  // 不补空字符串 —— status 补 '' 会当场撞 CHECK 约束。
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  const now = localDateTime()

  const wdb = getWritableDb()
  try {
    const info = wdb.prepare(`
      INSERT INTO intel_report (${cols.join(', ')}, created_by, created_at, updated_at)
      VALUES (${cols.map(() => '?').join(', ')}, ?, ?, ?)
    `).run(...cols.map(c => body[c] as never), user.email, now, now)

    const created = wdb.prepare(
      'SELECT * FROM intel_report WHERE id = ?'
    ).get(info.lastInsertRowid)

    return NextResponse.json({ report: created }, { status: 201 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('FOREIGN KEY')) {
      return NextResponse.json({ error: "badCompanyBrandOrOpp" }, { status: 400 })
    }
    if (msg.includes('CHECK')) {
      return NextResponse.json({ error: "invalidValue" }, { status: 400 })
    }
    if (msg.includes('NOT NULL')) {
      return NextResponse.json({ error: "requiredField" }, { status: 400 })
    }
    throw e
  } finally {
    wdb.close()   // 不 close 会泄漏 WAL 连接
  }
}
