"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, X } from "lucide-react"
import { getUserInfo } from "@/lib/auth"

type Brand = {
  brand_id: string; name_cn: string; name_en?: string
  organizer?: string; city?: string; industry_l1?: string; industry_l2?: string
  ma_potential?: number; strategic_relevance?: number; competition_relation?: string
  mds_related?: string; website?: string; notes?: string
  year?: number; venue?: string; area_sqm?: number
  exhibitors_count?: number; visitors_count?: number
  heat_score?: number; yoy_trend?: string; edition_status?: string
}

type TimelineEvent = {
  id: number; event_date: string; event_type: string; title: string
  description?: string; counterpart?: string; outcome?: string
  source_url?: string; created_by: string; created_at: string
}

type Relation = {
  id: number; from_brand_id: string; to_brand_id: string
  relation_type: string; notes?: string
  to_name_cn: string; to_city?: string; to_industry?: string
}

type Contact = {
  id: number; person_id: number; name: string; title?: string
  company?: string; role?: string; contact_date?: string; notes?: string
}

type ExhibitionData = { brand: Brand; timeline: TimelineEvent[]; relations: Relation[]; contacts: Contact[] }

const EVENT_TYPES = ['战略合作','收购意向','资本进入','高管变动','展会改名','主办方变更','合作谈判','实地考察','其他']
const RELATION_TYPES = ['竞争','合作','母子','收购目标','参考标杆','同主办方']

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

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F' }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#FE5C00', background: 'none', border: '1px solid #FE5C0040', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
      <Plus size={12} /> 添加
    </button>
  )
}

