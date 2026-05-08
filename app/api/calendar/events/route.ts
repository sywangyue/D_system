import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_request: Request) {
  const db = getDb()

  const rows = db.prepare(`
    SELECT e.edition_id,
           e.date_start,
           e.date_end,
           e.venue,
           e.city,
           e.exhibitors_count,
           e.brand_id,
           b.name_cn,
           b.competition_relation
    FROM exhibition_edition e
    JOIN exhibition_brand b ON b.brand_id = e.brand_id
    WHERE e.date_start IS NOT NULL AND e.date_start != ''
    ORDER BY e.date_start ASC
  `).all() as {
    edition_id: string
    date_start: string
    date_end: string | null
    venue: string
    city: string
    exhibitors_count: number | null
    brand_id: string
    name_cn: string
    competition_relation: string
  }[]

  const events = rows.map((row) => ({
    edition_id: row.edition_id,
    name_cn: row.name_cn || '未知展会',
    date_start: row.date_start,
    date_end: row.date_end,
    venue: row.venue,
    city: row.city,
    exhibitors_count: row.exhibitors_count,
    competition_relation: row.competition_relation || '',
  }))

  return NextResponse.json({ events })
}
