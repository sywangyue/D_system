"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CITY_GEO } from "@/lib/geo"
import { INDUSTRY_L1, enumLabel } from "@/lib/enums"
import { errorText, fill, fmtNum, LOCALE_TAG, type Dict, type Locale } from "@/lib/i18n-shared"
import type { ExpoStats, CalendarDay } from "@/lib/queries/expo"
// 地图与行业堆叠条抽成了共用组件：落地页复用同一份实现（TASK-J §4.4）
import MapSvg from "@/components/basemap/MapSvg"
import IndustryBar from "@/components/basemap/IndustryBar"

/**
 * 展会底图看板。一屏四块：筛选条 / 地图 / 我的行动日历 / 四宫格。
 *
 * 几条不变式：
 * - 地图与四宫格**共同**跟随筛选；日历不受筛选影响（它是机会台的事项，不是展会）。
 * - 首屏数据由服务端算好传进来，这里只在筛选变化 / 翻月时才请求接口。
 * - 地图**在 SQL 里聚合过**：拿到的最多约 120 个点，不是 7,378 行。
 * - 配色只用 globals.css 的令牌；单点强调色用 --color-fg，不碰品牌橙。
 */

/** kind 直接就是 /api/expo/stats 的参数名：国内按 city、海外按 country_cn。 */
type Place = { kind: "city" | "country_cn"; name: string }

type Props = {
  t: Dict
  locale: Locale
  initialStats: ExpoStats
  initialDays: CalendarDay[]
  initialMonth: string
  today: string
  initialIndustry: string[]
  /** 城市下拉的候选。服务端按**不带筛选**的点位算好：若取当前筛选结果，
   *  选中一个城市后列表只剩它自己，没法直接换成别的城市。 */
  placeOptions: ExpoStats["points"]
}

const scaleLabels = (t: Dict) => t.basemap.scale as Record<string, string>
const scaleKeys = ["lt1w", "1w-5w", "5w-10w", "gte10w"]

