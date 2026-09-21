"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { AlertCircle, ArrowLeft, Link2, Search, Store, X } from "lucide-react"
import ResourceList, { type ResourceItem } from "@/components/resource/ResourceList"
import { COMPANY_STATUS, enumLabel, slugLabel } from "@/lib/enums"
import { errorText, fill, fmtDateTime, type Locale, type Dict } from "@/lib/i18n-shared"

/**
 * 调研报告详情 —— 这里才拿全文（report_md，可达几万字），列表页永远只吃 160 字摘要。
 *
 * report_md 用 Markdown 渲染，容器带 prose-cjk（中文排版规范 R3：长文行高 1.8）。
 * 表格由 remark-gfm 支持 —— 任务 D 回填的 11 份 docx 里有大量表格
 * （FPackAsia 一份就有 27 张），没有 GFM 会整片塌成纯文本。
 * ⚠️ report_md 与报告标题是**数据**，任何语言下一律原样渲染，绝不进字典。
 *
 * ⚠️ 主键是裸 `id`。⚠️ 这张表没有 is_archived，所以不做删除入口。
 */

interface Company {
  company_id: number
  name: string | null
  credit_code: string | null
  oper_name: string | null
  company_status: string | null
}

/** 公司搜索命中项 —— /api/company 列表端点返回的子集 */
interface CompanyHit {
  company_id: number
  name: string | null
  company_status: string | null
}

interface Report {
  id: number
  title: string | null
  report_type: string
  status: string
  report_md: string
  report_file: string
  target_company: string | null
  created_at: string | null
  updated_at: string | null
}

interface ReportData {
  report: Report
  company: Company | null
  resources: ResourceItem[]
}

/**
 * report_type / status 都是闭集 slug，slug 既是键又是值 —— 标签一律走
 * slugLabel(t.enum.reportType / t.enum.reportStatus)，页面里不留中文映射。
 */

