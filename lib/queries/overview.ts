import { getDb } from '@/lib/db'

/**
 * 盘面聚合查询。被 /api/overview 与 app/overview/page.tsx 共用 ——
 * 服务端组件直接调它，不必对自己发一次 HTTP；API 供将来的客户端刷新用。
 * 两处共用一份，避免口径漂移。
 */

/** 本周的结束日（周日 23:59:59），用于「本周待办」。 */
function endOfWeek(): string {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()   // 周一=1 … 周日=7
  d.setDate(d.getDate() + (7 - dow))
  return d.toISOString().slice(0, 10)
}

const STAGES = ['contact', 'intent', 'dd', 'audit', 'closing'] as const

export interface Task {
  opp_id: number; title: string; type: string; stage: string
  owner: string | null; next_action: string | null; next_action_due: string; overdue: number
}
export interface Report {
  id: number; title: string | null; report_type: string; status: string
  updated_at: string; company_name: string | null; excerpt: string | null
}
export interface ResourceKind { kind: string; n: number; bytes: number }
export interface ResourceTotal { n: number; bytes: number }
export interface OverviewData {
  kpi: { active: number; ma: number; greenfield: number; due_this_week: number }
  tasks: Task[]; reports: Report[]
  funnel: { stage: string; count: number }[]
  resources: { by_kind: ResourceKind[]; total: ResourceTotal }
  week_end: string
}

export function getOverview(): OverviewData {
  const db = getDb()
  const weekEnd = endOfWeek()

  // ── KPI 四个数 ────────────────────────────────────────────
  const kpi = db.prepare(`
    SELECT
      COUNT(*)                                          AS active,
      SUM(CASE WHEN type = 'ma'         THEN 1 ELSE 0 END) AS ma,
      SUM(CASE WHEN type = 'greenfield' THEN 1 ELSE 0 END) AS greenfield,
      SUM(CASE WHEN next_action_due IS NOT NULL
                AND next_action_due <> ''
                AND next_action_due <= ?                THEN 1 ELSE 0 END) AS due_this_week
    FROM opportunity
    WHERE is_archived = 0
  `).get(weekEnd) as Record<string, number>

  // ── 本周待办：到期日升序，逾期的排最前 ──────────────────────
  const tasks = db.prepare(`
    SELECT o.opp_id, o.title, o.type, o.stage, o.owner,
           o.next_action, o.next_action_due,
           CASE WHEN o.next_action_due < date('now', 'localtime') THEN 1 ELSE 0 END AS overdue
    FROM opportunity o
    WHERE o.is_archived = 0
      AND o.next_action_due IS NOT NULL AND o.next_action_due <> ''
      AND o.next_action_due <= ?
    ORDER BY o.next_action_due ASC
    LIMIT 10
  `).all(weekEnd)

  // ── 最近调研 ────────────────────────────────────────────
  const reports = db.prepare(`
    SELECT r.id, r.title, r.report_type, r.status, r.updated_at,
           c.name AS company_name,
           SUBSTR(r.report_md, 1, 160) AS excerpt
    FROM intel_report r
    LEFT JOIN company c ON c.company_id = r.company_id
    ORDER BY r.updated_at DESC
    LIMIT 5
  `).all()

  // ── 阶段漏斗：五档都要出现，没有数据的补 0 ──────────────────
  const counted = db.prepare(`
    SELECT stage, COUNT(*) AS n
    FROM opportunity WHERE is_archived = 0 GROUP BY stage
  `).all() as { stage: string; n: number }[]
  const byStage = Object.fromEntries(counted.map(r => [r.stage, r.n]))
  const funnel = STAGES.map(stage => ({
    stage,
    count: byStage[stage] ?? 0,
    // dwell_days / conversion 待 stage_change 事件积累后补，见文件头说明
  }))

  // ── 资源盘口：本系统的核心是存储，这块要在首屏就看得见 ────────
  const resources = db.prepare(`
    SELECT kind, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes
    FROM resource GROUP BY kind ORDER BY n DESC
  `).all()
  const resourceTotal = db.prepare(
    'SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM resource'
  ).get()

  return {
    kpi: {
      active: kpi.active ?? 0,
      ma: kpi.ma ?? 0,
      greenfield: kpi.greenfield ?? 0,
      due_this_week: kpi.due_this_week ?? 0,
    },
    tasks: tasks as Task[],
    reports: reports as Report[],
    funnel,
    resources: { by_kind: resources as ResourceKind[], total: resourceTotal as ResourceTotal },
    week_end: weekEnd,
  }
}
