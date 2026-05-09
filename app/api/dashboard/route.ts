import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const industryL1 = searchParams.get('industry_l1')
  const industryL2 = searchParams.get('industry_l2')
  const relation = searchParams.get('competition_relation')
  const mds = searchParams.get('mds_related')

  let where = 'WHERE 1=1'
  const params: (string | number)[] = []

  if (industryL1) {
    where += ' AND b.industry_l1 = ?'
    params.push(industryL1)
  }
  if (industryL2) {
    where += ' AND b.industry_l2 = ?'
    params.push(industryL2)
  }
  if (relation && relation !== '全部' && relation !== '') {
    const relations = relation.split(',').filter(Boolean)
    if (relations.length > 0) {
      const placeholders = relations.map(() => '?').join(',')
      where += ` AND b.competition_relation IN (${placeholders})`
      params.push(...relations)
    }
  }
  if (mds && mds !== '全部' && mds !== '') {
    where += ' AND b.mds_related = ?'
    params.push(mds)
  }

  const db = getDb()

  // KPI aggregation
  const kpiRow = db.prepare(`
    SELECT
      COALESCE(SUM(e.area_sqm), 0) as total_area,
      COALESCE(SUM(e.exhibitors_count), 0) as total_exhibitors,
      COALESCE(SUM(e.visitors_count), 0) as total_visitors,
      COUNT(DISTINCT b.organizer) as total_organizers
    FROM exhibition_brand b
    JOIN exhibition_edition e ON e.brand_id = b.brand_id
    ${where}
  `).get(...params) as {
    total_area: number
    total_exhibitors: number
    total_visitors: number
    total_organizers: number
  }

  // Brand list
  const brands = db.prepare(`
    SELECT b.* FROM exhibition_brand b ${where} ORDER BY b.name_cn
  `).all(...params)

  // Industry distribution
  const industryDistribution = db.prepare(`
    SELECT industry_l2 as name, COUNT(*) as value
    FROM exhibition_brand
    ${where}
    GROUP BY industry_l2
    ORDER BY value DESC
  `).all(...params)

  // Year-over-year trend (B1 fix — for TrendChart component)
  const yearTrend = db.prepare(`
    SELECT e.year, COALESCE(SUM(e.area_sqm), 0) as area_sqm
    FROM exhibition_brand b
    JOIN exhibition_edition e ON e.brand_id = b.brand_id
    ${where}
    GROUP BY e.year
    ORDER BY e.year
  `).all(...params)

  return NextResponse.json({
    kpis: kpiRow,
    brands,
    industryDistribution,
    yearTrend,
  })
}
