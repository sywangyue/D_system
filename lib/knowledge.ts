import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { rewriteAsset } from "@/lib/knowledge-url"

/**
 * 知识库 —— 本仓库唯一的「文件即数据源」页面。
 *
 * 不建表、不写录入表单、不写索引脚本：Max 直接在 `knowledge/<slug>/index.md`
 * 里写 Markdown，页面扫目录渲染。规模是这个决定的依据 —— 现在 3 条、上限 20 条，
 * 20 条记录不值得一张表 + 一次迁移 + 一套 CRUD 接口。
 *
 * ⚠️ 服务端专用（用了 `fs`）。客户端组件不要引这个文件。
 * ⚠️ 只扫 `knowledge/`，**不去读 `public/knowledge/`** 判断图存不存在 ——
 *    为此多一次 IO 不值得，图丢了就是浏览器出裂图（V2-10 §5.2）。
 * ⚠️ 每个 `path.join` 的根目录都写字面量 `"knowledge"`：Turbopack 的文件追踪
 *    靠这个静态收敛，写成变量会把整个仓库打进部署产物。
 */

/** slug 只允许小写字母、数字、连字符。下划线开头的目录（如 `_example`）因此自然隐身。 */
const SLUG_RE = /^[a-z0-9-]+$/

export type KnowledgeStatus = "active" | "archived"

/** 列表页需要的字段。 */
export interface KnowledgeMeta {
  slug: string
  title: string
  /** 缺了就回退 title —— 英文界面下显示中文标题好过显示空白 */
  titleEn: string | null
  /** 复用已有业务线枚举 ma / greenfield / project_support，标签走 bizLineLabel */
  type: string
  year: number
  status: KnowledgeStatus
  summary: string | null
  summaryEn: string | null
  /** 已重写成对外 URL（`/knowledge/<slug>/images/...`） */
  cover: string | null
}

/** 详情页额外带正文。 */
export interface KnowledgeItem extends KnowledgeMeta {
  body: string
}

export interface KnowledgeDoc {
  name: string
  size: number
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/**
 * 读 `knowledge/<slug>/index.md`，解析 frontmatter。
 *
 * 返回 null 的情形一律静默跳过（不报错、不渲染）：slug 不合法、没有 index.md、
 * frontmatter 缺必需字段。目录里多一个随手放的文件夹不应该让整页炸掉。
 */
function parseIndex(slug: string): { meta: KnowledgeMeta; body: string } | null {
  if (!SLUG_RE.test(slug)) return null

  const file = path.join(process.cwd(), "knowledge", slug, "index.md")
  let raw: string
  try {
    raw = fs.readFileSync(file, "utf8")
  } catch {
    return null
  }

  const { data, content } = matter(raw)

  const title = str(data.title)
  const type = str(data.type)
  const year = Number(data.year)
  // title / type / year 是必需项：缺一个就不出这张卡，而不是渲染一张半空的
  if (!title || !type || !Number.isInteger(year)) return null

  const cover = str(data.cover)

  return {
    meta: {
      slug,
      title,
      titleEn: str(data.title_en),
      type,
      year,
      // 缺省按 active
      status: data.status === "archived" ? "archived" : "active",
      summary: str(data.summary),
      summaryEn: str(data.summary_en),
      cover: cover ? rewriteAsset(cover, slug) : null,
    },
    body: content,
  }
}

/** 列表：`year` 倒序，同年按 `title`。目录不存在时返回空数组（页面出空态）。 */
export function listKnowledge(): KnowledgeMeta[] {
  let names: string[]
  try {
    names = fs.readdirSync(path.join(process.cwd(), "knowledge"))
  } catch {
    return []
  }

  const out: KnowledgeMeta[] = []
  for (const name of names) {
    if (!SLUG_RE.test(name)) continue
    let isDir = false
    try {
      isDir = fs.statSync(path.join(process.cwd(), "knowledge", name)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    const parsed = parseIndex(name)
    if (parsed) out.push(parsed.meta)
  }

  return out.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
}

/** 单条（含正文）。slug 不存在或 index.md 不合法 → null，调用方 `notFound()`。 */
export function getKnowledge(slug: string): KnowledgeItem | null {
  const parsed = parseIndex(slug)
  if (!parsed) return null
  return { ...parsed.meta, body: parsed.body }
}

/**
 * `docs/` 下的文件清单。目录可选，不存在就返回空数组（右栏整块不渲染）。
 * 与资源库不同：这里是文件系统里的裸文件，没有 resource_id / kind / collected_at，
 * 所以不要复用 components/resource/ResourceList。
 */
export function listDocs(slug: string): KnowledgeDoc[] {
  if (!SLUG_RE.test(slug)) return []

  const dir = path.join(process.cwd(), "knowledge", slug, "docs")
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }

  const out: KnowledgeDoc[] = []
  for (const name of names) {
    if (name.startsWith(".")) continue
    try {
      const st = fs.statSync(path.join(dir, name))
      if (st.isFile()) out.push({ name, size: st.size })
    } catch {
      continue
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
