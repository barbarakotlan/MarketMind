import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import public_api_admin
from user_state_store import reset_runtime_state


class PublicApiAdminTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "admin.sqlite")
        self.original_env = {
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
            "PUBLIC_API_KEY_HASH_PEPPER": os.environ.get("PUBLIC_API_KEY_HASH_PEPPER"),
        }
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path}"
        os.environ["PUBLIC_API_KEY_HASH_PEPPER"] = "admin-pepper"
        reset_runtime_state()

    def tearDown(self):
        if self.original_env["DATABASE_URL"] is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self.original_env["DATABASE_URL"]
        if self.original_env["PUBLIC_API_KEY_HASH_PEPPER"] is None:
            os.environ.pop("PUBLIC_API_KEY_HASH_PEPPER", None)
        else:
            os.environ["PUBLIC_API_KEY_HASH_PEPPER"] = self.original_env["PUBLIC_API_KEY_HASH_PEPPER"]
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _run(self, argv):
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            rc = public_api_admin.main(argv)
        return rc, stdout.getvalue()

    def test_create_issue_list_and_revoke_key(self):
        rc, client_output = self._run(["create-client", "Beta Client", "--contact-email", "beta@example.com"])
        self.assertEqual(rc, 0)
        self.assertIn("client_id=", client_output)
        client_id = client_output.split("client_id=")[1].split()[0]

        rc, issue_output = self._run(["issue-key", client_id, "--label", "beta-key"])
        self.assertEqual(rc, 0)
        self.assertIn("api_key=", issue_output)
        key_id = issue_output.split("key_id=")[1].splitlines()[0]

        rc, list_output = self._run(["list-keys", "--client-id", client_id])
        self.assertEqual(rc, 0)
        self.assertIn("prefix=", list_output)
        self.assertIn("status=active", list_output)

        rc, revoke_output = self._run(["revoke-key", key_id])
        self.assertEqual(rc, 0)
        self.assertIn("status=revoked", revoke_output)


if __name__ == "__main__":
    unittest.main()
