import Sidebar from "./Sidebar"
import type { SessionUser } from "@/lib/session"

/**
 * 应用外壳。改为服务端组件 —— user 在 layout 里读好传进来，
 * 不再由客户端自己判断登录态。
 * 未登录时（user 为 null）不渲染外壳，让 /login 与落地页自己占满整屏。
 */
export default function AppShell({
  user,
  children,
}: {
  user: SessionUser | null
  children: React.ReactNode
}) {
  if (!user) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
