#!/usr/bin/env python3
"""
MDS 收并购候选标的分析 v2
关键修正: 先排除国际大主办/政府/协会背景的展会，聚焦真正独立可收购标的
"""

import sqlite3
import json
from collections import defaultdict

from pathlib import Path
_REPO_ROOT = Path(__file__).resolve().parent
DB_PATH = str(_REPO_ROOT / "data" / "mwlab.db")

# ============================================================
# 国际大主办黑名单 — 被这些机构控制的展会基本不可收购
# ============================================================
BIG_PLAYERS = [
    # 国际展览集团
    'Informa', 'UBM', '博华', '博万德',  # Informa系
    'RX', 'Reed', '励展', '国药励展',    # Reed Exhibitions
    '法兰克福', 'Messe Frankfurt',
    '汉诺威', '米兰', 'Hannover',       # 汉诺威米兰
    '科隆', 'Koelnmesse',
    '慕尼黑', 'Messe München',
    '杜塞尔多夫', 'Messe Düsseldorf',    # 自己
    '纽伦堡', 'NürnbergMesse',
    'Comexposium', '高美爱博',
    'GL Events', '智奥',
    '英富曼', '博闻',
    'ITE', 'Hyve',
    'Clarion', 'Clarion Events',
    'DMG', 'dmg events',
    'Tarsus',
    'Emerald', 'Emerald Expositions',
    'Diversified', 'Diversified Communications',
    'Easyfairs',
    
    # 政府/央企/国企
    '商务部', '人民政府', '中国国际贸易促进委员会', '贸促会',
    '中国机械工业集团', '中国机械工业联合会',
    '中国汽车工业协会', '中国汽车贸促会',
    '中国家具协会', '中国建筑装饰协会', '中国建筑材料联合会',
    '中国纺织工业联合会', '中国服装协会',
    '中国食品土畜进出口商会', '中国粮油学会',
    '深圳市人民政府', '上海市人民政府', '北京市人民政府',
    '中国对外贸易中心', '广交会',
    '中国国际进口博览局',
    
    # 大型行业协会
    '中国安全防范产品行业协会',
    '中国电子学会', '中国电子信息行业联合会',
    '中国仪器仪表学会', '中国仪器仪表行业协会',
    '中国制冷学会', '中国制冷空调工业协会',
    '中国旅游饭店业协会',
    '中国医疗器械行业协会',
    '中国医药保健品进出口商会',
]

# 排除的关键词（展会名称中）
EXCLUDE_NAME_KW = [
    '广交会', '进博会', 'CHINAPLAS', 'CIOSH', 'ProWine', 'interpack',
    '全印展', 'Medical Fair China', 'REHACARE', 'Valve World',
    'wire China', 'Tube China',
]

# ============================================================
# MDS 品牌上下游映射（同 v1，但精简）
# ============================================================

