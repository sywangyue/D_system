import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getLocale, getDict } from "@/lib/i18n"
import LoginForm from "./login-form"

/** 服务端壳：已登录直接进系统，未登录渲染表单。语言取自 cookie。 */
export default async function LoginPage() {
  if (await getSessionUser()) redirect("/overview")

  const [locale, t] = await Promise.all([getLocale(), getDict()])
  return <LoginForm locale={locale} t={t} />
}
