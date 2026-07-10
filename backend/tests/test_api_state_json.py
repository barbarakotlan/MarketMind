import json
import os
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api_state


class JsonStatePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.tmpdir.name, "state.json")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_atomic_write_preserves_previous_file_when_replace_fails(self):
        api_state.save_json(self.path, {"version": 1})

        with patch.object(api_state.os, "replace", side_effect=OSError("disk failure")):
            with self.assertRaisesRegex(OSError, "disk failure"):
                api_state.save_json(self.path, {"version": 2})

        self.assertEqual(api_state.load_json(self.path, {}), {"version": 1})
        temporary_files = [name for name in os.listdir(self.tmpdir.name) if name.endswith(".tmp")]
        self.assertEqual(temporary_files, [])

    def test_corrupt_file_is_quarantined_and_reported(self):
        with open(self.path, "w", encoding="utf-8") as handle:
            handle.write('{"incomplete":')

        with self.assertRaises(api_state.CorruptStateError) as raised:
            api_state.load_json(self.path, {})

        self.assertFalse(os.path.exists(self.path))
        self.assertTrue(os.path.exists(raised.exception.quarantine_path))
        with open(raised.exception.quarantine_path, "r", encoding="utf-8") as handle:
            self.assertEqual(handle.read(), '{"incomplete":')

    def test_concurrent_reads_and_writes_never_observe_partial_json(self):
        api_state.save_json(self.path, {"writer": -1, "payload": []})

        def write_and_read(index):
            payload = {"writer": index, "payload": list(range(250))}
            api_state.save_json(self.path, payload)
            loaded = api_state.load_json(self.path, {})
            json.dumps(loaded)
            self.assertEqual(len(loaded["payload"]), 250)

        with ThreadPoolExecutor(max_workers=8) as executor:
            list(executor.map(write_and_read, range(32)))


if __name__ == "__main__":
    unittest.main()
