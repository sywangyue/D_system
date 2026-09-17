"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle, ArrowRight, Building2, CalendarDays, CircleDot,
  Download, FileText, Flag, Inbox, MessageSquare, Paperclip, Store,
} from "lucide-react"
import { STAGES, stageIndex, type Stage } from "../types"
import { bizLineLabel, dealTypeLabel, slugLabel, stageLabel } from "@/lib/enums"
import {
  fill, fmtDate, fmtDateTime, fmtNum, type Dict, type Locale,
} from "@/lib/i18n-shared"
import { errorText } from "@/lib/i18n-shared"
import ResourceList, { type ResourceItem } from "@/components/resource/ResourceList"
import type {
  OppDetail, OppDetailBrand, OppDetailCompany, OppDetailEvent,
  OppDetailOpportunity, OppDetailReport,
} from "@/lib/queries/opportunity"

/**
 * 机会详情 —— 客户端部分，只管两件有状态的事：tab 切换与阶段推进。
 * 六块数据由服务端页取好传进来（含 detail_json 已解析的对象），这里不再发一次。
 *
 * 阶段推进必须走 PATCH —— 它会自动写一条 stage_change 事件，
 * 那是日后算阶段驻留天数与转化率的唯一数据源（规格 §3.4）。绕过就等于永久丢数据。
 */

type TabKey = "overview" | "research" | "timeline" | "brand"

/**
 * 三条业务线的 detail_json 键各不相同（规格 §3.2）。缺的键跳过，不显示 undefined。
 *
 * 标签写成取字典的函数而不是字面量：中文文案只有字典一处来源，
 * 这里若再留一份，切语言时必然与字典对不上。EBITDA 是通用缩写，不进字典。
 */
const DETAIL_FIELDS: Record<string, { key: string; label: (t: Dict) => string }[]> = {
  ma: [
    { key: "valuation_range",  label: t => t.opportunity.ma.priceRange },
    { key: "equity_pct",       label: t => t.opportunity.ma.equity },
    { key: "baseline_date",    label: t => t.opportunity.ma.baselineDate },
    { key: "ebitda",           label: () => "EBITDA" },
    { key: "audit_confidence", label: t => t.opportunity.ma.auditConfidence },
  ],
  greenfield: [
    { key: "market_size",      label: t => t.opportunity.ma.marketSize },
    { key: "existing_players", label: t => t.opportunity.ma.players },
    { key: "dead_brand_ids",   label: t => t.opportunity.ma.entryBrands },
    { key: "feasibility",      label: t => t.opportunity.ma.feasibility },
  ],
  project_support: [
    { key: "requester",           label: t => t.opportunity.ma.demandSide },
    { key: "deliverable",         label: t => t.opportunity.ma.deliverables },
    { key: "partner_company_ids", label: t => t.opportunity.ma.partner },
  ],
}

/* ── 取值格式化 ───────────────────────────────────────────── */

/** 把 detail_json 里的任意值渲染成一行文字；取不到就返回 null 让调用方跳过整行。 */
function renderValue(v: unknown, t: Dict): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string") return v.trim() === "" ? null : v
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null
  if (typeof v === "boolean") return v ? t.common.yes : t.common.no
  if (Array.isArray(v)) {
    const parts = v.map(x => renderValue(x, t)).filter((s): s is string => s !== null)
    return parts.length ? parts.join(t.common.listSep) : null
  }
  if (typeof v === "object") {
    const parts = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const s = renderValue(val, t)
        return s === null ? null : `${k} ${s}`
      })
      .filter((s): s is string => s !== null)
    return parts.length ? parts.join(" · ") : null
  }
  return null
}

const baseName = (p: string | null) => (p ? p.split("/").pop() || p : "")

/** stage_change 的 content 存的是裸键（"dd → audit"），中文只在这里翻译一次。 */
function stageEventText(content: string | null, t: Dict): string {
  if (!content) return t.enum.eventType.stage_change
  const [from, to] = content.split("→").map(s => s.trim())
  return `${stageLabel(t, from)} → ${stageLabel(t, to)}`
}

