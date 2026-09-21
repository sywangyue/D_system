import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getLocale, getDict } from "@/lib/i18n"
import ResearchDetail from "./research-detail"

/**
 * 调研报告详情。服务端只取登录态与语言，报告全文由客户端组件按 id 拉
 * /api/research/[id]（report_md 可达几万字，不适合塞进服务端页的初始载荷）。
 */
export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const { id } = await params
  const [locale, t] = await Promise.all([getLocale(), getDict()])
  // readonly 账号看得到关联，但不给关联/取消的入口（接口那边 requireWriter 也会拦）
  return <ResearchDetail id={id} locale={locale} t={t} canWrite={user.role !== "readonly"} />
}
