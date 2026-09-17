import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

/**
 * 资源库 —— 一阶列表端点（**只读**）
 *
 * 资源登记不从这里走：写入路径是 scripts/index_resources.py（扫盘 + sha256 落库）。
 * 所以本端点没有 POST / PATCH / DELETE —— 从 API 手写记录或删除记录，
 * 都会和磁盘上的文件、索引里的 sha256 对不上。
 *
 * 列表只给元信息，**不返回文件内容** —— 下载走 /api/resource/[id]/download。
 *
 * ⚠️ resource 表没有 is_archived，也没有软删除过滤。
 */

/** 一阶字段。file_path 不出现在这里：它是下载端点的输入，不是展示字段。 */
const LIST_COLUMNS = `
  r.resource_id, r.kind, r.title, r.mime, r.size_bytes, r.collected_at, r.source,
  r.company_id, r.opp_id, r.brand_id
`

/** 排序白名单：key 是外部可传的值，value 是真实列名。
 *  绝不能把 sort 参数直接拼进 SQL。 */
const SORTABLE: Record<string, string> = {
  collected_at: 'r.collected_at',
  size_bytes: 'r.size_bytes',
  title: 'r.title',
  kind: 'r.kind',
}

/** 等值筛选白名单：key 是查询参数名，value 是真实列名。 */
const FILTERS: Record<string, string> = {
  kind: 'r.kind',
  source: 'r.source',
  company_id: 'r.company_id',
  opp_id: 'r.opp_id',
  brand_id: 'r.brand_id',
  report_id: 'r.report_id',
  industry_l1: 'r.industry_l1',
}

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  // 分页：size 上限 200，越界静默截断而不是报错
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const size = Math.min(200, Math.max(1, parseInt(sp.get('size') ?? '50', 10) || 50))

  // 排序：白名单查不到就回退默认，不报错也不拼串
  const sortCol = SORTABLE[sp.get('sort') ?? ''] ?? 'r.collected_at'
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
    where.push('(r.title LIKE ? OR r.file_path LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  // 这张表没有 is_archived，无筛选条件时 where 会是空的 —— WHERE 子句要按有无拼
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const db = getDb()

  // total 是筛选后的总数，不是全表数 —— 同一套 WHERE 再跑一次
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM resource r ${whereSql}`
  ).get(...params) as { total: number }

  const items = db.prepare(`
    SELECT ${LIST_COLUMNS}
    FROM resource r
    ${whereSql}
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, size, (page - 1) * size)

  return NextResponse.json({ items, page, size, total })
}
