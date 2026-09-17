"use client"

import { useEffect, useRef, useState } from "react"
import { X, Search, Loader2 } from "lucide-react"
import { BIZ_LINES, STAGES, DEAL_TYPES, type BizLine, type DealType, type Stage } from "./types"

/**
 * 录入机会。三条业务线共用一张表，靠 type 区分，
 * 差异字段进 detail_json —— 所以这里按 type 切换下半部分的表单。
 *
 * 关联公司不是可选项而是高价值动作：挂上之后，该公司名下已有的
 * 调研报告与企查查原始数据会自动出现在机会详情里。
 */

interface CompanyHit { company_id: number; name: string; company_status: string | null }

export default function NewDrawer({
  defaultType, currentUser, onClose, onCreated,
}: {
  defaultType: BizLine
  currentUser: string
  onClose: () => void
  onCreated: () => void
}) {
  const [type, setType] = useState<BizLine>(defaultType)
  const [title, setTitle] = useState("")
  const [stage, setStage] = useState<Stage>("contact")
  const [priority, setPriority] = useState(3)
  const [nextAction, setNextAction] = useState("")
  const [due, setDue] = useState("")
  // ma 专属
  const [dealType, setDealType] = useState<DealType>("收购")
  const [mdBrand, setMdBrand] = useState("")
  const [valuation, setValuation] = useState("")
  // greenfield 专属
  const [marketSize, setMarketSize] = useState("")
  const [players, setPlayers] = useState("")
  // project_support 专属
  const [requester, setRequester] = useState("")
  const [deliverable, setDeliverable] = useState("")

  const [cq, setCq] = useState("")
  const [hits, setHits] = useState<CompanyHit[]>([])
  const [company, setCompany] = useState<CompanyHit | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [onClose])

  // 公司搜索：300ms 防抖，避免每敲一个字打一次接口
  useEffect(() => {
    if (!cq.trim()) { setHits([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/company?size=6&q=${encodeURIComponent(cq.trim())}`)
      if (res.ok) setHits((await res.json()).items)
    }, 300)
    return () => clearTimeout(t)
  }, [cq])

  function buildDetail() {
    if (type === "ma") return { valuation_range: valuation || undefined }
    if (type === "greenfield") return { market_size: marketSize || undefined, existing_players: players || undefined }
    return { requester: requester || undefined, deliverable: deliverable || undefined }
  }

  async function submit() {
    if (!title.trim()) { setError("机会名称必填"); return }
    setSaving(true); setError("")
    const body: Record<string, unknown> = {
      type, title: title.trim(), stage, priority, owner: currentUser,
      detail_json: buildDetail(),
    }
    if (nextAction.trim()) body.next_action = nextAction.trim()
    if (due) body.next_action_due = due
    if (company) body.company_id = company.company_id
    if (type === "ma") {
      body.deal_type = dealType
      if (mdBrand.trim()) body.md_brand = mdBrand.trim()
    }
    const res = await fetch("/api/opportunity", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || "保存失败"); return }
    onCreated()
  }

  return (
    <>
      <div className="scrim fixed inset-0 z-40" onClick={onClose} />
      <aside className="overlay fixed right-0 top-0 bottom-0 w-[480px] z-50 bg-surface
                        hairline-l flex flex-col" style={{ borderLeft: "1px solid var(--color-hairline-active)" }}>
        <div className="flex items-center justify-between h-14 px-6 hairline-b shrink-0">
          <h2 className="text-[15px] font-medium">录入机会</h2>
          <button onClick={onClose}
                  className="btn w-7 h-7 flex items-center justify-center rounded-[4px]
                             bg-transparent border-0 text-fg-muted hover:text-fg cursor-pointer">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 px-3 h-9 rounded-[4px] text-[12px] text-[var(--color-error-text)]"
                 style={{ background: "var(--color-error-bg)", border: "1px solid var(--color-error-border)" }}>
              {error}
            </div>
          )}

          <Field label="业务线">
            <div className="flex gap-1.5">
              {BIZ_LINES.map(l => (
                <button key={l.key} onClick={() => setType(l.key)}
                  className={`btn h-7 px-3 rounded-[4px] text-[12px] cursor-pointer border
                    ${type === l.key ? "bg-surface-hover text-fg border-hairline-active"
                                     : "bg-transparent text-fg-muted border-hairline"}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="机会名称" required>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="如：华东半导体封装展 · 控股收购"
                   className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                              border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="阶段">
              <select value={stage} onChange={e => setStage(e.target.value as Stage)}
                      className="input w-full h-9 px-2.5 rounded-[4px] bg-sidebar text-[13px]
                                 border border-[rgb(255_255_255/9%)] cursor-pointer">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="优先级">
              <div className="flex gap-1 items-center h-9">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setPriority(n)}
                          className="btn w-6 h-6 rounded-[2px] border-0 cursor-pointer text-[11px]"
                          style={{
                            background: n <= priority ? "var(--color-fg-muted)" : "var(--color-hairline-active)",
                            color: n <= priority ? "var(--color-canvas)" : "var(--color-fg-faint)",
                          }}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* ── 按业务线切换的差异字段（存进 detail_json）───── */}
          {type === "ma" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="交易形式">
                  <select value={dealType} onChange={e => setDealType(e.target.value as DealType)}
                          className="input w-full h-9 px-2.5 rounded-[4px] bg-sidebar text-[13px]
                                     border border-[rgb(255_255_255/9%)] cursor-pointer">
                    {DEAL_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="对标 MD 品牌">
                  <input value={mdBrand} onChange={e => setMdBrand(e.target.value)}
                         placeholder="interpack / drupa …"
                         className="input lat w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                    border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
                </Field>
              </div>
              <Field label="对价区间">
                <input value={valuation} onChange={e => setValuation(e.target.value)}
                       placeholder="如：8000–12000 万"
                       className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
              </Field>
            </>
          )}

          {type === "greenfield" && (
            <>
              <Field label="市场规模判断">
                <input value={marketSize} onChange={e => setMarketSize(e.target.value)}
                       placeholder="如：国内年规模约 40 亿，无主力展会"
                       className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
              </Field>
              <Field label="现有玩家">
                <input value={players} onChange={e => setPlayers(e.target.value)}
                       placeholder="逗号分隔"
                       className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
              </Field>
            </>
          )}

          {type === "project_support" && (
            <>
              <Field label="需求方项目组">
                <input value={requester} onChange={e => setRequester(e.target.value)}
                       className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)]" />
              </Field>
              <Field label="交付物">
                <input value={deliverable} onChange={e => setDeliverable(e.target.value)}
                       placeholder="数据工具 / 合作方对接 / 线索清单"
                       className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
              </Field>
            </>
          )}

          {/* ── 关联公司 ───────────────────────────────────── */}
          <Field label="关联公司" hint="挂上后，该公司名下的调研报告与原始数据会出现在详情页">
            {company ? (
              <div className="flex items-center justify-between h-9 px-3 rounded-[4px]
                              bg-surface-hover text-[13px]">
                <span className="truncate">{company.name}</span>
                <button onClick={() => { setCompany(null); setCq("") }}
                        className="btn bg-transparent border-0 text-fg-subtle hover:text-fg cursor-pointer">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input value={cq} onChange={e => setCq(e.target.value)}
                       placeholder="搜索公司名或信用代码"
                       className="input w-full h-9 pl-8 pr-3 rounded-[4px] bg-sidebar text-[13px]
                                  border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
                {hits.length > 0 && (
                  <div className="overlay absolute left-0 right-0 top-10 z-10 rounded-[6px]
                                  bg-surface-elevated p-1"
                       style={{ border: "1px solid var(--color-hairline-active)" }}>
                    {hits.map(h => (
                      <button key={h.company_id} onClick={() => { setCompany(h); setHits([]) }}
                              className="btn w-full text-left px-2.5 py-2 rounded-[4px] bg-transparent
                                         border-0 cursor-pointer text-[12px] hover:bg-surface-hover">
                        <div className="truncate">{h.name}</div>
                        <div className="text-[11px] text-fg-subtle">{h.company_status}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-[1fr_140px] gap-4">
            <Field label="下一步">
              <input value={nextAction} onChange={e => setNextAction(e.target.value)}
                     placeholder="如：核实展位销售率"
                     className="input w-full h-9 px-3 rounded-[4px] bg-sidebar text-[13px]
                                border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint" />
            </Field>
            <Field label="到期日">
              <input type="date" value={due} onChange={e => setDue(e.target.value)}
                     className="input num w-full h-9 px-2.5 rounded-[4px] bg-sidebar text-[12px]
                                border border-[rgb(255_255_255/9%)]" />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 h-14 px-6 hairline-t shrink-0">
          <button onClick={onClose}
                  className="btn h-8 px-3.5 rounded-[4px] bg-transparent border border-hairline
                             text-[12px] text-fg-muted cursor-pointer">取消</button>
          <button onClick={submit} disabled={saving} data-loading={saving}
                  className="btn h-8 px-4 rounded-[4px] bg-accent text-[var(--color-accent-fg)] text-[12px]
                             font-semibold border-0 cursor-pointer flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            保存
          </button>
        </div>
      </aside>
    </>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-fg-muted mb-1.5">
        {label}{required && <span className="text-[var(--color-error-text)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-fg-subtle mt-1.5">{hint}</p>}
    </div>
  )
}
