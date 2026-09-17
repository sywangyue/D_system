"use client"

import { useEffect, useRef, useState } from "react"

/**
 * 首屏产品截图框（§4.2）。
 *
 * 截图是 `/expo` 的真实界面，由 Claude 质检时补上：存成
 * `public/landing/product.webp` 即可，**不用再改代码** ——
 * 图片不存在时下面这行小字就是占位说明。
 *
 * 两条禁令在这里落地：
 *  - 绝不用 AI 生成的假界面图；
 *  - 绝不截 /opportunity、/company、/research、/overview —— 这是公开页面，
 *    那几页上是机会名称、公司工商信息、尽调报告标题。`/expo` 上只有
 *    公开采集的展会数据，可以放。
 */
export default function ProductShot({
  src, alt, note,
}: {
  src: string
  alt: string
  note: string
}) {
  const [missing, setMissing] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  /**
   * ⚠️ 只靠 onError 不够：图片在 hydration 之前就 404 的话，错误事件早于
   * React 挂上监听器，事件不会被补发，占位就永远不出现（实测如此）。
   * 所以挂载后再自己查一次 naturalWidth。
   */
  useEffect(() => {
    const el = ref.current
    if (el && el.complete && el.naturalWidth === 0) setMissing(true)
  }, [])

  // 占位：同尺寸的空框（尺寸、边框、圆角由外层容器给），只有一行小字说明
  if (missing) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num text-[12px] text-fg-faint">{note}</span>
      </div>
    )
  }

  return (
    // 公开页上的静态资产，没有尺寸信息可给 next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      className="absolute inset-0 h-full w-full object-cover object-top"
    />
  )
}
