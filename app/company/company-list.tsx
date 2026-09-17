"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronRight, Inbox, Search } from "lucide-react"
import { fmtDate, type Dict, type Locale } from "@/lib/i18n-shared"
import { errorText } from "@/lib/i18n-shared"
import { COMPANY_STATUS, COMPANY_TYPE, SOURCE_TYPE, enumLabel } from "@/lib/enums"

/**
 * 公司库 —— 一阶列表。
 *
 * 二阶式：这里只有 5 列（公司名 / 类型 / 经营状态 / 法定代表人 / 更新时间），
 * 第五列原本按规格 §2.1 是「城市」，但 company.city 全表 501 行皆空，
 * 换成有值的 oper_name（468/501）。
 * 全字段与四个关联块（展会品牌 / 资源 / 机会 / 报告）都在 /company/[id]。
 * 分页与筛选走服务端（/api/company），不把 501 条拉回来在前端过滤。
 *
 * 文案一律走字典（t / locale 由 app/company/page.tsx 传下来）。
 * 闭集取值（类型 / 经营状态 / 来源）的原始值只此一份，在 lib/enums.ts：
 * value 保持库里原样发给接口，界面标签按 locale 从 enum.* 取。
 *
 * ⚠️ company 表没有 is_archived（四张表里只有 opportunity 有），
 * 所以这里没有归档过滤，也没有删除入口。
 */

interface CompanyRow {
  company_id: number
  name: string | null
  type: string | null
  company_status: string | null
  oper_name: string | null
  updated_at: string | null
}

const PAGE_SIZE = 50

/**
 * 经营状态直接取库里的实际取值，数据本身就是中文，字典只提供标签。
 * 但**必须与库里的字符串逐字一致** —— 接口是精确 `=` 匹配，差一个字就永远 0 条。
 * 「注销」在库里带日期后缀（注销（2023-01-04），1 行），与不带后缀的写法同义，
 * 所以同一个 slug 的多个原始取值按 slug 合并成一颗药丸，取靠后的那条
 * —— 保证发出去的是库里真实存在的字符串。标签仍按 locale 取，界面不出现中文残留。
 * 另有 32 家 company_status 是空串，没有对应筛选项，靠「全部状态」兜住。
 */
const STATUS_PILLS = COMPANY_STATUS.filter(
  (o, i) => COMPANY_STATUS.map(x => x.slug).lastIndexOf(o.slug) === i,
)

/** 排序：value 是接口白名单里的列名（app/api/company/route.ts），标签走字典。 */
const SORTS = [
  { value: "updated_at",     key: "sortUpdatedAt" },
  { value: "name",           key: "sortName" },
  { value: "prospect_score", key: "sortScore" },
] as const

