"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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

const TAG_COLORS: Record<string, string> = {
  '战略合作': '#30B060', '收购意向': '#FE5C00', '资本进入': '#9B59B6',
  '高管变动': '#E67E22', '展会改名': '#3498DB', '主办方变更': '#1ABC9C',
  '合作谈判': '#27AE60', '实地考察': '#2980B9', '其他': '#95A5A6',
  '竞争': '#E74C3C', '合作': '#27AE60', '母子': '#8E44AD',
  '收购目标': '#FE5C00', '参考标杆': '#2980B9', '同主办方': '#16A085',
}

function Tag({ label }: { label: string }) {
  const color = TAG_COLORS[label] || '#6E6E73'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

export default function ExhibitionContent({ id }: { id: string }) {
  const router = useRouter()
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
      if (!res.ok) throw new Error(res.status === 404 ? '展会不存在' : '加载失败')
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ color: '#AEAEB2', fontSize: '14px' }}>加载中...</div>
  if (error) return (
    <div style={{ color: '#E74C3C', fontSize: '14px', padding: '40px 0' }}>
      {error} <button onClick={fetchData} style={{ marginLeft: '12px', color: '#FE5C00', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>重试</button>
    </div>
  )
  if (!data) return null

  const { brand } = data

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Back */}
      <Link href="/dashboard.html" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6E6E73', marginBottom: '20px', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> 返回看板
      </Link>

      {/* Header card */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1D1D1F', margin: 0, lineHeight: 1.3 }}>{brand.name_cn}</h1>
            {brand.name_en && <div style={{ fontSize: '13px', color: '#AEAEB2', marginTop: '4px' }}>{brand.name_en}</div>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {brand.industry_l1 && <Tag label={brand.industry_l1} />}
              {brand.industry_l2 && <Tag label={brand.industry_l2} />}
              {brand.competition_relation === '是' && <Tag label="竞争展会" />}
              {brand.mds_related && brand.mds_related !== '无' && <Tag label={brand.mds_related} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
            {brand.ma_potential != null && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#FE5C00' }}>{brand.ma_potential}</div>
                <div style={{ fontSize: '11px', color: '#AEAEB2' }}>并购潜力</div>
              </div>
            )}
            {brand.strategic_relevance != null && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#1D1D1F' }}>{brand.strategic_relevance}</div>
                <div style={{ fontSize: '11px', color: '#AEAEB2' }}>战略相关</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F2F2F7' }}>
          {[
            ['主办方', brand.organizer],
            ['城市', brand.city],
            ['届次年份', brand.year ? String(brand.year) : undefined],
            ['场馆', brand.venue],
            ['面积(㎡)', brand.area_sqm ? brand.area_sqm.toLocaleString() : undefined],
            ['参展商', brand.exhibitors_count ? brand.exhibitors_count.toLocaleString() : undefined],
            ['观众', brand.visitors_count ? brand.visitors_count.toLocaleString() : undefined],
            ['网站', brand.website],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string}>
              <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{label}</div>
              <div style={{ fontSize: '13px', color: '#1D1D1F', fontWeight: 500, marginTop: '2px', wordBreak: 'break-all' }}>{value}</div>
            </div>
          ))}
        </div>

        {brand.notes && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#6E6E73', background: '#F7F7F8', borderRadius: '8px', padding: '10px 12px' }}>
            {brand.notes}
          </div>
        )}
      </div>
    </div>
  )
}

