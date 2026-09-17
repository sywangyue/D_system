"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ArrowRight, FileText } from "lucide-react"
import ResourceList, { type ResourceItem } from "@/components/resource/ResourceList"
import { fill, fmtDateTime, fmtNum, type Dict, type Locale } from "@/lib/i18n-shared"
import { errorText } from "@/lib/i18n-shared"
import {
  COMPANY_STATUS, COMPANY_TYPE, SOURCE_TYPE,
  bizLineLabel, enumLabel, slugLabel, stageLabel,
} from "@/lib/enums"

/**
 * 公司详情 —— 五块全都要落到页面上（TASK-C §2.2）：
 * 公司全字段 + 关联展会品牌 + 名下资源 + 引用它的机会 + 关联报告。
 *
 * 资源区是重点，用 components/resource/ResourceList（任务 G 提出来放进 components/ 的那份），
 * 不在这里重写一遍 —— 同一张列表维护两处早晚漂移。
 *
 * 文案一律走字典（t / locale 由 app/company/[id]/page.tsx 传下来）；
 * 闭集取值（类型 / 经营状态 / 来源 / 报告类型 / 业务线 / 阶段）的中文映射
 * 只此一份，在 lib/enums.ts + locales/*.json —— 这里不再各抄一张表。
 * 自由文本（公司名 / 品牌名 / 机会标题 / 报告标题 / 法定代表人）原样显示，不查字典。
 *
 * ⚠️ company 表没有 is_archived，所以没有归档过滤，也不做删除入口。
 */

interface Company {
  company_id: number
  name: string | null
  name_en: string | null
  type: string | null
  company_status: string | null
  credit_code: string | null
  oper_name: string | null
  start_date: string | null
  reg_no: string | null
  address: string | null
  email: string | null
  city: string | null
  country: string | null
  source_type: string | null
  brand_id: string | null
  created_at: string | null
  updated_at: string | null
}

interface Brand {
  brand_id: string
  name_cn: string | null
  name_en: string | null
  city: string | null
  organizer: string | null
  industry_l1: string | null
  industry_l2: string | null
  year: number | null
  area_sqm: number | null
  exhibitors_count: number | null
  visitors_count: number | null
}

interface OpportunityRow {
  opp_id: number
  title: string | null
  type: string | null
  stage: string | null
  owner: string | null
  updated_at: string | null
}

interface ReportRow {
  id: number
  title: string | null
  report_type: string
  status: string
  updated_at: string | null
}

interface CompanyData {
  company: Company
  brand: Brand | null
  resources: ResourceItem[]
  opportunities: OpportunityRow[]
  reports: ReportRow[]
}