/** 月份加减，'YYYY-MM' 进 'YYYY-MM' 出。 */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function ExpoBoard({
  t, locale, initialStats, initialDays, initialMonth, today, initialIndustry, placeOptions,
}: Props) {
  const router = useRouter()

  const [industry, setIndustry] = useState<string[]>(initialIndustry)
  const [place, setPlace] = useState<Place | null>(null)
  const [scale, setScale] = useState<string | null>(null)

  const [stats, setStats] = useState<ExpoStats>(initialStats)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [month, setMonth] = useState(initialMonth)
  const [days, setDays] = useState<CalendarDay[]>(initialDays)

  const filterKey = JSON.stringify([industry, place, scale])

  // 筛选变了才重拉统计。首屏用服务端给的数据，不再打一次接口。
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const sp = new URLSearchParams()
    for (const v of industry) sp.append("industry_l1", v)
    if (place) sp.set(place.kind, place.name)
    if (scale) sp.set("scale", scale)

    let cancelled = false
    setBusy(true)
    fetch(`/api/expo/stats?${sp}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(errorText(t, body.error, body.values, t.empty.loadFailed))
        return body as ExpoStats
      })
      .then(next => { if (!cancelled) { setStats(next); setStatsError(null) } })
      .catch(err => { if (!cancelled) setStatsError(err.message) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
    // filterKey 是三个筛选的序列化，等价于 [industry, place, scale]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  // 翻月才重拉日历
  const firstMonth = useRef(true)
  useEffect(() => {
    if (firstMonth.current) { firstMonth.current = false; return }
    let cancelled = false
    fetch(`/api/expo/calendar?month=${month}`)
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(errorText(t, body.error, body.values, t.empty.loadFailed))
        return body as { days: CalendarDay[] }
      })
      .then(body => { if (!cancelled) setDays(body.days) })
      .catch(() => { if (!cancelled) setDays([]) })
    return () => { cancelled = true }
  }, [month, t])

  const clearAll = useCallback(() => {
    setIndustry([]); setPlace(null); setScale(null)
  }, [])

  const hasFilter = industry.length > 0 || place !== null || scale !== null

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-7">
      {/* ── 筛选条 ───────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-x-6 gap-y-3 mb-5">
        <FilterGroup label={t.basemap.filterIndustry}>
          {INDUSTRY_L1.map(o => (
            <Pill key={o.value}
                  active={industry.includes(o.value)}
                  onClick={() => setIndustry(prev =>
                    prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value])}>
              {enumLabel(INDUSTRY_L1, t.enum.industryL1 as Record<string, string>, o.value)}
            </Pill>
          ))}
        </FilterGroup>

        <FilterGroup label={t.basemap.filterCity}>
          <select
            value={place ? `${place.kind}:${place.name}` : ""}
            onChange={e => {
              const v = e.target.value
              if (!v) return setPlace(null)
              const i = v.indexOf(":")
              setPlace({ kind: v.slice(0, i) as Place["kind"], name: v.slice(i + 1) })
            }}
            className="h-7 px-2 rounded-[4px] bg-surface border border-hairline text-[12px] text-fg-muted"
          >
            <option value="">{t.common.all}</option>
            {/* 候选取「不带筛选时点位品牌数倒序前 30」，由服务端给 */}
            {placeOptions.map(p => (
              <option key={p.name} value={`${CITY_GEO[p.name] ? "city" : "country_cn"}:${p.name}`}>
                {p.name} ({fmtNum(locale, p.count)})
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label={t.basemap.filterScale}>
          {scaleKeys.map(k => (
            <Pill key={k}
                  active={scale === k}
                  onClick={() => setScale(scale === k ? null : k)}>
              {scaleLabels(t)[k]}
            </Pill>
          ))}
        </FilterGroup>

        {hasFilter && (
          <button onClick={clearAll}
                  className="text-[12px] text-fg-subtle hover:text-fg underline underline-offset-2">
            {t.common.clearFilters}
          </button>
        )}
        {busy && <span className="text-[11px] text-fg-faint">{t.common.loading}</span>}
      </div>

      {statsError && (
        <p className="mb-4 text-[12px] text-[var(--color-error-text)]">{statsError}</p>
      )}

      {/* ── 地图 58% + 日历 42% ──────────────────────────── */}
      <div className="grid grid-cols-[1.38fr_1fr] gap-6 items-start">
        <MapPanel t={t} locale={locale} points={stats.points} unlocated={stats.unlocated}
                  active={place} onPick={setPlace} />

        <CalendarPanel t={t} locale={locale} month={month} days={days} today={today}
                       onShift={d => setMonth(m => shiftMonth(m, d))}
                       onThisMonth={() => setMonth(initialMonth)}
                       onOpen={id => router.push(`/opportunity/${id}`)} />
      </div>

      {/* ── 四宫格（跟随筛选，不做同比）───────────────────── */}
      <div className="grid grid-cols-4 gap-6 mt-6">
        <MetricPanel t={t} locale={locale} label={t.basemap.trendVisitors}
                     value={stats.totals.visitors} brands={stats.totals.brands} scale={stats.scale} />
        <MetricPanel t={t} locale={locale} label={t.basemap.trendArea}
                     value={stats.totals.area} unit={t.common.unitArea} brands={stats.totals.brands}
                     scale={stats.scale} />
        <MetricPanel t={t} locale={locale} label={t.basemap.trendExhibitors}
                     value={stats.totals.exhibitors} brands={stats.totals.brands} scale={stats.scale} />
        <IndustryPanel t={t} locale={locale} brands={stats.totals.brands} industry={stats.industry} />
      </div>
    </div>
  )
}

/* ── 地图 ───────────────────────────────────────────────── */

function MapPanel({
  t, locale, points, unlocated, active, onPick,
}: {
  t: Dict
  locale: Locale
  points: ExpoStats["points"]
  unlocated: number
  active: Place | null
  onPick: (p: Place | null) => void
}) {
  return (
    <section className="relative rounded-[6px] border border-hairline overflow-hidden bg-surface">
      {/* 地图本体在 components/basemap/MapSvg.tsx —— 落地页复用同一个组件（TASK-J §4.4），
          这里只负责外框、可点选、以及「定位不到」那句报数 */}
      <MapSvg points={points} locale={locale} active={active?.name ?? null}
              onPick={(name) => onPick(name ? { kind: CITY_GEO[name] ? "city" : "country_cn", name } : null)} />

      {/* 定位不到的必须报数，不许静默丢（§4.1） */}
      {unlocated > 0 && (
        <p className="absolute right-3 bottom-2 text-[11px] text-fg-faint">
          {fill(t.basemap.unlocated, { count: fmtNum(locale, unlocated) })}
        </p>
      )}
    </section>
  )
}

/* ── 日历 ───────────────────────────────────────────────── */

function CalendarPanel({
  t, locale, month, days, today, onShift, onThisMonth, onOpen,
}: {
  t: Dict
  locale: Locale
  month: string
  days: CalendarDay[]
  today: string
  onShift: (delta: number) => void
  onThisMonth: () => void
  onOpen: (oppId: number) => void
}) {
  const [y, m] = month.split("-").map(Number)
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7   // 周一 = 0
  const dayCount = new Date(y, m, 0).getDate()
  const byDate = new Map(days.map(d => [d.date, d.items]))
  const week = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
  const weekday = t.basemap.weekday as Record<string, string>

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ]

  return (
    <section className="rounded-[6px] border border-hairline px-4 py-3.5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-medium text-fg-muted">{t.basemap.calendar}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => onShift(-1)} aria-label={t.basemap.prevMonth}
                  className="p-1 text-fg-subtle hover:text-fg">
            <ChevronLeft size={14} />
          </button>
          {/* 月份走 Intl（TASK-E §4.3）：中文「2026年9月」，英文「Sep 2026」 */}
          <span className="num text-[12px] text-fg min-w-[64px] text-center">
            {new Intl.DateTimeFormat(LOCALE_TAG[locale], { year: "numeric", month: "short" })
              .format(new Date(y, m - 1, 1))}
          </span>
          <button onClick={() => onShift(1)} aria-label={t.basemap.nextMonth}
                  className="p-1 text-fg-subtle hover:text-fg">
            <ChevronRight size={14} />
          </button>
          <button onClick={onThisMonth}
                  className="ml-1 text-[11px] text-fg-subtle hover:text-fg">
            {t.basemap.backToMonth}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-[10px] text-fg-faint mb-1">
        {week.map(w => <span key={w} className="text-center">{weekday[w]}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`x${i}`} />
          const date = `${month}-${String(day).padStart(2, "0")}`
          const items = byDate.get(date) ?? []
          const isToday = date === today
          return (
            <div key={date} className="min-h-[54px] rounded-[3px] px-1 py-0.5 bg-surface-elevated/40">
              <div className="flex items-center gap-1 mb-0.5">
                {/* 今天用中性色实心方块标记，不用橙色（§6.5） */}
                {isToday && <span className="w-1.5 h-1.5 bg-fg inline-block" />}
                <span className="num text-[10px] text-fg-faint">{day}</span>
              </div>
              {items.slice(0, 3).map((it, k) => (
                <button key={k} onClick={() => onOpen(it.opp_id)}
                        title={it.title}
                        className="w-full flex items-start gap-1 text-left mb-0.5 group">
                  <span className="mt-[3px] w-0.5 h-2.5 shrink-0 bg-fg-subtle" />
                  {it.time && <span className="num text-[9px] text-fg-faint shrink-0">{it.time}</span>}
                  <span className={`text-[9px] leading-[1.3] truncate ${it.overdue ? "text-[var(--color-error-text)]" : "text-fg-muted"}`}>
                    {it.text || it.title}
                  </span>
                </button>
              ))}
              {items.length > 3 && (
                <span className="num text-[9px] text-fg-faint">{`+${items.length - 3}`}</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── 四宫格 ─────────────────────────────────────────────── */

function MetricPanel({
  t, locale, label, value, brands, unit, scale,
}: {
  t: Dict
  locale: Locale
  label: string
  value: number
  brands: number
  unit?: string
  scale: ExpoStats["scale"]
}) {
  return (
    <section className="rounded-[6px] border border-hairline px-4 py-3.5">
      <h2 className="text-[11px] text-fg-subtle mb-2">{label}</h2>
      <p className="num text-[1.75rem] leading-none text-fg mb-2.5">
        {fmtNum(locale, value)}{unit && <span className="text-[13px] text-fg-subtle ml-1">{unit}</span>}
      </p>
      <ScaleBar t={t} scale={scale} />
      {/* 没有这行，读者会以为是某一年的市场总量（§4.3） */}
      <p className="mt-2 text-[10px] text-fg-faint">
        {fill(t.basemap.scaleCaption, { brands: fmtNum(locale, brands) })}
      </p>
    </section>
  )
}

/** 规模四档的横向分布。三块面板共用同一份数据，放三遍是版式需要。
 *  不画轴线、不画网格线，数值直接标在段内（§4.3）。 */
function ScaleBar({ t, scale }: { t: Dict; scale: ExpoStats["scale"] }) {
  const total = scale.reduce((s, b) => s + b.count, 0) || 1
  return (
    <div className="flex h-[9px] rounded-[2px] overflow-hidden bg-surface-elevated">
      {scale.map((b, i) => {
        const pct = (b.count / total) * 100
        const labels = t.basemap.scale as Record<string, string>
        return (
          <div key={b.key}
               title={`${labels[b.key]} · ${b.count}`}
               style={{ width: `${pct}%`, background: "var(--color-fg)", opacity: 0.85 - i * 0.18 }}
               className="flex items-center justify-center">
            {pct >= 12 && (
              <span className="num text-[9px] text-[var(--color-canvas)]">{b.count}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function IndustryPanel({
  t, locale, brands, industry,
}: {
  t: Dict
  locale: Locale
  brands: number
  industry: ExpoStats["industry"]
}) {
  return (
    <section className="rounded-[6px] border border-hairline px-4 py-3.5">
      <h2 className="text-[11px] text-fg-subtle mb-2">{t.basemap.trendSectors}</h2>
      <p className="num text-[1.75rem] leading-none text-fg mb-2.5">{fmtNum(locale, brands)}</p>
      {/* 单条横向堆叠条在 components/basemap/IndustryBar.tsx —— 落地页复用同一个组件 */}
      <IndustryBar industry={industry} t={t} locale={locale} />
    </section>
  )
}

/* ── 小件 ───────────────────────────────────────────────── */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-fg-faint">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  )
}

function Pill({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
            className={`h-7 px-2.5 rounded-[4px] text-[12px] border transition-colors ${
              active
                ? "bg-fg text-[var(--color-canvas)] border-fg"
                : "bg-surface text-fg-subtle border-hairline hover:text-fg"
            }`}>
      {children}
    </button>
  )
}