export default function ExhibitionContent({ id }: { id: string }) {
  const router = useRouter()
  const [data, setData] = useState<ExhibitionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form visibility state
  const [showTimelineForm, setShowTimelineForm] = useState(false)
  const [showRelationForm, setShowRelationForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)

  // Form fields
  const [tlForm, setTlForm] = useState({ event_type: EVENT_TYPES[0], event_date: '', title: '', description: '', counterpart: '', outcome: '', source_url: '' })
  const [relForm, setRelForm] = useState({ to_brand_id: '', relation_type: RELATION_TYPES[0], notes: '' })
  const [ctForm, setCtForm] = useState({ person_id: '', role: '', contact_date: '', notes: '' })
  const [people, setPeople] = useState<{ person_id: number; name: string; company?: string }[]>([])

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const user = getUserInfo()
    if (!user) { router.push('/login'); return }
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

  async function loadPeople() {
    const res = await fetch('/api/people')
    if (res.ok) setPeople(await res.json())
  }

  async function addTimelineEvent() {
    if (!tlForm.event_date || !tlForm.title) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exhibition/${id}/timeline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tlForm),
      })
      if (res.ok) {
        setShowTimelineForm(false)
        setTlForm({ event_type: EVENT_TYPES[0], event_date: '', title: '', description: '', counterpart: '', outcome: '', source_url: '' })
        fetchData()
      }
    } finally { setSubmitting(false) }
  }

  async function deleteTimelineEvent(eventId: number) {
    await fetch(`/api/exhibition/${id}/timeline/${eventId}`, { method: 'DELETE' })
    fetchData()
  }

  async function addRelation() {
    if (!relForm.to_brand_id) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exhibition/${id}/relations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relForm),
      })
      if (res.ok) {
        setShowRelationForm(false)
        setRelForm({ to_brand_id: '', relation_type: RELATION_TYPES[0], notes: '' })
        fetchData()
      }
    } finally { setSubmitting(false) }
  }

  async function addContact() {
    if (!ctForm.person_id) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/people/${ctForm.person_id}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: id, role: ctForm.role, contact_date: ctForm.contact_date, notes: ctForm.notes }),
      })
      if (res.ok) {
        setShowContactForm(false)
        setCtForm({ person_id: '', role: '', contact_date: '', notes: '' })
        fetchData()
      }
    } finally { setSubmitting(false) }
  }

  if (loading) return <div style={{ color: '#AEAEB2', fontSize: '14px' }}>加载中...</div>
  if (error) return (
    <div style={{ color: '#E74C3C', fontSize: '14px', padding: '40px 0' }}>
      {error} <button onClick={fetchData} style={{ marginLeft: '12px', color: '#FE5C00', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>重试</button>
    </div>
  )
  if (!data) return null

  const { brand, timeline, relations, contacts } = data

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

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Timeline */}
        <Section title={`时间线 (${timeline.length})`} action={<AddBtn onClick={() => setShowTimelineForm(v => !v)} />}>
          {showTimelineForm && (
            <div style={{ background: '#F7F7F8', borderRadius: '8px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={tlForm.event_type} onChange={e => setTlForm(f => ({ ...f, event_type: e.target.value }))} style={inputStyle}>
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <input type="date" value={tlForm.event_date} onChange={e => setTlForm(f => ({ ...f, event_date: e.target.value }))} style={inputStyle} />
              </div>
              <input placeholder="标题 *" value={tlForm.title} onChange={e => setTlForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
              <input placeholder="对方机构（可选）" value={tlForm.counterpart} onChange={e => setTlForm(f => ({ ...f, counterpart: e.target.value }))} style={inputStyle} />
              <textarea placeholder="详情（可选）" value={tlForm.description} onChange={e => setTlForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} />
              <input placeholder="结果/进展（可选）" value={tlForm.outcome} onChange={e => setTlForm(f => ({ ...f, outcome: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addTimelineEvent} disabled={submitting} style={primaryBtnStyle}>保存</button>
                <button onClick={() => setShowTimelineForm(false)} style={cancelBtnStyle}><X size={14} /></button>
              </div>
            </div>
          )}
          {timeline.length === 0 && !showTimelineForm && <Empty text="暂无事件记录" />}
          {timeline.map(ev => (
            <div key={ev.id} style={{ borderBottom: '1px solid #F2F2F7', paddingBottom: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Tag label={ev.event_type} />
                    <span style={{ fontSize: '11px', color: '#AEAEB2' }}>{ev.event_date}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>{ev.title}</div>
                  {ev.counterpart && <div style={{ fontSize: '12px', color: '#6E6E73', marginTop: '2px' }}>↔ {ev.counterpart}</div>}
                  {ev.description && <div style={{ fontSize: '12px', color: '#6E6E73', marginTop: '4px' }}>{ev.description}</div>}
                  {ev.outcome && <div style={{ fontSize: '12px', color: '#27AE60', marginTop: '4px' }}>→ {ev.outcome}</div>}
                </div>
                <button onClick={() => deleteTimelineEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', padding: '2px', flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </Section>

        {/* Relations */}
        <Section title={`展会关系 (${relations.length})`} action={<AddBtn onClick={() => setShowRelationForm(v => !v)} />}>
          {showRelationForm && (
            <div style={{ background: '#F7F7F8', borderRadius: '8px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input placeholder="对方展会 brand_id（如 EXPO-0229）*" value={relForm.to_brand_id} onChange={e => setRelForm(f => ({ ...f, to_brand_id: e.target.value.trim().toUpperCase() }))} style={inputStyle} />
              <select value={relForm.relation_type} onChange={e => setRelForm(f => ({ ...f, relation_type: e.target.value }))} style={inputStyle}>
                {RELATION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="备注（可选）" value={relForm.notes} onChange={e => setRelForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addRelation} disabled={submitting} style={primaryBtnStyle}>保存</button>
                <button onClick={() => setShowRelationForm(false)} style={cancelBtnStyle}><X size={14} /></button>
              </div>
            </div>
          )}
          {relations.length === 0 && !showRelationForm && <Empty text="暂无关系记录" />}
          {relations.map(rel => {
            const isFrom = rel.from_brand_id === id
            const targetId = isFrom ? rel.to_brand_id : rel.from_brand_id
            return (
              <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F2F2F7' }}>
                <Tag label={rel.relation_type} />
                <div style={{ flex: 1 }}>
                  <Link href={`/exhibition/${targetId}`} style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F', textDecoration: 'none' }}>
                    {rel.to_name_cn}
                  </Link>
                  {rel.to_city && <span style={{ fontSize: '11px', color: '#AEAEB2', marginLeft: '6px' }}>{rel.to_city}</span>}
                  {rel.notes && <div style={{ fontSize: '11px', color: '#6E6E73', marginTop: '2px' }}>{rel.notes}</div>}
                </div>
                <span style={{ fontSize: '11px', color: '#AEAEB2' }}>{targetId}</span>
              </div>
            )
          })}
        </Section>
      </div>

      {/* Contacts full-width */}
      <Section title={`相关人员 (${contacts.length})`} action={
        <AddBtn onClick={() => { setShowContactForm(v => !v); if (!showContactForm) loadPeople() }} />
      }>
        {showContactForm && (
          <div style={{ background: '#F7F7F8', borderRadius: '8px', padding: '14px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <select value={ctForm.person_id} onChange={e => setCtForm(f => ({ ...f, person_id: e.target.value }))} style={inputStyle}>
              <option value="">-- 选择人员 *</option>
              {people.map(p => (
                <option key={p.person_id} value={p.person_id}>
                  {p.name}{p.company ? ` · ${p.company}` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input placeholder="角色（如：决策者、主办方）" value={ctForm.role} onChange={e => setCtForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} />
              <input type="date" value={ctForm.contact_date} onChange={e => setCtForm(f => ({ ...f, contact_date: e.target.value }))} style={inputStyle} />
            </div>
            <input placeholder="备注（可选）" value={ctForm.notes} onChange={e => setCtForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addContact} disabled={submitting} style={primaryBtnStyle}>保存</button>
              <button onClick={() => setShowContactForm(false)} style={cancelBtnStyle}><X size={14} /></button>
            </div>
            <div style={{ fontSize: '11px', color: '#AEAEB2' }}>
              没有此人？先前往 <Link href="/people" style={{ color: '#FE5C00' }}>人员网络</Link> 创建
            </div>
          </div>
        )}
        {contacts.length === 0 && !showContactForm && <Empty text="暂无相关人员" />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {contacts.map(c => (
            <div key={c.id} style={{ border: '1px solid #F2F2F7', borderRadius: '8px', padding: '12px' }}>
              <Link href={`/people`} style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F', textDecoration: 'none' }}>{c.name}</Link>
              {c.title && <div style={{ fontSize: '12px', color: '#6E6E73' }}>{c.title}</div>}
              {c.company && <div style={{ fontSize: '12px', color: '#AEAEB2' }}>{c.company}</div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {c.role && <Tag label={c.role} />}
                {c.contact_date && <span style={{ fontSize: '11px', color: '#AEAEB2' }}>{c.contact_date}</span>}
              </div>
              {c.notes && <div style={{ fontSize: '11px', color: '#6E6E73', marginTop: '4px' }}>{c.notes}</div>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: '13px', color: '#AEAEB2', padding: '12px 0', textAlign: 'center' }}>{text}</div>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: '13px', color: '#1D1D1F',
  background: '#fff', border: '1px solid #E5E5EA', borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#fff',
  background: '#FE5C00', border: 'none', borderRadius: '6px', cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: '13px',
  color: '#6E6E73', background: 'none', border: '1px solid #E5E5EA', borderRadius: '6px', cursor: 'pointer',
}
