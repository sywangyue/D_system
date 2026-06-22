#!/usr/bin/env python3
"""
Jufair 主办方批量回填脚本（自洽版）
- 从 mwlab.db 读取缺失 organizer 的 jufair 品牌
- 用 opencli browser 逐页提取主办方
- 断点续跑（checkpoint 文件）
- 最终输出汇总到 stdout（供 cron 发送）

用法: python3 scripts/backfill_organizer.py

注意: 本脚本为远端/cron 场景设计（无 CLI 参数，hardcoded 路径，checkpoint 文件断点续跑）。
      本地交互场景请使用 tools/backfill_organizer_local.py（支持 --dry-run/--delay/--start/--limit，
      读 CSV 中间层，opencli --tab page_id 方式调用，同时写 manual_tag_history 审计表）。
"""

import sqlite3
import subprocess
import json
import time
import sys
import os
import re
from datetime import datetime

# === 配置 ===
DB_PATH = "/Volumes/databoard/AI Project/D_dashboard/data/mwlab.db"
CHECKPOINT_FILE = "/Volumes/databoard/AI Project/D_dashboard/scripts/organizer_checkpoint.txt"
SESSION_NAME = "jufair_backfill"
PAGE_DELAY = 3  # 页面加载等待秒数
INTER_PAGE_DELAY = 2  # 页面间延迟秒数
OPEN_TIMEOUT = 20
EVAL_TIMEOUT = 15

# === 初始化 ===
def init_session():
    """确保浏览器 session 就绪"""
    # 如果已有 session，先关闭
    subprocess.run(["opencli", "browser", SESSION_NAME, "close"],
                   capture_output=True, timeout=5)

def extract_organizer(url):
    """打开 Jufair 页面并提取主办方，返回 (organizer_str | None)"""
    # 打开页面
    r = subprocess.run(
        ["opencli", "browser", SESSION_NAME, "open", url],
        capture_output=True, text=True, timeout=OPEN_TIMEOUT
    )
    if r.returncode != 0:
        print(f"  [WARN] open failed: {r.stderr[:80]}", file=sys.stderr)
        return None
    
    time.sleep(PAGE_DELAY)
    
    # 提取主办方
    js_code = 'JSON.stringify({organizer: (document.body.innerText.match(/主办单位:\\s*\\n?\\s*(.+?)(\\n|$)/) || [])[1] || null})'
    r = subprocess.run(
        ["opencli", "browser", SESSION_NAME, "eval", js_code],
        capture_output=True, text=True, timeout=EVAL_TIMEOUT
    )
    if r.returncode != 0:
        print(f"  [WARN] eval failed: {r.stderr[:80]}", file=sys.stderr)
        return None
    
    # 解析 JSON
    for line in r.stdout.strip().split('\n'):
        line = line.strip()
        if line.startswith('{'):
            try:
                data = json.loads(line)
                org = data.get('organizer')
                if org:
                    # 清理：去首尾空白，去可能的 HTML 残留
                    org = org.strip()
                    org = re.sub(r'<[^>]+>', '', org)
                return org if org else None
            except json.JSONDecodeError:
                continue
    return None


def load_checkpoint():
    """读取已处理的 brand_id 集合"""
    done = set()
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE) as f:
            for line in f:
                line = line.strip()
                if line:
                    done.add(line)
    return done


def save_checkpoint(brand_id):
    """追加一条 checkpoint"""
    with open(CHECKPOINT_FILE, 'a') as f:
        f.write(f"{brand_id}\n")