MDS_BRANDS = [
    {
        "brand": "CIOSH",
        "sector_cn": "劳保/安全生产",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "功能面料", "高性能纤维", "安全玻璃", "防静电",
            "过滤材料", "智能穿戴", "传感器", "检测认证",
            "复合材料", "高分子", "涂层", "纳米材料"
        ],
        "downstream_kw": [
            "消防", "应急救援", "矿山安全", "化工安全",
            "建筑安全", "电力安全", "职业健康", "环保检测",
            "智慧安防", "安全培训", "环境监测", "工业防爆"
        ],
    },
    {
        "brand": "CHINAPLAS",
        "sector_cn": "橡塑",
        "constraint": "雅式绑定 — 同品类不可收购",
        "upstream_kw": [
            "添加剂", "色母粒", "助剂", "模具", "热流道",
            "回收再生", "生物基材料", "降解材料", "弹性体",
            "改性塑料", "工程塑料", "复合材料成型"
        ],
        "downstream_kw": [
            "汽车轻量化", "医疗器械", "消费电子", "家电外壳",
            "运动器材", "3D打印", "薄膜", "建筑建材",
            "食品接触材料", "医用耗材", "可降解包装"
        ],
    },
    {
        "brand": "wire China",
        "sector_cn": "线材/电缆",
        "constraint": "上海电缆研究所绑定 — 同品类不可收购",
        "upstream_kw": [
            "铜材", "铝材", "绝缘材料", "电缆料",
            "连接器", "端子", "线束加工", "镀层"
        ],
        "downstream_kw": [
            "电力电网", "输配电", "充电桩", "新能源发电",
            "汽车线束", "轨道交通", "船舶", "工业连接器"
        ],
    },
    {
        "brand": "Tube China",
        "sector_cn": "管材",
        "constraint": "上海电缆研究所绑定 — 同品类不可收购",
        "upstream_kw": [
            "不锈钢管", "焊管", "无缝管", "管加工设备",
            "防腐", "涂层", "塑料管材", "复合管"
        ],
        "downstream_kw": [
            "市政管道", "暖通", "给排水", "油气管道",
            "锅炉", "换热器", "核电管道", "海洋工程"
        ],
    },
    {
        "brand": "All in Print China",
        "sector_cn": "印刷",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "油墨", "纸张", "版材", "喷墨", "胶粘剂",
            "光油", "印前软件", "色彩管理"
        ],
        "downstream_kw": [
            "标签印刷", "包装印刷", "纺织印花", "广告印刷",
            "快印", "防伪印刷", "智能包装", "RFID标签"
        ],
    },
    {
        "brand": "ProWine Shanghai",
        "sector_cn": "葡萄酒/烈酒",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "酿酒设备", "酒瓶", "橡木桶", "灌装线",
            "冷藏设备", "酒柜", "发酵罐"
        ],
        "downstream_kw": [
            "酒店餐饮", "零售终端", "进口食品", "酒类零售",
            "酒吧", "精品超市", "品鉴", "酒类电商"
        ],
    },
    {
        "brand": "interpack China",
        "sector_cn": "包装",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "包装材料", "包装纸", "薄膜", "玻璃瓶",
            "金属罐", "喷码", "贴标", "打包"
        ],
        "downstream_kw": [
            "食品加工", "饮料灌装", "医药包装", "化妆品包装",
            "日化包装", "冷链包装", "快递包装", "预制菜包装"
        ],
    },
    {
        "brand": "Medical Fair China",
        "sector_cn": "医疗器械",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "医疗电子", "传感器", "精密加工", "生物材料",
            "医疗模具", "医疗注塑", "芯片", "光学组件"
        ],
        "downstream_kw": [
            "医院建设", "家用医疗", "数字健康", "远程医疗",
            "医美设备", "口腔", "眼科", "兽医"
        ],
    },
    {
        "brand": "REHACARE CHINA",
        "sector_cn": "康复/辅具",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "碳纤维", "钛合金", "3D打印", "人工智能",
            "机器人", "传感器", "马达", "新材料"
        ],
        "downstream_kw": [
            "养老", "适老化", "无障碍", "辅具租赁",
            "居家护理", "特殊教育", "社区养老", "康复医院"
        ],
    },
    {
        "brand": "Valve World Asia",
        "sector_cn": "阀门",
        "constraint": "无强势绑定",
        "upstream_kw": [
            "铸件", "锻件", "密封件", "执行器",
            "不锈钢", "合金", "法兰", "垫片"
        ],
        "downstream_kw": [
            "石油化工", "天然气", "电力", "水处理",
            "氢能", "LNG", "核电", "海水淡化"
        ],
    },
]

# ============================================================
# 德国有但未入华的品牌（重新定义上下游）
# ============================================================

MDS_GERMANY_UNUSED = [
    {
        "parent": "COMPAMED",
        "sector_cn": "医疗制造/上游供应链",
        "description": "医疗器械零部件、原材料、OEM制造",
        "kw": [
            "医疗制造", "医疗加工", "医疗电子", "精密注塑",
            "医疗模具", "洁净室", "微流控", "生物芯片",
            "医疗包装", "医疗消毒", "医疗器械注册"
        ],
    },
    {
        "parent": "GIFA/METEC/NEWCAST/THERMPROCESS",
        "sector_cn": "铸造/冶金/热处理",
        "description": "金属全产业链",
        "kw": [
            "铸造", "压铸", "冶金", "热处理", "工业炉",
            "耐火材料", "铸件", "锻造", "冶金装备"
        ],
    },
    {
        "parent": "glasstec",
        "sector_cn": "玻璃技术",
        "description": "玻璃生产、加工、应用",
        "kw": [
            "玻璃生产", "玻璃加工", "钢化玻璃", "中空玻璃",
            "光伏玻璃", "电子玻璃", "汽车玻璃", "幕墙玻璃"
        ],
    },
    {
        "parent": "ALUMINIUM",
        "sector_cn": "铝业",
        "description": "铝及铝加工全产业链",
        "kw": [
            "铝加工", "铝型材", "铝合金", "铝挤压",
            "汽车铝材", "铝模板", "铝箔", "再生铝"
        ],
    },
    {
        "parent": "EuroShop/EuroCIS",
        "sector_cn": "零售/零售技术",
        "description": "零售业设计、技术、设备",
        "kw": [
            "零售设计", "店铺装修", "商业照明", "货架",
            "POS系统", "RFID", "商业制冷", "零售科技"
        ],
    },
    {
        "parent": "boot Düsseldorf",
        "sector_cn": "船艇/水上运动",
        "description": "全球最大船艇展",
        "kw": [
            "游艇", "帆船", "水上运动", "钓鱼", "潜水",
            "船用发动机", "船艇配件", "码头", "航海"
        ],
    },
    {
        "parent": "CARAVAN SALON",
        "sector_cn": "房车/露营/户外",
        "description": "全球最大房车展",
        "kw": [
            "房车", "露营", "自驾游", "户外", "旅居",
            "越野", "户外用品", "帐篷", "房车配件"
        ],
    },
    {
        "parent": "BEAUTY/TOP HAIR",
        "sector_cn": "美容美发",
        "description": "美容、美发、化妆品",
        "kw": [
            "美容", "美发", "化妆品", "美甲", "个护",
            "美容仪器", "化妆品原料", "美容院", "医美"
        ],
    },
]