export default function CompanyDetail({ id, locale, t }: { id: string; locale: Locale; t: Dict }) {
  const [data, setData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/company/${id}`)
      if (res.status === 404) throw new Error(t.company.notFound)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(errorText(t, err.error, err.values, t.empty.loadFailed))
      }
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => { load() }, [load])

  // 标签表：enum.* 的键是 slug，取值表在 lib/enums.ts
  const statusMap = t.enum.companyStatus as Record<string, string>
  const typeMap = t.enum.companyType as Record<string, string>
  const sourceMap = t.enum.sourceType as Record<string, string>
  const reportTypeMap = t.enum.reportType as Record<string, string>
  const reportStatusMap = t.enum.reportStatus as Record<string, string>

  if (loading) {
    return (
      <div className="max-w-[1180px] mx-auto px-8 py-9 flex flex-col gap-4">
        <div className="skeleton h-3.5 w-32" />
        <div className="skeleton h-7 w-96" />
        <div className="skeleton h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-[1180px] mx-auto px-8 py-9">
        <Link href="/company"
              className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
          <ArrowLeft size={13} /> {t.nav.entities}
        </Link>
        <div className="flex items-center gap-2 text-[14px] text-[var(--color-error-text)]">
          <AlertCircle size={15} /> {error}
          <button onClick={load}
                  className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px]
                             underline underline-offset-4 ml-2">{t.common.retry}</button>
        </div>
      </div>
    )
  }

  if (!data) return null
  const c = data.company

  // 工商信息：label 全部走字典，自由文本字段原样显示，空值整行不渲染
  const info: { label: string; value: string; mono?: boolean }[] = [
    { label: t.company.creditCode, value: c.credit_code || "", mono: true },
    { label: t.company.legalRep,   value: c.oper_name || "" },
    { label: t.company.founded,    value: c.start_date || "", mono: true },
    { label: t.company.regNo,      value: c.reg_no || "", mono: true },
    { label: t.company.address,    value: c.address || "" },
    { label: t.company.email,      value: c.email || "" },
  ].filter(r => r.value !== "")

  // 最新一届：数字走 Intl 格式化后再填进模板，单位与语序由字典决定（中英不同序）
  const editionStats = (b: Brand) => fill(t.company.editionStats, {
    year:       fmtNum(locale, b.year),
    area:       fmtNum(locale, b.area_sqm),
    exhibitors: fmtNum(locale, b.exhibitors_count),
    visitors:   fmtNum(locale, b.visitors_count),
  })

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      <Link href="/company"
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
        <ArrowLeft size={13} /> {t.nav.entities}
      </Link>

      {/* ── 头部：公司名 + 类型徽标 + 经营状态 ──────────────── */}
      <div className="hairline-b pb-6 mb-6">
        <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
          <h1 className="text-[1.5rem] font-medium leading-tight">{c.name || `#${c.company_id}`}</h1>
          {/* 类型与经营状态是闭集，按 locale 出标签；自由文本（公司名）不翻 */}
          {c.type && <span className="text-[11px]"><Tag>{enumLabel(COMPANY_TYPE, typeMap, c.type)}</Tag></span>}
          {c.company_status && <Tag>{enumLabel(COMPANY_STATUS, statusMap, c.company_status)}</Tag>}
        </div>
        {c.name_en && <div className="lat text-[12px] text-fg-subtle mb-2">{c.name_en}</div>}
        <div className="flex items-center gap-4 flex-wrap text-[12px] text-fg-subtle">
          <span>{t.company.source} <span className="text-fg-muted">{enumLabel(SOURCE_TYPE, sourceMap, c.source_type)}</span></span>
          <span className="num">{t.common.updated} {fmtDateTime(locale, c.updated_at)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[65fr_35fr] gap-8 items-start">
        {/* ── 左：工商信息 + 资源 ─────────────────────────── */}
        <div className="min-w-0 flex flex-col gap-7">
          <Section label={t.company.registration} lat="Registration">
            {info.length === 0 ? (
              <p className="text-[12px] text-fg-faint">{t.company.registrationEmpty}</p>
            ) : (
              <div className="rounded-[6px] border border-hairline overflow-hidden">
                {info.map((r, i) => (
                  <div key={r.label}
                       className={`grid grid-cols-[150px_1fr] gap-4 px-3.5 py-3 ${i > 0 ? "hairline-t" : ""}`}>
                    <div className="text-[12px] text-fg-subtle">{r.label}</div>
                    <div className={`text-[13px] text-fg-muted break-words ${r.mono ? "num" : ""}`}>
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section label={fill(t.company.resources, { count: String(data.resources.length) })} lat="Resources">
            <ResourceList resources={data.resources} t={t} locale={locale}
                          emptyText={t.company.resourcesEmpty} />
          </Section>

          {/* brand 为 null 时整块不渲染（规格 §2.2） */}
          {data.brand && (
            <Section label={t.company.brand} lat="Brand">
              <div className="rounded-[6px] border border-hairline overflow-hidden">
                <InfoRow label={t.company.brandName} value={data.brand.name_cn || data.brand.brand_id} />
                {data.brand.name_en && <InfoRow label={t.company.brandNameEn} value={data.brand.name_en} lat />}
                {data.brand.city && <InfoRow label={t.company.city} value={data.brand.city} />}
                {data.brand.organizer && <InfoRow label={t.company.organizer} value={data.brand.organizer} />}
                {(data.brand.industry_l1 || data.brand.industry_l2) && (
                  <InfoRow label={t.company.industry}
                           value={[data.brand.industry_l1, data.brand.industry_l2].filter(Boolean).join(" / ")} />
                )}
                {data.brand.year !== null && (
                  <InfoRow label={t.company.latestEdition} value={editionStats(data.brand)} />
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ── 右：关联机会 + 关联报告 ─────────────────────── */}
        <aside className="flex flex-col gap-7">
          <Section label={fill(t.company.opportunities, { count: String(data.opportunities.length) })}
                   lat="Opportunities">
            {data.opportunities.length === 0 ? (
              <p className="text-[12px] text-fg-faint">{t.company.opportunitiesEmpty}</p>
            ) : (
              <div className="hairline-t">
                {data.opportunities.map(o => (
                  <Link key={o.opp_id} href={`/opportunity/${o.opp_id}`}
                        className="row flex items-center gap-2.5 h-11 px-1 hairline-b">
                    <span className="text-[12px] text-fg-muted truncate flex-1">
                      {o.title || `#${o.opp_id}`}
                    </span>
                    <span className="shrink-0"><Tag>{bizLineLabel(t, o.type)}</Tag></span>
                    <span className="text-[11px] text-fg-subtle shrink-0">{stageLabel(t, o.stage)}</span>
                    <ArrowRight size={11} className="text-fg-faint shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section label={fill(t.company.reports, { count: String(data.reports.length) })} lat="Reports">
            {data.reports.length === 0 ? (
              <p className="text-[12px] text-fg-faint">{t.company.reportsEmpty}</p>
            ) : (
              <div className="hairline-t">
                {data.reports.map(r => (
                  <Link key={r.id} href={`/research/${r.id}`}
                        className="row flex items-center gap-2.5 h-11 px-1 hairline-b">
                    <FileText size={12} className="text-fg-faint shrink-0" />
                    <span className="text-[12px] text-fg-muted truncate flex-1">
                      {r.title || slugLabel(reportTypeMap, r.report_type)}
                    </span>
                    {r.status === "draft" && <Tag>{slugLabel(reportStatusMap, r.status)}</Tag>}
                    <ArrowRight size={11} className="text-fg-faint shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </aside>
      </div>
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Section({ label, lat, children }: {
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

function InfoRow({ label, value, lat }: { label: string; value: string; lat?: boolean }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-4 px-3.5 py-3 hairline-t first:border-t-0 border-hairline">
      <div className="text-[12px] text-fg-subtle">{label}</div>
      <div className={`text-[13px] text-fg-muted break-words ${lat ? "lat" : ""}`}>{value}</div>
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
