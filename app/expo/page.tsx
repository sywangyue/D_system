import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getDict, getLocale } from "@/lib/i18n"
import { getIndustryPrefs } from "@/lib/queries/user"
import {
  getExpoStats, getExpoCalendar, currentMonth, localToday,
} from "@/lib/queries/expo"
import ExpoBoard from "./expo-board"

/**
 * 展会底图。服务端壳 —— 首屏的地图、四宫格、当月日历都在这里直接算好（§6.2），
 * 客户端只在筛选变化 / 翻月时才请求接口，与 /overview 同一做法。
 *
 * 行业筛选的初始值 = 当前用户在 /profile 保存的偏好。这是那份偏好在
 * 新架构里唯一的消费方（V2-12 §4.4）。
 */

export default async function ExpoPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const [locale, t] = await Promise.all([getLocale(), getDict()])

  const month = currentMonth()
  const today = localToday()
  const industry = getIndustryPrefs(user.email)

  const stats = getExpoStats({ industry_l1: industry })
  const days = getExpoCalendar(month, today)
  // 城市下拉的候选不跟随筛选，否则选中一个城市后其余选项全部消失
  const placeOptions = getExpoStats().points.slice(0, 30)

  return (
    <ExpoBoard
      t={t}
      locale={locale}
      initialStats={stats}
      initialDays={days}
      initialMonth={month}
      today={today}
      initialIndustry={industry}
      placeOptions={placeOptions}
    />
  )
}
