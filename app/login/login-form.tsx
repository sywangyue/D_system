"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { LOCALE_LABELS, LOCALE_COOKIE, type Locale, type Dict } from "@/lib/i18n-shared"

/**
 * 登录表单。四个状态（default / focused / error / loading）全部实现。
 *
 * 与旧版的差别：
 *  - 删掉 Matrix 数字雨、打字机、日文半角假名（调性完全跑偏，且 SSR 水合报错）
 *  - 不再 saveAuth 到 localStorage —— cookie 是唯一登录态，成功后 refresh 即可
 *  - lang=en 时摘掉中文字体栈，英文版不出现中文字体
 */

const STATS: { n: string; zh: string; en: string }[] = [
  { n: "7,401", zh: "展会品牌", en: "Expo brands" },
  { n: "9,740", zh: "主办方索引", en: "Organizers" },
  { n: "7,703", zh: "历史届次", en: "Editions" },
  { n: "2,061", zh: "白地信号", en: "Greenfield signals" },
]

export default function LoginForm({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const isEn = locale === "en"

  function switchLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`
    router.refresh()
  }

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
        setError(res.status === 401 ? t.login.errCredentials : body.error || t.login.errNetwork)
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

  return (
    <div
      className="flex min-h-screen bg-canvas"
      // 英文版摘掉 CJK 字体栈，不让任何中文字体参与渲染
      style={isEn ? { fontFamily: "var(--font-sans)" } : undefined}
      lang={isEn ? "en" : "zh-CN"}
    >
      {/* ── 左栏 58%：品牌与实据 ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] flex-col justify-between p-12 hairline-r relative">
        {/* 英文版只留拉丁字标 —— 「万象」二字本身就需要 CJK 字体 */}
        <div className="flex items-center gap-2.5">
          <span className="lat text-[15px] font-semibold tracking-tight">MWLAB</span>
          {!isEn && (
            <>
              <span className="w-px h-3.5 bg-hairline-active" />
              <span className="text-[13px] text-fg-muted">万象</span>
            </>
          )}
        </div>

        <div>
          <div className="lat text-[11px] uppercase tracking-[0.12em] text-fg-faint mb-6">
            Messe Düsseldorf Shanghai · Business Development
          </div>
          <h1 className="text-[2.625rem] leading-[1.25] font-medium mb-4">
            {isEn ? <>Structural view of</> : <>中国展会市场的</>}
            <br />
            <span className="text-accent">{isEn ? "China’s expo market" : "结构化盘面"}</span>
          </h1>
          <p className="text-[14px] text-fg-muted mb-10">
            {isEn
              ? "7,401 expo brands · 9,740 organizers"
              : "7,401 个展会品牌 · 9,740 家主办方"}
          </p>

          <div className="grid grid-cols-2 gap-px bg-hairline max-w-md">
            {STATS.map(s => (
              <div key={s.n} className="bg-canvas p-4">
                <div className="num text-[26px] leading-none mb-1.5">{s.n}</div>
                <div className="text-[11px] uppercase tracking-wider text-fg-faint">
                  {isEn ? s.en : s.zh}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-fg-faint leading-relaxed">
          <div>{t.login.internalOnly}</div>
          <div className="lat">© 2026 Messe Düsseldorf Shanghai</div>
        </div>
      </div>

      {/* ── 右栏 42%：表单 ───────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#0E0E10]">
        <div className="flex justify-end p-8 gap-1">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map(l => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`btn h-7 px-3 text-[12px] rounded-[4px] border-0 cursor-pointer
                ${l === locale ? "bg-accent text-canvas font-medium" : "bg-transparent text-fg-muted hover:text-fg"}`}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center px-8">
          <form onSubmit={onSubmit} className="w-full max-w-[360px]">
            {/* 错误条占位常驻，出现时布局不跳动 */}
            <div className="h-[52px] mb-1">
              {error && (
                <div
                  className="flex items-center gap-2 h-10 px-3 rounded-[6px] text-[13px] text-accent"
                  style={{ background: "#1F1214", border: "1px solid rgb(254 92 0 / 35%)" }}
                  role="alert"
                >
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <h2 className="text-[26px] font-medium mb-1.5">{t.login.title}</h2>
            <p className="text-[13px] text-fg-muted mb-8">{t.login.subtitle}</p>

            <label className="block text-[11px] uppercase tracking-wider text-fg-muted mb-2">
              {t.login.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.login.emailPlaceholder}
              aria-invalid={!!error}
              autoComplete="username"
              className="input lat w-full h-11 px-3.5 mb-5 rounded-[4px] bg-canvas text-fg
                         border border-[rgb(255_255_255/9%)] placeholder:text-fg-faint"
            />

            <label className="block text-[11px] uppercase tracking-wider text-fg-muted mb-2">
              {t.login.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-invalid={!!error}
              autoComplete="current-password"
              className="input w-full h-11 px-3.5 mb-6 rounded-[4px] bg-canvas text-fg
                         border border-[rgb(255_255_255/9%)]"
            />

            <button
              type="submit"
              data-loading={loading}
              disabled={loading}
              className="btn w-full h-11 rounded-[4px] bg-accent text-canvas text-[14px]
                         font-semibold tracking-[0.2em] border-0 cursor-pointer"
            >
              {t.login.submit}
            </button>

            <p className="text-center text-[12px] text-fg-faint mt-4">{t.login.accountNote}</p>
          </form>
        </div>

        <div className="p-8 text-[12px] text-fg-faint">{t.login.accessNote}</div>
      </div>
    </div>
  )
}
