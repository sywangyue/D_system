"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FileText, Search } from "lucide-react"
import { REPORT_TYPE, REPORT_STATUS, slugLabel } from "@/lib/enums"
import { errorText, fmtDate, type Locale, type Dict } from "@/lib/i18n-shared"

/**
 * 调研库 —— 一阶列表。
 *
 * ⚠️ 一阶绝不能出现 report_md（可达几万字）。列表只吃接口返回的 excerpt
 * （已经是 SUBSTR(report_md,1,160)），**不要**为了拼列表再去请求详情接口。
 *
 * ⚠️ 这张表的主键是裸 `id`，不是 opp_id / company_id / resource_id。
 * ⚠️ 没有 is_archived，所以没有归档过滤，也没有删除入口。
 *
 * 文案一律走字典（t / locale 由服务端壳下传）；报告标题、公司名是**数据**，
 * 原样显示不查字典（V2-09 §4.1）。
 */

interface ReportRow {
  id: number
  title: string | null
  report_type: string
  status: string
  company_id: number | null
  company_name: string | null
  updated_at: string | null
  excerpt: string | null
}

const PAGE_SIZE = 50

/**
 * 筛选条的取值。report_type / status 都是**闭集 slug**，slug 本身既是键又是值，
 * 所以标签直接用 slugLabel(t.enum.reportType / t.enum.reportStatus) 查字典，
 * 页面里不再留任何中文映射（见 lib/enums.ts）。
 */
// 筛选条只露出库里实际有数据的三类（brand_research / single_prospect 目前 0 条）
const REPORT_TYPES = ["batch_prospect", "industry_research", "company_research"]
  .filter(v => REPORT_TYPE.some(o => o.value === v))
const STATUSES = REPORT_STATUS.map(o => o.value)

