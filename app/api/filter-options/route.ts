import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const l1Rows = db.prepare(
    `SELECT DISTINCT industry_l1 FROM exhibition_brand
     WHERE industry_l1 IS NOT NULL AND industry_l1 != ''
     ORDER BY industry_l1`
  ).all() as { industry_l1: string }[]

  const l2Rows = db.prepare(
    `SELECT DISTINCT industry_l1, industry_l2 FROM exhibition_brand
     WHERE industry_l1 IS NOT NULL AND industry_l1 != ''
       AND industry_l2 IS NOT NULL AND industry_l2 != ''
     ORDER BY industry_l1, industry_l2`
  ).all() as { industry_l1: string; industry_l2: string }[]

  const mdsRows = db.prepare(
    `SELECT DISTINCT mds_related FROM exhibition_brand
     WHERE mds_related IS NOT NULL AND mds_related != ''
     ORDER BY mds_related`
  ).all() as { mds_related: string }[]

  const l2ByL1: Record<string, string[]> = {}
  const allL2: string[] = []
  const seenL2 = new Set<string>()
  for (const { industry_l1, industry_l2 } of l2Rows) {
    if (!l2ByL1[industry_l1]) l2ByL1[industry_l1] = []
    l2ByL1[industry_l1].push(industry_l2)
    if (!seenL2.has(industry_l2)) {
      allL2.push(industry_l2)
      seenL2.add(industry_l2)
    }
  }

  return NextResponse.json({
    industry_l1: l1Rows.map((r) => r.industry_l1),
    industry_l2: allL2,
    industry_l2_by_l1: l2ByL1,
    mds_related: mdsRows.map((r) => r.mds_related),
  })
}
