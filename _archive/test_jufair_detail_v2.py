"""
jufair.com 国内展会详情页爬取测试脚本 v2
功能：
  1. 随机翻页（国内展会列表），每页随机选1个展会
  2. 进入详情页采集全字段数据（基于实际DOM结构）
  3. 输出测试结果
"""

import requests
import random
import re
import time
import json
from bs4 import BeautifulSoup

BASE_URL = "https://www.jufair.com"
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
    """从国内展会列表页提取所有展会链接"""
    url = f"{BASE_URL}/exhibition-0-0-1-0-0-0-{page_num}/"
    print(f"\n{'='*60}")
    print(f"[列表页] 第 {page_num} 页: {url}")
    soup = get_soup(url)
    if not soup:
        return []

    links = []
    articles = soup.select(".exh-info-wrap")
    for art in articles:
        a_tag = art.select_one("h2 a")
        if a_tag and a_tag.get("href"):
            href = a_tag["href"]
            full_url = BASE_URL + href if href.startswith("/") else href
            name = a_tag.get_text(strip=True)
            links.append({"name": name[:60], "url": full_url})

    print(f"  找到 {len(links)} 个展会链接")
    return links


def scrape_detail(detail_url):
    """采集 jufair 详情页数据 — 基于实际HTML结构"""
    print(f"\n  [详情页] {detail_url}")
    soup = get_soup(detail_url)
    if not soup:
        return None

    data = {"source_url": detail_url}

    # --- 1. 中文名 ---
    h1 = soup.find("h1")
    if h1:
        name_span = h1.select_one(".detail_name")
        if name_span:
            data["chinese_name"] = name_span.get_text(strip=True)
        else:
            data["chinese_name"] = h1.get_text(strip=True)

    # --- 2. 英文名 ---
    en_span = soup.select_one(".detail_en")
    if en_span:
        en_text = en_span.get_text(strip=True)
        if en_text:
            data["english_name"] = en_text

    # --- 3. 日期 ---
    time_tag = soup.find("time")
    if time_tag:
        data["date"] = time_tag.get_text(strip=True)

    # --- 4. 展馆名称（详情页专用链接）---
    # 注意：nav里有 /pavilion/ 的通用链接，要排除
    # 详情页的 venue 链接是 <a href="/pavilion/数字.html">
    venue_link = soup.select_one("a[href*='/pavilion/'][href*='.html']")
    if venue_link:
        data["venue"] = venue_link.get_text(strip=True)

    # --- 5/6/7. 统计数据 + 周期 ---
    # 结构: <dl><dd>值</dd><dt>标签</dt></dl>  (dd在dt前面!)
    all_dls = soup.find_all("dl")
    for dl in all_dls:
        dt = dl.find("dt")
        dd = dl.find("dd")
        if not dt or not dd:
            continue
        label = dt.get_text(strip=True)
        value = dd.get_text(strip=True)

        if label == "举办周期":
            data["cycle"] = value
        elif label == "展览面积":
            data["area"] = value
        elif label == "展商数量":
            data["exhibitors"] = value
        elif label == "观众数量":
            data["visitors"] = value

    # --- 8/9/10. 主办单位 / 所属行业 / 展馆地址 ---
    # 结构: <dl class="content-line"><dt>标签:</dt><dd>值</dd></dl>
    content_dls = soup.select("dl.content-line")
    for dl in content_dls:
        dt = dl.find("dt")
        dd = dl.find("dd")
        if not dt or not dd:
            continue
        label = dt.get_text(strip=True).rstrip(":")
        value = dd.get_text(strip=True)

        if "主办单位" in label:
            data["organizer"] = value
        elif "所属行业" in label:
            # 行业可能包含多个链接
            industry_links = dd.find_all("a")
            if industry_links:
                data["industry"] = ", ".join(a.get_text(strip=True) for a in industry_links)
            else:
                data["industry"] = value
        elif "展馆地址" in label:
            data["venue_address"] = value
        elif "举办城市" in label:
            data["city"] = value
        elif "举办展馆" in label:
            if "venue" not in data or not data["venue"]:
                data["venue"] = value

    # 打印结果
    print(f"    中文名: {data.get('chinese_name', 'N/A')}")
    print(f"    英文名: {data.get('english_name', 'N/A')}")
    print(f"    日  期: {data.get('date', 'N/A')}")
    print(f"    展  馆: {data.get('venue', 'N/A')}")
    print(f"    地  址: {data.get('venue_address', 'N/A')}")
    print(f"    城  市: {data.get('city', 'N/A')}")
    print(f"    面  积: {data.get('area', 'N/A')}")
    print(f"    展  商: {data.get('exhibitors', 'N/A')}")
    print(f"    观  众: {data.get('visitors', 'N/A')}")
    print(f"    周  期: {data.get('cycle', 'N/A')}")
    print(f"    主办方: {data.get('organizer', 'N/A')}")
    print(f"    行  业: {data.get('industry', 'N/A')}")

    return data


def main():
    total_pages = 20
    sample_size = 5

    print("=" * 60)
    print("jufair.com 国内展会详情页爬取测试 v2")
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

        detail = scrape_detail(chosen["url"])
        if detail:
            all_results.append(detail)

        time.sleep(random.uniform(1, 2))

    print("\n" + "=" * 60)
    print(f"测试完成！成功采集 {len(all_results)}/{len(test_pages)} 个详情页")
    print("=" * 60)

    if all_results:
        output_path = "/Volumes/databoard/AI Project/D_dashboard/test_jufair_detail_result.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n结果已保存: {output_path}")

        fields = ["chinese_name", "english_name", "date", "venue", "venue_address",
                   "city", "area", "exhibitors", "visitors", "cycle", "organizer", "industry"]
        for field in fields:
            hit = sum(1 for r in all_results if field in r and r[field])
            print(f"  {field}: {hit}/{len(all_results)} 条有数据")

    print("\n测试结束")


if __name__ == "__main__":
    main()
