import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from alert_worker import run_alert_worker, scheduler_leader_lock


class AlertWorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.lock_path = os.path.join(self.tmpdir.name, "alert-worker.lock")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_filesystem_lock_allows_only_one_worker(self):
        with scheduler_leader_lock("", lock_path=self.lock_path, blocking=False) as first:
            with scheduler_leader_lock("", lock_path=self.lock_path, blocking=False) as second:
                self.assertTrue(first)
                self.assertFalse(second)

        with scheduler_leader_lock("", lock_path=self.lock_path, blocking=False) as reacquired:
            self.assertTrue(reacquired)

    def test_worker_initializes_before_running_scheduler(self):
        calls = []

        result = run_alert_worker(
            database_url="",
            lock_path=self.lock_path,
            initialize_fn=lambda: calls.append("initialize"),
            run_scheduler_fn=lambda: calls.append("scheduler"),
            blocking_lock=False,
        )

        self.assertEqual(result, 0)
        self.assertEqual(calls, ["initialize", "scheduler"])

    def test_standby_worker_does_not_run_scheduler(self):
        calls = []
        with scheduler_leader_lock("", lock_path=self.lock_path, blocking=False):
            result = run_alert_worker(
                database_url="",
                lock_path=self.lock_path,
                initialize_fn=lambda: calls.append("initialize"),
                run_scheduler_fn=lambda: calls.append("scheduler"),
                blocking_lock=False,
            )

        self.assertEqual(result, 0)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
