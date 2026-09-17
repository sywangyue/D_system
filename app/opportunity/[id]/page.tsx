import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import { getOpportunityDetail } from "@/lib/queries/opportunity"
import OpportunityDetail from "./opportunity-detail"

/**
 * 机会详情 —— 全系统价值链的兑现处：
 * 机会挂上公司之后，该公司名下的调研报告与企查查原始数据自动出现在这里。
 *
 * 服务端直接调查询函数（与 /api/opportunity/[id] 共用同一份，见 lib/queries/opportunity.ts），
 * 不对自己发一次 HTTP —— 与 app/overview/page.tsx 同一做法。
 * 六块数据一次取齐，交给客户端组件负责 tab 切换与阶段推进。
 * 语言同样在服务端读好（cookie 是唯一来源），dict / locale 一起下传。
 */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const { id } = await params
  const detail = getOpportunityDetail(id)
  if (!detail) notFound()

  const [locale, t] = await Promise.all([getLocale(), getDict()])

  // 逾期判定放服务端算：客户端算会在服务端渲染与 hydration 之间
  // 因时区/跨日产生不一致，React 会报 hydration 警告。
  // 口径与 lib/queries/overview.ts 的 date('now','localtime') 对齐，用本地日期。
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")

  return (
    <OpportunityDetail
      detail={detail}
      canWrite={user.role !== "readonly"}
      today={today}
      locale={locale}
      t={t}
    />
  )
}
