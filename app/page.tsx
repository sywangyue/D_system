import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'

/**
 * 根路由。IA 定的是「未登录渲染官网落地页，已登录跳 /overview」，
 * 落地页在 5.8 才做，在那之前未登录一律回登录页。
 */
export default async function Home() {
  redirect((await getSessionUser()) ? '/overview' : '/login')
}
