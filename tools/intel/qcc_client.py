#!/usr/bin/env python3
"""
tools/intel/qcc_client.py — 企查查 API 封装

用法（命令行测试）:
  python3 tools/intel/qcc_client.py "上海机床厂"
  python3 tools/intel/qcc_client.py "格力电器" --page 2

配置（环境变量）:
  QCC_APP_KEY     企查查 AppKey（客户提供）
  QCC_SECRET_KEY  企查查 SecretKey（客户提供）

未配置时降级模式：返回占位符结果，不抛出异常。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from typing import Any

import requests

QCC_BASE_URL = "https://api.qichacha.com"
_PLACEHOLDER_KEY = "PLACEHOLDER_KEY"
_PLACEHOLDER_SECRET = "PLACEHOLDER_SECRET"
_REQUEST_TIMEOUT = 10  # 秒


def _is_configured() -> bool:
    """检查 API Key 是否已配置（区别于占位符）"""
    app_key = os.environ.get("QCC_APP_KEY", _PLACEHOLDER_KEY)
    secret_key = os.environ.get("QCC_SECRET_KEY", _PLACEHOLDER_SECRET)
    return (
        app_key != _PLACEHOLDER_KEY
        and secret_key != _PLACEHOLDER_SECRET
        and len(app_key) > 0
        and len(secret_key) > 0
    )


def _make_token(app_key: str, secret_key: str) -> tuple[str, str]:
    """
    生成企查查认证 Token（每次请求前实时生成，不缓存）。
    Token = MD5(AppKey + Timespan + SecretKey).upper()
    """
    timespan = str(int(time.time()))
    raw = f"{app_key}{timespan}{secret_key}"
    token = hashlib.md5(raw.encode("utf-8")).hexdigest().upper()
    return token, timespan


def fuzzy_search(
    keyword: str,
    page_index: int = 1,
    page_size: int = 10,
) -> dict[str, Any]:
    """
    企查查模糊搜索企业。

    降级模式（API Key 未配置时）：返回
    {"Status": "PLACEHOLDER", "Message": "QCC_APP_KEY 未配置", "Result": []}

    正常响应结构（企查查返回）：
    {
      "Status": "200",
      "Result": [
        {
          "KeyNo": str,       # 企查查内部唯一 ID
          "Name": str,        # 企业名称
          "CreditCode": str,  # 统一社会信用代码
          "StartDate": str,   # 成立日期 YYYY-MM-DD
          "OperName": str,    # 法定代表人
          "Status": str,      # 企业状态
          "No": str,          # 注册号
          "Address": str      # 注册地址
        }
      ]
    }
    """
    if not _is_configured():
        return {
            "Status": "PLACEHOLDER",
            "Message": (
                "QCC_APP_KEY / QCC_SECRET_KEY 未配置。"
                "请设置环境变量后重试。"
                f"搜索关键词: {keyword}"
            ),
            "Result": [],
        }

    app_key = os.environ["QCC_APP_KEY"]
    secret_key = os.environ["QCC_SECRET_KEY"]
    token, timespan = _make_token(app_key, secret_key)

    headers = {
        "Token": token,
        "Timespan": timespan,
        "Content-Type": "application/json",
    }
    params = {
        "key": app_key,
        "searchKey": keyword,
        "pageIndex": str(page_index),
        "pageSize": str(min(page_size, 20)),  # 企查查最大 pageSize=20
    }

    try:
        resp = requests.get(
            f"{QCC_BASE_URL}/FuzzySearch/GetList",
            headers=headers,
            params=params,
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("Status") != "200":
            status = data.get("Status", "UNKNOWN")
            message = data.get("Message", "企查查 API 返回非200状态")

            if status == "201":
                return {
                    "Status": "201",
                    "Message": "查询无结果（正常）",
                    "Result": [],
                }
            if status in ("101", "102"):
                reason = "Key 无效或未授权" if status == "101" else "余额不足（按次计费，请检查账户）"
                return {
                    "Status": status,
                    "Message": f"STOP_BATCH: {reason}",
                    "Result": [],
                }

            return {
                "Status": status,
                "Message": message,
                "Result": [],
            }
        return data

    except requests.exceptions.Timeout:
        return {"Status": "TIMEOUT", "Message": f"请求超时（{_REQUEST_TIMEOUT}s）", "Result": []}
    except requests.exceptions.RequestException as exc:
        return {"Status": "ERROR", "Message": str(exc), "Result": []}


def format_search_results(result: dict[str, Any]) -> str:
    """将 fuzzy_search 返回值格式化为可读文本（供 Skill 展示）。"""
    status = result.get("Status")
    if status == "PLACEHOLDER":
        return f"[企查查未配置] {result.get('Message', '')}"
    if status == "201":
        return f"[企查查] 查询无结果（正常）: {result.get('Message', '')}"
    if status in ("101", "102"):
        return f"[企查查] {result.get('Message', '')}"
    if status != "200":
        return f"[企查查错误] Status={status}: {result.get('Message', '')}"

    items = result.get("Result", [])
    if not items:
        return "[企查查] 未找到匹配企业"

    lines = [f"[企查查] 找到 {len(items)} 条结果:"]
    for item in items:
        lines.append(
            f"- {item.get('Name', 'N/A')} | "
            f"KeyNo={item.get('KeyNo', 'N/A')} | "
            f"代码={item.get('CreditCode', 'N/A')} | "
            f"法人={item.get('OperName', 'N/A')} | "
            f"成立={item.get('StartDate', 'N/A')} | "
            f"状态={item.get('Status', 'N/A')}"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="企查查 API 命令行测试工具")
    parser.add_argument("keyword", help="搜索关键词（企业名、人名等）")
    parser.add_argument("--page", type=int, default=1, help="页码（默认1）")
    parser.add_argument("--size", type=int, default=10, help="每页数量（默认10，最大20）")
    parser.add_argument("--json", dest="output_json", action="store_true", help="输出原始 JSON")
    args = parser.parse_args()

    result = fuzzy_search(args.keyword, page_index=args.page, page_size=args.size)

    if args.output_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_search_results(result))


if __name__ == "__main__":
    main()
