import Sidebar from "./Sidebar"
import type { SessionUser } from "@/lib/session"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * 应用外壳。服务端组件 —— user 与字典都在 layout 里读好传进来，
 * 客户端不自己判断登录态，也不自己读语言 cookie。
 * user 为 null 时不渲染外壳，让 /login 与落地页自己占满整屏。
 * 落地页对已登录用户也传 null（根布局按中间件的 x-mwlab-bare 标记处理）。
 */
export default function AppShell({
  user, locale, t, children,
}: {
  user: SessionUser | null
  locale: Locale
  t: Dict
  children: React.ReactNode
}) {
  if (!user) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} locale={locale} t={t} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
