import Image from "next/image"
import Link from "next/link"
import BrandLockup from "@/components/brand/BrandLockup"
import LikeButton from "./LikeButton"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * 页脚（V2-18 扩展）。
 *
 * 旧版是「字标 + 两行小字 / 进入系统 + 一行小字，没有别的」。改版后增加
 * 两个集团 logo、Terms / Privacy、以及一个 like。旧规范见 docs/DESIGN.md 第 6.0 节（已作废）。
 *
 * **两个 logo 原图是印刷素材**：990×999 CMYK JPG，各 2.2MB，其中 2.1MB 是 CMYK 的
 * ICC 配置文件。这里用的是处理过的 `public/brand/partners/*.png` ——
 * 转 sRGB、裁掉四周白边、白底转透明、三色归一后缩到 192px 高，各 1.4KB。
 * **不要改回直接引用 `/logo-mds.jpg`**：CMYK 的 JPG 在浏览器里颜色会偏，
 * 而且会把 4.4MB 塞进一个只显示 28px 高的位置。
 *
 * Terms / Privacy 两页尚未撰写，先指向 `#` 占位 —— 不要把它们接到不存在的路由上，
 * 那会给用户一个 404。
 */
export default function LandingFooter({
  locale, t, enterHref,
}: { locale: Locale; t: Dict; enterHref: string }) {
  const l = t.landing.footer

  return (
    <footer className="hairline-t bg-surface">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-14">
        <div className="flex items-start justify-between gap-12">
          {/* 左：字标 + 主体 + 两个集团 logo */}
          <div>
            <BrandLockup size="standard" showCn={locale === "zh"} />
            <div className="mt-4 text-[12px] leading-relaxed text-fg-subtle">{l.org}</div>

            {/* 两张一共 2.8KB，不做 lazy —— 品牌标识在滚到底时才闪出来很廉价。
                高度 64px 是下限：再小，logo 里「Messe Düsseldorf Shanghai」三行小字就糊了。 */}
            <div className="mt-7 flex items-center gap-8">
              <Image
                src="/brand/partners/mds.png"
                alt="Messe Düsseldorf Shanghai"
                width={184}
                height={192}
                loading="eager"
                className="h-16 w-auto"
              />
              <Image
                src="/brand/partners/mdc.png"
                alt="Messe Düsseldorf China"
                width={188}
                height={192}
                loading="eager"
                className="h-16 w-auto"
              />
            </div>
          </div>

          {/* 右：入口 + 链接 + like */}
          <div className="flex flex-col items-end gap-4">
            <Link
              href={enterHref}
              className="text-[13px] text-fg transition-colors hover:text-fg-muted"
            >
              {l.enter}
            </Link>
            <div className="text-[12px] text-fg-subtle">{l.accessNote}</div>

            <div className="mt-2 flex items-center gap-5 text-[12px] text-fg-subtle">
              <a href="#" className="transition-colors hover:text-fg">{l.terms}</a>
              <a href="#" className="transition-colors hover:text-fg">{l.privacy}</a>
            </div>

            <LikeButton label={l.like} />
          </div>
        </div>

        <div className="hairline-t mt-10 flex items-center justify-between pt-6 text-[11px] text-fg-faint">
          <span>{l.copyright}</span>
          <span>{l.confidential}</span>
        </div>
      </div>
    </footer>
  )
}
