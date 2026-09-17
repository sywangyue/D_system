"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronRight, Inbox, Search } from "lucide-react"

/**
 * 公司库 —— 一阶列表。
 *
 * 二阶式：这里只有 5 列（公司名 / 类型 / 经营状态 / 法定代表人 / 更新时间），
 * 第五列原本按规格 §2.1 是「城市」，但 company.city 全表 501 行皆空，
 * 换成有值的 oper_name（468/501）。
 * 全字段与四个关联块（展会品牌 / 资源 / 机会 / 报告）都在 /company/[id]。
 * 分页与筛选走服务端（/api/company），不把 501 条拉回来在前端过滤。
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
 * 类型与来源类型**没有中文映射**（仓库里查过，只有 company.type 的取值定义
 * organizer|exhibitor|service|target|partner 和 API 里的
 * SOURCE_TYPES = qcc_search|manual|db_match）。所以这里原样显示英文值，
 * 不自己编一套译名 —— 要中文得先有人在规格里定下来。
 */
const TYPES = ["organizer", "exhibitor", "service", "target", "partner"]
const SOURCES = ["qcc_search", "manual", "db_match"]

/**
 * 经营状态直接取库里的实际取值，数据本身就是中文，不需要映射。
 * 但**必须与库里的字符串逐字一致** —— 接口是精确 `=` 匹配，差一个字就永远 0 条。
 * 「注销（2023-01-04）」带日期后缀，写成「注销」筛出来是空的。
 * 另有 32 家 company_status 是空串，没有对应筛选项，靠「全部状态」兜住。
 */
const STATUSES = [
  { value: "存续",                   label: "存续" },
  { value: "在业",                   label: "在业" },
  { value: "存续（在营、开业、在册）", label: "存续（在营、开业、在册）" },
  { value: "仍注册",                 label: "仍注册" },
  { value: "正常",                   label: "正常" },
  { value: "注销（2023-01-04）",      label: "注销" },
]

const SORTS = [
  { value: "updated_at",     label: "更新时间" },
  { value: "name",           label: "名称" },
  { value: "prospect_score", label: "意向评分" },
]

export default function CompanyList() {
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "加载失败")
      const d = await res.json()
      setRows(d.items); setTotal(d.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q, type, status, source, sort, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, type, status, source, sort])

  const hasFilter = !!q.trim() || !!type || !!status || !!source
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function clearFilters() {
    setQ(""); setType(""); setStatus(""); setSource("")
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶栏 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 h-14 hairline-b shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[17px] font-medium">公司库</h1>
          <span className="lat text-[11px] uppercase tracking-wider text-fg-subtle">Entities</span>
          <span className="num text-[12px] text-fg-muted">{total}</span>
        </div>
      </div>

      {/* ── 筛选条 ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-8 py-2.5 hairline-b shrink-0 flex-wrap">
        <Pill active={!status} onClick={() => setStatus("")}>全部状态</Pill>
        {STATUSES.map(s => (
          <Pill key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
            {s.label}
          </Pill>
        ))}

        <span className="w-px h-4 bg-hairline mx-1.5" />

        <Select value={type} onChange={setType} placeholder="全部类型"
                options={TYPES.map(t => ({ value: t, label: t }))} />
        <Select value={source} onChange={setSource} placeholder="全部来源"
                options={SOURCES.map(s => ({ value: s, label: s }))} />
        <Select value={sort} onChange={setSort}
                options={SORTS} prefix="排序" />

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="搜索公司名称、统一社会信用代码…"
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
              <Th className="w-[44%]">公司名称</Th>
              <Th className="w-[12%]">类型</Th>
              <Th className="w-[16%]">经营状态</Th>
              <Th className="w-[14%]">法定代表人</Th>
              <Th className="w-[14%] text-right">更新时间</Th>
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
                <td className="lat px-3 text-[12px] text-fg-muted">{r.type || "—"}</td>
                <td className="px-3 text-[12px] text-fg-muted">{r.company_status || "—"}</td>
                <td className="px-3 text-[12px] text-fg-muted">{r.oper_name || "—"}</td>
                <td className="num px-8 text-[11px] text-fg-subtle text-right">
                  {(r.updated_at || "").slice(0, 10) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && error && (
          <Empty icon={<AlertCircle size={22} />} title={error}
                 action={<button onClick={load} className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">重试</button>} />
        )}

        {!loading && !error && rows.length === 0 && (
          hasFilter
            ? <Empty icon={<Search size={22} />} title="没有符合条件的公司"
                     hint="试着放宽筛选条件"
                     action={<button onClick={clearFilters}
                                     className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">清除筛选</button>} />
            : <Empty icon={<Inbox size={22} />} title="还没有公司记录" />
        )}
      </div>

      {/* ── 分页 ─────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 h-11 hairline-t shrink-0 text-[12px]">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="btn h-6 px-2.5 rounded-[4px] bg-transparent border border-hairline
                             text-fg-muted cursor-pointer disabled:opacity-35">上一页</button>
          <span className="num text-fg-subtle">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="btn h-6 px-2.5 rounded-[4px] bg-transparent border border-hairline
                             text-fg-muted cursor-pointer disabled:opacity-35">下一页</button>
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
