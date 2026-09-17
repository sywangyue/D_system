import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { Dict } from "@/lib/i18n-shared"

/**
 * 未实现页面的占位。
 * 用它而不是任其 404 —— 侧栏里挂着的入口点进去是「页面不存在」，
 * 会让人以为坏了；写清楚归属哪一步，才知道是没做还是出错。
 *
 * 文案分两来源：框架自己的字（计划内容 / 待实现）走字典；
 * 各页独有的 title / phase / items 由调用方从字典取好传进来。
 */
export default function Placeholder({
  title, lat, phase, items, back, t,
}: {
  title: string; lat: string; phase: string; items: string[]
  back?: { href: string; label: string }
  t: Dict
}) {
  return (
    <div className="max-w-[1180px] mx-auto px-8 py-9">
      {back && (
        <Link href={back.href}
              className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg mb-6">
          <ArrowLeft size={13} /> {back.label}
        </Link>
      )}
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-[1.6875rem] font-medium leading-tight">{title}</h1>
        <span className="lat text-[11px] uppercase tracking-wider text-fg-subtle">{lat}</span>
      </div>
      {/* 原先这里写成 `{phase} 待实现` —— 紧贴表达式的 JSX 文本，
          正则式的「硬编码中文」扫描扫不到，接 i18n 时按 AST 才抓出来 */}
      <p className="text-[13px] text-fg-subtle mb-8">{phase} {t.placeholder.notImplemented}</p>

      <div className="rounded-[8px] bg-surface border border-hairline p-6">
        <div className="text-[11px] uppercase tracking-wider text-fg-subtle mb-3">
          {t.placeholder.planned}
        </div>
        <ul className="flex flex-col gap-1.5">
          {items.map(i => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-fg-muted">
              <span className="text-fg-faint mt-[3px]">·</span>{i}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
