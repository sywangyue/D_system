#!/bin/bash
# ralph.sh — AM MEDICAL 背调自治循环
# 用法: ./ralph.sh [max_iterations]   默认 30 轮
# 每轮用 fresh context 启动 claude code，做一个 story，做完即停，循环续接
# 状态全部存外部文件：findings/ + progress.txt + prd.json

set -e
MAX_ITERATIONS="${1:-30}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# 初始化
mkdir -p "$SCRIPT_DIR/findings" "$SCRIPT_DIR/outputs"
[ -f "$PROGRESS_FILE" ] || cat > "$PROGRESS_FILE" <<'EOF'
## 已知线索（每轮先读这里）
（空，待填充）

## 卡点记录
（空）

## 复用模式
（空）
EOF

echo "=== AM MEDICAL 背调循环启动，最多 $MAX_ITERATIONS 轮 ==="

for i in $(seq 1 "$MAX_ITERATIONS"); do
  echo ""
  echo "========== 第 $i / $MAX_ITERATIONS 轮 =========="

  # 检查是否全部完成
  REMAINING=$(jq '[.userStories[] | select(.passes==false)] | length' "$PRD_FILE")
  echo "剩余未完成 story: $REMAINING"
  if [ "$REMAINING" -eq 0 ]; then
    echo "=== 所有 story 完成，循环退出 ==="
    break
  fi

  # 用 fresh context 启动 claude code，喂 CLAUDE.md 作为指令
  # --dangerously-skip-permissions 让其在循环中无需人工确认（仅限只读/写本地）
  cat "$SCRIPT_DIR/CLAUDE.md" | claude --print --dangerously-skip-permissions 2>&1 | tee "$SCRIPT_DIR/findings/iter_${i}.log"

  # 检测完成信号
  if grep -q "<promise>COMPLETE</promise>" "$SCRIPT_DIR/findings/iter_${i}.log"; then
    echo "=== 收到 COMPLETE 信号，循环退出 ==="
    break
  fi

  # 轮间短暂休息，避免 API 限速
  sleep 5
done

echo ""
echo "=== 循环结束。完成进度: ==="
jq '.userStories[] | {id, title, passes}' "$PRD_FILE"
echo ""
echo "=== 最终报告应位于: outputs/ ==="
ls -la "$SCRIPT_DIR/outputs/"
