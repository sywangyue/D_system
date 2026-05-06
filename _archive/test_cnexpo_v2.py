"""
cnexpo.com 国内展会爬取测试脚本 v2
功能：
  1. 随机翻页（前20页），每页随机选1个展会
  2. 进入详情页采集全字段数据（基于精确DOM定位）
  3. 输出测试结果
"""

import requests
import random
import re
import time
import json
from pathlib import Path

from bs4 import BeautifulSoup

BASE_URL = "https://www.cnexpo.com"
_REPO = Path(__file__).resolve().parent.parent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36"
}


def get_soup(url):
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.encoding = 'utf-8'
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, 'html.parser')
            print(f"  [!] HTTP {resp.status_code}")
        except Exception as e:
            print(f"  [!] 请求失败 (attempt {attempt+1}): {e}")
            time.sleep(2)
    return None


def extract_list_page(page_num):
    """从列表页提取所有展会链接"""
    url = f"{BASE_URL}/events/1000/0/{page_num}"
    print(f"\n{'='*60}")
    print(f"[列表页] 第 {page_num} 页: {url}")
    soup = get_soup(url)
    if not soup:
        return []

    links = []
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        if re.match(r'^/event/\d+(\.html)?$', href):
            full_url = BASE_URL + href
            text = a_tag.get_text(strip=True)
            if text and len(text) > 4 and full_url not in [l['url'] for l in links]:
                links.append({'name': text[:60], 'url': full_url})

    print(f"  找到 {len(links)} 个展会链接")
    return links


