import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import type { Brand, Edition } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = getDb()

  const brand = db.prepare(`
    SELECT brand_id, name_cn, name_en, first_year, organizer, co_organizer, city,
           frequency, industry_l1, industry_l2, competition_relation, mds_related,
           scale_score, is_international, is_ufi_certified, ma_potential,
           strategic_relevance, competitor_group, website, notes, created_at, updated_at
    FROM exhibition_brand
    WHERE brand_id = ?
  `).get(id) as Brand | undefined

  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const editions = db.prepare(`
    SELECT edition_id, brand_id, year, date_start, date_end, city, venue, status,
           area_sqm, exhibitors_count, visitors_count, overseas_exhibitor_pct,
           booth_price_per_sqm, heat_score, yoy_trend, anomaly_flag, data_source,
           recorded_at, notes
    FROM exhibition_edition
    WHERE brand_id = ?
    ORDER BY year DESC
  `).all(id) as Edition[]

  return NextResponse.json({ brand, editions })
}
