import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-guard'
import { getExpoStats, SCALE_BUCKETS, type ExpoFilters } from '@/lib/queries/expo'

/**
 * 展会底图统计 —— 地图点位 + 四宫格。这两个都跟随筛选，所以合成一个端点：
 * 客户端只在筛选变化时重拉这一个（§5）。
 *
 * 筛选参数走白名单；规模只认枚举键（lt1w / 1w-5w / 5w-10w / gte10w），
 * 区间由服务端映射 —— 不接受客户端传数字区间。
 *
 * 错误回错误码，不回中文句子（E-2）。
 */

/** 合法档位键。显式标成 string[]：SCALE_BUCKETS 是 as const，
 *  直接 includes(外部字符串) 会被 TS 判成「字面量联合里没有 string」。 */
const KEYS: string[] = SCALE_BUCKETS.map(b => b.key)

/** 行业多选：既接受重复参数（?industry_l1=a&industry_l1=b），也接受逗号分隔（a,b）。 */
function readMulti(sp: URLSearchParams, name: string): string[] {
  const raw = [...sp.getAll(name)].flatMap(v => v.split(','))
  return raw.map(v => v.trim()).filter(Boolean)
}

export async function GET(request: Request) {
  const user = requireUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp = new URL(request.url).searchParams

  const scale = sp.get('scale')?.trim()
  if (scale && !KEYS.includes(scale)) {
    // 非法档位：明确回一个码，并告诉调用方有哪些合法值（不 echo 客户端传的东西）
    return NextResponse.json(
      { error: 'invalidValue', values: KEYS.join(' / ') },
      { status: 400 })
  }

  const filters: ExpoFilters = {
    industry_l1: readMulti(sp, 'industry_l1'),
    city: sp.get('city')?.trim() || undefined,
    country_cn: sp.get('country_cn')?.trim() || undefined,
    scale: scale || undefined,
  }

  return NextResponse.json(getExpoStats(filters))
}
