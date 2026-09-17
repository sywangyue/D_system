import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import Pipeline from "./pipeline"

/** 机会台。服务端只负责取登录态，列表数据由客户端按需分页拉取。 */
export default async function OpportunityPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return <Pipeline currentUser={user.email} canWrite={user.role !== "readonly"} />
}