TIER1_CITIES = ['上海', '北京', '广州', '深圳', '杭州', '苏州']


def is_big_player(organizer):
    """判断主办方是否为国际大主办/政府/协会"""
    if not organizer:
        return False
    org = organizer
    for bp in BIG_PLAYERS:
        if bp.lower() in org.lower():
            return True
    return False


def load_candidates():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    placeholders = ','.join(['?'] * len(TIER1_CITIES))
    cur.execute(f"""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer,
               b.industry_l1, b.industry_l2, b.city,
               e.year, e.date_start, e.date_end, e.venue,
               e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        JOIN exhibition_edition e ON b.brand_id = e.brand_id
        WHERE b.country_cn = '中国'
          AND b.city IN ({placeholders})
          AND e.area_sqm >= 30000
          AND e.year >= 2024
        ORDER BY e.area_sqm DESC
    """, TIER1_CITIES)

    rows = cur.fetchall()
    conn.close()

    # 聚合去重
    brands = {}
    for r in rows:
        bid = r['brand_id']
        area = r['area_sqm'] or 0
        if bid not in brands or area > (brands[bid].get('max_area', 0)):
            d = dict(r)
            d['max_area'] = area
            brands[bid] = d
    return list(brands.values())


def keyword_match(text, keywords):
    text = text or ''
    score = 0
    matched = []
    for kw in keywords:
        if kw in text:
            score += 1
            matched.append(kw)
    return score, matched


def filter_own(candidates):
    mds_kw = ['CIOSH', 'CHINAPLAS', 'wire China', 'Tube China',
              'All in Print', 'ProWine', 'interpack', 'Medical Fair',
              'REHACARE', 'Valve World', 'AIC']
    return [c for c in candidates if not any(m in (c['name_cn'] or '') for m in mds_kw)]


