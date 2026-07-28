import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

type CrawlLogRow = {
  started_at: string
  finished_at: string | null
  status: string
}

export async function GET(request: Request) {
  // requireUser 同时校验 is_active，使被禁用账号的存量 token 立即失效
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getDb()

  const brandResult = db.prepare('SELECT COUNT(*) as count FROM exhibition_brand').get() as { count: number }
  const editionResult = db.prepare('SELECT COUNT(*) as count FROM exhibition_edition').get() as { count: number }
  const crawlLog = db.prepare(`
    SELECT started_at, finished_at, status
    FROM crawl_log
    ORDER BY started_at DESC
    LIMIT 1
  `).get() as CrawlLogRow | undefined

  const lastCrawl = crawlLog ?? null

  return NextResponse.json({
    data_status: {
      total_brands: brandResult.count,
      total_editions: editionResult.count,
      last_crawl_started_at: lastCrawl?.started_at ?? null,
      last_crawl_finished_at: lastCrawl?.finished_at ?? null,
      last_crawl_status: lastCrawl?.status ?? null,
    },
    system_info: {
      node_version: process.version,
      next_version: process.env.__NEXT_VERSION__ || '16.x',
      db_type: 'SQLite',
      build_time: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
    },
  })
}
