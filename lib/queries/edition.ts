import { getDb } from '@/lib/db'

/**
 * 品牌 → 最新一届届次。全仓库唯一的一份写法，展会底图、落地页、`/api/expo`、
 * 公司详情、机会详情都用它 —— 口径不同的话，同一个品牌在不同页面的规模数字会对不上。
 *
 * 「最新一届」必须锁定到单行：有 8 个品牌在同一年有两届（春秋两季那种），
 * 用 `e.year = MAX(year)` 会让 LEFT JOIN 扇出，列表里重复出现、计数也多算。
 * 别名固定为 `b`（品牌）与 `e`（届次）。
 */
export const BRAND_LATEST_FROM = `
  FROM exhibition_brand b
  LEFT JOIN exhibition_edition e
    ON e.brand_id = b.brand_id
   AND e.edition_id = (SELECT edition_id FROM exhibition_edition
                       WHERE brand_id = b.brand_id
                       ORDER BY year DESC, edition_id DESC LIMIT 1)
`

export interface BrandWithLatest {
  brand_id: string
  name_cn: string | null
  name_en: string | null
  city: string | null
  organizer: string | null
  industry_l1: string | null
  industry_l2: string | null
  is_ufi_certified: number | null
  year: number | null
  area_sqm: number | null
  exhibitors_count: number | null
  visitors_count: number | null
}

/** 单个品牌 + 最新一届的规模数字。公司详情与机会详情共用。 */
export function getBrandWithLatest(brandId: string): BrandWithLatest | null {
  const row = getDb().prepare(`
    SELECT b.brand_id, b.name_cn, b.name_en, b.city, b.organizer,
           b.industry_l1, b.industry_l2, b.is_ufi_certified,
           e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
    ${BRAND_LATEST_FROM}
    WHERE b.brand_id = ?
  `).get(brandId) as BrandWithLatest | undefined
  return row ?? null
}
