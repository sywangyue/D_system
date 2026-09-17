import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import path from 'path'

/**
 * 资源下载。
 *
 * 安全要点：resource.file_path 虽然来自数据库，但数据库是可写的
 * （/api/resource 的 POST、index_resources.py、将来的上传功能都会写它），
 * 所以它**不是可信输入**。必须在 resolve 之后校验绝对路径确实落在允许的根目录内，
 * 否则一条 file_path='../../.env.local' 就能读走 JWT_SECRET 和企查查密钥。
 */

/** 只有这三个目录下的文件可以下载。 */
const ALLOWED_ROOTS = ['reports', 'exports', 'research'] as const

/**
 * 把库里的相对路径换成可信的绝对路径，越界返回 null。
 *
 * 校验全部在**字符串层**完成，不先拼路径再回头比前缀：
 * 绝对路径、`..`、`.` 任一出现即拒绝。这比「resolve 之后比前缀」更早拦截，
 * 也让下面的 path.join 每个分支都锚在字面量目录上 —— 否则 Turbopack 的
 * 文件追踪会认为整个项目都可能被读取，把全仓库打进部署产物
 * （构建报 "Encountered unexpected file in NFT list"）。
 */
function resolveSafe(filePath: string): string | null {
  if (!filePath || path.isAbsolute(filePath)) return null

  const parts = filePath.split(/[\\/]/).filter(Boolean)
  if (parts.length < 2) return null
  if (parts.some(seg => seg === '..' || seg === '.')) return null

  const [root, ...rest] = parts
  const tail = rest.join('/')
  if (!(ALLOWED_ROOTS as readonly string[]).includes(root)) return null

  // 每个分支的根目录都是字面量，文件追踪才能静态收敛
  switch (root) {
    case 'reports':  return path.join(process.cwd(), 'reports', tail)
    case 'exports':  return path.join(process.cwd(), 'exports', tail)
    case 'research': return path.join(process.cwd(), 'research', tail)
    default:         return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const row = getDb().prepare(
    'SELECT title, file_path, mime, size_bytes FROM resource WHERE resource_id = ?'
  ).get(id) as { title: string; file_path: string; mime: string | null; size_bytes: number } | undefined

  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const abs = resolveSafe(row.file_path)
  if (!abs) {
    // 路径越界：不告诉调用方越到了哪里，也不回显路径
    return NextResponse.json({ error: '资源路径非法' }, { status: 400 })
  }

  let size: number
  try {
    const st = statSync(abs)
    if (!st.isFile()) return NextResponse.json({ error: '资源不是普通文件' }, { status: 400 })
    size = st.size
  } catch {
    // 库里有记录但磁盘上文件没了 —— 这在文件留磁盘的方案里是会发生的
    return NextResponse.json({ error: '文件已不在磁盘上，请重新索引' }, { status: 404 })
  }

  const filename = path.basename(abs)
  // 中文文件名必须走 RFC 5987 的 filename*。
  // filename= 是给不认 filename* 的老客户端的回退，按规范它只能是 ASCII，
  // 塞百分号编码进去的话那些客户端会原样显示成 %E4%B8%8A... 一串乱码，
  // 所以回退值把非 ASCII 换成下划线，保留扩展名。
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  const disposition =
    `attachment; filename="${ascii}"; ` +
    `filename*=UTF-8''${encodeURIComponent(filename)}`

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream

  return new NextResponse(stream, {
    headers: {
      'Content-Type': row.mime || 'application/octet-stream',
      'Content-Length': String(size),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  })
}
