import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getLocale, getDict } from '@/lib/i18n'
import { getLandingData } from '@/lib/queries/landing'
import LandingPage from '@/components/landing/LandingPage'

/**
 * 根路由，按登录态分流（TASK-J §1）：已登录 → /overview；未登录 → 官网落地页。
 *
 * 中间件对 `/` 是**精确放行**（proxy.ts），所以未登录请求真的会渲染到本页，
 * 而不是在中间件被 307 走；已登录用户的分流由这里的 getSessionUser() 完成。
 *
 * 取数一律走 lib/queries/landing.ts —— 一小时的 unstable_cache 挂在那里的
 * **查询函数**上，不挂在本页：本页要读 cookie 判断登录态，必然是动态的（§5）。
 *
 * 未登录时 AppShell 不渲染侧栏，本页自己占满整屏，这里不再加一层判断（§6.3）。
 */
export default async function Home() {
  if (await getSessionUser()) redirect('/overview')

  const [locale, t, data] = await Promise.all([getLocale(), getDict(), getLandingData()])
  return <LandingPage locale={locale} t={t} data={data} />
}
