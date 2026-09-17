import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

/**
 * 调研报告详情 —— 二阶端点
 *
 * 这里才给全字段：report_md 全文、params_json、report_file 都在这一层。
 * 一阶列表（/api/research）永远只给 160 字摘要。
 *
 * ⚠️ 主键是裸 `id`；⚠️ 没有 is_archived，所以没有 DELETE 端点。
 */

// 必须与 intel_report.report_type 的 CHECK 约束一致（见 006 建表 + 017 拓宽）。
const REPORT_TYPES = [
  'industry_research', 'brand_research', 'batch_prospect', 'single_prospect',
  'company_research',
]

const STATUSES = ['draft', 'published', 'archived']

/** 与列表端点同一份白名单：不在表里的键静默忽略。 */
const WRITABLE = [
  'title', 'report_type', 'status', 'report_md', 'report_file',
  'params_json', 'company_id', 'brand_id', 'opp_id',
  'industry_l1', 'industry_l2', 'target_company',
]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const report = db.prepare('SELECT * FROM intel_report WHERE id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!report) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const company = report.company_id
    ? db.prepare('SELECT * FROM company WHERE company_id = ?').get(report.company_id)
    : null

  // 该报告落库的资源（report_id 指向它）。不带文件内容，只要元信息，
  // 下载走 /api/resource/[id]/download。
  const resources = db.prepare(`
    SELECT resource_id, kind, title, file_path, mime, size_bytes, collected_at, source
    FROM resource
    WHERE report_id = ?
    ORDER BY collected_at DESC
  `).all(id)

  return NextResponse.json({ report, company, resources })
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

  if (body.report_type != null && !REPORT_TYPES.includes(body.report_type as string)) {
    return NextResponse.json(
      { error: "badReportType", values: REPORT_TYPES.join(" / ") },
      { status: 400 }
    )
  }
  if (body.status != null && !STATUSES.includes(body.status as string)) {
    return NextResponse.json({ error: "badReportStatus", values: STATUSES.join(" / ") }, { status: 400 })
  }
  if (body.params_json != null && typeof body.params_json === 'object') {
    body.params_json = JSON.stringify(body.params_json)
  }

  // 只更新请求体里出现的字段，缺省的不动 —— 不做整行覆盖
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  if (cols.length === 0) {
    return NextResponse.json({ error: "noFields" }, { status: 400 })
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const wdb = getWritableDb()
  try {
    const exists = wdb.prepare('SELECT id FROM intel_report WHERE id = ?').get(id)
    if (!exists) return NextResponse.json({ error: 'not found' }, { status: 404 })

    wdb.prepare(`
      UPDATE intel_report
      SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ?
      WHERE id = ?
    `).run(...cols.map(c => body[c] as never), now, id)

    const updated = wdb.prepare('SELECT * FROM intel_report WHERE id = ?').get(id)
    return NextResponse.json({ report: updated })
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
    wdb.close()
  }
}
