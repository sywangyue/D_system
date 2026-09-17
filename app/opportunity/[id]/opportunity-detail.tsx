"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, CalendarDays, CircleDot,
  Download, FileText, Flag, Inbox, MessageSquare, Paperclip, Store,
} from "lucide-react"
import { BIZ_LINES, STAGES, stageIndex, type Stage } from "../types"
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

const REPORT_TYPE: Record<string, string> = {
  batch_prospect: "批量线索", industry_research: "行业调研", company_research: "公司尽调",
}
const STAGE_CN: Record<string, string> = {
  contact: "接洽", intent: "意向", dd: "尽调", audit: "审计", closing: "交割",
}

/** 三条业务线的 detail_json 键各不相同（规格 §3.2）。缺的键跳过，不显示 undefined。 */
const DETAIL_FIELDS: Record<string, { key: string; label: string }[]> = {
  ma: [
    { key: "valuation_range",  label: "对价区间" },
    { key: "equity_pct",       label: "股权比例" },
    { key: "baseline_date",    label: "评估基准日" },
    { key: "ebitda",           label: "EBITDA" },
    { key: "audit_confidence", label: "审计置信度" },
  ],
  greenfield: [
    { key: "market_size",      label: "市场规模" },
    { key: "existing_players", label: "现有玩家" },
    { key: "dead_brand_ids",   label: "可切入品牌" },
    { key: "feasibility",      label: "可行性" },
  ],
  project_support: [
    { key: "requester",           label: "需求方" },
    { key: "deliverable",         label: "交付物" },
    { key: "partner_company_ids", label: "合作公司" },
  ],
}

/* ── 取值格式化 ───────────────────────────────────────────── */

/** 把 detail_json 里的任意值渲染成一行文字；取不到就返回 null 让调用方跳过整行。 */
function renderValue(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string") return v.trim() === "" ? null : v
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : null
  if (typeof v === "boolean") return v ? "是" : "否"
  if (Array.isArray(v)) {
    const parts = v.map(renderValue).filter((s): s is string => s !== null)
    return parts.length ? parts.join("、") : null
  }
  if (typeof v === "object") {
    const parts = Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const s = renderValue(val)
        return s === null ? null : `${k} ${s}`
      })
      .filter((s): s is string => s !== null)
    return parts.length ? parts.join(" · ") : null
  }
  return null
}

const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US")

const baseName = (p: string | null) => (p ? p.split("/").pop() || p : "")

/** stage_change 的 content 存的是裸键（"dd → audit"），中文只在这里翻译一次。 */
function stageEventText(content: string | null): string {
  if (!content) return "阶段变更"
  const [from, to] = content.split("→").map(s => s.trim())
  return `${STAGE_CN[from] ?? from} → ${STAGE_CN[to] ?? to}`
}

/* ── 主体 ─────────────────────────────────────────────────── */