def scrape_detail(detail_url):
    """采集详情页数据 — 基于精确DOM定位"""
    print(f"\n  [详情页] {detail_url}")
    soup = get_soup(detail_url)
    if not soup:
        return None

    data = {'source_url': detail_url}

    # 获取所有<p>标签文本（前30个）
    paragraphs = []
    for p in soup.find_all('p'):
        t = p.get_text(strip=True)
        if t:
            paragraphs.append(t)

    # p[0]/[1] 通常是 "企业微信""新浪微博""等导航
    # p[2]～p[5] 是核心信息区（所有页面结构一致）
    # ──────────────────────────────

    # --- 1. 名称：从多个来源提取 ---
    # 优先从 h1 获取
    h1 = soup.find('h1')
    if h1:
        data['chinese_name'] = h1.get_text(strip=True)
    else:
        title_tag = soup.find('title')
        if title_tag:
            t = title_tag.get_text(strip=True)
            t = re.sub(r'-中国会展网$', '', t).strip()
            data['chinese_name'] = t

    # 页面文本全量（用于正则搜索）
    page_text = '\n'.join(paragraphs)

    # --- 2. 日期 ---
    # p[2]: "2025.06.03 - 06.05 开闭馆时间：08:30:00 - 17:00:00"
    date_str = ""
    if len(paragraphs) > 2:
        date_str = paragraphs[2]
        # 提取 "2025.06.03 - 06.05"
        m = re.search(r'(\d{4}\.\d{2}\.\d{2}\s*-\s*\d{2}\.\d{2})', date_str)
        if m:
            data['date'] = m.group(1)

    # --- 3. 展馆名称 ---
    # p[3]: " 上海-上海 上海新国际博览中心" 或 " 河南-郑州 郑州国际会展中心"
    if len(paragraphs) > 3:
        venue_line = paragraphs[3]
        # 去掉图标和地区前缀，提取场馆名
        # "上海-上海 上海新国际博览中心" → "上海新国际博览中心"
        # "河南-郑州 郑州国际会展中心" → "郑州国际会展中心"
        # 先去掉开头的图标
        venue_line = re.sub(r'^[\s]+', '', venue_line)
        # 格式: "省份-城市 场馆名" 或 "城市-城市 场馆名"
        m = re.search(r'(?:[\u4e00-\u9fff]+-[\u4e00-\u9fff]+\s+)?(.+)', venue_line)
        if m and m.group(1):
            data['venue'] = m.group(1).strip()

    # --- 4. 主办单位 ---
    # p[4]: "主办单位：河南省煤炭学会，河南华威展览服务有限公司"
    if len(paragraphs) > 4:
        m = re.search(r'主办单位[：:](.+)', paragraphs[4])
        if m:
            data['organizer'] = m.group(1).strip()

    # --- 5/6/7. 统计数据 ---
    # p[5]: "举办周期：1年1届 会展面积：22,000平方米展商数量：280家观众数量：30,000人"
    # 全部连写无分隔符! 需要用正则逐个匹配
    if len(paragraphs) > 5:
        stats_line = paragraphs[5]
        m_area = re.search(r'会展面积[：:]\s*([\d,]+平方米)', stats_line)
        if m_area:
            data['area'] = '面积:' + m_area.group(1)

        m_exh = re.search(r'展商数量[：:]\s*([\d,]+家)', stats_line)
        if m_exh:
            data['exhibitors'] = '展商:' + m_exh.group(1)

        m_vis = re.search(r'观众数量[：:]\s*([\d,]+人)', stats_line)
        if m_vis:
            data['visitors'] = '观众:' + m_vis.group(1)

        m_cyc = re.search(r'举办周期[：:]\s*([^\s]+)', stats_line)
        if m_cyc:
            data['cycle'] = m_cyc.group(1)

    # --- 8. 英文名（在"会展介绍"区域）---
    # 通常在中文名后面的独立<p>段落
    # 在 description 区域找："Shanghai International Artificial Intelligence Exhibition 2026"
    eng_pattern = r'([A-Z][A-Za-z\s/&\-,]+(?:Expo|Exhibition|Fair|Show|Conference|Summit)[A-Za-z\s/&\-,0-9]*)'
    eng_m = re.search(eng_pattern, page_text)
    if eng_m:
        eng = eng_m.group(1).strip()
        # 排除明显不是英文名的长句（含中文、超过100字符的）
        if len(eng) > 8 and not re.search(r'[\u4e00-\u9fff]', eng) and len(eng) < 100:
            data['english_name'] = eng

    # 打印结果
    print(f"    中文名: {data.get('chinese_name', 'N/A')}")
    print(f"    英文名: {data.get('english_name', 'N/A')}")
    print(f"    日  期: {data.get('date', 'N/A')}")
    print(f"    展  馆: {data.get('venue', 'N/A')}")
    print(f"    面  积: {data.get('area', 'N/A')}")
    print(f"    展  商: {data.get('exhibitors', 'N/A')}")
    print(f"    观  众: {data.get('visitors', 'N/A')}")
    print(f"    主办方: {data.get('organizer', 'N/A')}")
    print(f"    周  期: {data.get('cycle', 'N/A')}")

    return data


def main():
    total_pages = 20
    sample_size = 5

    print("=" * 60)
    print("cnexpo.com 国内展会爬取测试 v2")
    print(f"范围：前 {total_pages} 页，每页随机选1个，共采 {sample_size} 个")
    print("=" * 60)

    test_pages = random.sample(range(1, total_pages + 1), min(sample_size, total_pages))
    test_pages.sort()

    all_results = []

    for page_num in test_pages:
        links = extract_list_page(page_num)
        if not links:
            continue

        chosen = random.choice(links)
        print(f"  → 随机选中: {chosen['name']}")

        detail = scrape_detail(chosen['url'])
        if detail:
            all_results.append(detail)

        time.sleep(random.uniform(1, 2))

    print("\n" + "=" * 60)
    print(f"测试完成！成功采集 {len(all_results)}/{len(test_pages)} 个详情页")
    print("=" * 60)

    if all_results:
        output_path = str(_REPO / "test_cnexpo_result.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n结果已保存: {output_path}")

        fields = ['chinese_name', 'english_name', 'date', 'venue', 'area', 'exhibitors', 'visitors', 'organizer', 'cycle']
        for field in fields:
            hit = sum(1 for r in all_results if field in r and r[field])
            print(f"  {field}: {hit}/{len(all_results)} 条有数据")

    print("\n测试结束")


if __name__ == '__main__':
    main()
