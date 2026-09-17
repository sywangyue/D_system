import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { FileText } from "lucide-react"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import { getKnowledge, listDocs } from "@/lib/knowledge"
import { bizLineLabel } from "@/lib/enums"
import { pickContent } from "@/lib/i18n-shared"
import KnowledgeBody from "./knowledge-body"

/**
 * 知识库详情 —— 服务端组件，直接读文件系统。
 *
 * slug 不存在、或 index.md 不合法（缺 title / type / year）→ `notFound()`，
 * 与 `/opportunity/[id]` 一致：真 404，不是空页也不是 500。
 *
 * ⚠️ 标题 / 正文是数据：英文界面优先取 `title_en`，缺了回退中文标题（§5.5）。
 * ⚠️ 右栏文档是 `docs/` 下的裸文件，没有 resource_id / kind / collected_at，
 *    所以**不复用** components/resource/ResourceList —— 硬套要么造假数据要么改坏共用组件。
 */

/** 文件大小。B / KB / MB 两边语言写法相同，不进字典。 */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [{ slug }, locale, t] = await Promise.all([params, getLocale(), getDict()])

  const item = getKnowledge(slug)
  if (!item) notFound()

  const docs = listDocs(slug)
  const title = pickContent(locale, item.title, item.titleEn)

  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      {/* 字典里的 back 自带箭头，不要再配一个 lucide 图标 */}
      <Link href="/knowledge"
            className="inline-flex items-center text-[13px] text-fg-subtle hover:text-fg mb-5">
        {t.knowledge.back}
      </Link>

      <div className="flex items-baseline flex-wrap gap-3 mb-7">
        <h1 className="text-[1.6875rem] font-medium leading-tight">{title}</h1>
        <span className="num text-[13px] text-fg-subtle">{item.year}</span>
        <Tag>{bizLineLabel(t, item.type)}</Tag>
        {item.status === "archived" && <Tag>{t.knowledge.archived}</Tag>}
      </div>

      <div className="grid grid-cols-[1.9fr_1fr] gap-10 items-start">
        <KnowledgeBody md={item.body} slug={slug} />

        {/* docs/ 为空或不存在时整块不渲染 */}
        {docs.length > 0 && (
          <aside>
            <h2 className="text-[13px] font-medium text-fg-muted mb-2.5">{t.knowledge.docs}</h2>
            <ul className="hairline-t">
              {docs.map(d => (
                <li key={d.name} className="flex items-center gap-3 h-11 px-1 hairline-b">
                  <FileText size={14} className="text-fg-faint shrink-0" />
                  <span className="text-[12px] text-fg-muted truncate flex-1">{d.name}</span>
                  <span className="num text-[11px] text-fg-faint shrink-0">{fmtSize(d.size)}</span>
                  <a
                    href={`/api/knowledge/${slug}/doc/${encodeURIComponent(d.name)}`}
                    className="text-[12px] text-fg-subtle hover:text-fg shrink-0"
                  >
                    {t.knowledge.download}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}

/* ── 小件 ─────────────────────────────────────────────── */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-[10px]
                     bg-surface-elevated text-fg-subtle">
      {children}
    </span>
  )
}