export default function OpportunityDetail({
  detail, canWrite, today,
}: {
  detail: OppDetail
  canWrite: boolean
  today: string
}) {
  const router = useRouter()
  const o = detail.opportunity

  const [tab, setTab] = useState<TabKey>("overview")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const overdue = !!o.next_action_due && o.next_action_due < today
  const biz = BIZ_LINES.find(l => l.key === o.type)

  // 「关联展会」为 null 时整个 tab 隐藏，不留空 tab（规格 §2.2）
  const tabs: { key: TabKey; label: string; n?: number }[] = [
    { key: "overview", label: "概览" },
    { key: "research", label: "深度调研", n: detail.reports.length },
    { key: "timeline", label: "时间线", n: detail.events.length },
    ...(detail.brand ? [{ key: "brand" as TabKey, label: "关联展会" }] : []),
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
        throw new Error((d as { error?: string }).error || "推进阶段失败")
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
      <Link href="/opportunity"
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
        <ArrowLeft size={13} /> 返回机会台
      </Link>

      {/* ── 头部 ─────────────────────────────────────────── */}
      <div className="flex items-start gap-8 flex-wrap hairline-b pb-6 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5 flex-wrap mb-2.5">
            <h1 className="text-[1.5rem] font-medium leading-tight">{o.title}</h1>
            <Tag>{biz?.label ?? o.type}</Tag>
            {/* deal_type 只对 ma 有意义，其余业务线为 null，不显示（规格 §3.3） */}
            {o.type === "ma" && o.deal_type && <Tag>{o.deal_type}</Tag>}
            {o.is_archived === 1 && <Tag>已归档</Tag>}
            {o.priority !== null && (
              <span className="num text-[11px] px-1.5 h-[17px] leading-[17px] rounded-[2px]
                               border border-hairline-active text-fg"
                    title="优先级">P{o.priority}</span>
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
              负责人 <span className="lat text-fg-muted">{o.owner || "未指派"}</span>
            </span>
            <span className="num">更新 {(o.updated_at || "").slice(0, 16) || "—"}</span>
          </div>

          <div className="mt-3.5 rounded-[4px] border border-hairline bg-surface px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-fg-subtle">下一步</span>
              {o.next_action_due && (
                <span className={`num text-[11px] ${overdue
                  ? "text-[var(--color-error-text)]"
                  : "text-fg-muted"}`}>
                  {o.next_action_due}{overdue && " · 已逾期"}
                </span>
              )}
            </div>
            <div className="text-[13px] text-fg-muted">{o.next_action || "未填写"}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StageStepper value={o.stage} busy={busy}
                        disabled={!canWrite} onAdvance={advance} />
          <div className="text-[11px] text-fg-faint">
            {canWrite ? "点任一阶段可直接推进" : "只读账号不可推进阶段"}
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

          {tab === "overview"  && <OverviewTab opp={o} />}
          {tab === "research"  && <ResearchTab reports={detail.reports} />}
          {tab === "timeline"  && <TimelineTab events={detail.events}
                                               resources={detail.resources} />}
          {tab === "brand" && detail.brand && <BrandTab brand={detail.brand} />}
        </div>

        <aside className="flex flex-col gap-6">
          <CompanyRail company={detail.company} />

          <Section label="对标 MD 品牌" lat="Benchmark">
            {o.md_brand
              ? <div className="lat text-[14px]">{o.md_brand}</div>
              : <p className="text-[12px] text-fg-faint">未标注对标品牌</p>}
          </Section>

          {/* 「规模数据」区块按返工单 G-3 删除 ——
              同一屏上 110,000 / 1,035 / 54,000 原来出现两次（这里 + 关联展会 tab）。
              只保留 tab 里那份「最新一届规模」：规模数据只在 brand 存在时才有内容，
              而右栏其余三块（关联公司 / 对标 MD 品牌 / 资源）是常驻的。 */}

          <Section label={`资源 · ${detail.resources.length}`} lat="Resources">
            <ResourceList resources={detail.resources}
                          emptyText="这一机会及其关联公司名下还没有资源" />
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
  value, disabled, busy, onAdvance,
}: {
  value: Stage; disabled: boolean; busy: boolean; onAdvance: (s: Stage) => void
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
              title={active ? `当前阶段：${s.label}` : `推进到「${s.label}」`}
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
              {s.label}
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

function OverviewTab({ opp }: { opp: OppDetailOpportunity }) {
  const rows = (DETAIL_FIELDS[opp.type] ?? [])
    .map(f => ({ label: f.label, value: renderValue(opp.detail_json?.[f.key]) }))
    .filter((r): r is { label: string; value: string } => r.value !== null)

  if (rows.length === 0) {
    return <Empty icon={<Inbox size={18} />} title="尚未填写详细信息"
                  hint="这条机会的入参还没有落到 detail_json" />
  }

  return (
    <div className="rounded-[6px] border border-hairline overflow-hidden">
      {rows.map((r, i) => (
        <div key={r.label}
             className={`grid grid-cols-[136px_1fr] gap-4 px-3.5 py-3 ${i > 0 ? "hairline-t" : ""}`}>
          <div className="text-[12px] text-fg-subtle">{r.label}</div>
          <div className="text-[13px] text-fg-muted break-words">{r.value}</div>
        </div>
      ))}
    </div>
  )
}

function ResearchTab({ reports }: { reports: OppDetailReport[] }) {
  if (reports.length === 0) {
    return <Empty icon={<FileText size={18} />} title="还没有关联的调研报告"
                  hint="挂上公司后会自动带出该公司名下的报告" />
  }
  return (
    <div className="hairline-t">
      {reports.map(r => (
        <Link key={r.id} href={`/research/${r.id}`}
              className="row flex items-center gap-3 h-12 px-1 hairline-b">
          <FileText size={14} className="text-fg-faint shrink-0" />
          <span className="text-[13px] text-fg-muted truncate flex-1">
            {r.title || REPORT_TYPE[r.report_type] || r.report_type}
          </span>
          <Tag>{REPORT_TYPE[r.report_type] || r.report_type}</Tag>
          {r.status === "draft" && <Tag>草稿</Tag>}
          <span className="num text-[11px] text-fg-subtle shrink-0">
            {(r.updated_at || "").slice(0, 10)}
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
  events, resources,
}: {
  events: OppDetailEvent[]; resources: ResourceItem[]
}) {
  if (events.length === 0) {
    return <Empty icon={<Inbox size={18} />} title="还没有记录" />
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
                    ? stageEventText(e.content)
                    : EVENT_LABEL[e.event_type] ?? e.event_type}
                </span>
                <span className="num text-[10px] text-fg-faint">
                  {e.occurred_at || e.created_at}
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
                      <span className="text-fg-faint"> · 未登记进资源库</span>
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

const EVENT_LABEL: Record<string, string> = {
  note: "记录", meeting: "会议", file: "上传附件", task_done: "已完成",
}

function BrandTab({ brand }: { brand: OppDetailBrand }) {
  const rows: { label: string; value: string }[] = [
    { label: "品牌 ID", value: brand.brand_id },
    { label: "中文名", value: brand.name_cn || "" },
    { label: "英文名", value: brand.name_en || "" },
    { label: "城市", value: brand.city || "" },
    { label: "主办方", value: brand.organizer || "" },
    { label: "行业", value: [brand.industry_l1, brand.industry_l2].filter(Boolean).join(" / ") },
    { label: "UFI 认证", value: brand.is_ufi_certified ? "是" : "否" },
    { label: "最新一届", value: brand.year ? `${brand.year} 年` : "" },
  ].filter(r => r.value !== "")

  return (
    <div>
      <div className="rounded-[6px] border border-hairline overflow-hidden mb-5">
        {rows.map((r, i) => (
          <div key={r.label}
               className={`grid grid-cols-[136px_1fr] gap-4 px-3.5 py-3 ${i > 0 ? "hairline-t" : ""}`}>
            <div className="text-[12px] text-fg-subtle">{r.label}</div>
            <div className={`text-[13px] text-fg-muted break-words
                             ${r.label === "品牌 ID" || r.label === "最新一届" ? "num" : ""}`}>
              {r.value}
            </div>
          </div>
        ))}
      </div>

      <Section label="最新一届规模" lat="Latest Edition">
        <div className="grid grid-cols-3 gap-px bg-hairline border border-hairline rounded-[4px] overflow-hidden">
          <Stat label="展览面积" value={fmtNum(brand.area_sqm)} unit="㎡" />
          <Stat label="展商数"   value={fmtNum(brand.exhibitors_count)} unit="家" />
          <Stat label="观众数"   value={fmtNum(brand.visitors_count)} unit="人次" />
        </div>
      </Section>
    </div>
  )
}

/* ── 右栏 ─────────────────────────────────────────────────── */

function CompanyRail({ company }: { company: OppDetailCompany | null }) {
  if (!company) {
    return (
      <Section label="关联公司" lat="Entity">
        <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3">
          <div className="flex items-center gap-2 text-[13px] text-fg-muted mb-1.5">
            <Store size={13} className="text-fg-faint" /> 未关联公司
          </div>
          <p className="text-[12px] text-fg-subtle leading-relaxed">
            关联后可自动带出其调研报告与原始数据
          </p>
        </div>
      </Section>
    )
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "统一社会信用代码", value: company.credit_code || "", mono: true },
    { label: "法定代表人",       value: company.oper_name || "" },
    { label: "成立日期",         value: company.start_date || "", mono: true },
    { label: "经营状态",         value: company.company_status || "" },
  ].filter(r => r.value !== "")

  return (
    // 右上角固定拉丁标签 ENTITY —— 与同列 BENCHMARK / RESOURCES 保持同一种节奏。
    // 不要把经营状态塞到这里：它下面「经营状态」那一行已经显示过一次，
    // 而且一串中文长文案会打断这一列的拉丁小字规律（返工单 G-4）。
    <Section label="关联公司" lat="Entity">
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
          查看公司详情 <ArrowRight size={10} />
        </Link>
      </div>
    </Section>
  )
}

/* ── 小件 ─────────────────────────────────────────────────── */

function Section({
  label, lat, children,
}: {
  label: string; lat: string; children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-[13px] font-medium text-fg-muted">{label}</h2>
        <span className="lat text-[10px] uppercase tracking-wider text-fg-faint">{lat}</span>
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
