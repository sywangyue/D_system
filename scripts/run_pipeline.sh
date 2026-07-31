#!/bin/bash
# run_pipeline.sh — 每月 7 / 27 号的全流程：采集 → 合并 → 分类 → 状态 → 展示池 → 去重复核表
#
# 由 crontab 调用。cron 的 PATH 极简，所有解释器/二进制一律用绝对路径。
#
# 刻意不包含的两步：
#   scripts/geo_backfill.py   无条件覆盖 country_cn（会撤销人工修正）、结尾清空全表 notes，
#                             且在 CWD 乱丢 19MB 备份 —— 一次性治理脚本，不可重入
#   scripts/dedup.py --execute  品牌合并不可逆，只产出复核 CSV，由人工过完再执行

set -uo pipefail

PROJ="/Volumes/databoard/AI Project/D_dashboard"
PY="/Library/Frameworks/Python.framework/Versions/3.12/bin/python3"
# 输出重定向到文件时 Python 默认块缓冲，采集要跑几十分钟却看不到进度 —— 关掉缓冲
export PYTHONUNBUFFERED=1
BATCH="auto-$(date +%Y%m%d)"
LOG_DIR="$PROJ/logs"
LOG="$LOG_DIR/pipeline_${BATCH}.log"
LOCK="$LOG_DIR/.pipeline.lock"
BACKUP="$PROJ/data/backups/mwlab_${BATCH}_pre_pipeline.db"

mkdir -p "$LOG_DIR" "$PROJ/data/backups" "$PROJ/exports"
cd "$PROJ" || exit 1

# ── 互斥锁：mkdir 是原子操作（macOS 无 flock）。上一轮没跑完就直接退出。
if ! mkdir "$LOCK" 2>/dev/null; then
    echo "[$(date '+%F %T')] 上一轮 pipeline 仍在运行（$LOCK 存在），本次跳过" >> "$LOG"
    exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

exec >> "$LOG" 2>&1
echo "=========================================================="
echo "[$(date '+%F %T')] pipeline 开始  batch=$BATCH"
echo "=========================================================="

# ── 改库前备份，只保留最近 10 份
cp "$PROJ/data/mwlab.db" "$BACKUP" || { echo "[FATAL] 备份失败，中止"; exit 1; }
echo "[$(date '+%F %T')] 已备份 -> $BACKUP"
ls -1t "$PROJ"/data/backups/mwlab_auto-*_pre_pipeline.db 2>/dev/null | tail -n +11 | while read -r f; do
    rm -f "$f" && echo "  清理旧备份: $(basename "$f")"
done

FAILED=""

# 采集/合并属于关键步骤：失败就中止。否则后续步骤基于未更新的数据跑完，
# 还会产出一份看似正常、实则不含新数据的复核表 —— 比直接失败更误导人。
die() {
    echo ""
    echo "=========================================================="
    echo "[$(date '+%F %T')] 关键步骤失败，中止后续步骤:$FAILED"
    echo "  数据库可回滚: cp '$BACKUP' '$PROJ/data/mwlab.db'"
    echo "=========================================================="
    echo "[$BATCH]$FAILED (关键步骤，已中止)  见 $LOG" >> "$LOG_DIR/pipeline_failures.log"
    exit 1
}

run_step() {
    local name="$1"; shift
    echo ""
    echo "---- [$(date '+%F %T')] $name ----"
    if "$@"; then
        echo "---- [$(date '+%F %T')] $name 完成 ----"
    else
        local code=$?
        echo "---- [$(date '+%F %T')] $name 失败 (exit $code) ----"
        FAILED="$FAILED $name"
        return $code
    fi
}

# 1. 采集：--refresh 让已存在记录也走 UPSERT，源站改档期才能同步进来
run_step "1/6 jufair 采集" \
    "$PY" crawlers/jufair_crawler.py --all --detail --refresh --batch-id "$BATCH" || die

# 2. 合并：只合本批次。传 ALL 会触发全表 O(N²) 模糊匹配（9129×7179 次比对）
run_step "2/6 合并进主库" \
    "$PY" tools/merge_engine.py --batch "$BATCH" || die

# 3. 自动分类：--only-empty 避免覆盖已收敛的 industry_l1/l2 与人工修正
run_step "3/6 行业分类" \
    "$PY" scripts/classify_all_brands.py --only-empty

# 4. 届次状态按日期派生
run_step "4/6 刷新届次状态" \
    "$PY" scripts/refresh_edition_status.py

# 5. 展示池
run_step "5/6 重算展示池" \
    "$PY" scripts/check_display_ready.py

# 6. 产出本轮去重复核表，等人工过
run_step "6/6 导出去重复核表" \
    "$PY" tools/export_dedup_review.py -o "exports/dedup_review_${BATCH}.csv"

echo ""
echo "=========================================================="
if [ -n "$FAILED" ]; then
    echo "[$(date '+%F %T')] pipeline 结束，失败步骤:$FAILED"
    echo "  数据库可回滚: cp '$BACKUP' '$PROJ/data/mwlab.db'"
    # 失败摘要单独落一个文件，方便一眼扫到（主日志太长）
    echo "[$BATCH]$FAILED  见 $LOG" >> "$LOG_DIR/pipeline_failures.log"
    exit 1
fi
echo "[$(date '+%F %T')] pipeline 全部完成"
echo "  待人工复核: exports/dedup_review_${BATCH}.csv"
echo "=========================================================="
