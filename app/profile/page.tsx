import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import ProfileContent from "./profile-content"

export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return <ProfileContent userInfo={user} />
}