export default function ResearchList({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<ReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
    if (q.trim()) p.set("q", q.trim())
    if (type) p.set("report_type", type)
    if (status) p.set("status", status)
    try {
      const res = await fetch(`/api/research?${p}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(errorText(t, err.error, err.values, t.empty.loadFailed))
      }
      const d = await res.json()
      setRows(d.items); setTotal(d.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q, type, status, page, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, type, status])

  const hasFilter = !!q.trim() || !!type || !!status
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶栏 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 md:px-8 h-14 hairline-b shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[17px] font-medium">{t.research.title}</h1>
          {/* 拉丁字标是中文标题的对照，中文版才需要；英文版标题本身就是 Reports，
              再来一个等于同一个词渲染两遍。 */}
          {locale === "zh" && (
            <span className="lat text-[11px] uppercase tracking-wider text-fg-subtle">Reports</span>
          )}
          <span className="num text-[12px] text-fg-muted">{total}</span>
        </div>
      </div>

      {/* ── 筛选条 ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-4 md:px-8 py-2.5 hairline-b shrink-0 flex-wrap">
        <Pill active={!type} onClick={() => setType("")}>{t.research.allType}</Pill>
        {REPORT_TYPES.map(v => (
          <Pill key={v} active={type === v} onClick={() => setType(v)}>
            {slugLabel(t.enum.reportType, v)}
          </Pill>
        ))}

        <span className="w-px h-4 bg-hairline mx-1.5" />

        <Pill active={!status} onClick={() => setStatus("")}>{t.research.allStatus}</Pill>
        {STATUSES.map(v => (
          <Pill key={v} active={status === v} onClick={() => setStatus(v)}>
            {slugLabel(t.enum.reportStatus, v)}
          </Pill>
        ))}

        <div className="relative w-full md:ml-auto md:w-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t.research.search}
            className="input h-7 w-full md:w-64 pl-8 pr-2.5 rounded-[4px] bg-sidebar text-[12px]
                       border border-hairline placeholder:text-fg-faint"
          />
        </div>
      </div>

      {/* ── 列表 ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="px-4 md:px-8 py-3 flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton h-3.5" style={{ width: `${70 - i * 4}%` }} />
                <div className="skeleton h-3" style={{ width: `${92 - i * 4}%` }} />
              </div>
            ))}
          </div>
        )}

        {/* table-fixed 不能省：excerpt 那行带 truncate（= white-space:nowrap），
            自动布局下单元格会被 160 字的摘要整行撑开，表格宽到 1704px，
            右边「类型 / 状态 / 关联公司 / 更新时间」四列全被挤出可视区。
            固定布局下列宽以 Th 上的百分比为准，truncate 才会真的省略。 */}
        {!loading && !error && rows.length > 0 && (
          <table className="table-cards w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sidebar">
                <Th className="w-[46%]">{t.research.col.title}</Th>
                <Th className="w-[11%]">{t.research.col.type}</Th>
                <Th className="w-[11%]">{t.research.col.status}</Th>
                <Th className="w-[20%]">{t.research.col.company}</Th>
                <Th className="w-[12%] text-right">{t.research.col.updatedAt}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}
                    className="row hairline-b cursor-pointer"
                    onClick={() => router.push(`/research/${r.id}`)}>
                  {/* 摘要在标题单元格里另起一行（规格 §3.1：列表项下的一行摘要）。
                      用单元格内的第二行而不是独立的列表布局，列头才立得住。 */}
                  <td className="px-8 py-2.5 align-top">
                    <div className="text-[13px] text-fg">
                      {r.title || slugLabel(t.enum.reportType, r.report_type)}
                    </div>
                    {r.excerpt && (
                      <div className="text-[12px] text-fg-subtle truncate mt-0.5">{r.excerpt}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Tag>{slugLabel(t.enum.reportType, r.report_type)}</Tag>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Tag>{slugLabel(t.enum.reportStatus, r.status)}</Tag>
                  </td>
                  <td className="px-3 py-2.5 align-top text-[12px] text-fg-muted">
                    {r.company_name || "—"}
                  </td>
                  <td className="num px-8 py-2.5 align-top text-[11px] text-fg-subtle text-right">
                    {fmtDate(locale, r.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && error && (
          <Empty icon={<AlertCircle size={22} />} title={error}
                 action={<button onClick={load} className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">{t.common.retry}</button>} />
        )}

        {!loading && !error && rows.length === 0 && (
          hasFilter
            ? <Empty icon={<Search size={22} />} title={t.research.noResults}
                     hint={t.common.searchHint}
                     action={<button onClick={() => { setQ(""); setType(""); setStatus("") }}
                                     className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">{t.common.clearFilters}</button>} />
            : <Empty icon={<FileText size={22} />} title={t.research.emptyTitle} />
        )}
      </div>

      {/* ── 分页 ─────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 h-11 hairline-t shrink-0 text-[12px]">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="btn h-6 px-2.5 rounded-[4px] bg-transparent border border-hairline
                             text-fg-muted cursor-pointer disabled:opacity-35">{t.common.prev}</button>
          <span className="num text-fg-subtle">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="btn h-6 px-2.5 rounded-[4px] bg-transparent border border-hairline
                             text-fg-muted cursor-pointer disabled:opacity-35">{t.common.next}</button>
        </div>
      )}
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-7 px-3 first:pl-8 last:pr-8 text-left text-[10px] font-semibold uppercase
                    tracking-[0.06em] text-fg-subtle hairline-b ${className}`}>
      {children}
    </th>
  )
}

function Pill({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`btn h-6 px-2.5 rounded-[4px] text-[12px] cursor-pointer border
        ${active
          ? "bg-surface-hover text-fg border-hairline-active"
          : "bg-transparent text-fg-muted border-hairline hover:text-fg"}`}
    >
      {children}
    </button>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-[10px]
                     bg-surface-elevated border border-hairline text-fg-subtle">
      {children}
    </span>
  )
}

function Empty({ icon, title, hint, action }: {
  icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-2.5 text-fg-subtle">
      <div className="opacity-40">{icon}</div>
      <div className="text-[14px] text-fg-muted">{title}</div>
      {hint && <div className="text-[12px]">{hint}</div>}
      {action}
    </div>
  )
}
