# -*- coding: utf-8 -*-
"""追加调研结论到 results.jsonl（一行一家）。用法: python3 add.py <<'EOF' ... json数组 ... EOF"""
import sys, json, os
recs = json.load(sys.stdin)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"results.jsonl"), "a", encoding="utf-8") as f:
    for r in recs: f.write(json.dumps(r, ensure_ascii=False) + "\n")
print("appended", len(recs))
