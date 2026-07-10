import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from http_policy import DEFAULT_HTTP_TIMEOUT, ensure_success, timeout


class _ResponseWithoutRequestsHelpers:
    def __init__(self, status_code):
        self.status_code = status_code


class HttpPolicyTests(unittest.TestCase):
    def test_default_timeout_bounds_connect_and_read_phases(self):
        self.assertEqual(DEFAULT_HTTP_TIMEOUT, (3.05, 15))
        self.assertEqual(timeout(45), (3.05, 45))

    def test_status_fallback_rejects_upstream_errors(self):
        with self.assertRaisesRegex(RuntimeError, "status 503"):
            ensure_success(_ResponseWithoutRequestsHelpers(503))

    def test_status_fallback_accepts_success(self):
        response = _ResponseWithoutRequestsHelpers(200)
        self.assertIs(ensure_success(response), response)


if __name__ == "__main__":
    unittest.main()
