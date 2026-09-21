import { Clock, CircleDot, Circle, FileCode, GitBranch } from "lucide-react"
import type { Dict, Locale } from "@/lib/i18n-shared"

/**
 * 第 7 段 · 数据管道（V2-18）。「自组，自建，为 BD 而生」。
 *
 * **这一段是 Stitch 稿的 1:1 还原**（design/v2-18-landing/stitch/code.html
 * 的 .pipeline-section）：Linear 风格的代码评审窗口 —— 三点 chrome、面包屑、
 * 分支标签、左侧任务栏、双栏 split diff、底部状态条。
 * 结构、尺寸、层级都照搬，色值收进 globals.css 的 --ide-* 令牌（不是散在组件里，
 * 否则过不了「无硬编码色值」门禁）。**改它之前先看稿子，别按自己的理解简化。**
 *
 * ⚠️ 窗口里的代码、任务号（ENG-xxxx）、分支名都是 Stitch 生成的**示意内容**，
 * 仓库里没有 `@mwlab/core` 这个包，也没有 `02_entity_resolution.ts`。
 * 它是一张「我们自己写管道」的视觉素材，不是真实代码快照。
 * 里面引用的数字（7,378 / 7,703 / 4,990 / 12,302）与真实口径一致。
 */

/** 一行代码 = 若干带高亮类型的片段。`k` 对应 --ide-* 里的语法色。 */
type Tok = [k: "kw" | "type" | "fn" | "str" | "prop" | "cm" | "bool" | "numc" | "punct" | "plain", v: string]
type Line = { n: string; tone?: "add" | "del"; toks: Tok[] }

const BASE: Line[] = [
  { n: "01", toks: [["kw","import"],["punct"," { "],["type","IngestSource"],["punct",", "],["type","ExpoEdition"],["punct"," } "],["kw","from"],["str"," '@mwlab/core'"],["punct",";"]] },
  { n: "02", toks: [["kw","import"],["punct"," { "],["fn","dedupeByNormalizedTitle"],["punct"," } "],["kw","from"],["str"," '../transforms'"],["punct",";"]] },
  { n: "03", tone: "del", toks: [["kw","import"],["punct"," { "],["prop","legacyMergeOrganizer"],["punct"," } "],["kw","from"],["str"," './legacyResolver'"],["punct",";"]] },
  { n: "04", toks: [["plain",""]] },
  { n: "05", toks: [["kw","export"],["kw"," async"],["kw"," function"],["fn"," resolveEditions"],["punct","("],["prop","raw"],["punct",": "],["type","IngestSource"],["punct","[]): "],["type","Promise"],["punct","<"],["type","ExpoEdition"],["punct","[]> {"]] },
  { n: "06", toks: [["cm","  // Step 1: Exact title match across cnexpo + jufair"]] },
  { n: "07", tone: "del", toks: [["kw","  const"],["prop"," candidates"],["punct"," = "],["fn","dedupeByNormalizedTitle"],["punct","("],["prop","raw"],["punct",", { "],["prop","fuzzy"],["punct",": "],["bool","false"],["punct"," });"]] },
  { n: "08", tone: "del", toks: [["kw","  const"],["prop"," resolved"],["punct"," = "],["kw","await"],["fn"," legacyMergeOrganizer"],["punct","("],["prop","candidates"],["punct",");"]] },
  { n: "09", toks: [["plain",""]] },
  { n: "10", tone: "del", toks: [["kw","  if"],["punct"," (!"],["prop","resolved"],["punct","."],["prop","isFullyAligned"],["punct",") {"]] },
  { n: "11", tone: "del", toks: [["kw","    throw"],["kw"," new"],["type"," ResolutionMismatchError"],["punct","("],["str","'Edition count mismatch'"],["punct",");"]] },
  { n: "12", toks: [["punct","  }"]] },
  { n: "13", toks: [["plain",""]] },
  { n: "14", toks: [["kw","  return"],["prop"," resolved"],["punct","."],["prop","items"],["punct",";"]] },
  { n: "15", toks: [["punct","}"]] },
]