export default function CompanyList({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [source, setSource] = useState("")
  const [sort, setSort] = useState("updated_at")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<CompanyRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort })
    if (q.trim()) p.set("q", q.trim())
    if (type) p.set("type", type)
    if (status) p.set("company_status", status)
    if (source) p.set("source_type", source)
    try {
      const res = await fetch(`/api/company?${p}`)
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
  }, [q, type, status, source, sort, page, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, type, status, source, sort])

  const hasFilter = !!q.trim() || !!type || !!status || !!source
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 标签表：enum.* 的键是 slug，取值表在 lib/enums.ts
  const statusMap = t.enum.companyStatus as Record<string, string>
  const typeMap = t.enum.companyType as Record<string, string>
  const sourceMap = t.enum.sourceType as Record<string, string>

  const typeOptions = COMPANY_TYPE.map(o => ({ value: o.value, label: enumLabel(COMPANY_TYPE, typeMap, o.value) }))
  const sourceOptions = SOURCE_TYPE.map(o => ({ value: o.value, label: enumLabel(SOURCE_TYPE, sourceMap, o.value) }))
  const sortOptions = SORTS.map(s => ({ value: s.value, label: t.company[s.key] }))

  function clearFilters() {
    setQ(""); setType(""); setStatus(""); setSource("")
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶栏 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 h-14 hairline-b shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[17px] font-medium">{t.company.title}</h1>
          {/* 拉丁字标只在中文版出现：英文版标题本身就是 Entities，再挂一次是重复 */}
          {locale === "zh" && (
            <span className="lat text-[11px] uppercase tracking-wider text-fg-subtle">Entities</span>
          )}
          <span className="num text-[12px] text-fg-muted">{total}</span>
        </div>
      </div>

      {/* ── 筛选条 ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-8 py-2.5 hairline-b shrink-0 flex-wrap">
        <Pill active={!status} onClick={() => setStatus("")}>{t.company.allStatus}</Pill>
        {STATUS_PILLS.map(s => (
          <Pill key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
            {enumLabel(COMPANY_STATUS, statusMap, s.value)}
          </Pill>
        ))}

        <span className="w-px h-4 bg-hairline mx-1.5" />

        <Select value={type} onChange={setType} placeholder={t.company.allType}
                options={typeOptions} />
        <Select value={source} onChange={setSource} placeholder={t.company.allSource}
                options={sourceOptions} />
        <Select value={sort} onChange={setSort}
                options={sortOptions} prefix={t.company.sort} />

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t.company.search}
            className="input h-7 w-72 pl-8 pr-2.5 rounded-[4px] bg-sidebar text-[12px]
                       border border-hairline placeholder:text-fg-faint"
          />
        </div>
      </div>

      {/* ── 表格 ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-sidebar">
              <Th className="w-[44%]">{t.company.col.name}</Th>
              <Th className="w-[12%]">{t.company.col.type}</Th>
              <Th className="w-[16%]">{t.company.col.status}</Th>
              <Th className="w-[14%]">{t.company.col.legalRep}</Th>
              <Th className="w-[14%] text-right">{t.company.col.updatedAt}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="hairline-b">
                <td colSpan={5} className="px-8 py-2.5">
                  <div className="skeleton h-3.5" style={{ width: `${88 - i * 5}%` }} />
                </td>
              </tr>
            ))}

            {!loading && rows.map(r => (
              <tr key={r.company_id}
                  className="row hairline-b cursor-pointer"
                  onClick={() => router.push(`/company/${r.company_id}`)}>
                <td className="px-8 h-9 text-[13px]">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{r.name || "—"}</span>
                    <ChevronRight size={12} className="text-fg-faint shrink-0" />
                  </span>
                </td>
                {/* 类型与状态是闭集，按 locale 出标签；查不到取值时回退原值 */}
                <td className="px-3 text-[12px] text-fg-muted">
                  {enumLabel(COMPANY_TYPE, typeMap, r.type)}
                </td>
                <td className="px-3 text-[12px] text-fg-muted">
                  {enumLabel(COMPANY_STATUS, statusMap, r.company_status)}
                </td>
                {/* oper_name 是自由文本（人名），原样显示，不查字典 */}
                <td className="px-3 text-[12px] text-fg-muted">{r.oper_name || "—"}</td>
                {/* 日期走 Intl（helpers 在 lib/i18n-shared）：en 下是 Jan 15, 2026 */}
                <td className="num px-8 text-[11px] text-fg-subtle text-right">
                  {fmtDate(locale, r.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && error && (
          <Empty icon={<AlertCircle size={22} />} title={error}
                 action={<button onClick={load} className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">{t.common.retry}</button>} />
        )}

        {!loading && !error && rows.length === 0 && (
          hasFilter
            ? <Empty icon={<Search size={22} />} title={t.company.noResults}
                     hint={t.common.searchHint}
                     action={<button onClick={clearFilters}
                                     className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">{t.common.clearFilters}</button>} />
            : <Empty icon={<Inbox size={22} />} title={t.company.emptyTitle} />
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

function Select({ value, onChange, options, placeholder, prefix }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  prefix?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input h-6 px-1.5 rounded-[4px] bg-transparent text-[12px] cursor-pointer
                 border border-hairline text-fg-muted"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{prefix ? `${prefix} · ${o.label}` : o.label}</option>
      ))}
    </select>
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
