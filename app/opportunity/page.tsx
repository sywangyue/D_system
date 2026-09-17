import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import Pipeline from "./pipeline"

/** 机会台。服务端只负责取登录态与语言，列表数据由客户端按需分页拉取。 */
export default async function OpportunityPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const [locale, t] = await Promise.all([getLocale(), getDict()])
  return (
    <Pipeline
      currentUser={user.email}
      canWrite={user.role !== "readonly"}
      locale={locale}
      t={t}
    />
  )
}
