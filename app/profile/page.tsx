import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict } from "@/lib/i18n"
import ProfileContent from "./profile-content"

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  const t = await getDict()
  return <ProfileContent userInfo={user} t={t} />
}
