"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader2 } from "lucide-react"
import { type Locale, type Dict, errorText } from "@/lib/i18n-shared"
import LocaleSwitch from "@/components/layout/LocaleSwitch"
import LoginBackdrop from "@/components/login/LoginBackdrop"

/**
 * 登录表单（V2-18 改版）。
 *
 * **Stitch 稿的 1:1 还原**（design/v2-18-landing/stitch-login/）：整页一张画布，
 * 等距 3D 几何背景（LoginBackdrop），420px 白卡片居中悬浮。
 * 旧版的左右分栏、左栏大标题与四个统计数字全部去掉 —— 登录页不需要讲这些。
 *
 * 稿子上没有、但代码里一个都不能少的东西：
 *   - 四个状态：default / focused / error / loading，稿子都画了，这里全部接上真实逻辑
 *   - `autoComplete` username / current-password —— 浏览器密码填充靠它，丢了体验就废一半
 *   - `aria-invalid` 与 `role="alert"` —— 读屏要靠它们知道哪里错了
 *   - LocaleSwitch 用现成组件，不是稿子里那两个 onclick 按钮
 *   - cookie 是唯一登录态，成功后 refresh，不写任何客户端存储
 *
 * 卡片顶部的品牌锁定同时是回首页的链接（稿子的设计，参考 workbuddy）。
 * 这里没有复用 BrandLockup 组件：稿子给的尺寸（橙板 92×33 / 竖线 15px / 中文 17px）
 * 与 standard 态一致，但它要整体可点且带 hover 位移，包一层 Link 更直接。
 */
export default function LoginForm({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const isEn = locale === "en"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    if (!email.trim()) return setError(t.login.errEmail)
    if (!/\S+@\S+\.\S+/.test(email)) return setError(t.login.errFormat)
    if (!password) return setError(t.login.errPassword)

    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(res.status === 401 ? t.login.errCredentials : errorText(t, body.error, body.values, t.login.errNetwork))
        setLoading(false)
        return
      }
      // cookie 已由接口种下。刷新让服务端重新读登录态，不写任何客户端存储。
      router.replace("/overview")
      router.refresh()
    } catch {
      setError(t.login.errNetwork)
      setLoading(false)
    }
  }

  const l = t.login

  return (
    <div
      className="relative flex min-h-screen select-none flex-col justify-between overflow-hidden bg-canvas"
      // 英文版摘掉 CJK 字体栈由 globals.css 的 html[lang="en"] 规则负责，这里只声明语言
      lang={isEn ? "en" : "zh-CN"}
    >
      <LoginBackdrop />

      {/* 顶栏：只有语言切换 */}
      <header className="relative z-20 flex w-full items-center justify-end px-10 py-8">
        <LocaleSwitch locale={locale} />
      </header>

      {/* 卡片区 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4">
        <div className="login-card flex w-full max-w-[420px] flex-col items-center rounded-[8px] bg-surface-elevated p-10">
          {/* 品牌锁定 = 回首页入口 */}
          <Link
            href="/"
            aria-label={l.homeAria}
            title={l.homeAria}
            className="group mb-6 inline-flex items-center rounded-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-fg focus:ring-offset-4"
          >
            <span
              className="flex select-none items-center justify-center bg-brand font-semibold leading-none tracking-[-0.02em] text-brand-fg"
              style={{ width: 92, height: 33, fontSize: 20, fontFamily: "var(--font-sans)" }}
            >
              MWLAB
            </span>
            <span className="mx-[12px] h-[15px] w-px bg-logo-rule" />
            <span
              className="select-none font-bold leading-none"
              style={{
                fontSize: 17,
                fontFamily: "var(--font-logo-cn)",
                letterSpacing: "var(--logo-cn-tracking)",
                color: "var(--color-brand-ink)",
              }}
            >
              万象
            </span>
          </Link>

          {/* 三行文字 */}
          <div className="mb-8 w-full text-center">
            <p className="mb-1 text-[13px] font-normal tracking-wide text-fg-subtle">{l.poweredBy}</p>
            <h1 className="text-[27px] font-medium leading-snug tracking-normal text-fg">{l.title}</h1>
            <p className="mt-1 text-[13px] tracking-normal text-fg-subtle">{l.subtitle}</p>
          </div>

          {/* 错误态 */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 flex w-full items-center gap-2 rounded-[4px] px-3.5 py-2.5 text-[12px]"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error-border)",
                color: "var(--color-error-text)",
              }}
            >
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-medium tracking-normal">{error}</span>
            </div>
          )}

          <form className="w-full space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-1.5 text-left">
              <label htmlFor="login-email" className="block text-[12px] font-normal text-fg-muted">
                {l.email}
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                aria-invalid={!!error}
                placeholder={l.emailPlaceholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="login-input h-[42px] w-full rounded-[4px] px-3.5 text-[13px] text-fg outline-none"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="login-password" className="block text-[12px] font-normal text-fg-muted">
                {l.password}
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={!!error}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input h-[42px] w-full rounded-[4px] px-3.5 text-[13px] text-fg outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex h-[42px] w-full items-center justify-center rounded-[4px] bg-accent text-[14px] font-medium tracking-wide text-accent-fg transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-fg focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{loading ? l.submitting : l.submit}</span>
                {loading && <Loader2 size={16} className="ml-2 animate-spin" />}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-[12px] font-normal tracking-normal text-fg-subtle">{l.hint}</p>
        </div>
      </main>

      {/* 底部留白，与顶栏对称 —— 稿子里这里是设计验收用的状态切换器，不上线 */}
      <div className="relative z-20 pb-5" />
    </div>
  )
}
