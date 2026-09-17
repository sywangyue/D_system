import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import CompanyList from "./company-list"

/** 公司库。服务端只负责取登录态，列表数据由客户端按需分页拉取。 */
export default async function CompanyPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return <CompanyList />
}
