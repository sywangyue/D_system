#!/usr/bin/env python3
"""
MWLAB 地理信息双语化 + notes 反填 city
1. 解析 notes 提取 city/province/country
2. 反填 city（原值为空时）
3. 填充 city_en, country_cn, country_en
4. 清空 notes
"""

import sqlite3
import re
import os

DB_PATH = "data/mwlab.db"

# ═══════════════════════════════════════════════════
# 中英对照表
# ═══════════════════════════════════════════════════

CITY_MAP = {
    # 中国大陆城市
    "上海": "Shanghai",       "北京": "Beijing",
    "深圳": "Shenzhen",       "广州": "Guangzhou",
    "香港": "Hong Kong",      "成都": "Chengdu",
    "杭州": "Hangzhou",       "郑州": "Zhengzhou",
    "武汉": "Wuhan",          "南京": "Nanjing",
    "西安": "Xi'an",          "重庆": "Chongqing",
    "青岛": "Qingdao",        "厦门": "Xiamen",
    "宁波": "Ningbo",         "大连": "Dalian",
    "沈阳": "Shenyang",       "济南": "Jinan",
    "天津": "Tianjin",        "苏州": "Suzhou",
    "东莞": "Dongguan",       "佛山": "Foshan",
    "长沙": "Changsha",       "合肥": "Hefei",
    "福州": "Fuzhou",         "昆明": "Kunming",
    "贵阳": "Guiyang",        "南宁": "Nanning",
    "海口": "Haikou",         "石家庄": "Shijiazhuang",
    "太原": "Taiyuan",        "哈尔滨": "Harbin",
    "长春": "Changchun",      "南昌": "Nanchang",
    "兰州": "Lanzhou",        "银川": "Yinchuan",
    "西宁": "Xining",         "乌鲁木齐": "Urumqi",
    "呼和浩特": "Hohhot",     "拉萨": "Lhasa",
    "义乌": "Yiwu",           "嘉兴": "Jiaxing",
    "温州": "Wenzhou",        "江门": "Jiangmen",
    "临沂": "Linyi",          "台州": "Taizhou",
    "绍兴": "Shaoxing",       "湖州": "Huzhou",
    "南通": "Nantong",        "常州": "Changzhou",
    "无锡": "Wuxi",           "徐州": "Xuzhou",
    "芜湖": "Wuhu",           "安庆": "Anqing",
    "蚌埠": "Bengbu",         "马鞍山": "Ma'anshan",
    "铜陵": "Tongling",       "黄山": "Huangshan",
    "潍坊": "Weifang",        "烟台": "Yantai",
    "淄博": "Zibo",           "威海": "Weihai",
    "泰安": "Tai'an",         "济宁": "Jining",
    "绵阳": "Mianyang",       "德阳": "Deyang",
    "洛阳": "Luoyang",        "开封": "Kaifeng",
    "珠海": "Zhuhai",         "惠州": "Huizhou",
    "中山": "Zhongshan",      "湛江": "Zhanjiang",
    "昆山": "Kunshan",        "三亚": "Sanya",
    "保定": "Baoding",        "沧州": "Cangzhou",
    "邢台": "Xingtai",        "邯郸": "Handan",
    "廊坊": "Langfang",       "唐山": "Tangshan",
    "桂林": "Guilin",         "三亚": "Sanya",
    "吉安": "Ji'an",          "赣州": "Ganzhou",
    "景德镇": "Jingdezhen",   "武夷山": "Wuyishan",
    "榆林": "Yulin",          "哈密": "Hami",
    "巴彦淖尔": "Bayannur",   "赤峰": "Chifeng",
    "吉林": "Jilin",          "鞍山": "Anshan",
    "淮安": "Huai'an",        "邵东": "Shaodong",
    "澳门": "Macau",          "台北": "Taipei",
    "高雄": "Kaohsiung",
    
    # 遗漏城市（运行时发现）
    "扬州": "Yangzhou",      "金华": "Jinhua",
    "菏泽": "Heze",          "泸州": "Luzhou",
    "宝鸡": "Baoji",         "顺德": "Shunde",
    "盐城": "Yancheng",      "漳州": "Zhangzhou",
    "漯河": "Luohe",         "淮南": "Huainan",
    "泰州": "Taizhou",       "株洲": "Zhuzhou",
    "柳州": "Liuzhou",       "昌吉": "Changji",
    "新乡": "Xinxiang",      "宜春": "Yichun",
    "东营": "Dongying",
    # 省份作 city 兜底
    "台湾": "Taiwan",        "内蒙古": "Inner Mongolia",
    "新疆": "Xinjiang",      "福建": "Fujian",
    "广东": "Guangdong",     "山东": "Shandong",
    "贵州": "Guizhou",       "西藏": "Tibet",
    "湖南": "Hunan",         "浙江": "Zhejiang",
    "河北": "Hebei",         "江苏": "Jiangsu",
    "广西": "Guangxi",       "山西": "Shanxi",
    "安徽": "Anhui",         "四川": "Sichuan",
    
    # 修复截断的城市名
    "木齐": "Urumqi",         # 乌鲁木齐截断
    "浩特": "Hohhot",         # 呼和浩特截断
    "淖尔": "Bayannur",       # 巴彦淖尔截断
    "贝尔": "Harbin",         # 可能是贝尔格莱德或哈尔滨相关
    
    # 海外城市
    "东京": "Tokyo",          "巴黎": "Paris",
    "慕尼黑": "Munich",       "拉斯维加斯": "Las Vegas",
    "杜塞尔多夫": "Düsseldorf","法兰克福": "Frankfurt",
    "科隆": "Cologne",        "米兰": "Milan",
    "纽约": "New York",       "芝加哥": "Chicago",
    "迪拜": "Dubai",          "阿布扎比": "Abu Dhabi",
    "埃森": "Essen",         "多斯": "Dos",
}