def get_pending_urls(conn, done_ids):
    """获取待处理的 URL 列表"""
    if done_ids:
        placeholders = ','.join(['?' for _ in done_ids])
        sql = f"""SELECT DISTINCT dp.source_url, b.brand_id, b.name_cn
FROM data_provenance dp
JOIN exhibition_brand b ON dp.brand_id = b.brand_id
WHERE dp.source_site = 'jufair'
  AND (b.organizer IS NULL OR b.organizer = '')
  AND b.brand_id NOT IN ({placeholders})
ORDER BY b.brand_id"""
        cursor = conn.execute(sql, list(done_ids))
    else:
        sql = """SELECT DISTINCT dp.source_url, b.brand_id, b.name_cn
FROM data_provenance dp
JOIN exhibition_brand b ON dp.brand_id = b.brand_id
WHERE dp.source_site = 'jufair'
  AND (b.organizer IS NULL OR b.organizer = '')
ORDER BY b.brand_id"""
        cursor = conn.execute(sql)
    
    return cursor.fetchall()


def main():
    start_time = datetime.now()
    
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    
    # 读取断点
    done_ids = load_checkpoint()
    
    # 获取待处理列表
    pending = get_pending_urls(conn, done_ids)
    total = len(pending)
    
    if total == 0:
        print("所有 jufair 品牌已完成 organizer 回填，无需处理。")
        conn.close()
        return
    
    print(f"开始回填: {total} 个品牌待处理")
    print(f"起始时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"断点续跑: 已跳过 {len(done_ids)} 个")
    print()
    
    # 初始化浏览器 session
    init_session()
    
    success = 0
    empty = 0  # 页面无主办方
    error = 0  # 技术错误
    processed = 0
    
    for url, brand_id, name_cn in pending:
        processed += 1
        short_name = name_cn[:40] if len(name_cn) > 40 else name_cn
        
        # 进度输出
        if processed % 50 == 0 or processed == 1:
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = processed / max(elapsed, 1) * 60  # per minute
            eta_min = (total - processed) / max(rate, 0.01)
            print(f"[{processed}/{total}] ({processed*100//total}%) "
                  f"速率 {rate:.1f}/min, 预计剩余 {eta_min:.0f}min")
        
        organizer = extract_organizer(url)
        
        if organizer is None and error < 10:  # 前几次错误可能是 session 问题
            # 重试一次
            time.sleep(5)
            organizer = extract_organizer(url)
        
        if organizer:
            conn.execute(
                "UPDATE exhibition_brand SET organizer = ?, updated_at = datetime('now','localtime') WHERE brand_id = ?",
                (organizer, brand_id)
            )
            conn.commit()
            success += 1
        elif organizer == '':  # 空字符串（页面有这个字段但值为空）
            # 有些 jufair 页面主办方字段就是空的，标记待补充
            # 但我们需要区分"页面没有这个信息"和"提取失败"
            # 页面确实有"主办单位:"标签但后面为空 → 标记待补充
            empty += 1
        else:
            # 提取失败（技术错误），不标记，下次重跑
            error += 1
            print(f"  [ERR] {brand_id} {short_name} 提取失败，跳过", file=sys.stderr)
        
        # 保存断点
        save_checkpoint(brand_id)
        
        # 页面间延迟
        time.sleep(INTER_PAGE_DELAY)
    
    # 关闭 session
    subprocess.run(["opencli", "browser", SESSION_NAME, "close"],
                   capture_output=True, timeout=5)
    
    # 汇总
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # 最终统计
    still_missing = conn.execute(
        "SELECT COUNT(*) FROM exhibition_brand WHERE organizer IS NULL OR organizer = ''"
    ).fetchone()[0]
    
    conn.close()
    
    # 删除 checkpoint（全部完成）
    if error == 0:
        os.remove(CHECKPOINT_FILE)
    
    print()
    print("=" * 60)
    print("Jufair 主办方回填完成")
    print("=" * 60)
    print(f"总耗时: {duration/60:.1f} 分钟")
    print(f"本次处理: {processed} 个品牌")
    print(f"提取成功: {success}")
    print(f"页面无主办方: {empty}")
    print(f"技术错误: {error}")
    print(f"数据库仍缺失: {still_missing}")
    print(f"完成时间: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
