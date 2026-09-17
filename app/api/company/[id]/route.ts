import { NextResponse } from 'next/server'
import { getDb, getWritableDb } from '@/lib/db'
import { requireUser, requireWriter } from '@/lib/api-guard'

/**
 * 客户详情 —— 二阶端点
 *
 * 一阶只给 6 个字段，全部细节在这里一次取齐：
 * 公司全字段 + 关联展会品牌 + 名下资源 + 引用它的机会 + 关联报告。
 *
 * resources 是必须带的 —— 本系统的核心是存储报告与采集资源，
 * 任何详情页都要能看到并下载该对象名下的资源。
 *
 * ⚠️ company 表没有 is_archived，所以既不过滤软删除，也没有 DELETE 端点。
 */

const CONTACT_STATUS = ['未接触', '已接触', '谈判中', '合作中', '放弃', '']

/** 与列表端点同一份白名单：不在表里的键静默忽略。source_type 不可改。 */
const WRITABLE = [
  'name', 'name_en', 'type', 'city', 'country', 'credit_code', 'oper_name',
  'start_date', 'company_status', 'reg_no', 'address', 'email',
  'prospect_score', 'contact_status', 'notes', 'brand_id', 'intel_report_id',
]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const companyRow = db.prepare('SELECT * FROM company WHERE company_id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!companyRow) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const brand = companyRow.brand_id
    ? db.prepare(`
        SELECT b.brand_id, b.name_cn, b.name_en, b.city, b.organizer,
               b.industry_l1, b.industry_l2, b.is_ufi_certified,
               e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e
          ON e.brand_id = b.brand_id
         AND e.edition_id = (SELECT edition_id FROM exhibition_edition
                             WHERE brand_id = b.brand_id
                             ORDER BY year DESC, edition_id DESC LIMIT 1)
        WHERE b.brand_id = ?
      `).get(companyRow.brand_id)
    : null

  // 名下资源：直接挂在公司上的。collected_at 倒序，最新版本排最前。
  const resources = db.prepare(`
    SELECT resource_id, kind, title, file_path, mime, size_bytes, collected_at, source
    FROM resource
    WHERE company_id = ?
    ORDER BY collected_at DESC
  `).all(id)

  // 引用该公司的机会，只给一阶字段。is_archived 只有 opportunity 有，
  // 这里要过滤 —— 已归档的机会不该出现在关联清单里。
  const opportunities = db.prepare(`
    SELECT o.opp_id, o.title, o.type, o.stage, o.owner, o.updated_at
    FROM opportunity o
    WHERE o.company_id = ? AND o.is_archived = 0
    ORDER BY o.updated_at DESC
  `).all(id)

  // 关联报告：不带 report_md（可以几万字），要看全文走 /api/research/[id]
  const reports = db.prepare(`
    SELECT id, title, report_type, status, updated_at
    FROM intel_report
    WHERE company_id = ?
    ORDER BY updated_at DESC
  `).all(id)

  return NextResponse.json({ company: companyRow, brand, resources, opportunities, reports })
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

  // 只更新请求体里出现的字段，缺省的不动 —— 不做整行覆盖
  const cols = WRITABLE.filter(c => body[c] !== undefined)
  if (cols.length === 0) {
    return NextResponse.json({ error: "noFields" }, { status: 400 })
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const wdb = getWritableDb()
  try {
    const exists = wdb.prepare('SELECT company_id FROM company WHERE company_id = ?').get(id)
    if (!exists) return NextResponse.json({ error: 'not found' }, { status: 404 })

    wdb.prepare(`
      UPDATE company
      SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = ?
      WHERE company_id = ?
    `).run(...cols.map(c => body[c] as never), now, id)

    const updated = wdb.prepare('SELECT * FROM company WHERE company_id = ?').get(id)
    return NextResponse.json({ company: updated })
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
    wdb.close()
  }
}