export default function ResearchDetail({ id, locale, t, canWrite }: {
  id: string; locale: Locale; t: Dict; canWrite: boolean
}) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // 关联公司的就地编辑。后端 PATCH 早就收 company_id，缺的一直是这个入口。
  const [picking, setPicking] = useState(false)
  const [cq, setCq] = useState("")
  const [hits, setHits] = useState<CompanyHit[]>([])
  const [linking, setLinking] = useState(false)
  const [linkErr, setLinkErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/research/${id}`)
      if (res.status === 404) throw new Error(t.research.notFound)
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

  // 公司搜索：300ms 防抖，与新建机会抽屉同一套（app/opportunity/new-drawer.tsx）
  useEffect(() => {
    if (!cq.trim()) { setHits([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/company?size=6&q=${encodeURIComponent(cq.trim())}`)
      if (res.ok) setHits((await res.json()).items)
    }, 300)
    return () => clearTimeout(timer)
  }, [cq])

  /** 挂上或摘掉关联。company_id 传 null 就是摘掉 —— 这一列可空。 */
  async function linkCompany(companyId: number | null) {
    setLinking(true); setLinkErr("")
    const res = await fetch(`/api/research/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId }),
    })
    setLinking(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setLinkErr(errorText(t, err.error, err.values, t.research.linkFailed))
      return
    }
    setPicking(false); setCq(""); setHits([])
    // 重新取一次：右栏那张公司卡片的字段（法人 / 状态 / 信用代码）由服务端带回
    load()
  }

  if (loading) {
    return (
      <div className="max-w-[1180px] mx-auto px-4 py-6 md:px-8 md:py-9 flex flex-col gap-4">
        <div className="skeleton h-3.5 w-32" />
        <div className="skeleton h-7 w-[28rem]" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-[92%]" />
        <div className="skeleton h-4 w-[86%]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-[1180px] mx-auto px-4 py-6 md:px-8 md:py-9">
        <Link href="/research"
              className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
          <ArrowLeft size={13} /> {t.nav.reports}
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
  const r = data.report
  // report_md 是数据，不翻译、不加工，空判断只 trim 不改写
  const md = (r.report_md || "").trim()

  return (
    <div className="max-w-[1180px] mx-auto px-4 py-6 md:px-8 md:py-9">
      <Link href="/research"
            className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
        <ArrowLeft size={13} /> {t.nav.reports}
      </Link>

      {/* ── 头部 ─────────────────────────────────────────── */}
      <div className="hairline-b pb-5 mb-6">
        <h1 className="text-[1.5rem] font-medium leading-tight mb-2.5">
          {r.title || slugLabel(t.enum.reportType, r.report_type)}
        </h1>
        <div className="flex items-center gap-2.5 flex-wrap text-[12px] text-fg-subtle">
          <Tag>{slugLabel(t.enum.reportType, r.report_type)}</Tag>
          <Tag>{slugLabel(t.enum.reportStatus, r.status)}</Tag>
          <span className="num">{fill(t.common.updatedAt, { time: fmtDateTime(locale, r.updated_at) })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[65fr_35fr] gap-6 md:gap-8 items-start">
        {/* ── 左：报告正文 ────────────────────────────────── */}
        <div className="min-w-0">
          {md === "" ? (
            <div className="rounded-[6px] border border-hairline bg-surface px-4 py-10
                            flex flex-col items-center gap-2">
              <span className="text-[13px] text-fg-muted">{t.research.bodyEmpty}</span>
              <span className="text-[12px] text-fg-faint">{t.research.bodyEmptyHint}</span>
            </div>
          ) : (
            <article className="prose-cjk rounded-[6px] border border-hairline px-4 py-4 md:px-6 md:py-5">
              <Markdown remarkPlugins={[remarkGfm]}>{md}</Markdown>
            </article>
          )}
        </div>

        {/* ── 右：关联公司 + 资源 ─────────────────────────── */}
        <aside className="flex flex-col gap-7">
          <Section label={t.research.company} lat="Entity">
            {data.company ? (
              <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3">
                <Link href={`/company/${data.company.company_id}`}
                      className="text-[14px] text-fg hover:underline underline-offset-4">
                  {data.company.name || `#${data.company.company_id}`}
                </Link>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Meta label={t.research.legalRep}   value={data.company.oper_name} />
                  <Meta label={t.research.status}     value={data.company.company_status} />
                  <Meta label={t.research.creditCode} value={data.company.credit_code} mono />
                </div>
                {canWrite && (
                  <button onClick={() => linkCompany(null)} disabled={linking}
                          className="btn mt-3 flex items-center gap-1.5 bg-transparent border-0 p-0
                                     text-[12px] text-fg-subtle hover:text-fg cursor-pointer
                                     disabled:cursor-default disabled:opacity-50">
                    <X size={12} /> {t.research.unlinkCompany}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3">
                <div className="flex items-center gap-2 text-[13px] text-fg-muted mb-1.5">
                  <Store size={13} className="text-fg-faint" /> {t.research.noCompany}
                </div>
                {/* 说明分业务线给 —— 行业调研通常不挂公司，
                    公司尽调没挂上是缺关联（id=13 励泰展览就是这种，任务 D 当时标了「需人工判断」）。
                    统一写一句会对着一份公司尽调说瞎话。 */}
                <p className="text-[12px] text-fg-subtle leading-relaxed">
                  {r.report_type === "industry_research"
                    ? t.research.noCompanyHintSector
                    : t.research.noCompanyHint}
                </p>

                {canWrite && !picking && (
                  <button onClick={() => setPicking(true)}
                          className="btn mt-3 flex items-center gap-1.5 bg-transparent border-0 p-0
                                     text-[12px] text-fg hover:text-fg-muted cursor-pointer">
                    <Link2 size={12} /> {t.research.linkCompany}
                  </button>
                )}

                {canWrite && picking && (
                  <div className="relative mt-3">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input autoFocus value={cq} onChange={e => setCq(e.target.value)}
                           onKeyDown={e => { if (e.key === "Escape") { setPicking(false); setCq(""); setHits([]) } }}
                           placeholder={t.company.search} disabled={linking}
                           className="input w-full h-9 pl-8 pr-3 rounded-[4px] bg-sidebar text-[13px]
                                      border border-hairline placeholder:text-fg-faint" />
                    {hits.length > 0 && (
                      <div className="overlay absolute left-0 right-0 top-10 z-10 rounded-[6px]
                                      bg-surface-elevated p-1"
                           style={{ border: "1px solid var(--color-hairline-active)" }}>
                        {hits.map(h => (
                          <button key={h.company_id} onClick={() => linkCompany(h.company_id)}
                                  className="btn w-full text-left px-2.5 py-2 rounded-[4px] bg-transparent
                                             border-0 cursor-pointer text-[12px] hover:bg-surface-hover">
                            <div className="truncate">{h.name}</div>
                            <div className="text-[11px] text-fg-subtle">
                              {enumLabel(COMPANY_STATUS, t.enum.companyStatus as Record<string, string>,
                                         h.company_status)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {linkErr && (
              <p className="mt-2 text-[12px] text-[var(--color-error-text)]">{linkErr}</p>
            )}
          </Section>

          <Section label={fill(t.research.resources, { count: data.resources.length })} lat="Resources">
            <ResourceList resources={data.resources} t={t} locale={locale}
                          emptyText={t.research.resourcesEmpty} />
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

function Meta({ label, value, mono }: {
  label: string; value: string | null; mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-fg-subtle shrink-0">{label}</span>
      <span className={`text-[12px] text-fg-muted text-right break-all ${mono ? "num" : ""}`}>
        {value}
      </span>
    </div>
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
