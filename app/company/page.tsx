import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import CompanyList from "./company-list"

/** 公司库。服务端只负责取登录态与字典（t / locale 往下传），列表数据由客户端按需分页拉取。 */
export default async function CompanyPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const [locale, t] = await Promise.all([getLocale(), getDict()])
  return <CompanyList locale={locale} t={t} />
}
