import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUser } from "@/lib/session"
import { getOverview } from "@/lib/queries/overview"
import { getLocale, getDict } from "@/lib/i18n"
import { fmtDate, fmtMonthDay, type Dict } from "@/lib/i18n-shared"
import { slugLabel, stageLabel } from "@/lib/enums"
import { STAGES } from "@/app/opportunity/types"
import { ArrowRight, FileText, Inbox } from "lucide-react"

/**
 * 盘面 —— 只给决策要看的数字与短清单，不吐明细。
 * 服务端直接调查询函数，不对自己发 HTTP；字典也在服务端读。
 *
 * 数据稀疏是当前的真实状态（机会刚开始录），所以每一块都必须
 * 在「只有 1 条」和「一条没有」时依然成立，而不是靠塞满才好看。
 */

const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

export default async function OverviewPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [locale, t] = await Promise.all([getLocale(), getDict()])
  const isEn = locale === "en"

  const d = getOverview()
  const funnelMax = Math.max(1, ...d.funnel.map(f => f.count))

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      <div className="mb-8">
        <h1 className="text-[1.6875rem] font-medium leading-tight">{t.overview.title}</h1>
        <p className="text-[13px] text-fg-subtle mt-1">
          {user.display_name} {t.overview.weekEnding}{" "}
          <span className="num">{fmtDate(locale, d.week_end)}</span>
        </p>
      </div>

      {/* ── KPI 四数：发丝线分格，不是带投影的卡片 ──────────── */}
      <div className="grid grid-cols-4 gap-px bg-hairline mb-12">
        <Kpi n={d.kpi.active}        label={t.overview.kpiActive}     lat="Active"     showLat={!isEn} />
        <Kpi n={d.kpi.ma}            label={t.overview.kpiMa}         lat="M&A"        showLat={!isEn} />
        <Kpi n={d.kpi.greenfield}    label={t.overview.kpiGreenfield} lat="Greenfield" showLat={!isEn} />
        <Kpi n={d.kpi.due_this_week} label={t.overview.kpiTasks}      lat="Due"        showLat={!isEn} />
      </div>

      {/* ── 62 / 38 非对称分栏 ─────────────────────────────── */}
      <div className="grid grid-cols-[1.62fr_1fr] gap-10 mb-12">
        {/* 本周待办 */}
        <section>
          <SectionTitle>{t.overview.tasksTitle}</SectionTitle>
          {d.tasks.length === 0 ? (
            <Blank icon={<Inbox size={18} />} text={t.empty.noTasks} />
          ) : (
            <div className="hairline-t">
              {d.tasks.map(tk => (
                <Link key={tk.opp_id} href={`/opportunity/${tk.opp_id}`}
                      className="row flex items-center gap-4 h-11 px-1 hairline-b">
                  <span className={`num text-[11px] w-[52px] shrink-0
                                    ${tk.overdue ? "text-[var(--color-error-text)]" : "text-fg-subtle"}`}>
                    {fmtMonthDay(locale, tk.next_action_due)}
                  </span>
                  {/* 机会标题是数据，原样显示 */}
                  <span className="text-[13px] text-fg-muted truncate flex-1">{tk.title}</span>
                  <span className="text-[12px] text-fg-subtle truncate max-w-[38%]">
                    {tk.next_action || "—"}
                  </span>
                  <StagePip stage={tk.stage} t={t} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 最近调研 */}
        <section>
          <SectionTitle
            action={<Link href="/research" className="flex items-center gap-1 text-[12px] text-fg-subtle hover:text-fg">
                      {t.nav.reports} <ArrowRight size={12} />
                    </Link>}>
            {t.overview.reportsTitle}
          </SectionTitle>
          {d.reports.length === 0 ? (
            <Blank icon={<FileText size={18} />} text={t.empty.noReports} />
          ) : (
            <div className="hairline-t">
              {d.reports.map(r => (
                <Link key={r.id} href={`/research/${r.id}`}
                      className="row block py-3 px-1 hairline-b">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] text-fg-muted truncate flex-1">
                      {r.title || r.company_name || slugLabel(t.enum.reportType, r.report_type)}
                    </span>
                    <span className="num text-[10px] text-fg-faint shrink-0">
                      {fmtMonthDay(locale, r.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tag>{slugLabel(t.enum.reportType, r.report_type)}</Tag>
                    {r.status === "draft" && <Tag>{slugLabel(t.enum.reportStatus, r.status)}</Tag>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── 阶段漏斗 ───────────────────────────────────────── */}
      <section className="mb-12">
        <SectionTitle>{t.overview.funnelTitle}</SectionTitle>
        <div className="grid grid-cols-5 gap-px bg-hairline">
          {d.funnel.map(f => (
            <div key={f.stage} className="bg-canvas p-4">
              <div className="num text-[22px] leading-none mb-2">{f.count}</div>
              <div className="h-1 rounded-[1px] mb-2.5"
                   style={{
                     background: "var(--color-hairline-active)",
                     backgroundImage: `linear-gradient(to right, var(--color-fg-subtle) ${(f.count / funnelMax) * 100}%, transparent 0)`,
                   }} />
              <div className="text-[11px] text-fg-subtle">{stageLabel(t, f.stage)}</div>
            </div>
          ))}
        </div>
        {/* IA §4.1 标注过：驻留天数与转化率需 stage_change 事件积累存量才能算。
            机会台的行内改阶段已在写这类事件，跑一段时间后在这里补上。 */}
        <p className="text-[11px] text-fg-faint mt-2.5">{t.overview.funnelEmpty}</p>
      </section>

      {/* ── 资源盘口：核心是存储，首屏就要看得见 ──────────────── */}
      <section>
        <SectionTitle
          action={<span className="num text-[12px] text-fg-subtle">
                    {d.resources.total.n} {t.overview.reportsUnit} {mb(d.resources.total.bytes)} MB
                  </span>}>
          {t.overview.reportsScope}
        </SectionTitle>
        <div className="grid grid-cols-5 gap-px bg-hairline">
          {d.resources.by_kind.map(k => (
            <div key={k.kind} className="bg-canvas p-4">
              <div className="num text-[22px] leading-none mb-1.5">{k.n}</div>
              <div className="text-[11px] text-fg-subtle">
                {slugLabel(t.enum.resourceKind, k.kind)}
              </div>
              <div className="num text-[10px] text-fg-faint mt-0.5">{mb(k.bytes)} MB</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Kpi({ n, label, lat, showLat }: {
  n: number; label: string; lat: string; showLat: boolean
}) {
  return (
    <div className="bg-canvas px-5 py-4">
      <div className="num text-[34px] leading-none mb-2.5">{n}</div>
      <div className="text-[11px] text-fg-subtle">{label}</div>
      {/* 拉丁小字只在中文版出现：英文标签本身就是拉丁 */}
      {showLat && <div className="lat text-[10px] uppercase tracking-wider text-fg-faint">{lat}</div>}
    </div>
  )
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-[13px] font-medium text-fg-muted">{children}</h2>
      {action}
    </div>
  )
}

function StagePip({ stage, t }: { stage: string; t: Dict }) {
  const i = STAGES.findIndex(s => s.key === stage)
  return (
    <span className="flex gap-0.5 shrink-0" title={stageLabel(t, stage)}>
      {STAGES.map((_, k) => (
        <span key={k} className="w-2.5 h-1 rounded-[1px]"
              style={{ background: k <= i ? "var(--color-fg-subtle)" : "var(--color-hairline-active)" }} />
      ))}
    </span>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-[10px]
                     bg-surface-elevated text-fg-subtle">
      {children}
    </span>
  )
}

function Blank({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 hairline-t text-fg-faint">
      <span className="opacity-50">{icon}</span>
      <span className="text-[12px]">{text}</span>
    </div>
  )
}
