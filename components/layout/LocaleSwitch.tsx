"use client"

import { useRouter } from "next/navigation"
import { LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n-shared"

/**
 * 语言切换（ZH | EN）。
 *
 * 从登录页抽出来，落地页与登录页共用一份（V2-14 §4.1）。复制第二份的代价是：
 * 「写 cookie 之后必须 refresh」这类细节，早晚只在一处修。
 *
 * 没有 DE：`locales/` 只有 zh 与 en，德文待人工翻译（docs/QC.md §4）。
 * 放一个点了没反应的按钮比不放更糟。
 */
export default function LocaleSwitch({
  locale, className = "",
}: {
  locale: Locale
  className?: string
}) {
  const router = useRouter()
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000`
            router.refresh()
          }}
          aria-current={l === locale ? "true" : undefined}
          className={`px-2 py-1 rounded-[4px] text-[12px] transition-colors ${
            l === locale ? "text-fg font-medium" : "text-fg-subtle hover:text-fg"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
