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
 *
 * V2-19 版式：五块内容各自成卡，外层 .board-masonry 走真 masonry
 * （CSS multicol，列宽 340px 驱动）。原来的 62/38 分栏与 5 列并排网格都拆掉了 ——
 * 340px 的列里塞不下 5 格，漏斗与资源改成纵向条目，narrow 下反而更好读。
 * 版式决策与取舍记在 globals.css 的「盘面 · 卡片与瀑布式布局」段。
 */

const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

export default async function OverviewPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [locale, t] = await Promise.all([getLocale(), getDict()])
  const isEn = locale === "en"

  const d = getOverview()
  const funnelMax = Math.max(1, ...d.funnel.map(f => f.count))
  const resMax = Math.max(1, ...d.resources.by_kind.map(k => k.n))

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      <div className="mb-8">
        <h1 className="text-title-cjk font-medium leading-tight">{t.overview.title}</h1>
        <p className="text-ui text-fg-subtle mt-1">
          {user.display_name} {t.overview.weekEnding}{" "}
          <span className="num">{fmtDate(locale, d.week_end)}</span>
        </p>
      </div>

      <div className="board-masonry">

        {/* ── KPI 四数：卡内 2×2，发丝线分格 ──────────────────
            跨卡不可比是 masonry 的代价，卡内这四个数彼此仍然对齐可比。 */}
        <section className="board-card overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-hairline">
            <Kpi n={d.kpi.active}        label={t.overview.kpiActive}     lat="Active"     showLat={!isEn} />
            <Kpi n={d.kpi.ma}            label={t.overview.kpiMa}         lat="M&A"        showLat={!isEn} />
            <Kpi n={d.kpi.greenfield}    label={t.overview.kpiGreenfield} lat="Greenfield" showLat={!isEn} />
            <Kpi n={d.kpi.due_this_week} label={t.overview.kpiTasks}      lat="Due"        showLat={!isEn} />
          </div>
        </section>

        {/* ── 本周待办 ──────────────────────────────────────── */}
        <section className="board-card">
          <CardTitle>{t.overview.tasksTitle}</CardTitle>
          {d.tasks.length === 0 ? (
            <Blank icon={<Inbox size={18} />} text={t.empty.noTasks} />
          ) : (
            <div>
              {d.tasks.map(tk => (
                <Link key={tk.opp_id} href={`/opportunity/${tk.opp_id}`}
                      className="row block py-2.5 px-4 hairline-t">
                  <div className="flex items-center gap-3">
                    <span className={`num text-micro w-[46px] shrink-0
                                      ${tk.overdue ? "text-[var(--color-error-text)]" : "text-fg-subtle"}`}>
                      {fmtMonthDay(locale, tk.next_action_due)}
                    </span>
                    {/* 机会标题是数据，原样显示 */}
                    <span className="text-ui text-fg-muted truncate flex-1">{tk.title}</span>
                    <StagePip stage={tk.stage} t={t} />
                  </div>
                  {/* 下一步动作。340px 的列宽里与标题并排会挤成两三个字，
                      所以换到第二行、与标题左对齐 —— 不是不显示。 */}
                  {tk.next_action && (
                    <div className="text-ui-cjk text-fg-subtle truncate mt-0.5 pl-[58px]">
                      {tk.next_action}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── 最近调研 ──────────────────────────────────────── */}
        <section className="board-card">
          <CardTitle
            action={<Link href="/research" className="flex items-center gap-1 text-ui-cjk text-fg-subtle hover:text-fg">
                      {t.nav.reports} <ArrowRight size={12} />
                    </Link>}>
            {t.overview.reportsTitle}
          </CardTitle>
          {d.reports.length === 0 ? (
            <Blank icon={<FileText size={18} />} text={t.empty.noReports} />
          ) : (
            <div>
              {d.reports.map(r => (
                <Link key={r.id} href={`/research/${r.id}`}
                      className="row block py-3 px-4 hairline-t">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-ui-cjk text-fg-muted truncate flex-1">
                      {r.title || r.company_name || slugLabel(t.enum.reportType, r.report_type)}
                    </span>
                    <span className="num text-micro text-fg-faint shrink-0">
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

        {/* ── 阶段漏斗：5 格并排改成 5 行，340px 列里放得下 ────── */}
        <section className="board-card">
          <CardTitle>{t.overview.funnelTitle}</CardTitle>
          <div className="px-4 pt-1 pb-3">
            {d.funnel.map(f => (
              <MeterRow key={f.stage}
                        n={f.count}
                        ratio={f.count / funnelMax}
                        label={stageLabel(t, f.stage)} />
            ))}
          </div>
          {/* IA §4.1 标注过：驻留天数与转化率需 stage_change 事件积累存量才能算。
              机会台的行内改阶段已在写这类事件，跑一段时间后在这里补上。 */}
          <p className="text-micro text-fg-faint px-4 pb-3">{t.overview.funnelEmpty}</p>
        </section>

        {/* ── 资源盘口：核心是存储，首屏就要看得见 ──────────────── */}
        <section className="board-card">
          <CardTitle
            action={<span className="num text-ui-cjk text-fg-subtle">
                      {d.resources.total.n} {t.overview.reportsUnit} {mb(d.resources.total.bytes)} MB
                    </span>}>
            {t.overview.reportsScope}
          </CardTitle>
          <div className="px-4 pt-1 pb-3">
            {d.resources.by_kind.map(k => (
              <MeterRow key={k.kind}
                        n={k.n}
                        ratio={k.n / resMax}
                        label={slugLabel(t.enum.resourceKind, k.kind)}
                        meta={`${mb(k.bytes)} MB`} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Kpi({ n, label, lat, showLat }: {
  n: number; label: string; lat: string; showLat: boolean
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="num text-title leading-none mb-2.5">{n}</div>
      <div className="text-micro text-fg-subtle">{label}</div>
      {/* 拉丁小字只在中文版出现：英文标签本身就是拉丁 */}
      {showLat && <div className="lat text-micro uppercase tracking-wider text-fg-faint">{lat}</div>}
    </div>
  )
}

/** 卡头。原 SectionTitle 是裸标题，进卡之后要自己带内边距。 */
function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-4 py-3">
      <h2 className="text-ui font-medium text-fg-muted">{children}</h2>
      {action}
    </div>
  )
}

/** 数值 + 横向比例条 + 标签。漏斗与资源盘口共用 —— 原来是两套并排网格。 */
function MeterRow({ n, ratio, label, meta }: {
  n: number; ratio: number; label: string; meta?: string
}) {
  return (
    <div className="flex items-center gap-3 h-8">
      <span className="num text-ui text-fg w-8 shrink-0 text-right">{n}</span>
      <span className="h-1 rounded-[1px] flex-1 min-w-0"
            style={{
              background: "var(--color-hairline-active)",
              backgroundImage: `linear-gradient(to right, var(--color-fg-subtle) ${ratio * 100}%, transparent 0)`,
            }} />
      <span className="text-micro text-fg-subtle shrink-0 truncate max-w-[40%]">{label}</span>
      {meta && <span className="num text-micro text-fg-faint shrink-0">{meta}</span>}
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
    <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-micro
                     bg-surface-elevated text-fg-subtle">
      {children}
    </span>
  )
}

function Blank({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 hairline-t text-fg-faint">
      <span className="opacity-50">{icon}</span>
      <span className="text-ui-cjk">{text}</span>
    </div>
  )
}
