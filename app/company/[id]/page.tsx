import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import CompanyDetail from "./company-detail"

/**
 * 公司详情。服务端取登录态（未登录由中间件与这里双重兜住）与字典，
 * 五块数据由客户端组件按 id 拉 /api/company/[id]，文案走传下去的 t。
 * 与 app/exhibition/[id] 的 page.tsx + exhibition-content.tsx 同一结构。
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const { id } = await params
  const [locale, t] = await Promise.all([getLocale(), getDict()])
  return <CompanyDetail id={id} locale={locale} t={t} />
}
