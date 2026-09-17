import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getLocale, getDict } from "@/lib/i18n"
import ResearchList from "./research-list"

/** 调研库。服务端只负责取登录态与语言，列表数据由客户端按需分页拉取。 */
export default async function ResearchPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const [locale, t] = await Promise.all([getLocale(), getDict()])
  return <ResearchList locale={locale} t={t} />
}
