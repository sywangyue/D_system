import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const cityCoords: Record<string, [number, number]> = {
  "北京": [39.9042, 116.4074],
  "上海": [31.2304, 121.4737],
  "广州": [23.1291, 113.2644],
  "深圳": [22.5431, 114.0579],
  "成都": [30.5728, 104.0668],
  "重庆": [29.4316, 106.9123],
  "西安": [34.3416, 108.9398],
  "武汉": [30.5928, 114.3055],
  "南京": [32.0603, 118.7969],
  "杭州": [30.2741, 120.1551],
  "天津": [39.1252, 117.2108],
  "苏州": [31.299, 120.5853],
  "青岛": [36.0671, 120.3826],
  "大连": [38.914, 121.6147],
  "厦门": [24.4798, 118.0894],
  "郑州": [34.7466, 113.6254],
  "长沙": [28.2282, 112.9388],
  "沈阳": [41.8057, 123.4315],
  "昆明": [25.0389, 102.7183],
  "福州": [26.0745, 119.2965],
  "济南": [36.6512, 116.9972],
  "宁波": [29.8683, 121.544],
  "合肥": [31.8206, 117.2272],
  "哈尔滨": [45.8038, 126.535],
  "长春": [43.8178, 125.3235],
  "太原": [37.8706, 112.5489],
  "石家庄": [38.0428, 114.5149],
  "南宁": [22.817, 108.3665],
  "贵阳": [26.647, 106.6302],
  "海口": [20.044, 110.1999],
  "乌鲁木齐": [43.8256, 87.6168],
  "兰州": [36.0611, 103.8343],
  "东莞": [23.0208, 113.7518],
  "珠海": [22.2707, 113.5767],
  "佛山": [23.0218, 113.1214],
  "无锡": [31.4912, 120.3119],
  "温州": [28.0016, 120.6994],
  "南昌": [28.682, 115.8581],
  "台北": [25.033, 121.5654],
  "香港": [22.3193, 114.1694],
  "澳门": [22.1987, 113.5439],
  "东京": [35.6762, 139.6503],
  "首尔": [37.5665, 126.978],
  "新加坡": [1.3521, 103.8198],
  "曼谷": [13.7563, 100.5018],
  "吉隆坡": [3.139, 101.6869],
  "法兰克福": [50.1109, 8.6821],
  "杜塞尔多夫": [51.2277, 6.7735],
  "米兰": [45.4642, 9.19],
  "巴黎": [48.8566, 2.3522],
  "伦敦": [51.5074, -0.1278],
  "纽约": [40.7128, -74.006],
  "芝加哥": [41.8781, -87.6298],
  "拉斯维加斯": [36.1699, -115.1398],
  "莫斯科": [55.7558, 37.6173],
  "圣保罗": [-23.5505, -46.6333],
  "雅加达": [-6.2088, 106.8456],
  "孟买": [19.076, 72.8777],
  "新德里": [28.6139, 77.209],
  "伊斯坦布尔": [41.0082, 28.9784],
  "迪拜": [25.2048, 55.2708],
}

function getCityCoord(city: string): [number, number] {
  const cleaned = city.trim()
  if (cityCoords[cleaned]) return cityCoords[cleaned]
  for (const [key, coord] of Object.entries(cityCoords)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return coord
  }
  return [35, 105]
}

export async function GET(_request: Request) {
  const db = getDb()

  const rows = db.prepare(`
    SELECT e.city,
           COUNT(DISTINCT b.brand_id) as count,
           GROUP_CONCAT(DISTINCT b.name_cn, ', ') as exhibition_names,
           MAX(CASE WHEN b.is_international = 1 THEN 1 ELSE 0 END) as has_international
    FROM exhibition_edition e
    JOIN exhibition_brand b ON b.brand_id = e.brand_id
    WHERE e.city != ''
    GROUP BY e.city
    ORDER BY count DESC
  `).all() as {
    city: string
    count: number
    exhibition_names: string
    has_international: number
  }[]

  const markers = rows.map((row) => {
    const [lat, lng] = getCityCoord(row.city)
    const names = row.exhibition_names ? row.exhibition_names.split(', ') : []
    return {
      city: row.city,
      count: row.count,
      lat,
      lng,
      top_exhibitions: names.slice(0, 3),
      is_china: row.has_international === 0,
    }
  })

  return NextResponse.json({ markers })
}
