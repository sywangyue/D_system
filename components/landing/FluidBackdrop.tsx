"use client"

import { useEffect, useRef } from "react"

/**
 * 数据段的背景流体层（V2-18）。鼠标经过时泛起一圈圈极淡的涟漪。
 *
 * **只画在背景层，上层的数字与文字绝不跟着变形** —— 这是数据页，可读性第一。
 * 所以它是一张 `pointer-events-none` 的绝对定位 canvas，内容层用 z-index 压在它上面。
 *
 * 两处与设计稿的出入，都是有意为之：
 *   1. **空闲即停**。设计稿里 `requestAnimationFrame` 是无条件永久循环，没有涟漪时
 *      仍然每秒清屏 60 次，笔记本上是白烧电。这里在最后一圈涟漪散尽后停掉循环，
 *      下次 mousemove 再拉起来。
 *   2. **`prefers-reduced-motion` 直接不挂载**，留纯底色。
 *
 * 颜色只用黑色的低透明度叠加，不引入任何新色值 —— 底色由父容器的 --color-surface 给。
 */
type Ripple = { x: number; y: number; r: number; max: number; alpha: number; speed: number }

export default function FluidBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const ripples: Ripple[] = []
    const mouse = { x: -1000, y: -1000, tx: -1000, ty: -1000 }
    let raf = 0
    let running = false

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      w = canvas.width = rect.width
      h = canvas.height = rect.height
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    /** 涟漪散尽且指针已离开时收工，别让 rAF 空转。 */
    const idle = () => ripples.length === 0 && mouse.tx < 0

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      mouse.x += (mouse.tx - mouse.x) * 0.1
      mouse.y += (mouse.ty - mouse.y) * 0.1

      if (mouse.x > 0 && mouse.y > 0) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 10, mouse.x, mouse.y, 220)
        g.addColorStop(0, "rgba(0,0,0,0.035)")
        g.addColorStop(0.5, "rgba(0,0,0,0.012)")
        g.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 220, 0, Math.PI * 2)
        ctx.fill()
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.r += r.speed
        r.alpha *= 0.96
        ctx.strokeStyle = `rgba(0,0,0,${r.alpha})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
        if (r.alpha < 0.005 || r.r >= r.max) ripples.splice(i, 1)
      }

      if (idle()) {
        ctx.clearRect(0, 0, w, h)
        running = false
        return
      }
      raf = requestAnimationFrame(draw)
    }

    const kick = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(draw)
    }

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      mouse.tx = e.clientX - rect.left
      mouse.ty = e.clientY - rect.top
      if (Math.random() > 0.4) {
        ripples.push({
          x: mouse.tx, y: mouse.ty, r: 10,
          max: 120 + Math.random() * 80, alpha: 0.12, speed: 2 + Math.random() * 2,
        })
        if (ripples.length > 25) ripples.shift()
      }
      kick()
    }
    const onLeave = () => { mouse.tx = -1000; mouse.ty = -1000 }

    parent.addEventListener("mousemove", onMove)
    parent.addEventListener("mouseleave", onLeave)

    return () => {
      parent.removeEventListener("mousemove", onMove)
      parent.removeEventListener("mouseleave", onLeave)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full opacity-75"
    />
  )
}
