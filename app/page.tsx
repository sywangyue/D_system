import { getSessionUser } from '@/lib/session'
import { getLocale, getDict } from '@/lib/i18n'
import { getLandingData } from '@/lib/queries/landing'
import LandingPage from '@/components/landing/LandingPage'

/**
 * 根路由 = 官网落地页，登录与否都显示（2026-09-17 Max 定，原 TASK-J §1 为「已登录跳 /overview」）。
 * 登录态只决定「进入系统」指向哪里：已登录直接进盘面，未登录去登录页。
 *
 * 中间件对 `/` 是**精确放行**并打上 x-mwlab-bare，根布局据此不渲染后台侧栏。
 *
 * 取数一律走 lib/queries/landing.ts —— 一小时的 unstable_cache 挂在那里的
 * **查询函数**上，不挂在本页：本页要读 cookie 判断登录态，必然是动态的（§5）。
 *
 */
export default async function Home() {
  const [user, locale, t, data] = await Promise.all([
    getSessionUser(), getLocale(), getDict(), getLandingData(),
  ])
  const enterHref = user ? '/overview' : '/login'
  return <LandingPage locale={locale} t={t} data={data} enterHref={enterHref} />
}
