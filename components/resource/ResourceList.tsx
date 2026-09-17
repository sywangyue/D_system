"use client"

import { Download } from "lucide-react"
import { fill, fmtDate, type Dict, type Locale } from "@/lib/i18n-shared"
import { slugLabel } from "@/lib/enums"

/**
 * 资源列表 —— 机会详情页与公司详情页共用。
 *
 * 两处规格逐字对得上（V2-07 §2.3 / V2-08 §2.2「资源区」）：
 * 按 collected_at 倒序，每行 kind 徽标 + 标题 + 大小 + 采集时间 + 下载按钮。
 * 因此收到 components/ 下成为一份实现 —— 否则同一张列表要维护两份，早晚漂移。
 *
 * 组件只接收资源数组与字典，不夹带机会或公司的业务判断（任务 C 要原样复用）。
 * 空态文案是唯一留的口子：几个页面的说法不同，由调用方传。
 *
 * 下载一律用 <a download> 让浏览器自己流式处理。
 * 不要 fetch + createObjectURL —— 那会把整个文件读进内存。
 */

export interface ResourceItem {
  resource_id: number
  kind: string
  title: string
  file_path?: string | null
  mime?: string | null
  size_bytes?: number | null
  collected_at?: string | null
  source?: string | null
}

function fmtSize(b: number | null | undefined): string {
  if (b === null || b === undefined || !Number.isFinite(b) || b <= 0) return "—"
  // KB 与 MB 一律给一位小数：取整会把 44.75 KB 显示成 45 KB，
  // 同屏两个文件差了 1KB 以上却看着一样大。
  // 小数点是千分位之外的东西，两种语言一致，不需要走 Intl。
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${b} B`
}

export default function ResourceList({
  resources, t, locale, emptyText,
}: {
  resources: ResourceItem[]
  t: Dict
  locale: Locale
  emptyText?: string
}) {
  if (resources.length === 0) {
    return (
      <div className="rounded-[4px] border border-hairline bg-surface px-3.5 py-3
                      text-[12px] text-fg-faint">
        {emptyText ?? t.resource.empty}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {resources.map(r => (
        <div key={r.resource_id}
             className="row flex items-center gap-2.5 rounded-[4px] border border-hairline px-2.5 py-2">
          <span className="shrink-0">
            <span className="inline-block px-1.5 h-[17px] leading-[17px] rounded-[2px] text-[10px]
                             bg-surface-elevated border border-hairline text-fg-subtle align-middle">
              {/* 资源类型是闭集枚举，按 locale 取标签；未知值回退原值 */}
              {slugLabel(t.enum.resourceKind, r.kind)}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            {/* 标题是数据（文件名/报告名），原样显示，不查字典 */}
            <div className="text-[12px] text-fg-muted truncate" title={r.title}>{r.title}</div>
            <div className="num text-[10px] text-fg-faint">
              {fmtSize(r.size_bytes)}
              {r.collected_at ? ` · ${fmtDate(locale, r.collected_at)}` : ""}
            </div>
          </div>
          <a href={`/api/resource/${r.resource_id}/download`} download
             title={fill(t.resource.download, { name: r.title })}
             className="shrink-0 w-6 h-6 rounded-[4px] border border-hairline
                        flex items-center justify-center text-fg-subtle hover:text-fg">
            <Download size={12} />
          </a>
        </div>
      ))}
    </div>
  )
}
