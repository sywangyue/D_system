"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Search, Users } from "lucide-react"
import { getUserInfo } from "@/lib/auth"

type Person = {
  person_id: number; name: string; title?: string; company?: string
  linkedin?: string; email?: string; phone?: string; notes?: string
  exhibition_count?: number; created_at: string
}

type PersonDetail = {
  person: Person
  exhibitions: { id: number; brand_id: string; name_cn: string; city?: string; industry_l1?: string; role?: string; contact_date?: string; notes?: string }[]
  relations: { id: number; person_id: number; name: string; title?: string; company?: string; relation_type?: string; notes?: string }[]
}

const RELATION_TYPES = ['上下级','同事','商业伙伴','竞争对手','其他']

const TAG_COLORS: Record<string, string> = {
  '上下级': '#8E44AD', '同事': '#27AE60', '商业伙伴': '#2980B9', '竞争对手': '#E74C3C', '其他': '#95A5A6',
}

function Tag({ label }: { label: string }) {
  const color = TAG_COLORS[label] || '#FE5C00'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
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

export default function PeopleContent() {
  const router = useRouter()
  const [people, setPeople] = useState<Person[]>([])
  const [filtered, setFiltered] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', title: '', company: '', linkedin: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const [showContactForm, setShowContactForm] = useState(false)
  const [showRelationForm, setShowRelationForm] = useState(false)
  const [ctForm, setCtForm] = useState({ brand_id: '', role: '', contact_date: '', notes: '' })
  const [relForm, setRelForm] = useState({ to_person_id: '', relation_type: RELATION_TYPES[0], notes: '' })

  useEffect(() => {
    const user = getUserInfo()
    if (!user) { router.push('/login'); return }
    loadPeople()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? people.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.title || '').toLowerCase().includes(q)
    ) : people)
  }, [search, people])

  async function loadPeople() {
    setLoading(true)
    try {
      const res = await fetch('/api/people')
      if (res.ok) { const data = await res.json(); setPeople(data); setFiltered(data) }
    } finally { setLoading(false) }
  }

  async function selectPerson(p: Person) {
    setDetailLoading(true)
    setShowContactForm(false)
    setShowRelationForm(false)
    try {
      const res = await fetch(`/api/people/${p.person_id}`)
      if (res.ok) setSelected(await res.json())
    } finally { setDetailLoading(false) }
  }

  async function createPerson() {
    if (!newForm.name.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/people', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      if (res.ok) {
        setShowNewForm(false)
        setNewForm({ name: '', title: '', company: '', linkedin: '', email: '', phone: '', notes: '' })
        await loadPeople()
        const created = await res.json().catch(() => null)
        if (created) selectPerson(created)
      }
    } finally { setSubmitting(false) }
  }

  async function addExhibitionContact() {
    if (!selected || !ctForm.brand_id.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/people/${selected.person.person_id}/contacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: ctForm.brand_id.trim().toUpperCase(), role: ctForm.role, contact_date: ctForm.contact_date, notes: ctForm.notes }),
      })
      if (res.ok) {
        setShowContactForm(false)
        setCtForm({ brand_id: '', role: '', contact_date: '', notes: '' })
        selectPerson(selected.person)
        loadPeople()
      }
    } finally { setSubmitting(false) }
  }

  async function addPersonRelation() {
    if (!selected || !relForm.to_person_id) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/people/${selected.person.person_id}/relations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relForm),
      })
      if (res.ok) {
        setShowRelationForm(false)
        setRelForm({ to_person_id: '', relation_type: RELATION_TYPES[0], notes: '' })
        selectPerson(selected.person)
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={20} color="#1D1D1F" />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1D1D1F' }}>人员网络</h1>
          <span style={{ fontSize: '13px', color: '#AEAEB2' }}>{people.length} 人</span>
        </div>
        <button onClick={() => setShowNewForm(v => !v)} style={primaryBtnStyle}>
          <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />新建人员
        </button>
      </div>

      {/* New person form */}
      {showNewForm && (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F', marginBottom: '12px' }}>新建人员档案</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input placeholder="姓名 *" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input placeholder="职位" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <input placeholder="公司/机构" value={newForm.company} onChange={e => setNewForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} />
            <input placeholder="LinkedIn URL" value={newForm.linkedin} onChange={e => setNewForm(f => ({ ...f, linkedin: e.target.value }))} style={inputStyle} />
            <input placeholder="邮箱" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="电话" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
          </div>
          <textarea placeholder="备注" value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createPerson} disabled={submitting} style={primaryBtnStyle}>保存</button>
            <button onClick={() => setShowNewForm(false)} style={cancelBtnStyle}><X size={14} /></button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>
        {/* Left: people list */}
        <div>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#AEAEB2' }} />
            <input
              placeholder="搜索姓名/公司..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '30px' }}
            />
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', overflow: 'hidden' }}>
            {loading && <div style={{ padding: '20px', color: '#AEAEB2', fontSize: '13px', textAlign: 'center' }}>加载中...</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '20px', color: '#AEAEB2', fontSize: '13px', textAlign: 'center' }}>
                {search ? '无匹配结果' : '暂无人员，点击「新建人员」开始'}
              </div>
            )}
            {filtered.map(p => {
              const isActive = selected?.person.person_id === p.person_id
              return (
                <button
                  key={p.person_id}
                  onClick={() => selectPerson(p)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none',
                    borderBottom: '1px solid #F2F2F7', cursor: 'pointer',
                    background: isActive ? '#FFF8F5' : '#fff', transition: 'background 0.1s',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isActive ? '#FE5C00' : '#1D1D1F' }}>{p.name}</div>
                  {(p.title || p.company) && (
                    <div style={{ fontSize: '12px', color: '#6E6E73', marginTop: '2px' }}>
                      {[p.title, p.company].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {(p.exhibition_count ?? 0) > 0 && (
                    <div style={{ fontSize: '11px', color: '#AEAEB2', marginTop: '2px' }}>关联 {p.exhibition_count} 个展会</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div>
          {!selected && !detailLoading && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '40px', textAlign: 'center', color: '#AEAEB2', fontSize: '13px' }}>
              从左侧选择一位人员查看详情
            </div>
          )}
          {detailLoading && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '40px', textAlign: 'center', color: '#AEAEB2', fontSize: '13px' }}>
              加载中...
            </div>
          )}
          {selected && !detailLoading && (
            <>
              {/* Profile card */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '20px', marginBottom: '12px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1D1D1F' }}>{selected.person.name}</div>
                {selected.person.title && <div style={{ fontSize: '13px', color: '#6E6E73', marginTop: '2px' }}>{selected.person.title}</div>}
                {selected.person.company && <div style={{ fontSize: '13px', color: '#AEAEB2' }}>{selected.person.company}</div>}
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {selected.person.email && <span style={{ fontSize: '12px', color: '#2980B9' }}>{selected.person.email}</span>}
                  {selected.person.phone && <span style={{ fontSize: '12px', color: '#6E6E73' }}>{selected.person.phone}</span>}
                  {selected.person.linkedin && (
                    <a href={selected.person.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#2980B9' }}>LinkedIn</a>
                  )}
                </div>
                {selected.person.notes && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#6E6E73', background: '#F7F7F8', borderRadius: '6px', padding: '8px 10px' }}>
                    {selected.person.notes}
                  </div>
                )}
              </div>

              {/* Linked exhibitions */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F' }}>关联展会 ({selected.exhibitions.length})</span>
                  <button onClick={() => setShowContactForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#FE5C00', background: 'none', border: '1px solid #FE5C0040', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                    <Plus size={12} /> 关联展会
                  </button>
                </div>
                {showContactForm && (
                  <div style={{ background: '#F7F7F8', borderRadius: '8px', padding: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input placeholder="展会 brand_id（如 EXPO-3187）*" value={ctForm.brand_id} onChange={e => setCtForm(f => ({ ...f, brand_id: e.target.value }))} style={inputStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input placeholder="角色（如：决策者）" value={ctForm.role} onChange={e => setCtForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} />
                      <input type="date" value={ctForm.contact_date} onChange={e => setCtForm(f => ({ ...f, contact_date: e.target.value }))} style={inputStyle} />
                    </div>
                    <input placeholder="备注" value={ctForm.notes} onChange={e => setCtForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={addExhibitionContact} disabled={submitting} style={primaryBtnStyle}>保存</button>
                      <button onClick={() => setShowContactForm(false)} style={cancelBtnStyle}><X size={14} /></button>
                    </div>
                  </div>
                )}
                {selected.exhibitions.length === 0 && !showContactForm && (
                  <div style={{ fontSize: '13px', color: '#AEAEB2', textAlign: 'center', padding: '8px 0' }}>暂无关联展会</div>
                )}
                {selected.exhibitions.map(ex => (
                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F2F2F7' }}>
                    <div style={{ flex: 1 }}>
                      <Link href={`/exhibition/${ex.brand_id}`} style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F', textDecoration: 'none' }}>
                        {ex.name_cn}
                      </Link>
                      <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{ex.brand_id}{ex.city ? ` · ${ex.city}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {ex.role && <Tag label={ex.role} />}
                      {ex.contact_date && <span style={{ fontSize: '11px', color: '#AEAEB2' }}>{ex.contact_date}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* People relations */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #F2F2F7', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F' }}>人脉关系 ({selected.relations.length})</span>
                  <button onClick={() => setShowRelationForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#FE5C00', background: 'none', border: '1px solid #FE5C0040', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                    <Plus size={12} /> 关联人员
                  </button>
                </div>
                {showRelationForm && (
                  <div style={{ background: '#F7F7F8', borderRadius: '8px', padding: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select value={relForm.to_person_id} onChange={e => setRelForm(f => ({ ...f, to_person_id: e.target.value }))} style={inputStyle}>
                      <option value="">-- 选择人员 *</option>
                      {people.filter(p => p.person_id !== selected.person.person_id).map(p => (
                        <option key={p.person_id} value={p.person_id}>
                          {p.name}{p.company ? ` · ${p.company}` : ''}
                        </option>
                      ))}
                    </select>
                    <select value={relForm.relation_type} onChange={e => setRelForm(f => ({ ...f, relation_type: e.target.value }))} style={inputStyle}>
                      {RELATION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input placeholder="备注（可选）" value={relForm.notes} onChange={e => setRelForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={addPersonRelation} disabled={submitting} style={primaryBtnStyle}>保存</button>
                      <button onClick={() => setShowRelationForm(false)} style={cancelBtnStyle}><X size={14} /></button>
                    </div>
                  </div>
                )}
                {selected.relations.length === 0 && !showRelationForm && (
                  <div style={{ fontSize: '13px', color: '#AEAEB2', textAlign: 'center', padding: '8px 0' }}>暂无人脉关系</div>
                )}
                {selected.relations.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F2F2F7' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }}>{r.name}</div>
                      {(r.title || r.company) && (
                        <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{[r.title, r.company].filter(Boolean).join(' · ')}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {r.relation_type && <Tag label={r.relation_type} />}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
