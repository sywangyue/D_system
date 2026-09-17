import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"

/**
 * 盘面 —— 5.2 阶段的最小可用版，只为让登录有地方落。
 * 完整设计（KPI 四数 / 本周待办 / 最近调研 / 阶段漏斗 / 资源盘口）在 5.3 做。
 */
export default async function OverviewPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10">
      <h1 className="text-[1.6875rem] font-medium mb-1">盘面</h1>
      <p className="text-[13px] text-fg-muted mb-10">
        欢迎回来，{user.display_name}
      </p>
      <div className="rounded-[8px] bg-surface p-8 hairline border">
        <div className="text-[11px] uppercase tracking-wider text-fg-subtle mb-3">
          阶段 5.3 待实现
        </div>
        <p className="text-[14px] text-fg-muted leading-relaxed">
          KPI 四数 · 本周待办 · 最近调研 · 阶段漏斗 · 资源盘口
          <br />
          接口 <span className="lat num">/api/overview</span> 已就绪。
        </p>
      </div>
    </div>
  )
}