/* ── 主体 ─────────────────────────────────────────────────── */

export default function OpportunityDetail({
  detail, canWrite, today, locale, t,
}: {
  detail: OppDetail
  canWrite: boolean
  today: string
  locale: Locale
  t: Dict
}) {
  const router = useRouter()
  const o = detail.opportunity

  const [tab, setTab] = useState<TabKey>("overview")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const overdue = !!o.next_action_due && o.next_action_due < today

  // 「关联展会」为 null 时整个 tab 隐藏，不留空 tab（规格 §2.2）
  const tabs: { key: TabKey; label: string; n?: number }[] = [
    { key: "overview", label: t.opportunity.tabOverview },
    { key: "research", label: t.opportunity.tabResearch, n: detail.reports.length },
    { key: "timeline", label: t.opportunity.tabTimeline, n: detail.events.length },
    ...(detail.brand ? [{ key: "brand" as TabKey, label: t.opportunity.tabExpo }] : []),
  ]

  async function advance(next: Stage) {
    if (!canWrite || busy || next === o.stage) return
    setBusy(true); setErr("")
    try {
      const res = await fetch(`/api/opportunity/${o.opp_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(errorText(t, d.error, d.values, t.opportunity.advanceFailed))
      }
      // 服务端已写 stage_change 事件，重新拉一次数据让时间线立刻反映出来
      router.refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      {/* 字典里的 back 自带箭头（"← 机会台" / "← Pipeline"），不要再配一个 lucide 图标 */}
      <Link href="/opportunity"
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
        {t.opportunity.back}
      </Link>

      {/* ── 头部 ─────────────────────────────────────────── */}
      <div className="flex items-start gap-8 flex-wrap hairline-b pb-6 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5 flex-wrap mb-2.5">
            <h1 className="text-[1.5rem] font-medium leading-tight">{o.title}</h1>
            <Tag>{bizLineLabel(t, o.type)}</Tag>
            {/* deal_type 只对 ma 有意义，其余业务线为 null，不显示（规格 §3.3）。
                取值是中文原文（数据），显示标签走字典 enum.dealType。 */}
            {o.type === "ma" && o.deal_type && <Tag>{dealTypeLabel(t, o.deal_type)}</Tag>}
            {o.is_archived === 1 && <Tag>{t.opportunity.archived}</Tag>}
            {o.priority !== null && (
              <span className="num text-[11px] px-1.5 h-[17px] leading-[17px] rounded-[2px]
                               border border-hairline-active text-fg"
                    title={t.opportunity.priority}>P{o.priority}</span>
            )}
          </div>

          {/* 机会的英文标题（供德方阅读）跟在中文标题下 —— 它属于标题区，
              原先放在右栏「对标 MD 品牌」下，那里是 md_brand 的位置，语义不对。 */}
          {o.title_en && (
            <div className="lat text-[12px] text-fg-subtle mb-2">{o.title_en}</div>
          )}

          <div className="flex items-center gap-4 flex-wrap text-[12px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={12} />
              {t.common.owner} <span className="lat text-fg-muted">{o.owner || t.common.notAssigned}</span>
            </span>
            <span className="num">{t.common.updated} {fmtDateTime(locale, o.updated_at)}</span>
          </div>

          <div className="mt-3.5 rounded-[4px] border border-hairline bg-surface px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-fg-subtle">{t.opportunity.nextAction}</span>
              {o.next_action_due && (
                <span className={`num text-[11px] ${overdue
                  ? "text-[var(--color-error-text)]"
                  : "text-fg-muted"}`}>
                  {o.next_action_due}{overdue && t.opportunity.overdueSuffix}
                </span>
              )}
            </div>
            <div className="text-[13px] text-fg-muted">{o.next_action || t.common.notFilled}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StageStepper value={o.stage} busy={busy} t={t}
                        disabled={!canWrite} onAdvance={advance} />
          <div className="text-[11px] text-fg-faint">
            {canWrite ? t.opportunity.stageHint : t.opportunity.stageHintReadonly}
          </div>
          {err && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-error-text)]">
              <AlertCircle size={11} /> {err}
            </div>
          )}
        </div>
      </div>

      {/* ── 左 65% / 右 35% ──────────────────────────────── */}
      <div className="grid grid-cols-[65fr_35fr] gap-8 items-start">
        <div className="min-w-0">
          <div className="flex gap-6 hairline-b mb-5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`btn relative h-9 bg-transparent border-0 cursor-pointer text-[13px] px-0
                  ${tab === t.key ? "text-fg" : "text-fg-muted hover:text-fg"}`}
              >
                {t.label}
                {t.n !== undefined && t.n > 0 && (
                  <span className="num text-[10px] text-fg-subtle ml-1.5">{t.n}</span>
                )}
                {tab === t.key && (
                  <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-fg" />
                )}
              </button>
            ))}
          </div>

          {tab === "overview"  && <OverviewTab opp={o} t={t} />}
          {tab === "research"  && <ResearchTab reports={detail.reports} locale={locale} t={t} />}
          {tab === "timeline"  && <TimelineTab events={detail.events}
                                               resources={detail.resources}
                                               locale={locale} t={t} />}
          {tab === "brand" && detail.brand && <BrandTab brand={detail.brand} locale={locale} t={t} />}
        </div>

        <aside className="flex flex-col gap-6">
          <CompanyRail company={detail.company} t={t} />

          <Section label={t.opportunity.mdBrand} lat="Benchmark">
            {o.md_brand
              ? <div className="lat text-[14px]">{o.md_brand}</div>
              : <p className="text-[12px] text-fg-faint">{t.opportunity.mdBrandNone}</p>}
          </Section>

          {/* 「规模数据」区块按返工单 G-3 删除 ——
              同一屏上 110,000 / 1,035 / 54,000 原来出现两次（这里 + 关联展会 tab）。
              只保留 tab 里那份「最新一届规模」：规模数据只在 brand 存在时才有内容，
              而右栏其余三块（关联公司 / 对标 MD 品牌 / 资源）是常驻的。 */}

          {/* 资源区标题：opportunity.* 下暂无 "{count}" 模板，暂借 company.resources
              —— zh 与原文逐字相同（"资源 · 3"），en 为 "Resources · 3"，不留中文。
              字典补出 opportunity.resources 后改回即可。 */}
          <Section label={fill(t.company.resources, { count: detail.resources.length })}
                   lat={locale === "zh" ? "Resources" : undefined}>
            <ResourceList resources={detail.resources} t={t} locale={locale}
                          emptyText={t.opportunity.resourcesEmpty} />
          </Section>
        </aside>
      </div>
    </div>
  )
}

/* ── 阶段步进器 ───────────────────────────────────────────── */

/**
 * 五档阶段，当前档高亮，点任一档直接推进。
 * 全程中性色 —— 橙色只属于品牌板（规格 §2.1、§3.6）。
 */
function StageStepper({
  value, disabled, busy, t, onAdvance,
}: {
  value: Stage; disabled: boolean; busy: boolean; t: Dict; onAdvance: (s: Stage) => void
}) {
  const idx = stageIndex(value)
  return (
    <div className="flex items-stretch h-8 rounded-[4px] border border-hairline bg-surface overflow-hidden">
      {STAGES.map((s, i) => {
        const active = s.key === value
        const past = i < idx
        return (
          <Fragment key={s.key}>
            {i > 0 && <span className="w-px bg-hairline" />}
            <button
              type="button"
              onClick={() => onAdvance(s.key)}
              disabled={disabled || active}
              title={active
                ? fill(t.opportunity.stageCurrent, { stage: stageLabel(t, s.key) })
                : fill(t.opportunity.stageAdvanceTo, { stage: stageLabel(t, s.key) })}
              className={`btn h-full px-2.5 flex items-center gap-1.5 border-0 text-[12px] cursor-pointer
                disabled:cursor-default
                ${active
                  ? "bg-surface-hover text-fg"
                  : past
                    ? "bg-transparent text-fg-muted hover:text-fg"
                    : "bg-transparent text-fg-subtle hover:text-fg"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: active
                      ? "var(--color-fg)"
                      : past
                        ? "var(--color-fg-subtle)"
                        : "var(--color-fg-faint)" }} />
              {stageLabel(t, s.key)}
              {active && (
                <span className="num text-[10px] text-fg-subtle">{busy ? "…" : `${i + 1}/5`}</span>
              )}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

/* ── 左栏四个 tab ─────────────────────────────────────────── */

function OverviewTab({ opp, t }: { opp: OppDetailOpportunity; t: Dict }) {
  const rows = (DETAIL_FIELDS[opp.type] ?? [])
    .map(f => ({ key: f.key, label: f.label(t), value: renderValue(opp.detail_json?.[f.key], t) }))
    .filter((r): r is { key: string; label: string; value: string } => r.value !== null)

  if (rows.length === 0) {
    return <Empty icon={<Inbox size={18} />} title={t.opportunity.detail.emptyTitle}
                  hint={t.opportunity.detail.emptyHint} />
  }

  return (
    <div className="rounded-[6px] border border-hairline overflow-hidden">
      {rows.map((r, i) => (
        <div key={r.key}
             className={`grid grid-cols-[136px_1fr] gap-4 px-3.5 py-3 ${i > 0 ? "hairline-t" : ""}`}>
          <div className="text-[12px] text-fg-subtle">{r.label}</div>
          <div className="text-[13px] text-fg-muted break-words">{r.value}</div>
        </div>
      ))}
    </div>
  )
}

function ResearchTab({
  reports, locale, t,
}: { reports: OppDetailReport[]; locale: Locale; t: Dict }) {
  if (reports.length === 0) {
    return <Empty icon={<FileText size={18} />} title={t.opportunity.reportsEmpty}
                  hint={t.opportunity.reportsEmptyHint} />
  }
  return (
    <div className="hairline-t">
      {reports.map(r => (
        <Link key={r.id} href={`/research/${r.id}`}
              className="row flex items-center gap-3 h-12 px-1 hairline-b">
          <FileText size={14} className="text-fg-faint shrink-0" />
          <span className="text-[13px] text-fg-muted truncate flex-1">
            {r.title || slugLabel(t.enum.reportType, r.report_type)}
          </span>
          <Tag>{slugLabel(t.enum.reportType, r.report_type)}</Tag>
          {r.status === "draft" && <Tag>{slugLabel(t.enum.reportStatus, r.status)}</Tag>}
          <span className="num text-[11px] text-fg-subtle shrink-0">
            {fmtDate(locale, r.updated_at)}
          </span>
          <ArrowRight size={12} className="text-fg-faint shrink-0" />
        </Link>
      ))}
    </div>
  )
}

/**
 * 时间线倒序。排序键由查询层给定，是 COALESCE(NULLIF(occurred_at,''), created_at)，
 * 与下面显示的 `occurred_at || created_at` 同一个口径 —— 两者必须保持一致，
 * 否则填了 occurred_at 的事件会显示得比它的位置更早或更晚（返工单 G-2）。
 * 四类事件各有形态。
 */
function TimelineTab({
  events, resources, locale, t,
}: {
  events: OppDetailEvent[]; resources: ResourceItem[]; locale: Locale; t: Dict
}) {
  if (events.length === 0) {
    return <Empty icon={<Inbox size={18} />} title={t.opportunity.timelineEmpty} />
  }
  const byPath = new Map(resources.map(r => [r.file_path, r]))
  return (
    <div className="flex flex-col">
      {events.map(e => {
        const Icon = EVENT_ICON[e.event_type] ?? CircleDot
        const res = e.file_path ? byPath.get(e.file_path) : undefined
        return (
          <div key={e.event_id} className="flex gap-3.5 py-3 hairline-b">
            <span className="w-6 h-6 shrink-0 rounded-full bg-surface-elevated border border-hairline
                             flex items-center justify-center text-fg-subtle mt-0.5">
              <Icon size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[12px] text-fg">
                  {e.event_type === "stage_change"
                    ? stageEventText(e.content, t)
                    : slugLabel(t.enum.eventType, e.event_type)}
                </span>
                <span className="num text-[10px] text-fg-faint">
                  {fmtDateTime(locale, e.occurred_at || e.created_at)}
                </span>
                <span className="lat text-[10px] text-fg-faint">{e.created_by}</span>
              </div>

              {e.event_type === "file" && e.file_path && (
                res
                  ? <a href={`/api/resource/${res.resource_id}/download`} download
                       className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg">
                      <Download size={11} /> {baseName(e.file_path)}
                    </a>
                  : <div className="mt-1 text-[12px] text-fg-muted break-all">
                      {baseName(e.file_path)}
                      <span className="text-fg-faint">{t.opportunity.notIndexed}</span>
                    </div>
              )}

              {/* stage_change 的正文已由上面的中文标签表达，再渲染一遍裸键
                  （"dd → audit"）既是重复又把内部键值漏到了界面上；
                  file 的文件名也已单独处理。两者都不走这块正文。 */}
              {e.event_type !== "file" && e.event_type !== "stage_change" && e.content && (
                <p className="text-[13px] text-fg-muted mt-1 break-words">{e.content}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const EVENT_ICON = {
  stage_change: Flag,
  note: MessageSquare,
  meeting: CalendarDays,
  file: Paperclip,
  task_done: CircleDot,
} as const

function BrandTab({ brand, locale, t }: { brand: OppDetailBrand; locale: Locale; t: Dict }) {
  /**
   * num 是**字段自带的标记**，原来靠 `r.label === "品牌 ID"` 比中文字符串来决定等宽字体 ——
   * 标签改成字典取值后那种比法必然失效（英文版比不中，中文版改一个字也比不中）。
   */
  const rows: { label: string; value: string; num?: boolean }[] = [
    { label: t.opportunity.expo.brandId, value: brand.brand_id, num: true },
    { label: t.opportunity.expo.nameCn, value: brand.name_cn || "" },
    { label: t.opportunity.expo.nameEn, value: brand.name_en || "" },
    { label: t.opportunity.expo.city, value: brand.city || "" },
    { label: t.opportunity.expo.organizer, value: brand.organizer || "" },
    { label: t.opportunity.expo.industry, value: [brand.industry_l1, brand.industry_l2].filter(Boolean).join(" / ") },
    { label: t.opportunity.expo.ufi, value: brand.is_ufi_certified ? t.opportunity.expo.ufiYes : t.opportunity.expo.ufiNo },
    { label: t.opportunity.expo.latestEdition, value: brand.year ? fill(t.common.unitYear, { n: brand.year }) : "", num: true },
  ].filter(r => r.value !== "")

  return (
    <div>
      <div className="rounded-[6px] border border-hairline overflow-hidden mb-5">
        {rows.map((r, i) => (
          <div key={r.label}
               className={`grid grid-cols-[136px_1fr] gap-4 px-3.5 py-3 ${i > 0 ? "hairline-t" : ""}`}>
            <div className="text-[12px] text-fg-subtle">{r.label}</div>
            <div className={`text-[13px] text-fg-muted break-words ${r.num ? "num" : ""}`}>
              {r.value}
            </div>
          </div>
        ))}
      </div>

      <Section label={t.opportunity.expo.latestScale} lat="Latest Edition">
        <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-[4px] overflow-hidden">
          <Stat label={t.opportunity.expo.area}
                value={fmtNum(locale, brand.area_sqm)} unit={t.common.unitArea} />
          <Stat label={t.opportunity.expo.exhibitors}
                value={fmtNum(locale, brand.exhibitors_count)} unit={t.opportunity.expo.exhibitorsUnit} />
          <Stat label={t.opportunity.expo.visitorsCount}
                value={fmtNum(locale, brand.visitors_count)} unit={t.opportunity.expo.visitorsUnit} />
        </div>
      </Section>
    </div>
  )
}

/* ── 右栏 ─────────────────────────────────────────────────── */

function CompanyRail({ company, t }: { company: OppDetailCompany | null; t: Dict }) {
  if (!company) {
    return (
      <Section label={t.opportunity.company.title} lat="Entity">
        <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3">
          <div className="flex items-center gap-2 text-[13px] text-fg-muted mb-1.5">
            <Store size={13} className="text-fg-faint" /> {t.opportunity.company.empty}
          </div>
          <p className="text-[12px] text-fg-subtle leading-relaxed">
            {t.opportunity.company.emptyHint}
          </p>
        </div>
      </Section>
    )
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: t.opportunity.company.creditCode, value: company.credit_code || "", mono: true },
    { label: t.opportunity.company.legalRep,   value: company.oper_name || "" },
    { label: t.opportunity.company.founded,    value: company.start_date || "", mono: true },
    { label: t.opportunity.company.status,     value: company.company_status || "" },
  ].filter(r => r.value !== "")

  return (
    // 右上角固定拉丁标签 ENTITY —— 与同列 BENCHMARK / RESOURCES 保持同一种节奏。
    // 不要把经营状态塞到这里：它下面「经营状态」那一行已经显示过一次，
    // 而且一串中文长文案会打断这一列的拉丁小字规律（返工单 G-4）。
    <Section label={t.opportunity.company.title} lat="Entity">
      <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3">
        <div className="text-[14px] text-fg mb-0.5">{company.name || `#${company.company_id}`}</div>
        {company.name_en && (
          <div className="lat text-[11px] text-fg-subtle">{company.name_en}</div>
        )}
        {rows.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {rows.map(r => (
              <div key={r.label} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-fg-subtle shrink-0">{r.label}</span>
                <span className={`text-[12px] text-fg-muted text-right break-all
                                  ${r.mono ? "num" : ""}`}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        <Link href={`/company/${company.company_id}`}
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-fg-subtle hover:text-fg">
          {t.opportunity.company.view} <ArrowRight size={10} />
        </Link>
      </div>
    </Section>
  )
}

/* ── 小件 ─────────────────────────────────────────────────── */

function Section({
  label, lat, children,
}: {
  /** lat 省略则不渲染右上角小字：英文版标签本身就是拉丁，再挂一次是重复 */
  label: string; lat?: string; children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-[13px] font-medium text-fg-muted">{label}</h2>
        {lat && (
          <span className="lat text-[10px] uppercase tracking-wider text-fg-faint">{lat}</span>
        )}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-surface-elevated px-3 py-2.5">
      <div className="text-[11px] text-fg-subtle mb-1.5">{label}</div>
      <div className="num text-[18px] leading-none">{value}</div>
      <div className="num text-[10px] text-fg-faint mt-1">{unit}</div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-[10px]
                     bg-surface-elevated border border-hairline text-fg-subtle align-middle">
      {children}
    </span>
  )
}

function Empty({
  icon, title, hint,
}: {
  icon: React.ReactNode; title: string; hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 hairline-t text-fg-faint">
      <span className="opacity-50">{icon}</span>
      <span className="text-[13px] text-fg-muted">{title}</span>
      {hint && <span className="text-[12px] text-fg-faint">{hint}</span>}
    </div>
  )
}
