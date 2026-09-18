import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * 第 7 段 · 数据管道（V2-18 新增）。「自组，自建，为 BD 而生」。
 *
 * 版式照 Linear 的「Build, review, and ship」：左标题右说明，下面一个悬浮的深色终端块。
 *
 * **里面跑的是真实管道，不是摆拍的代码。** 六个步骤就是 scripts/run_pipeline.sh 的六步，
 * 日志行取自 2026-09-18 那次 auto-20260918 的真实输出（logs/pipeline_auto-20260918.log）。
 * 改管道就要回来改这里 —— 落地页上写着假流程比不写更糟。
 *
 * 日志行不进字典：它是技术输出，等宽英文与数字为主，两种语言下都原样显示
 * （同内容契约里「数字与数据不进字典」的规矩）。步骤名和标题走 i18n。
 */
const LOG: { t: string; text: string; tone?: "ok" | "dim" }[] = [
  { t: "03:00:02", text: "jufair 采集 · 增量 --refresh", tone: "dim" },
  { t: "03:29:22", text: "✓ 批次 auto-20260918 · 新增 45 条", tone: "ok" },
  { t: "03:29:22", text: "合并进主库 · 读取 2,239 行", tone: "dim" },
  { t: "03:29:29", text: "✓ 新建品牌 74 · 匹配 2,165 · 届次 2,239", tone: "ok" },
  { t: "03:29:29", text: "行业分类 · jufair 映射表 7,076 URL → 8 类", tone: "dim" },
  { t: "03:29:29", text: "✓ 7,475 / 7,475 已分类 · 未匹配 0", tone: "ok" },
  { t: "03:29:29", text: "刷新届次状态 · 已举办 5,325 · 即将举办 2,453", tone: "dim" },
  { t: "03:29:29", text: "✓ 展示池 7,452 / 7,475 · 99.7%", tone: "ok" },
]

export default function PipelineSection({ locale, t }: { locale: Locale; t: Dict }) {
  const l = t.landing.pipeline
  const h2 = locale === "zh" ? "text-[42px]" : "text-[44px]"
  const steps: string[] = l.steps

  return (
    <section
      className="hairline-t relative overflow-hidden px-6 pb-[140px] pt-[120px]"
      style={{ background: "var(--gradient-halo)" }}
    >
      <div className="mx-auto mb-13 grid max-w-[1240px] grid-cols-2 items-start gap-12">
        <h2 className={`${h2} whitespace-pre-line font-semibold leading-[1.15] text-fg`}>{l.headline}</h2>
        <div className="flex flex-col gap-5">
          <p className="text-[16px] leading-relaxed text-fg-muted">{l.body}</p>
          <div className="flex items-center gap-4">
            <span className="num inline-flex items-center gap-2 rounded-full border border-hairline bg-sidebar px-3.5 py-1.5 text-[12px] text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-fg-subtle" />
              {l.cadence}
            </span>
            <span className="text-[12px] text-fg-subtle">{l.sources}</span>
          </div>
        </div>
      </div>

      {/* 悬浮终端块：外层一团弥散辉光，内层深色窗口 */}
      <div className="relative mx-auto max-w-[1240px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[10%] bottom-[5%] top-[15%] z-[1]"
          style={{
            background: "radial-gradient(ellipse at center, rgb(0 0 0 / 0.08) 0%, rgb(0 0 0 / 0) 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="relative z-[2] overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-inkbox)",
            border: "1px solid var(--color-inkbox-rule)",
            boxShadow: "var(--shadow-inkbox)",
            color: "var(--color-inkbox-fg)",
          }}
        >
          {/* 顶栏 */}
          <div
            className="flex h-11 items-center justify-between px-4.5 text-[12px]"
            style={{ background: "var(--color-inkbox-bar)", borderBottom: "1px solid var(--color-inkbox-rule)" }}
          >
            <span className="num" style={{ color: "var(--color-inkbox-dim)" }}>
              scripts/run_pipeline.sh
            </span>
            <span className="num" style={{ color: "var(--color-inkbox-dim)" }}>
              auto-20260918
            </span>
          </div>

          <div className="grid grid-cols-[220px_1fr]">
            {/* 左：六个步骤 */}
            <div
              className="px-5 py-5"
              style={{ borderRight: "1px solid var(--color-inkbox-rule)" }}
            >
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2.5 py-2 text-[12px]">
                  <span className="num w-4 shrink-0" style={{ color: "var(--color-inkbox-dim)" }}>
                    {i + 1}
                  </span>
                  <span style={{ color: "var(--color-inkbox-fg)" }}>{s}</span>
                </div>
              ))}
            </div>

            {/* 右：真实日志 */}
            <div className="px-6 py-5">
              {LOG.map((row, i) => (
                <div key={i} className="num flex gap-4 py-1.5 text-[12px] leading-relaxed">
                  <span className="shrink-0" style={{ color: "var(--color-inkbox-dim)" }}>
                    {row.t}
                  </span>
                  <span style={{ color: row.tone === "ok" ? "var(--color-inkbox-fg)" : "var(--color-inkbox-dim)" }}>
                    {row.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
