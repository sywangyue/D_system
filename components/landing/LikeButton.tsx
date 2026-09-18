"use client"

import { useEffect, useRef, useState } from "react"
import { Heart } from "lucide-react"

/**
 * 页脚的 like（V2-18）。点一下放礼花。
 *
 * **纯前端，不计数、不落库、不发请求。** 落地页是公开无鉴权页，
 * 给它开一个写接口就等于给全网开一个可刷的口子，为一个点赞数不值当。
 * 「点过」的状态只留在本次会话里，刷新即忘 —— 这是装饰，不是数据。
 *
 * 粒子用 canvas 手画，不引任何动画库。颗粒只取中性灰阶，不用彩色也不用品牌橙。
 * 250ms 节流防连点堆粒子；粒子散尽即停 rAF，不空转；
 * prefers-reduced-motion 下只留状态变化，不放礼花。
 */
type P = {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; alpha: number; rot: number; vr: number
}

/**
 * 粒子色从令牌读，不写字面量 —— canvas 的 fillStyle 要的是实际色值，
 * 拿不到 CSS 变量，所以开画前 getComputedStyle 解一次。
 * 全是既有的中性灰阶，不引入新色，也不用品牌橙。
 */
const COLOR_TOKENS = ["--color-fg", "--color-fg-muted", "--color-fg-subtle", "--color-fg-faint", "--color-surface-hover"]

function readColors(): string[] {
  const cs = getComputedStyle(document.documentElement)
  return COLOR_TOKENS.map(t => cs.getPropertyValue(t).trim()).filter(Boolean)
}

export default function LikeButton({ label }: { label: string }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<P[]>([])
  const raf = useRef(0)
  const running = useRef(false)
  const lastClick = useRef(0)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const loop = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const ps = particles.current
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.18
      p.alpha -= 0.016
      p.rot += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.alpha)
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rot * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
      if (p.alpha <= 0) ps.splice(i, 1)
    }

    // 散尽即停，别让 rAF 永久空转
    if (ps.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      running.current = false
      return
    }
    raf.current = requestAnimationFrame(loop)
  }

  const burst = () => {
    const btn = btnRef.current
    if (!btn) return
    const colors = readColors()
    if (colors.length === 0) return
    const r = btn.getBoundingClientRect()
    const ox = r.left + r.width / 2
    const oy = r.top + r.height / 2
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 3 + Math.random() * 6
      particles.current.push({
        x: ox, y: oy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 10,
      })
    }
    if (!running.current) {
      running.current = true
      raf.current = requestAnimationFrame(loop)
    }
  }

  const onClick = () => {
    const now = Date.now()
    if (now - lastClick.current < 250) return
    lastClick.current = now
    setLiked(true)
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) burst()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        aria-pressed={liked}
        className="inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-[12px] text-fg-muted transition-all hover:-translate-y-px hover:border-hairline-active hover:text-fg"
      >
        <Heart size={12} strokeWidth={2} fill={liked ? "currentColor" : "none"} />
        {label}
      </button>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50"
      />
    </>
  )
}
