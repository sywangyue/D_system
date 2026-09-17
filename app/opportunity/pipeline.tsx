"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Inbox, AlertCircle } from "lucide-react"
import NewDrawer from "./new-drawer"
import {
  BIZ_LINES, STAGES, stageIndex,
  type BizLine, type OppRow, type Stage,
} from "./types"
import { bizLineLabel, stageLabel } from "@/lib/enums"
import type { Dict, Locale } from "@/lib/i18n-shared"
import { fmtMonthDay } from "@/lib/i18n-shared"
import { errorText } from "@/lib/i18n-shared"

/**
 * 机会台 —— 一阶列表。
 *
 * 二阶式：这里只有 5 列（机会名称/类型/阶段/负责人/更新时间），其余字段
 * 全在 /opportunity/[id]。分页与筛选走服务端，不把全表拉回来在前端过滤。
 *
 * 阶段列支持行内改 —— 推进阶段是最高频动作，不该为了改一个字段点进详情。
 * 改动会由 PATCH 自动写一条 stage_change 事件（日后算阶段驻留天数的数据源）。
 */

const PAGE_SIZE = 50

export default function Pipeline({
  currentUser, canWrite, locale, t,
}: { currentUser: string; canWrite: boolean; locale: Locale; t: Dict }) {
  const router = useRouter()
  const [tab, setTab] = useState<BizLine>("ma")
  const [stage, setStage] = useState<Stage | "">("")
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<OppRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [drawer, setDrawer] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    const p = new URLSearchParams({ type: tab, page: String(page), size: String(PAGE_SIZE) })
    if (stage) p.set("stage", stage)
    if (mine) p.set("owner", currentUser)
    if (q.trim()) p.set("q", q.trim())
    try {
      const res = await fetch(`/api/opportunity?${p}`)
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
  }, [tab, stage, mine, q, page, currentUser, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tab, stage, mine, q])

  /** 行内推进阶段 */
  async function patchStage(id: number, next: Stage) {
    setSavingId(id)
    const res = await fetch(`/api/opportunity/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next }),
    })
    setSavingId(null)
    if (res.ok) setRows(rs => rs.map(r => (r.opp_id === id ? { ...r, stage: next } : r)))
  }

  const hasFilter = !!stage || mine || !!q.trim()
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="h-full flex flex-col">
      {/* ── 顶栏 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 h-14 hairline-b shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[17px] font-medium">{t.pipeline.title}</h1>
          {/* lat 小字只在中文版出现：英文版标题本身就是 "Pipeline"，再挂一次是重复 */}
          {locale === "zh" && (
            <span className="lat text-[11px] uppercase tracking-wider text-fg-subtle">Pipeline</span>
          )}
          <span className="num text-[12px] text-fg-muted">{total}</span>
        </div>
        {canWrite && (
          <button
            onClick={() => setDrawer(true)}
            className="btn flex items-center gap-1.5 h-7 px-3 rounded-[4px] bg-accent text-[var(--color-accent-fg)]
                       text-[12px] font-semibold border-0 cursor-pointer"
          >
            <Plus size={13} /> {t.pipeline.create}
          </button>
        )}
      </div>

      {/* ── 业务线 tab ───────────────────────────────────── */}
      <div className="flex gap-6 px-8 hairline-b shrink-0">
        {BIZ_LINES.map(l => (
          <button
            key={l.key}
            onClick={() => setTab(l.key)}
            className={`btn relative h-10 bg-transparent border-0 cursor-pointer text-[13px] px-0
              ${tab === l.key ? "text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {bizLineLabel(t, l.key)}
            {tab === l.key && (
              <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-fg" />
            )}
          </button>
        ))}
      </div>

      {/* ── 筛选条 ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-8 py-2.5 hairline-b shrink-0 flex-wrap">
        <Pill active={!stage} onClick={() => setStage("")}>{t.pipeline.allStages}</Pill>
        {STAGES.map(s => (
          <Pill key={s.key} active={stage === s.key} onClick={() => setStage(s.key)}>
            {stageLabel(t, s.key)}
          </Pill>
        ))}
        <span className="w-px h-4 bg-hairline mx-1.5" />
        <Pill active={mine} onClick={() => setMine(v => !v)}>{t.pipeline.onlyMine}</Pill>

        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t.pipeline.search}
            className="input h-7 w-64 pl-8 pr-2.5 rounded-[4px] bg-sidebar text-[12px]
                       border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint"
          />
        </div>
      </div>

      {/* ── 表格 ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-sidebar">
              <Th className="w-[46%]">{t.pipeline.col.name}</Th>
              <Th className="w-[12%]">{t.pipeline.col.type}</Th>
              <Th className="w-[18%]">{t.pipeline.col.stage}</Th>
              <Th className="w-[14%]">{t.pipeline.col.owner}</Th>
              <Th className="w-[10%] text-right">{t.pipeline.col.updatedAt}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="hairline-b">
                <td colSpan={5} className="px-8 py-2.5">
                  <div className="skeleton h-3.5" style={{ width: `${88 - i * 6}%` }} />
                </td>
              </tr>
            ))}

            {!loading && rows.map(r => (
              <tr
                key={r.opp_id}
                className="row hairline-b cursor-pointer"
                onClick={() => router.push(`/opportunity/${r.opp_id}`)}
              >
                <td className="px-8 h-9 text-[13px]">{r.title}</td>
                <td className="px-3 text-[12px] text-fg-muted">
                  {bizLineLabel(t, r.type)}
                </td>
                <td className="px-3" onClick={e => e.stopPropagation()}>
                  <StageCell
                    value={r.stage}
                    disabled={!canWrite || savingId === r.opp_id}
                    t={t}
                    onChange={next => patchStage(r.opp_id, next)}
                  />
                </td>
                <td className="lat px-3 text-[12px] text-fg-muted truncate">{r.owner || "—"}</td>
                <td className="num px-8 text-[11px] text-fg-subtle text-right">
                  {fmtMonthDay(locale, r.updated_at)}
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
            ? <Empty icon={<Search size={22} />} title={t.empty.noResults}
                     hint={t.empty.noResultsHint}
                     action={<button onClick={() => { setStage(""); setMine(false); setQ("") }}
                                     className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px] underline underline-offset-4">{t.common.clearFilters}</button>} />
            : <Empty icon={<Inbox size={22} />} title={t.empty.noOpportunities}
                     hint={canWrite ? t.empty.noOpportunitiesHint : t.empty.noOpportunitiesHintReadonly} />
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

      {drawer && (
        <NewDrawer
          defaultType={tab}
          currentUser={currentUser}
          t={t}
          onClose={() => setDrawer(false)}
          onCreated={() => { setDrawer(false); load() }}
        />
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

/**
 * 阶段列：5 段进度 + 就地选择。
 * 用中性灰而不是橙色 —— 橙色留给侧栏 active 与唯一主 CTA，
 * 24 行 × 5 段全上橙会变成满屏橙点（上一版设计就是栽在这）。
 */
function StageCell({ value, disabled, t, onChange }: {
  value: Stage; disabled: boolean; t: Dict; onChange: (s: Stage) => void
}) {
  const idx = stageIndex(value)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {STAGES.map((_, i) => (
          <span key={i} className="w-3 h-1 rounded-[1px]"
                style={{ background: i <= idx ? "var(--color-fg-muted)" : "var(--color-hairline-active)" }} />
        ))}
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as Stage)}
        className="input bg-transparent border-0 text-[12px] text-fg-muted cursor-pointer
                   disabled:cursor-default outline-none"
      >
        {STAGES.map(s => <option key={s.key} value={s.key}>{stageLabel(t, s.key)}</option>)}
      </select>
      <span className="num text-[10px] text-fg-subtle">{idx + 1}/5</span>
    </div>
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