const HEAD: Line[] = [
  { n: "01", toks: [["kw","import"],["punct"," { "],["type","IngestSource"],["punct",", "],["type","ExpoEdition"],["punct"," } "],["kw","from"],["str"," '@mwlab/core'"],["punct",";"]] },
  { n: "02", toks: [["kw","import"],["punct"," { "],["fn","dedupeByNormalizedTitle"],["punct"," } "],["kw","from"],["str"," '../transforms'"],["punct",";"]] },
  { n: "03", tone: "add", toks: [["kw","import"],["punct"," { "],["prop","multimodalOrganizerGraph"],["punct"," } "],["kw","from"],["str"," '@mwlab/entity-graph'"],["punct",";"]] },
  { n: "04", toks: [["plain",""]] },
  { n: "05", toks: [["kw","export"],["kw"," async"],["kw"," function"],["fn"," resolveEditions"],["punct","("],["prop","raw"],["punct",": "],["type","IngestSource"],["punct","[]): "],["type","Promise"],["punct","<"],["type","ExpoEdition"],["punct","[]> {"]] },
  { n: "06", toks: [["cm","  // Step 1: Hybrid title + venue footprint alignment"]] },
  { n: "07", tone: "add", toks: [["kw","  const"],["prop"," candidates"],["punct"," = "],["fn","dedupeByNormalizedTitle"],["punct","("],["prop","raw"],["punct",", { "],["prop","threshold"],["punct",": "],["numc","0.96"],["punct",", "],["prop","cityAware"],["punct",": "],["bool","true"],["punct"," });"]] },
  { n: "08", tone: "add", toks: [["kw","  const"],["prop"," resolved"],["punct"," = "],["kw","await"],["fn"," multimodalOrganizerGraph"],["punct","("],["prop","candidates"],["punct",", {"]] },
  { n: "09", tone: "add", toks: [["prop","    auditNodesCount"],["punct",": "],["numc","12302"],["punct",","]] },
  { n: "10", tone: "add", toks: [["prop","    organizerTotal"],["punct",": "],["numc","4990"]] },
  { n: "11", tone: "add", toks: [["punct","  });"]] },
  { n: "12", tone: "add", toks: [["plain",""]] },
  { n: "13", tone: "add", toks: [["kw","  await"],["fn"," verifyTargetCoverage"],["punct","("],["prop","resolved"],["punct",", { "],["prop","brands"],["punct",": "],["numc","7378"],["punct",", "],["prop","editions"],["punct",": "],["numc","7703"],["punct"," });"]] },
  { n: "14", toks: [["kw","  return"],["prop"," resolved"],["punct","."],["prop","items"],["punct",";"]] },
  { n: "15", toks: [["punct","}"]] },
]