def main():
    print("=" * 80)
    print("MDS 收并购候选标的分析 v2 — 排除国际大主办/政府/协会")
    print("=" * 80)

    candidates = load_candidates()
    print(f"\n初筛（一线城市 + ≥3万㎡）: {len(candidates)} 个品牌")

    candidates = filter_own(candidates)
    print(f"排除自有品牌后: {len(candidates)}")

    # === 分组 ===
    independent = []   # 独立主办方
    big_player = []    # 国际大主办/政府背景

    for c in candidates:
        org = c['organizer'] or ''
        name = c['name_cn'] or ''
        
        # 检查展会名称中是否含排除词
        name_excluded = any(kw in name for kw in EXCLUDE_NAME_KW)
        
        if is_big_player(org) or name_excluded:
            big_player.append(c)
        else:
            independent.append(c)

    print(f"\n🔴 国际大主办/政府背景（不可收购）: {len(big_player)} 个")
    print(f"🟢 独立/潜在可收购: {len(independent)} 个")

    # === 对独立展会做上下游匹配 ===
    print("\n" + "=" * 80)
    print("A. 现有 MDS 品牌 — 独立展会的上下游匹配")
    print("=" * 80)

    all_matches = []

    for mds in MDS_BRANDS:
        up_matches = []
        down_matches = []

        for c in independent:
            text = f"{c['name_cn'] or ''} {c['industry_l1'] or ''} {c['industry_l2'] or ''} {c['organizer'] or ''}"
            
            up_score, up_kw = keyword_match(text, mds['upstream_kw'])
            down_score, down_kw = keyword_match(text, mds['downstream_kw'])

            if up_score >= 1:
                up_matches.append({**c, 'score': up_score, 'kw': up_kw, 'type': '上游'})
            if down_score >= 1:
                down_matches.append({**c, 'score': down_score, 'kw': down_kw, 'type': '下游'})

        up_matches.sort(key=lambda x: x['score'], reverse=True)
        down_matches.sort(key=lambda x: x['score'], reverse=True)

        for m in up_matches[:5] + down_matches[:5]:
            all_matches.append({**m, 'mds_brand': mds['brand'], 'constraint': mds['constraint']})

        if up_matches or down_matches:
            print(f"\n{'─' * 60}")
            print(f"  {mds['brand']} ({mds['sector_cn']}) | 约束: {mds['constraint']}")
            if up_matches[:3]:
                print(f"  🔼 上游:")
                for r in up_matches[:3]:
                    print(f"    ⭐{r['score']} | {r['name_cn']} | {r['city']} | {r['max_area']:,.0f}㎡")
                    print(f"      主办: {r['organizer']} | {r['industry_l1']}>{r['industry_l2']}")
                    print(f"      匹配: {', '.join(r['kw'])}")
            if down_matches[:3]:
                print(f"  🔽 下游:")
                for r in down_matches[:3]:
                    print(f"    ⭐{r['score']} | {r['name_cn']} | {r['city']} | {r['max_area']:,.0f}㎡")
                    print(f"      主办: {r['organizer']} | {r['industry_l1']}>{r['industry_l2']}")
                    print(f"      匹配: {', '.join(r['kw'])}")

    # === B. 德国未入华品牌 → 中国独立同类展 ===
    print("\n\n" + "=" * 80)
    print("B. 德国品牌未入华 — 中国市场独立同类展（JV/收购机会）")
    print("=" * 80)

    for ger in MDS_GERMANY_UNUSED:
        matches = []
        for c in independent:
            text = f"{c['name_cn'] or ''} {c['industry_l1'] or ''} {c['industry_l2'] or ''}"
            score, kw = keyword_match(text, ger['kw'])
            if score >= 1:
                matches.append({**c, 'score': score, 'kw': kw})

        matches.sort(key=lambda x: x['score'], reverse=True)
        if matches:
            print(f"\n{'─' * 60}")
            print(f"  {ger['parent']} — {ger['sector_cn']}")
            print(f"  {ger['description']}")
            for r in matches[:3]:
                print(f"    ⭐{r['score']} | {r['name_cn']} | {r['city']} | {r['max_area']:,.0f}㎡")
                print(f"      主办: {r['organizer']} | {r['industry_l1']}>{r['industry_l2']}")
                print(f"      匹配: {', '.join(r['kw'])}")
                all_matches.append({**r, 'mds_brand': ger['parent'], 'constraint': '德国未入华'})

    # === 汇总 ===
    print("\n\n" + "=" * 80)
    print("汇总: 独立可收购候选")
    print("=" * 80)

    # 去重
    seen = {}
    for m in all_matches:
        bid = m['brand_id']
        if bid not in seen or m.get('score', 0) > seen[bid].get('score', 0):
            seen[bid] = m

    sorted_results = sorted(seen.values(), key=lambda x: x.get('score', 0), reverse=True)
    
    print(f"\n共 {len(sorted_results)} 个独立品牌的候选匹配\n")
    
    for i, r in enumerate(sorted_results):
        score = r.get('score', r.get('match_score', 0))
        print(f"  {i+1}. [{r['mds_brand']}] ⭐{score} | {r['name_cn']}")
        print(f"     {r['city']} | {r['max_area']:,.0f}㎡ | {r.get('type', '同类')}")
        print(f"     主办: {r['organizer']} | {r['industry_l1']}>{r['industry_l2']}")
        print()

    # 保存
    output = []
    for r in sorted_results:
        output.append({
            'name_cn': r['name_cn'],
            'city': r['city'],
            'area_sqm': r['max_area'],
            'organizer': r['organizer'],
            'industry': f"{r['industry_l1']}>{r['industry_l2']}",
            'mds_brand': r['mds_brand'],
            'score': r.get('score', 0),
            'match_type': r.get('type', ''),
            'keywords': r.get('kw', []),
        })

    with open(str(_REPO_ROOT / "ma_candidates_v2.json"), 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"详细结果: ma_candidates_v2.json")


if __name__ == '__main__':
    main()
