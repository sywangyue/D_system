#!/usr/bin/env python3
"""
MDS 收并购候选标的分析脚本
基于 MDS 德国/上海展会品牌，在 MWLAB 数据库中筛选上下游可收购展会
"""

import sqlite3
import json
from collections import defaultdict
from datetime import datetime

from pathlib import Path
_REPO_ROOT = Path(__file__).resolve().parent
DB_PATH = str(_REPO_ROOT / "data" / "mwlab.db")

# ============================================================
# 1. MDS 品牌定义（德国母展 → 上海子展 → 行业）
# ============================================================

MDS_BRANDS = [
    {
        "brand": "CIOSH",
        "parent": "A+A",
        "sector_cn": "劳保/安全生产",
        "core_keywords": ["劳保", "安全", "防护", "PPE", "职业健康", "应急"],
        "upstream_kw": [
            "纺织面料", "功能面料", "无纺布", "高分子材料", "安全玻璃",
            "检测认证", "防静电", "过滤材料", "复合材料", "高性能纤维"
        ],
        "downstream_kw": [
            "建筑安全", "矿山安全", "消防安全", "应急救援", "化工安全",
            "职业健康", "安全培训", "安全生产", "环保安全", "智慧工地"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "CHINAPLAS",
        "parent": "K",
        "sector_cn": "橡塑",
        "core_keywords": ["塑料", "橡胶", "橡塑", "高分子", "弹性体"],
        "upstream_kw": [
            "石化", "添加剂", "色母粒", "助剂", "模具",
            "热流道", "注塑机", "挤出机", "吹塑", "回收再生"
        ],
        "downstream_kw": [
            "汽车零部件", "包装", "医疗器械", "消费电子", "家电",
            "建筑建材", "运动器材", "薄膜", "管材型材", "3D打印"
        ],
        "cooperation_partner": "雅式(Adsale) — 同品类不可收购",
    },
    {
        "brand": "wire China",
        "parent": "wire",
        "sector_cn": "线材/电缆",
        "core_keywords": ["线缆", "电缆", "电线", "光纤", "线材"],
        "upstream_kw": [
            "铜材", "铝材", "绝缘材料", "电缆料", "金属加工",
            "拉丝", "绞线", "镀层", "连接器", "端子"
        ],
        "downstream_kw": [
            "电力", "输配电", "通信", "5G", "新能源",
            "汽车线束", "轨道交通", "船舶", "航空航天", "智能电网"
        ],
        "cooperation_partner": "上海电缆研究所 — 同品类不可收购",
    },
    {
        "brand": "Tube China",
        "parent": "Tube",
        "sector_cn": "管材",
        "core_keywords": ["管材", "管道", "钢管", "管件"],
        "upstream_kw": [
            "钢铁", "不锈钢", "焊管", "无缝管", "管加工",
            "弯管", "防腐", "涂层", "检测", "塑料管材"
        ],
        "downstream_kw": [
            "市政管道", "油气管道", "化工管道", "建筑给排水", "暖通",
            "锅炉", "换热器", "海洋工程", "核电", "水利"
        ],
        "cooperation_partner": "上海电缆研究所 — 同品类不可收购",
    },
    {
        "brand": "All in Print China",
        "parent": "drupa",
        "sector_cn": "印刷",
        "core_keywords": ["印刷", "打印", "包装印刷", "标签印刷", "数字印刷"],
        "upstream_kw": [
            "油墨", "纸张", "版材", "印前", "印后",
            "喷墨", "色粉", "光油", "胶粘剂", "滚筒"
        ],
        "downstream_kw": [
            "包装", "标签", "出版", "商业印刷", "纺织印花",
            "广告", "快印", "防伪", "3D打印", "智能包装"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "ProWine Shanghai",
        "parent": "ProWein",
        "sector_cn": "葡萄酒/烈酒",
        "core_keywords": ["葡萄酒", "红酒", "烈酒", "洋酒", "酒类"],
        "upstream_kw": [
            "葡萄种植", "酿酒设备", "酒瓶", "酒标", "橡木桶",
            "灌装", "冷藏", "过滤", "发酵", "酒柜"
        ],
        "downstream_kw": [
            "酒店", "餐饮", "零售", "电商", "高端食品",
            "酒吧", "进口食品", "生鲜", "精品超市", "品鉴"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "interpack China",
        "parent": "interpack",
        "sector_cn": "包装",
        "core_keywords": ["包装", "包装机械", "包装材料"],
        "upstream_kw": [
            "包装纸", "塑料薄膜", "玻璃瓶", "金属罐", "包装印刷",
            "喷码", "贴标", "封口", "打包", "码垛"
        ],
        "downstream_kw": [
            "食品", "饮料", "医药", "日化", "化妆品",
            "快消品", "电商物流", "冷链", "乳品", "调味品"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "Medical Fair China",
        "parent": "MEDICA",
        "sector_cn": "医疗器械",
        "core_keywords": ["医疗", "医疗器械", "医用", "诊断", "影像"],
        "upstream_kw": [
            "电子元器件", "传感器", "精密加工", "生物材料", "芯片",
            "光学", "电源", "线束", "注塑", "表面处理"
        ],
        "downstream_kw": [
            "医院", "康复", "家用医疗", "数字健康", "远程医疗",
            "养老", "体检", "医美", "兽医", "口腔"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "REHACARE CHINA",
        "parent": "REHACARE",
        "sector_cn": "康复/辅具",
        "core_keywords": ["康复", "辅具", "无障碍", "助行", "护理"],
        "upstream_kw": [
            "碳纤维", "钛合金", "传感器", "马达", "电池",
            "硅胶", "3D打印", "人工智能", "机器人", "新材料"
        ],
        "downstream_kw": [
            "养老", "无障碍", "辅具租赁", "居家护理", "特殊教育",
            "残联", "社区养老", "适老化", "福祉", "康复医院"
        ],
        "cooperation_partner": "无强势绑定",
    },
    {
        "brand": "Valve World Asia",
        "parent": "VALVE WORLD EXPO",
        "sector_cn": "阀门",
        "core_keywords": ["阀门", "泵", "执行器", "密封"],
        "upstream_kw": [
            "铸件", "锻件", "密封件", "执行器", "定位器",
            "不锈钢", "合金", "法兰", "垫片", "紧固件"
        ],
        "downstream_kw": [
            "石油", "天然气", "化工", "电力", "水处理",
            "核电", "LNG", "氢能", "海水淡化", "制药"
        ],
        "cooperation_partner": "无强势绑定",
    },
]

# ============================================================
# 2. MDS 德国有但未引入中国的品牌（机会池）
# ============================================================

MDS_GERMANY_UNUSED = [
    {
        "parent": "COMPAMED",
        "sector_cn": "医疗制造/上游供应链",
        "description": "医疗器械零部件、原材料、OEM制造 — MEDICA 的上游",
        "upstream_kw": ["医疗制造", "医疗加工", "医疗注塑", "医疗包装", "生物芯片",
                        "微流控", "医疗电子", "精密加工", "医疗模具", "洁净室"],
        "downstream_kw": ["医疗器械", "体外诊断", "植入物", "手术器械"],
    },
    {
        "parent": "GIFA/METEC/NEWCAST/THERMPROCESS",
        "sector_cn": "金属加工/铸造/冶金/热处理 (Bright World of Metals)",
        "description": "四大展会同期举办，覆盖金属全产业链",
        "upstream_kw": ["金属原料", "铸造设备", "耐火材料", "工业炉", "模具钢"],
        "downstream_kw": ["汽车制造", "航空航天", "能源装备", "工程机械", "轨道交通",
                          "船舶", "风电", "核电", "农机", "机床"],
    },
    {
        "parent": "glasstec",
        "sector_cn": "玻璃",
        "description": "玻璃生产、加工、应用全产业链",
        "upstream_kw": ["石英砂", "纯碱", "玻璃窑炉", "耐火材料"],
        "downstream_kw": ["建筑玻璃", "汽车玻璃", "光伏玻璃", "电子玻璃", "中空玻璃",
                          "幕墙", "门窗", "太阳能", "显示屏", "智能玻璃"],
    },
    {
        "parent": "ALUMINIUM",
        "sector_cn": "铝业",
        "description": "铝及铝加工全产业链",
        "upstream_kw": ["氧化铝", "电解铝", "铝加工", "挤压"],
        "downstream_kw": ["汽车轻量化", "航空航天", "建筑铝材", "包装铝箔", "新能源",
                          "轨道交通", "船舶", "消费电子", "光伏边框", "铝模板"],
    },
    {
        "parent": "EuroShop/EuroCIS",
        "sector_cn": "零售/零售技术",
        "description": "零售业设计、技术、设备",
        "upstream_kw": ["商业照明", "货架", "POS", "RFID", "商业制冷"],
        "downstream_kw": ["新零售", "智慧零售", "无人零售", "直播电商", "O2O",
                          "商业地产", "购物中心", "便利店", "超市", "生鲜零售"],
    },
    {
        "parent": "BEAUTY/TOP HAIR",
        "sector_cn": "美容美发",
        "description": "美容、美发、化妆品",
        "upstream_kw": ["化妆品原料", "包材", "代工", "美容仪器"],
        "downstream_kw": ["医美", "美容院", "美发沙龙", "美妆零售", "直播电商",
                          "药妆", "男士理容", "香氛", "个护", "美甲"],
    },
    {
        "parent": "boot Düsseldorf",
        "sector_cn": "船艇/水上运动",
        "description": "全球最大船艇展",
        "upstream_kw": ["船用发动机", "导航", "船体材料", "复合材料"],
        "downstream_kw": ["游艇", "帆船", "水上运动", "钓鱼", "潜水",
                          "滨海旅游", "邮轮", "海洋经济", "码头", "俱乐部"],
    },
    {
        "parent": "CARAVAN SALON",
        "sector_cn": "房车/露营",
        "description": "全球最大房车展",
        "upstream_kw": ["房车底盘", "房车配件", "露营装备"],
        "downstream_kw": ["房车旅游", "露营地", "自驾游", "户外", "旅居",
                          "越野", "帐篷", "户外电源", "房车租赁", "营地"],
    },
]

# ============================================================
# 3. 城市筛选
# ============================================================
TIER1_CITIES = ['上海', '北京', '广州', '深圳', '杭州', '苏州']

# ============================================================
# 4. 主分析逻辑
# ============================================================

def load_candidates():
    """从数据库加载符合基础条件的候选展会"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    placeholders = ','.join(['?'] * len(TIER1_CITIES))
    cur.execute(f"""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer,
               b.industry_l1, b.industry_l2, b.city,
               e.edition_id, e.year, e.date_start, e.date_end, e.venue,
               e.area_sqm, e.exhibitors_count, e.visitors_count,
               e.data_source
        FROM exhibition_brand b
        JOIN exhibition_edition e ON b.brand_id = e.brand_id
        WHERE b.country_cn = '中国'
          AND b.city IN ({placeholders})
          AND (e.area_sqm >= 30000 OR e.area_sqm IS NULL)
          AND e.year >= 2024
        ORDER BY e.area_sqm DESC, b.city
    """, TIER1_CITIES)

    rows = cur.fetchall()
    conn.close()

    # 按 brand_id 聚合，取最大面积的那届
    brands = {}
    for r in rows:
        bid = r['brand_id']
        area = r['area_sqm'] or 0
        if bid not in brands or area > (brands[bid].get('max_area', 0)):
            d = dict(r)
            d['max_area'] = area
            brands[bid] = d

    return list(brands.values())


def keyword_match_score(name, industry_l1, industry_l2, organizer, keywords):
    """计算关键词匹配得分"""
    text = f"{name or ''} {industry_l1 or ''} {industry_l2 or ''} {organizer or ''}"
    score = 0
    matched = []
    for kw in keywords:
        if kw in text:
            score += 1
            matched.append(kw)
    return score, matched


def analyze_candidate(candidate, mds_brand, match_type="upstream"):
    """分析单个候选与某个 MDS 品牌的关联度"""
    kw_list = mds_brand.get(f'{match_type}_kw', []) if match_type in ('upstream', 'downstream') else mds_brand.get('core_keywords', [])
    score, matched = keyword_match_score(
        candidate['name_cn'],
        candidate['industry_l1'],
        candidate['industry_l2'],
        candidate['organizer'],
        kw_list
    )
    return score, matched


def filter_own_brands(candidates):
    """排除 MDS 自有品牌"""
    mds_names = [
        'CIOSH', 'CHINAPLAS', 'wire China', 'Tube China',
        'All in Print', 'ProWine', 'interpack', 'Medical Fair China',
        'REHACARE', 'Valve World', 'AIC', '中国国际橡塑展',
        '中国国际线缆', '中国国际管材', '中国国际全印展',
        '中国国际葡萄酒', '中国国际包装', '中国国际医疗器械',
        '中国国际康复', '中国国际阀门',
    ]
    filtered = []
    for c in candidates:
        name = c['name_cn'] or ''
        if not any(mn in name for mn in mds_names):
            filtered.append(c)
    return filtered


def main():
    print("=" * 80)
    print("MDS 收并购候选标的分析")
    print(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 80)

    # 加载候选
    candidates = load_candidates()
    print(f"\n📊 初筛: {len(candidates)} 个品牌符合城市+面积条件")

    # 排除自有品牌
    candidates = filter_own_brands(candidates)
    print(f"📊 排除自有品牌后: {len(candidates)} 个候选\n")

    # 按 MDS 品牌分组分析
    all_results = []

    # === A. 现有 MDS 中国品牌的上下游 ===
    print("=" * 80)
    print("A. 现有 MDS 中国品牌 — 上下游候选")
    print("=" * 80)

    for mds in MDS_BRANDS:
        upstream_results = []
        downstream_results = []

        for c in candidates:
            up_score, up_matched = analyze_candidate(c, mds, "upstream")
            down_score, down_matched = analyze_candidate(c, mds, "downstream")

            if up_score >= 1:
                upstream_results.append({
                    **c,
                    'match_score': up_score,
                    'matched_kw': up_matched,
                    'mds_brand': mds['brand'],
                    'mds_sector': mds['sector_cn'],
                    'match_type': '上游',
                    'constraint': mds['cooperation_partner'],
                })

            if down_score >= 1:
                downstream_results.append({
                    **c,
                    'match_score': down_score,
                    'matched_kw': down_matched,
                    'mds_brand': mds['brand'],
                    'mds_sector': mds['sector_cn'],
                    'match_type': '下游',
                    'constraint': mds['cooperation_partner'],
                })

        upstream_results.sort(key=lambda x: x['match_score'], reverse=True)
        downstream_results.sort(key=lambda x: x['match_score'], reverse=True)

        top_up = upstream_results[:3]
        top_down = downstream_results[:3]

        if top_up or top_down:
            print(f"\n{'─' * 60}")
            print(f"  {mds['brand']} （{mds['sector_cn']}）| 母展: {mds['parent']}")
            print(f"  合作约束: {mds['cooperation_partner']}")

            if top_up:
                print(f"\n  🔼 上游候选 (Top {len(top_up)}):")
                for r in top_up:
                    print(f"    ⭐{r['match_score']} | {r['name_cn']} | {r['city']} | "
                          f"{r['max_area']:,.0f}㎡ | {r['industry_l1']}>{r['industry_l2']}")
                    print(f"       匹配词: {', '.join(r['matched_kw'])}")
                    all_results.append(r)

            if top_down:
                print(f"\n  🔽 下游候选 (Top {len(top_down)}):")
                for r in top_down:
                    print(f"    ⭐{r['match_score']} | {r['name_cn']} | {r['city']} | "
                          f"{r['max_area']:,.0f}㎡ | {r['industry_l1']}>{r['industry_l2']}")
                    print(f"       匹配词: {', '.join(r['matched_kw'])}")
                    all_results.append(r)

    # === B. 德国有但未引入中国的品牌 — 中国已有同类展会 ===
    print("\n\n" + "=" * 80)
    print("B. 德国品牌未入华 — 中国市场已有同类展会（收购/合作机会）")
    print("=" * 80)

    for mds_ger in MDS_GERMANY_UNUSED:
        results = []
        all_kw = mds_ger.get('upstream_kw', []) + mds_ger.get('downstream_kw', [])

        for c in candidates:
            score, matched = keyword_match_score(
                c['name_cn'], c['industry_l1'],
                c['industry_l2'], c['organizer'], all_kw
            )
            if score >= 1:
                results.append({
                    **c,
                    'match_score': score,
                    'matched_kw': matched,
                    'mds_brand': mds_ger['parent'],
                    'mds_sector': mds_ger['sector_cn'],
                    'match_type': '同类替代',
                    'constraint': mds_ger['description'],
                })

        results.sort(key=lambda x: x['match_score'], reverse=True)
        top = results[:3]

        if top:
            print(f"\n{'─' * 60}")
            print(f"  {mds_ger['parent']} — {mds_ger['sector_cn']}")
            print(f"  描述: {mds_ger['description']}")
            print(f"\n  中国候选 (Top {len(top)}):")
            for r in top:
                print(f"    ⭐{r['match_score']} | {r['name_cn']} | {r['city']} | "
                      f"{r['max_area']:,.0f}㎡ | {r['industry_l1']}>{r['industry_l2']}")
                print(f"       匹配词: {', '.join(r['matched_kw'])}")
                all_results.append(r)

    # === 汇总 ===
    print("\n\n" + "=" * 80)
    print("汇总统计")
    print("=" * 80)

    # 按 MDS 品牌分组统计
    by_mds = defaultdict(list)
    for r in all_results:
        by_mds[r['mds_brand']].append(r)

    print(f"\n总计 {len(all_results)} 条候选匹配，涉及 {len(by_mds)} 个 MDS 品牌线\n")

    for brand, items in sorted(by_mds.items()):
        # 去重 brand_id
        unique_brands = {}
        for it in items:
            bid = it['brand_id']
            if bid not in unique_brands or it['match_score'] > unique_brands[bid]['match_score']:
                unique_brands[bid] = it
        print(f"  {brand}: {len(unique_brands)} 个独立候选品牌")

    # 保存 JSON
    output = []
    seen_ids = set()
    for r in all_results:
        if r['brand_id'] not in seen_ids:
            seen_ids.add(r['brand_id'])
            output.append({
                'brand_id': r['brand_id'],
                'name_cn': r['name_cn'],
                'city': r['city'],
                'area_sqm': r['max_area'],
                'mds_brand': r['mds_brand'],
                'mds_sector': r['mds_sector'],
                'match_type': r['match_type'],
                'match_score': r['match_score'],
                'matched_kw': r['matched_kw'],
                'industry': f"{r['industry_l1']}>{r['industry_l2']}",
                'organizer': r['organizer'],
                'constraint': r.get('constraint', ''),
            })

    json_path = str(_REPO_ROOT / "ma_candidates.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n详细结果已保存至: {json_path}")
    print(f"共 {len(output)} 个去重候选品牌")


if __name__ == '__main__':
    main()
