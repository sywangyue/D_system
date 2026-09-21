"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Dict, Locale } from "@/lib/i18n-shared"
import { fmtNum } from "@/lib/i18n-shared"
import { COMPETITION_YES, MDS_NONE } from "@/lib/enums"

type Brand = {
  brand_id: string; name_cn: string; name_en?: string
  organizer?: string; city?: string; industry_l1?: string; industry_l2?: string
  ma_potential?: number; strategic_relevance?: number; competition_relation?: string
  mds_related?: string; website?: string; notes?: string
  year?: number; venue?: string; area_sqm?: number
  exhibitors_count?: number; visitors_count?: number
  heat_score?: number; yoy_trend?: string; edition_status?: string
}

type ExhibitionData = { brand: Brand }


function Tag({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: 'var(--color-surface-elevated)', color: 'var(--color-fg-muted)', border: '1px solid var(--color-hairline)' }}>
      {label}
    </span>
  )
}

export default function ExhibitionContent({ id, t, locale }: {
  id: string; t: Dict; locale: Locale
}) {
  const [data, setData] = useState<ExhibitionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form fields

  useEffect(() => {
    // 未登录的页面请求由中间件拦截，这里不再重复判断
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exhibition/${id}`)
      if (!res.ok) throw new Error(res.status === 404 ? t.exhibition.notFound : t.empty.loadFailed)
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--color-fg-subtle)', fontSize: '14px' }}>{t.common.loading}</div>
  if (error) return (
    <div style={{ color: 'var(--color-error-text)', fontSize: '14px', padding: '40px 0' }}>
      {error} <button onClick={fetchData} style={{ marginLeft: '12px', color: 'var(--color-fg)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>{t.common.retry}</button>
    </div>
  )
  if (!data) return null

  const { brand } = data

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Back */}
      <Link href="/overview" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-fg-muted)', marginBottom: '20px', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> {t.exhibition.back}
      </Link>

      {/* Header card */}
      <div style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-hairline)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            {/* 展会名与英文名都是数据，原样显示 */}
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-fg)', margin: 0, lineHeight: 1.3 }}>{brand.name_cn}</h1>
            {brand.name_en && <div className="lat" style={{ fontSize: '13px', color: 'var(--color-fg-subtle)', marginTop: '4px' }}>{brand.name_en}</div>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {brand.industry_l1 && <Tag label={brand.industry_l1} />}
              {brand.industry_l2 && <Tag label={brand.industry_l2} />}
              {/* 下面两处比较的是库里的**取值**，属于数据判断，不随语言变；
                  取值常量在 lib/enums.ts，只有显示的标签走字典。 */}
              {brand.competition_relation === COMPETITION_YES && <Tag label={t.exhibition.competition} />}
              {brand.mds_related && brand.mds_related !== MDS_NONE && <Tag label={brand.mds_related} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
            {brand.ma_potential != null && (
              <div style={{ textAlign: 'center' }}>
                <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-fg)' }}>{brand.ma_potential}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-fg-subtle)' }}>{t.exhibition.maPotential}</div>
              </div>
            )}
            {brand.strategic_relevance != null && (
              <div style={{ textAlign: 'center' }}>
                <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-fg)' }}>{brand.strategic_relevance}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-fg-subtle)' }}>{t.exhibition.strategicRelevance}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-hairline)' }}>
          {/* 值全部来自接口，是数据：数字走 Intl，文字原样显示，不查字典 */}
          {[
            [t.exhibition.organizer, brand.organizer],
            [t.exhibition.city, brand.city],
            [t.exhibition.editionYear, brand.year ? fmtNum(locale, brand.year) : undefined],
            [t.exhibition.venue, brand.venue],
            [t.exhibition.area, brand.area_sqm ? fmtNum(locale, brand.area_sqm) : undefined],
            [t.exhibition.exhibitors, brand.exhibitors_count ? fmtNum(locale, brand.exhibitors_count) : undefined],
            [t.exhibition.visitors, brand.visitors_count ? fmtNum(locale, brand.visitors_count) : undefined],
            [t.exhibition.website, brand.website],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string}>
              <div style={{ fontSize: '11px', color: 'var(--color-fg-subtle)' }}>{label}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-fg)', fontWeight: 500, marginTop: '2px', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}
        </div>

        {brand.notes && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-fg-muted)', background: 'var(--color-surface-elevated)', borderRadius: '8px', padding: '10px 12px' }}>
            {brand.notes}
          </div>
        )}
      </div>
    </div>
  )
}