PROVINCE_MAP = {
    "山东": "Shandong",       "江苏": "Jiangsu",
    "浙江": "Zhejiang",       "广东": "Guangdong",
    "福建": "Fujian",         "河北": "Hebei",
    "河南": "Henan",          "湖北": "Hubei",
    "湖南": "Hunan",          "四川": "Sichuan",
    "安徽": "Anhui",          "江西": "Jiangxi",
    "贵州": "Guizhou",        "云南": "Yunnan",
    "山西": "Shanxi",         "陕西": "Shaanxi",
    "甘肃": "Gansu",          "青海": "Qinghai",
    "辽宁": "Liaoning",       "吉林": "Jilin",
    "黑龙江": "Heilongjiang", "海南": "Hainan",
    "台湾": "Taiwan",         "内蒙古": "Inner Mongolia",
    "广西": "Guangxi",        "西藏": "Tibet",
    "宁夏": "Ningxia",        "新疆": "Xinjiang",
}

COUNTRY_MAP = {
    "中国": "China",          "美国": "United States",
    "日本": "Japan",          "韩国": "South Korea",
    "德国": "Germany",        "法国": "France",
    "英国": "United Kingdom", "意大利": "Italy",
    "俄罗斯": "Russia",       "巴西": "Brazil",
    "印度": "India",          "印尼": "Indonesia",
    "越南": "Vietnam",        "泰国": "Thailand",
    "马来西亚": "Malaysia",   "新加坡": "Singapore",
    "澳大利亚": "Australia",  "加拿大": "Canada",
    "墨西哥": "Mexico",       "土耳其": "Turkey",
    "波兰": "Poland",         "沙特": "Saudi Arabia",
    "阿联酋": "UAE",          "埃及": "Egypt",
    "南非": "South Africa",   "瑞士": "Switzerland",
    "荷兰": "Netherlands",    "西班牙": "Spain",
    "菲律宾": "Philippines",  "瑞士": "Switzerland",
}

# 国内城市列表（用于推断 country）
CN_CITIES = {k for k in CITY_MAP if CITY_MAP.get(k) not in 
    ["Tokyo", "Paris", "Munich", "Las Vegas", "Düsseldorf", "Frankfurt",
     "Cologne", "Milan", "New York", "Chicago", "Dubai", "Abu Dhabi", 
     "Essen", "Dos"]}

# 海外城市列表
OVERSEAS_CITIES = {
    "东京": "日本", "巴黎": "法国", "慕尼黑": "德国",
    "拉斯维加斯": "美国", "杜塞尔多夫": "德国", "法兰克福": "德国",
    "科隆": "德国", "米兰": "意大利", "纽约": "美国",
    "芝加哥": "美国", "迪拜": "阿联酋", "阿布扎比": "阿联酋",
    "埃森": "德国", "多斯": "多斯",
}


def parse_notes(notes_text: str) -> dict:
    """解析 notes 中的地理标签"""
    result = {"city": None, "province": None, "country": None}
    if not notes_text:
        return result
    m = re.match(r'\[geo:[^\]]+\]\s*(.*)', notes_text)
    if not m:
        return result
    pairs = m.group(1).split(' ')
    for p in pairs:
        if '=' in p:
            k, v = p.split('=', 1)
            if k == 'city' and v != '':
                result['city'] = v
            elif k == 'province' and v != '':
                result['province'] = v
            elif k == 'country' and v != '':
                result['country'] = v
    return result


def get_city_en(city_cn: str) -> str:
    """获取英文城市名，处理多城市逗号分隔"""
    if not city_cn:
        return ''
    # 多城市取第一个
    first_city = city_cn.split(',')[0].strip()
    return CITY_MAP.get(first_city, '')