function CodePane({ tag, delta, deltaTone, lines }: {
  tag: string; delta: string; deltaTone?: "add"; lines: Line[]
}) {
  return (
    <div className="ide-diff-col relative py-4.5">
      <div className="ide-pane-tag flex items-center justify-between px-5 pb-2.5 text-[10px] tracking-[0.05em]">
        <span>{tag}</span>
        <span style={deltaTone === "add" ? { color: "var(--ide-dot-green)" } : undefined}>{delta}</span>
      </div>
      {lines.map(ln => (
        <div key={ln.n} className={`ide-code-line ${ln.tone === "add" ? "is-add" : ln.tone === "del" ? "is-del" : ""}`}>
          <span className="ide-line-num">{ln.n}</span>
          <span>
            {ln.toks.map(([k, v], i) => (
              <span key={i} className={k === "plain" ? undefined : `ide-t-${k}`}>{v}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PipelineSection({ locale, t }: { locale: Locale; t: Dict }) {
  const l = t.landing.pipeline
  const h2 = locale === "zh" ? "text-[24px] md:text-[42px]" : "text-[25px] md:text-[44px]"
  // 字典是宽松类型（JSON 进来是 string），这里收窄一次，下面的三分支才有穷尽性保证
  type Group = { title: string; count: number; icon: string; items: { id: string; label: string }[] }
  const groups = l.groups as Group[]

  return (
    <section id="pipeline" className="hairline-t relative overflow-hidden px-4 pb-20 pt-16 md:px-12 md:pb-[140px] md:pt-[120px]"
      style={{ background: "var(--gradient-halo)" }}>
      {/* 标题区：左标题右说明 */}
      <div className="mx-auto mb-8 grid max-w-[1240px] grid-cols-1 items-start gap-6 md:mb-13 md:grid-cols-2 md:gap-12">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-fg-subtle">{l.overline}</div>
          <h2 className={`${h2} mt-2 whitespace-pre-line font-semibold leading-[1.15] text-fg`}>{l.headline}</h2>
        </div>
        <div className="flex flex-col gap-5">
          <p className="text-[14px] leading-relaxed text-fg-muted md:text-[16px]">{l.body}</p>
          <div className="flex items-center gap-4">
            <span className="num inline-flex items-center gap-2 rounded-full border border-hairline bg-sidebar px-3.5 py-1.5 text-[12px] text-fg-muted">
              <span style={{ color: "var(--ide-dot-green)" }}>●</span>
              {l.cadence}
            </span>
          </div>
        </div>
      </div>

      {/* IDE 窗口：外层弥散辉光 + 内层深色窗口 */}
      <div className="relative mx-auto max-w-[1240px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-[10%] bottom-[5%] top-[15%] z-[1]"
          style={{ background: "radial-gradient(ellipse at center, rgb(0 0 0 / 0.08) 0%, rgb(0 0 0 / 0) 70%)", filter: "blur(50px)" }} />

        <div className="ide-window relative z-[2] overflow-hidden rounded-[12px]">
          {/* 顶栏 chrome */}
          <div className="ide-top-bar flex h-11 items-center justify-between px-4.5 text-[12px]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full opacity-85" style={{ background: "var(--ide-dot-red)" }} />
                <span className="h-2.5 w-2.5 rounded-full opacity-85" style={{ background: "var(--ide-dot-yellow)" }} />
                <span className="h-2.5 w-2.5 rounded-full opacity-85" style={{ background: "var(--ide-dot-green)" }} />
              </div>
              <div className="num flex items-center gap-2 text-[12px]" style={{ color: "var(--ide-fg-faint)" }}>
                <FileCode size={14} className="opacity-70" />
                <span className="hidden md:inline">mwlab-core</span>
                <span className="hidden opacity-40 md:inline">/</span>
                <span className="hidden md:inline">pipeline</span>
                <span className="hidden opacity-40 md:inline">/</span>
                <span className="hidden md:inline">stages</span>
                <span className="hidden opacity-40 md:inline">/</span>
                <span className="font-medium" style={{ color: "var(--ide-fg)" }}>02_entity_resolution.ts</span>
              </div>
            </div>
            <div className="num hidden items-center gap-4 text-[11px] md:flex" style={{ color: "var(--ide-fg-faint)" }}>
              <span className="ide-branch-tag flex items-center gap-1.5 rounded-[4px] px-2 py-0.5">
                <GitBranch size={12} />
                feat/cnexpo-jufair-sync
              </span>
              <span style={{ color: "var(--ide-accent)" }}>Review Mode · Split Diff</span>
            </div>
          </div>

          {/* 主体：左任务栏 + 右双栏 diff */}
          <div className="ide-body grid min-h-[380px] grid-cols-1 md:min-h-[520px] md:grid-cols-[310px_1fr]">
            <aside className="ide-sidebar flex flex-col gap-5 px-3 py-4.5">
              {groups.map(g => (
                <div key={g.title}>
                  <div className="ide-group-title num mb-1.5 flex items-center justify-between px-2 pb-1.5 text-[11px] uppercase tracking-[0.04em]">
                    <span className="flex items-center gap-1.5">
                      {g.icon === "review"
                        ? <Clock size={12} strokeWidth={2.5} style={{ color: "var(--ide-dot-green)" }} />
                        : g.icon === "progress"
                          ? <CircleDot size={12} strokeWidth={2.5} style={{ color: "var(--ide-dot-yellow)" }} />
                          : <Circle size={12} strokeWidth={2.5} style={{ color: "var(--ide-fg-ghost)" }} />}
                      {g.title}
                    </span>
                    <span className="ide-count num rounded-[10px] px-1.5 py-px text-[10px]">{g.count}</span>
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {g.items.map((it, i) => (
                      <li key={it.id}
                        className={`ide-task flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[12px] ${g.icon === "review" && i === 0 ? "is-active" : ""}`}>
                        <span className="num shrink-0 text-[11px]">{it.id}</span>
                        <span className="flex-1 truncate">{it.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </aside>

            <div className="ide-diff-main hidden grid-cols-2 overflow-x-auto md:grid">
              <CodePane tag="BASE REVISION (01_raw_ingest)" delta="- 4 lines" lines={BASE} />
              <CodePane tag="HEAD (feat/cnexpo-jufair-sync)" delta="+ 8 lines" deltaTone="add" lines={HEAD} />
            </div>
          </div>

          {/* 底部状态条 */}
          <div className="ide-bottom-strip num flex min-h-8 flex-wrap items-center justify-between gap-x-3 px-4 py-1.5 text-[10px] md:h-8 md:flex-nowrap md:py-0 md:text-[11px]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span style={{ color: "var(--ide-dot-green)" }}>●</span>
                TypeScript 5.4 · Strict Mode
              </span>
              <span className="hidden md:inline">Encoding: UTF-8</span>
              <span className="hidden md:inline">Target: ES2024</span>
            </div>
            <span>
              CI Checks: <strong className="font-medium" style={{ color: "var(--ide-dot-green)" }}>4 Passed</strong> · 0 Warnings
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
