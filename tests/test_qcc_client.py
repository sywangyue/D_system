"""
tests/test_qcc_client.py — 企查查客户端状态码 mock 测试

用 unittest.mock 替换 HTTP 层，不依赖真实 API Key。
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 设测试用 API Key（qcc_client.py 在模块级不检查，但 _is_configured 检查通过后 os.environ 取值）
os.environ.setdefault("QCC_KEY", "TEST_KEY")
os.environ.setdefault("QCC_SECRET", "TEST_SECRET")

import json
import unittest
from unittest.mock import patch, Mock


class TestQccStatusCodes(unittest.TestCase):
    """验证 qcc_client 的 201/102/超时分支。"""

    def _mock_response(self, status_code: int, body: dict) -> Mock:
        mock = Mock()
        mock.status_code = status_code
        mock.json.return_value = body
        mock.raise_for_status = Mock()
        return mock

    @patch('tools.intel.qcc_client.requests.get')
    def test_status_201_returns_empty_result(self, mock_get):
        """Status=201 → Result=[] 且 Message 不含错误字样。"""
        mock_get.return_value = self._mock_response(200, {
            "Status": "201", "Message": "查询无结果", "Result": []
        })
        from tools.intel.qcc_client import fuzzy_search, _is_configured

        # 降级模式会直接走 PLACEHOLDER，需要绕过
        with patch('tools.intel.qcc_client._is_configured', return_value=True):
            result = fuzzy_search("不存在的公司")
        self.assertEqual(result["Status"], "201")
        self.assertEqual(result["Result"], [])
        self.assertNotIn("错误", result.get("Message", ""))

    @patch('tools.intel.qcc_client.requests.get')
    def test_status_102_contains_stop_batch(self, mock_get):
        """Status=102 → Message 以 STOP_BATCH 开头。"""
        mock_get.return_value = self._mock_response(200, {
            "Status": "102", "Message": "余额不足", "Result": []
        })
        from tools.intel.qcc_client import fuzzy_search

        with patch('tools.intel.qcc_client._is_configured', return_value=True):
            result = fuzzy_search("测试公司")
        self.assertTrue(result["Message"].startswith("STOP_BATCH"),
                        f"102 Message 不以 STOP_BATCH 开头: {result['Message']}")
        self.assertEqual(result["Result"], [])

    @patch('tools.intel.qcc_client.requests.get')
    def test_status_200_returns_results(self, mock_get):
        """Status=200 → 返回 Result 列表。"""
        mock_get.return_value = self._mock_response(200, {
            "Status": "200",
            "Result": [{"KeyNo": "KEY001", "Name": "测试公司",
                        "CreditCode": "91310000XXXX", "StartDate": "2010-01-01",
                        "OperName": "张某", "Status": "存续", "No": "12345", "Address": "上海"}]
        })
        from tools.intel.qcc_client import fuzzy_search

        with patch('tools.intel.qcc_client._is_configured', return_value=True):
            result = fuzzy_search("测试公司")
        self.assertEqual(result["Status"], "200")
        self.assertGreater(len(result["Result"]), 0)

    @patch('tools.intel.qcc_client.requests.get')
    def test_placeholder_mode(self, mock_get):
        """未配置 API Key 时返回 PLACEHOLDER。"""
        from tools.intel.qcc_client import fuzzy_search

        with patch('tools.intel.qcc_client._is_configured', return_value=False):
            result = fuzzy_search("测试公司")
        self.assertEqual(result["Status"], "PLACEHOLDER")
        mock_get.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