def infer_country(city_cn: str, province_cn: str, country_from_note: str) -> tuple:
    """推断国家（中英文）"""
    # 1. notes 中已有 country
    if country_from_note:
        return country_from_note, COUNTRY_MAP.get(country_from_note, country_from_note)
    
    # 2. 从城市推断
    if city_cn:
        first_city = city_cn.split(',')[0].strip()
        if first_city in OVERSEAS_CITIES:
            country_cn = OVERSEAS_CITIES[first_city]
            return country_cn, COUNTRY_MAP.get(country_cn, country_cn)
        if first_city in CN_CITIES or CITY_MAP.get(first_city) not in [
            "Tokyo", "Paris", "Munich", "Las Vegas", "Düsseldorf", "Frankfurt",
            "Cologne", "Milan", "New York", "Chicago", "Dubai", "Abu Dhabi", "Essen"]:
            return "中国", "China"
    
    # 3. 有省份 = 中国
    if province_cn:
        return "中国", "China"
    
    return '', ''


def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    cur = db.cursor()
    
    # 读取所有 brand
    cur.execute("""
        SELECT brand_id, name_cn, city, notes 
        FROM exhibition_brand
        WHERE notes IS NOT NULL AND notes != ''
    """)
    rows = cur.fetchall()
    
    print(f"处理 {len(rows)} 条品牌...")
    
    city_filled = 0
    city_existed = 0
    city_skipped = 0  # name:default
    bilingual_filled = 0
    
    updates = []
    
    for row in rows:
        geo = parse_notes(row['notes'])
        
        # Step 1: 反填 city
        new_city = row['city']  # 保留现有值
        current_city_empty = not new_city or new_city.strip() == ''
        
        if current_city_empty:
            if geo['city']:
                new_city = geo['city']
                city_filled += 1
            elif geo['province']:
                new_city = geo['province']  # 省份兜底
                city_filled += 1
            else:
                city_skipped += 1  # name:default 或仅有 country
        else:
            city_existed += 1
        
        # Step 2: 双语列
        city_en = get_city_en(new_city) if new_city else ''
        country_cn, country_en = infer_country(
            new_city, geo['province'], geo['country']
        )
        
        if city_en or country_cn:
            bilingual_filled += 1
        
        updates.append((
            new_city or '',
            city_en,
            country_cn,
            country_en,
            row['brand_id']
        ))
    
    # 批量写入
    cur.execute("BEGIN")
    for city_val, city_en_val, country_cn_val, country_en_val, brand_id in updates:
        cur.execute("""
            UPDATE exhibition_brand 
            SET city = ?, city_en = ?, country_cn = ?, country_en = ?
            WHERE brand_id = ?
        """, (city_val, city_en_val, country_cn_val, country_en_val, brand_id))
    cur.execute("COMMIT")
    
    print(f"\n写入完成:")
    print(f"  city 反填: {city_filled}")
    print(f"  city 已有跳过: {city_existed}")
    print(f"  无法确定跳过: {city_skipped}")
    print(f"  双语列填充: {bilingual_filled}")
    
    # 验证
    cur.execute("SELECT COUNT(*) FROM exhibition_brand WHERE city_en IS NOT NULL AND city_en != ''")
    en_filled = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM exhibition_brand WHERE country_cn IS NOT NULL AND country_cn != ''")
    country_filled = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM exhibition_brand")
    total = cur.fetchone()[0]
    
    print(f"\n验证:")
    print(f"  city_en 有值: {en_filled}/{total}")
    print(f"  country 有值: {country_filled}/{total}")
    
    # 检查 city_en 为空的海外城市
    cur.execute("""
        SELECT brand_id, name_cn, city FROM exhibition_brand 
        WHERE (city IS NOT NULL AND city != '') 
        AND (city_en IS NULL OR city_en = '')
        LIMIT 10
    """)
    missing_en = cur.fetchall()
    if missing_en:
        print(f"\ncity 有值但 city_en 为空 ({len(missing_en)} 条样本):")
        for r in missing_en:
            print(f"  [{r[0]}] {r[1][:40]} city='{r[2]}'")
    
    db.close()


if __name__ == "__main__":
    # 备份
    backup = f"mwlab_backup_pre_geo_{os.popen('date +%Y%m%d_%H%M%S').read().strip()}.db"
    os.system(f"cp {DB_PATH} {backup}")
    print(f"备份: {backup}")
    main()
    
    # Step 5: 清空 notes
    db2 = sqlite3.connect(DB_PATH)
    db2.execute("UPDATE exhibition_brand SET notes = ''")
    db2.commit()
    print("notes 已清空")
    db2.close()
