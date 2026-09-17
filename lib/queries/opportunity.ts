import { getDb } from '@/lib/db'
import { getBrandWithLatest } from '@/lib/queries/edition'

/**
 * 机会详情六块聚合查询。
 *
 * 与 lib/queries/overview.ts 同一做法：服务端组件直接调它，不对自己发一次 HTTP；
 * API 供客户端刷新用。两处共用一份，避免口径漂移 ——
 * 详情页与 /api/opportunity/[id] 若各写一遍 SQL，改一处漏一处时页面会静默空掉。
 *
 * 六块：机会全字段（detail_json 已解析）+ 关联公司 + 关联展会 + 资源 + 时间线 + 调研报告。
 */

export interface OppDetailOpportunity {
  opp_id: number
  type: BizLine
  title: string
  title_en: string | null
  stage: Stage
  deal_type: string | null
  company_id: number | null
  brand_id: string | null
  md_brand: string | null
  priority: number | null
  owner: string | null
  next_action: string | null
  next_action_due: string | null
  /** 出口已 JSON.parse 成对象；脏数据降级为 {}，页面据此走空态 */
  detail_json: Record<string, unknown>
  is_archived: number
  created_by: string
  created_at: string
  updated_at: string
}

export type BizLine = 'ma' | 'greenfield' | 'project_support'
export type Stage = 'contact' | 'intent' | 'dd' | 'audit' | 'closing'

export interface OppDetailCompany {
  company_id: number
  name: string | null
  name_en: string | null
  credit_code: string | null
  oper_name: string | null
  start_date: string | null
  company_status: string | null
  [k: string]: unknown
}

export interface OppDetailBrand {
  brand_id: string
  name_cn: string | null
  name_en: string | null
  city: string | null
  organizer: string | null
  industry_l1: string | null
  industry_l2: string | null
  is_ufi_certified: number | null
  year: number | null
  area_sqm: number | null
  exhibitors_count: number | null
  visitors_count: number | null
}

export interface OppDetailResource {
  resource_id: number
  kind: string
  title: string
  file_path: string
  mime: string | null
  size_bytes: number | null
  collected_at: string | null
  source: string | null
}

export interface OppDetailEvent {
  event_id: number
  event_type: 'note' | 'stage_change' | 'file' | 'meeting' | 'task_done'
  content: string | null
  file_path: string | null
  occurred_at: string | null
  created_by: string
  created_at: string
}

export interface OppDetailReport {
  id: number
  title: string | null
  report_type: string
  status: string
  updated_at: string
}

export interface OppDetail {
  opportunity: OppDetailOpportunity
  company: OppDetailCompany | null
  brand: OppDetailBrand | null
  resources: OppDetailResource[]
  events: OppDetailEvent[]
  reports: OppDetailReport[]
}

/** 取不到机会时返回 null —— 调用方自行决定 404（API）还是 notFound()（页面）。 */
export function getOpportunityDetail(id: string | number): OppDetail | null {
  const db = getDb()

  const row = db.prepare('SELECT * FROM opportunity WHERE opp_id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!row) return null

  // detail_json 存的是字符串，出口解析成对象，前端不必再 parse 一次
  let detail: unknown = {}
  try {
    detail = JSON.parse((row.detail_json as string) || '{}')
  } catch {
    detail = {}   // 脏数据不应让整个详情页 500
  }
  const opportunity = { ...row, detail_json: detail } as unknown as OppDetailOpportunity

  const company = row.company_id
    ? db.prepare('SELECT * FROM company WHERE company_id = ?').get(row.company_id)
    : null

  const brand = row.brand_id
    ? getBrandWithLatest(row.brand_id as string)
    : null

  // 资源：直接挂在本机会上的，加上挂在其关联公司上的
  const resources = db.prepare(`
    SELECT resource_id, kind, title, file_path, mime, size_bytes, collected_at, source
    FROM resource
    WHERE opp_id = ? OR (company_id IS NOT NULL AND company_id = ?)
    ORDER BY collected_at DESC
  `).all(id, row.company_id ?? -1)

  // 时间线：排序键必须与页面显示的键是同一个。
  //
  // 原先按 created_at DESC 排、界面却显示 occurred_at || created_at，
  // 只要有人填了 occurred_at（补记上周开过的会、预排下周的会、补录文件时间），
  // 列表顺序就是乱的 —— 实测「会议 2026-09-20」被夹在两条 09-17 之间。
  //
  // 往哪边统一：选 occurred_at（回退 created_at），即「按事件发生时间倒序」。
  // 理由是 occurred_at 存在的意义就是让事件脱离录入时间；
  // 若改按 created_at 排，这个字段就只剩显示用途、排序价值归零，
  // 而时间线的语义本就是「事情什么时候发生的」，不是「什么时候录进来的」。
  //
  // NULLIF 不能省：occurred_at 可能是 NULL，也可能是空字符串（写入方漏填），
  // 只 COALESCE 挡不住空串 —— 空串会排到最前面。
  const events = db.prepare(`
    SELECT event_id, event_type, content, file_path, occurred_at, created_by, created_at
    FROM opportunity_event
    WHERE opp_id = ?
    ORDER BY COALESCE(NULLIF(occurred_at, ''), created_at) DESC, created_at DESC, event_id DESC
  `).all(id)

  const reports = db.prepare(`
    SELECT id, title, report_type, status, updated_at
    FROM intel_report
    WHERE opp_id = ? OR (company_id IS NOT NULL AND company_id = ?)
    ORDER BY updated_at DESC
  `).all(id, row.company_id ?? -1)

  return {
    opportunity,
    company: (company as OppDetailCompany | null) ?? null,
    brand: (brand as OppDetailBrand | null) ?? null,
    resources: resources as OppDetailResource[],
    events: events as OppDetailEvent[],
    reports: reports as OppDetailReport[],
  }
}
