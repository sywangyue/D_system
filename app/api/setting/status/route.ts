import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireUser } from '@/lib/api-guard'

type CrawlLogRow = {
  started_at: string
  finished_at: string | null
  status: string
}

export async function GET(request: Request) {
  // requireUser 同时查库校验 is_active，被禁用账号的存量 token 立即失效
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = getDb()

  // 中心实体已经是公司（REBUILD-2026-09-PLAN.md §0 判断 2），所以这四个计数排在前，
  // 原有品牌/届次/采集三项退到后面：这张卡的读者是判断「系统里有什么」的人。
  const companies = db.prepare('SELECT COUNT(*) as count FROM company').get() as { count: number }
  const opportunities = db.prepare(
    'SELECT COUNT(*) as count FROM opportunity WHERE is_archived = 0'
  ).get() as { count: number }
  const reports = db.prepare('SELECT COUNT(*) as count FROM intel_report').get() as { count: number }
  const resources = db.prepare('SELECT COUNT(*) as count FROM resource').get() as { count: number }

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
      total_companies: companies.count,
      total_opportunities: opportunities.count,
      total_reports: reports.count,
      total_resources: resources.count,
      total_brands: brandResult.count,
      total_editions: editionResult.count,
      last_crawl_started_at: lastCrawl?.started_at ?? null,
      last_crawl_finished_at: lastCrawl?.finished_at ?? null,
      last_crawl_status: lastCrawl?.status ?? null,
    },
    system_info: {
      node_version: process.version,
      db_type: 'SQLite',
      // 由 next.config.ts 在构建时写死。取不到就是 '—'，**不回退成当前时间** ——
      // 原来 `|| new Date().toISOString()` 会让「构建时间」每次请求都变，等于在说谎（TASK-I §3.1）。
      // Next.js 版本那一行已删：`process.env.__NEXT_VERSION__` 不是 Next 提供的变量，永远走回退值。
      build_time: process.env.NEXT_PUBLIC_BUILD_TIME || '—',
    },
  })
}
