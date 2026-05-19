#!/usr/bin/env python3
"""批量测试：从 Jufair 页面提取主办方信息"""
import subprocess, json, re, time, sys

URLS = [
    ("https://www.jufair.com/exhibition/517.html", "EXPO-3781", "印度孟买化学品仓储物流展览会"),
    ("https://www.jufair.com/exhibition/7351.html", "EXPO-5461", "深圳国际酒店用品及餐饮业展览会"),
    ("https://www.jufair.com/exhibition/10215.html", "EXPO-4527", "俄罗斯欧洲鞋首发系列展览会"),
    ("https://www.jufair.com/exhibition/9899.html", "EXPO-4555", "柬埔寨金边畜牧及家禽展览会"),
    ("https://www.jufair.com/exhibition/353.html", "EXPO-4162", "马来西亚食品包装与加工设备展览会"),
    ("https://www.jufair.com/exhibition/9990.html", "EXPO-3577", "德国国土安全与警用装备展览会"),
    ("https://www.jufair.com/exhibition/9207.html", "EXPO-4779", "哈萨克斯坦智慧城市技术展览会"),
    ("https://www.jufair.com/exhibition/2106.html", "EXPO-5532", "墨西哥瓜达拉哈拉殡仪殡葬展览会"),
    ("https://www.jufair.com/exhibition/4926.html", "EXPO-4244", "越南胡志明医疗器械及制药展览会"),
    ("https://www.jufair.com/exhibition/6222.html", "EXPO-4308", "印度丝网印刷展览会"),
    ("https://www.jufair.com/exhibition/16480.html", "EXPO-4588", "沙特利雅得人工智能展览会"),
    ("https://www.jufair.com/exhibition/3287.html", "EXPO-4890", "上海国际广告新科技秋交会"),
    ("https://www.jufair.com/exhibition/4787.html", "EXPO-2870", "菲律宾车展"),
    ("https://www.jufair.com/exhibition/10263.html", "EXPO-3214", "亚洲建筑及装饰联展-上海室内空间六面一体化展"),
    ("https://www.jufair.com/exhibition/9548.html", "EXPO-4885", "上海国际智慧显示及数字标牌展"),
    ("https://www.jufair.com/exhibition/701.html", "EXPO-5655", "美国金属加工、金属成型及焊接展览会"),
    ("https://www.jufair.com/exhibition/341.html", "EXPO-5212", "印度宝马展 - 印度新德里工程机械展"),
    ("https://www.jufair.com/exhibition/9864.html", "EXPO-3496", "西班牙巴塞罗那成人用品展Erospain"),
    ("https://www.jufair.com/exhibition/8981.html", "EXPO-4099", "广州国际卫浴博览会-广州卫博会"),
    ("https://www.jufair.com/exhibition/8687.html", "EXPO-4681", "俄罗斯莫斯科内衣展览会"),
]

ESCAPED_JS = """JSON.stringify({organizer: (document.body.innerText.match(/主办单位:\\s*\\n?\\s*(.+?)(\\n|$)/) || [])[1] || null})"""
# 注意：shell 里单引号内的 ! 和 \ 会有问题，用 Python 的子进程传参更安全

def extract(url):
    """打开 Jufair 页面并提取主办方"""
    # 打开页面
    r = subprocess.run(
        ["opencli", "browser", "jufair", "open", url],
        capture_output=True, text=True, timeout=20
    )
    if r.returncode != 0:
        return f"ERROR_OPEN: {r.stderr[:100]}"
    
    time.sleep(3)  # 等页面加载
    
    # 提取主办方
    js_code = 'JSON.stringify({organizer: (document.body.innerText.match(/主办单位:\\s*\\n?\\s*(.+?)(\\n|$)/) || [])[1] || null})'
    r = subprocess.run(
        ["opencli", "browser", "jufair", "eval", js_code],
        capture_output=True, text=True, timeout=15
    )
    if r.returncode != 0:
        return f"ERROR_EVAL: {r.stderr[:100]}"
    
    # 解析 JSON 输出（可能有 warning 行混入）
    for line in r.stdout.strip().split('\n'):
        line = line.strip()
        if line.startswith('{'):
            try:
                data = json.loads(line)
                return data.get('organizer') or '未找到(页面无主办方)'
            except json.JSONDecodeError:
                continue
    return f"PARSE_ERROR: {r.stdout[:200]}"

def main():
    success = 0
    empty = 0
    error = 0
    
    print(f"{'brand_id':<12} {'名称':<35} {'主办方':<40} {'状态'}")
    print("-" * 100)
    
    for url, brand_id, name in URLS:
        # 缩短名称
        short_name = name[:32] if len(name) > 32 else name
        result = extract(url)
        
        if result.startswith('ERROR') or result.startswith('PARSE'):
            status = "❌ 错误"
            error += 1
        elif result == '未找到(页面无主办方)':
            status = "⚠️  页面无"
            empty += 1
        else:
            status = "✅"
            success += 1
        
        print(f"{brand_id:<12} {short_name:<35} {result:<40} {status}")
        sys.stdout.flush()
        time.sleep(2)  # 页面间延迟
    
    print("-" * 100)
    print(f"总结: 成功 {success}, 页面无主办方 {empty}, 错误 {error}, 共 {len(URLS)}")

if __name__ == '__main__':
    main()
