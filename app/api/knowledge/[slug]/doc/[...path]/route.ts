import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import path from 'path'

/**
 * 知识库文档下载 —— **只放行 `knowledge/<slug>/docs/` 下的文件**。
 *
 * 登录那一关 `proxy.ts` 已经全局做完（`/api/*` 无有效 token 直接 401，伪造的 x-user-* 头会被剥离）。
 * 下面那行 `requireUser` 与其余路由一致：读中间件注入的身份，并查库校验 `is_active`。
 *
 * 必须写的是 `resolveSafeDoc`：`[...path]` 是从 URL 来的字符串，
 * 没有它就没有下载功能 —— 拒绝 `..` 只是这个函数里的一个 `if`，不是外面再加一层。
 * 少写它的后果是 `..%2f..%2f.env.local` 也能拼出去，而那里是 JWT_SECRET 和企查查密钥。
 *
 * 写法照 `app/api/resource/[id]/download/route.ts` 的 `resolveSafe()`：
 * 字符串层就拒绝，不做「先 join 再回头比前缀」。
 */

const SLUG_RE = /^[a-z0-9-]+$/

/**
 * 把 URL 段拼成可信的绝对路径，越界返回 null。
 *
 * 三个要点：
 * 1. **slug 本身也是路径的一段**，同样要校验（只校验 `[...path]` 会漏掉 `/api/knowledge/../doc/x`）
 * 2. 段里出现空串、`.`、`..` 或任何分隔符即拒绝 —— `%2f` 被解码后正好落在这一条上
 * 3. `path.join` 的根目录写字面量 `"knowledge"`，Turbopack 的文件追踪才收敛得了，
 *    否则构建会报 `Encountered unexpected file in NFT list` 并把整个仓库打进产物
 */
function resolveSafeDoc(slug: string, segments: string[]): string | null {
  if (!SLUG_RE.test(slug)) return null
  if (segments.length === 0) return null
  if (segments.some(s => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
    return null
  }
  // ⚠️ 这里**不能**写 `path.join(..., ...segments)`。展开动态数组会让 Turbopack 的
  //    文件追踪算不出范围，构建报 "Encountered unexpected file in NFT list"
  //    并认为整个仓库都可能被读取（把全仓库打进部署产物）。
  //    先 join 成单个相对串，调用形状就和 app/api/resource/[id]/download 一样收敛了。
  return path.join(process.cwd(), 'knowledge', slug, 'docs', segments.join('/'))
}

/** 按扩展名给 Content-Type。
 *  resource 端点用的是库里的 `mime` 列，而知识库的 docs/ 是裸文件、没有元数据，
 *  所以只能按扩展名判。缺省 octet-stream（浏览器会直接下载，不会猜错类型）。 */
const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.zip':  'application/zip',
}

const mimeOf = (filename: string): string =>
  MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { slug, path: segments } = await params

  const abs = resolveSafeDoc(slug, segments)
  if (!abs) {
    // 路径越界：不告诉调用方越到了哪里，也不回显路径
    return NextResponse.json({ error: "badResourcePath" }, { status: 400 })
  }

  let size: number
  try {
    const st = statSync(abs)
    // 越到 knowledge/<slug>/docs 之外、或指到目录上，都当越界
    if (!st.isFile()) return NextResponse.json({ error: "notRegularFile" }, { status: 400 })
    size = st.size
  } catch {
    // 越出 docs/ 的路径在这里是 ENOENT（拼不到文件），与「文件被删了」同一条分支。
    // 两种情况对外都是 404，不额外区分 —— 区分了等于告诉调用方哪些路径存在。
    return NextResponse.json({ error: "fileMissing" }, { status: 404 })
  }

  const filename = path.basename(abs)
  // 中文文件名必须走 RFC 5987 的 filename*。
  // filename= 是给不认 filename* 的老客户端的回退，按规范它只能是 ASCII，
  // 塞百分号编码进去那些客户端会原样显示成一串 %E4%B8%8A 乱码，
  // 所以回退值把非 ASCII 换成下划线，保留扩展名。
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  const disposition =
    `attachment; filename="${ascii}"; ` +
    `filename*=UTF-8''${encodeURIComponent(filename)}`

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream

  return new NextResponse(stream, {
    headers: {
      'Content-Type': mimeOf(filename),
      'Content-Length': String(size),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  })
}
