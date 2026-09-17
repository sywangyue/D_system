import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict } from "@/lib/i18n"
import { getIndustryPrefs } from "@/lib/queries/user"
import ProfileContent from "./profile-content"

/**
 * 服务端壳。
 * 偏好在服务端读好再传下来（V2-13 §2.2）：省掉首屏那次 `/api/user/preferences`，
 * 也没有「先渲染未勾选、再闪一下变成已勾选」的过程。
 */
export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const t = await getDict()
  return <ProfileContent userInfo={user} t={t} initialL1s={getIndustryPrefs(user.email)} />
}
