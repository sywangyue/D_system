import { redirect } from "next/navigation"
import Link from "next/link"
import { Library } from "lucide-react"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import { listKnowledge } from "@/lib/knowledge"
import { bizLineLabel } from "@/lib/enums"
import { pickContent, type Dict, type Locale } from "@/lib/i18n-shared"

/**
 * 知识库 —— Max 已完成项目（并购 / 收购 / 新品类开拓）的档案，一个项目一条。
 *
 * 服务端组件，**直接调 lib/knowledge.ts 读目录，不发 HTTP、不建列表接口** ——
 * 页面和数据在同一个进程里，套一层 HTTP 只是给自己发请求。
 *
 * 「显示已归档」走 `?archived=1` 而不是 useState：这一页因此完全不需要客户端 JS，
 * 顺带让开关状态可收藏、可后退。缺点是不是即时切换 —— 20 条记录上不明显。
 *
 * ⚠️ title / summary 是**内容**（有 `_en` 变体是 Max 自己写了两份），走 pickContent，
 *    不进字典；界面文案才走 t.knowledge.*（V2-10 §5.5）。
 */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [sp, locale, t] = await Promise.all([searchParams, getLocale(), getDict()])
  const showArchived = sp.archived === "1"

  const all = listKnowledge()
  const items = all.filter(i => showArchived || i.status === "active")
  const archivedCount = all.filter(i => i.status === "archived").length

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[1.6875rem] font-medium leading-tight">{t.knowledge.title}</h1>
          <span className="num text-[12px] text-fg-muted">{items.length}</span>
        </div>

        {/* 没有已归档项目时不显示这个开关 —— 摆一个点不出东西的控件是噪音。
            已经打开的状态下始终显示，否则用户没法关掉它。 */}
        {(archivedCount > 0 || showArchived) && (
          <Link
            href={showArchived ? "/knowledge" : "/knowledge?archived=1"}
            className="flex items-center gap-2 text-[12px] text-fg-subtle hover:text-fg"
          >
            <span className={`w-[28px] h-4 rounded-full relative transition-colors
                              ${showArchived ? "bg-accent" : "bg-hairline-active"}`}>
              <span className={`absolute top-[3px] w-[10px] h-[10px] rounded-full bg-surface
                                transition-all ${showArchived ? "left-[15px]" : "left-[3px]"}`} />
            </span>
            {t.knowledge.archivedToggle}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-fg-faint">
          <Library size={22} className="opacity-40" />
          <span className="text-[13px] text-fg-subtle">{t.knowledge.empty}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map(item => (
            <Card key={item.slug} item={item} locale={locale} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Card({
  item, locale, t,
}: {
  item: ReturnType<typeof listKnowledge>[number]
  locale: Locale
  t: Dict
}) {
  const title = pickContent(locale, item.title, item.titleEn)
  const summary = item.summary ? pickContent(locale, item.summary, item.summaryEn) : null

  return (
    <Link
      href={`/knowledge/${item.slug}`}
      className="group block rounded-[6px] border border-hairline bg-surface overflow-hidden
                 hover:border-hairline-active"
      style={{ transition: "border-color var(--dur-fast) var(--ease-standard)" }}
    >
      {item.cover && (
        <div className="aspect-video bg-surface-elevated overflow-hidden">
          {/* public/ 下的静态图，Next 自己发；cover 已在 lib/knowledge.ts 里改写成对外 URL。
              这里用裸 img 是因为本页是服务端组件，挂不了 onError 兜底（§5.2 说明过：
              图丢了就是裂图，不值得为此多一次 IO）。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.cover} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="num text-[11px] text-fg-subtle">{item.year}</span>
          <Tag>{bizLineLabel(t, item.type)}</Tag>
          {item.status === "archived" && <Tag>{t.knowledge.archived}</Tag>}
        </div>
        <div className="text-[14px] text-fg leading-snug group-hover:text-fg">{title}</div>
        {summary && (
          <p className="mt-1 text-[12px] text-fg-subtle leading-relaxed line-clamp-2">{summary}</p>
        )}
      </div>
    </Link>
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
