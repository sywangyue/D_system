import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const industryL1s = searchParams.getAll('industry_l1')
  const industryL2 = searchParams.get('industry_l2')
  const relation = searchParams.get('competition_relation')
  const mds = searchParams.get('mds_related')

  const currentYear = new Date().getFullYear()
  const nextYear = currentYear + 1
  const yearSet = `(${currentYear}, ${nextYear})`

  const baseConditions = `
    b.name_cn IS NOT NULL AND b.name_cn != ''
    AND b.industry_l1 IS NOT NULL AND b.industry_l1 != ''
    AND EXISTS (
      SELECT 1 FROM exhibition_edition
      WHERE brand_id = b.brand_id AND year IN ${yearSet}
    )
  `

  let where = `WHERE ${baseConditions}`
  const params: (string | number)[] = []

  if (industryL1s.length > 0) {
    const placeholders = industryL1s.map(() => '?').join(',')
    where += ` AND b.industry_l1 IN (${placeholders})`
    params.push(...industryL1s)
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
    JOIN exhibition_edition e ON e.brand_id = b.brand_id AND e.year IN ${yearSet}
    ${where}
  `).get(...params) as {
    total_area: number
    total_exhibitors: number
    total_visitors: number
    total_organizers: number
  }

  // Brand list — explicit columns only, join latest edition in target years
  const brands = db.prepare(`
    SELECT b.brand_id, b.name_cn, b.name_en, b.organizer, b.city, b.city_en,
      b.country_cn, b.country_en, b.industry_l1, b.industry_l2,
      b.competition_relation, b.mds_related, b.is_ufi_certified, b.is_international,
      b.strategic_relevance, b.scale_score, b.website, b.competitor_group,
      e.date_start, e.date_end, e.area_sqm, e.exhibitors_count,
      e.visitors_count, e.venue, e.status, e.year
    FROM exhibition_brand b
    LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
      AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id AND year IN ${yearSet})
    ${where}
    ORDER BY b.name_cn
  `).all(...params)

  // Industry distribution
  const industryDistribution = db.prepare(`
    SELECT industry_l2 as name, COUNT(*) as value
    FROM exhibition_brand b
    ${where}
    GROUP BY industry_l2
    ORDER BY value DESC
  `).all(...params)

  // Year-over-year trend
  const yearTrend = db.prepare(`
    SELECT e.year,
      COALESCE(SUM(e.area_sqm), 0) as area_sqm,
      COALESCE(SUM(e.exhibitors_count), 0) as exhibitors_count,
      COALESCE(SUM(e.visitors_count), 0) as visitors_count
    FROM exhibition_brand b
    JOIN exhibition_edition e ON e.brand_id = b.brand_id AND e.year IN ${yearSet}
    ${where}
    GROUP BY e.year
    ORDER BY e.year
  `).all(...params)

  return NextResponse.json({
    kpis: kpiRow,
    brands,
    industryDistribution,
    yearTrend,
  }, {
    headers: { 'Cache-Control': 'private, max-age=300' }
  })
}
