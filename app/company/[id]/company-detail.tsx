"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ArrowRight, FileText } from "lucide-react"
import ResourceList, { type ResourceItem } from "@/components/resource/ResourceList"
// 阶段中文只此一份（app/opportunity/types.ts）。跨路由引用一个纯数据模块，
// 好过在这里再抄一份五档映射 —— 两处映射早晚对不上。
import { STAGES } from "@/app/opportunity/types"

/**
 * 公司详情 —— 五块全都要落到页面上（TASK-C §2.2）：
 * 公司全字段 + 关联展会品牌 + 名下资源 + 引用它的机会 + 关联报告。
 *
 * 资源区是重点，用 components/resource/ResourceList（任务 G 提出来放进 components/ 的那份），
 * 不在这里重写一遍 —— 同一张列表维护两处早晚漂移。
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

const BIZ_LINE: Record<string, string> = {
  ma: "并购标的", greenfield: "全新品类", project_support: "项目组支持",
}
const REPORT_TYPE: Record<string, string> = {
  batch_prospect: "批量线索", industry_research: "行业调研", company_research: "公司尽调",
}

const stageLabel = (s: string | null) =>
  STAGES.find(x => x.key === s)?.label ?? (s || "—")

const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US")

export default function CompanyDetail({ id }: { id: string }) {
  const [data, setData] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/company/${id}`)
      if (res.status === 404) throw new Error("公司不存在")
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "加载失败")
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

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
          <ArrowLeft size={13} /> 返回公司库
        </Link>
        <div className="flex items-center gap-2 text-[14px] text-[var(--color-error-text)]">
          <AlertCircle size={15} /> {error}
          <button onClick={load}
                  className="btn text-fg bg-transparent border-0 cursor-pointer text-[13px]
                             underline underline-offset-4 ml-2">重试</button>
        </div>
      </div>
    )
  }

  if (!data) return null
  const c = data.company

  const info: { label: string; value: string; mono?: boolean }[] = [
    { label: "统一社会信用代码", value: c.credit_code || "", mono: true },
    { label: "法定代表人",       value: c.oper_name || "" },
    { label: "成立日期",         value: c.start_date || "", mono: true },
    { label: "注册号",           value: c.reg_no || "", mono: true },
    { label: "注册地址",         value: c.address || "" },
    { label: "邮箱",             value: c.email || "" },
  ].filter(r => r.value !== "")

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      <Link href="/company"
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
        <ArrowLeft size={13} /> 返回公司库
      </Link>

      {/* ── 头部：公司名 + 类型徽标 + 经营状态 ──────────────── */}
      <div className="hairline-b pb-6 mb-6">
        <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
          <h1 className="text-[1.5rem] font-medium leading-tight">{c.name || `#${c.company_id}`}</h1>
          {/* type 仓库里没有中文映射，原样显示英文值（见交付说明） */}
          {c.type && <span className="lat text-[11px]"><Tag>{c.type}</Tag></span>}
          {c.company_status && <Tag>{c.company_status}</Tag>}
        </div>
        {c.name_en && <div className="lat text-[12px] text-fg-subtle mb-2">{c.name_en}</div>}
        <div className="flex items-center gap-4 flex-wrap text-[12px] text-fg-subtle">
          <span>来源 <span className="lat text-fg-muted">{c.source_type || "—"}</span></span>
          <span className="num">更新 {(c.updated_at || "").slice(0, 16) || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-[65fr_35fr] gap-8 items-start">
        {/* ── 左：工商信息 + 资源 ─────────────────────────── */}
        <div className="min-w-0 flex flex-col gap-7">
          <Section label="工商信息" lat="Registration">
            {info.length === 0 ? (
              <p className="text-[12px] text-fg-faint">这家公司还没有工商信息</p>
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

          <Section label={`资源 · ${data.resources.length}`} lat="Resources">
            <ResourceList resources={data.resources} emptyText="这家公司名下还没有资源" />
          </Section>

          {/* brand 为 null 时整块不渲染（规格 §2.2） */}
          {data.brand && (
            <Section label="关联展会品牌" lat="Brand">
              <div className="rounded-[6px] border border-hairline overflow-hidden">
                <InfoRow label="品牌名" value={data.brand.name_cn || data.brand.brand_id} />
                {data.brand.name_en && <InfoRow label="英文名" value={data.brand.name_en} lat />}
                {data.brand.city && <InfoRow label="城市" value={data.brand.city} />}
                {data.brand.organizer && <InfoRow label="主办方" value={data.brand.organizer} />}
                {(data.brand.industry_l1 || data.brand.industry_l2) && (
                  <InfoRow label="行业"
                           value={[data.brand.industry_l1, data.brand.industry_l2].filter(Boolean).join(" / ")} />
                )}
                {data.brand.year !== null && (
                  <InfoRow label="最新一届"
                           value={`${data.brand.year} 年 · 面积 ${fmtNum(data.brand.area_sqm)} ㎡ · `
                                  + `展商 ${fmtNum(data.brand.exhibitors_count)} · `
                                  + `观众 ${fmtNum(data.brand.visitors_count)}`} />
                )}
              </div>
            </Section>
          )}
        </div>

        {/* ── 右：关联机会 + 关联报告 ─────────────────────── */}
        <aside className="flex flex-col gap-7">
          <Section label={`关联机会 · ${data.opportunities.length}`} lat="Opportunities">
            {data.opportunities.length === 0 ? (
              <p className="text-[12px] text-fg-faint">还没有引用这家公司的机会</p>
            ) : (
              <div className="hairline-t">
                {data.opportunities.map(o => (
                  <Link key={o.opp_id} href={`/opportunity/${o.opp_id}`}
                        className="row flex items-center gap-2.5 h-11 px-1 hairline-b">
                    <span className="text-[12px] text-fg-muted truncate flex-1">
                      {o.title || `#${o.opp_id}`}
                    </span>
                    <span className="shrink-0"><Tag>{BIZ_LINE[o.type || ""] || o.type || "—"}</Tag></span>
                    <span className="text-[11px] text-fg-subtle shrink-0">{stageLabel(o.stage)}</span>
                    <ArrowRight size={11} className="text-fg-faint shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section label={`关联报告 · ${data.reports.length}`} lat="Reports">
            {data.reports.length === 0 ? (
              <p className="text-[12px] text-fg-faint">这家公司名下还没有调研报告</p>
            ) : (
              <div className="hairline-t">
                {data.reports.map(r => (
                  <Link key={r.id} href={`/research/${r.id}`}
                        className="row flex items-center gap-2.5 h-11 px-1 hairline-b">
                    <FileText size={12} className="text-fg-faint shrink-0" />
                    <span className="text-[12px] text-fg-muted truncate flex-1">
                      {r.title || REPORT_TYPE[r.report_type] || r.report_type}
                    </span>
                    {r.status === "draft" && <Tag>草稿</Tag>}
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
