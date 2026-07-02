"""Guard: importing the app must not boot the heavy ML stack.

`import api` should pull only Flask + light dependencies. The expensive ML
libraries (torch, shap, mlforecast, statsforecast) are imported lazily, on
first use, inside models.py / prediction_service.py. Booting them at import
time makes test collection and app startup slow and fragile, so this test
fails if any of them leak back into the import path.

Run in a subprocess with a clean interpreter so the assertion is not polluted
by other tests that may have already imported these modules in-process.
"""
import os
import subprocess
import sys
import unittest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HEAVY_MODULES = ("torch", "shap", "mlforecast", "statsforecast")

_SENTINEL = "LEAKED_MODULES:"

_PROBE = """
import sys
import api  # noqa: F401
leaked = [m for m in {heavy!r} if m in sys.modules]
print("{sentinel}" + ",".join(leaked))
""".format(heavy=list(HEAVY_MODULES), sentinel=_SENTINEL)


class ImportIsMlFreeTests(unittest.TestCase):
    def test_import_api_does_not_load_heavy_ml_modules(self):
        env = dict(os.environ, PERSISTENCE_MODE="json")
        result = subprocess.run(
            [sys.executable, "-c", _PROBE],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            result.returncode, 0, msg=f"probe failed:\n{result.stderr}"
        )
        # Find the sentinel line the probe emits (ignores banners/warnings).
        sentinel_lines = [
            ln[len(_SENTINEL):].strip()
            for ln in result.stdout.splitlines()
            if ln.startswith(_SENTINEL)
        ]
        self.assertTrue(
            sentinel_lines,
            msg=f"probe did not emit sentinel; stdout:\n{result.stdout}\nstderr:\n{result.stderr}",
        )
        leaked = sentinel_lines[-1]
        self.assertEqual(
            leaked,
            "",
            msg=f"`import api` unexpectedly loaded heavy ML modules: {leaked}",
        )


if __name__ == "__main__":
    unittest.main()
