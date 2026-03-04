import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import selective_prediction as sp


class SelectiveResolverStatusMappingTests(unittest.TestCase):
    def test_auto_terminal_status_precedence_disabled_mode_over_model_unavailable(self):
        attempts_seen = []

        def runner(source):
            attempts_seen.append(source)
            if source == "ticker":
                return sp.AttemptResult(source="ticker", status="model_unavailable", reason="missing")
            return sp.AttemptResult(source="global", status="disabled_mode", reason="tau_missing")

        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=runner,
            regime_bucket="trend",
        )

        self.assertEqual(attempts_seen, ["ticker", "global"])
        self.assertEqual(out["selector_status"], "disabled_mode")
        self.assertEqual(out["selector_source"], "none")
        self.assertFalse(out["abstain"])
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])
        self.assertEqual(out["selector_mode_effective"], "none")

    def test_forced_global_has_no_ticker_fallback(self):
        attempts_seen = []

        def runner(source):
            attempts_seen.append(source)
            if source == "global":
                return sp.AttemptResult(source="global", status="model_unavailable", reason="missing")
            return sp.AttemptResult(source="ticker", status="ok", prob=0.8, tau=0.7)

        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="global",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=runner,
            regime_bucket="trend",
        )

        self.assertEqual(attempts_seen, ["global"])
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(out["selector_status"], "model_unavailable")

    def test_forced_ticker_has_no_global_fallback(self):
        attempts_seen = []

        def runner(source):
            attempts_seen.append(source)
            if source == "ticker":
                return sp.AttemptResult(source="ticker", status="stale_artifact", reason="expired")
            return sp.AttemptResult(source="global", status="ok", prob=0.8, tau=0.7)

        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="ticker",
            global_selector_enabled=True,
            global_selector_policy="prefer_global",
            attempt_runner=runner,
            regime_bucket="trend",
        )

        self.assertEqual(attempts_seen, ["ticker"])
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(out["selector_status"], "stale_artifact")

    def test_auto_fallback_prefer_ticker_uses_global_when_ticker_fails(self):
        attempts_seen = []

        def runner(source):
            attempts_seen.append(source)
            if source == "ticker":
                return sp.AttemptResult(source="ticker", status="model_unavailable")
            return sp.AttemptResult(source="global", status="ok", prob=0.81, tau=0.62)

        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=runner,
            regime_bucket="neutral",
        )

        self.assertEqual(attempts_seen, ["ticker", "global"])
        self.assertEqual(out["selector_status"], "ok")
        self.assertEqual(out["selector_source"], "global")
        self.assertEqual(out["selector_mode_effective"], "conservative")
        self.assertIsInstance(out["selector_prob"], float)
        self.assertIsInstance(out["selector_threshold"], float)

    def test_auto_fallback_prefer_global_uses_ticker_when_global_fails(self):
        attempts_seen = []

        def runner(source):
            attempts_seen.append(source)
            if source == "global":
                return sp.AttemptResult(source="global", status="model_unavailable")
            return sp.AttemptResult(source="ticker", status="ok", prob=0.41, tau=0.60)

        out = sp._resolve_selector_attempts(
            mode_requested="aggressive",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_global",
            attempt_runner=runner,
            regime_bucket="chop",
        )

        self.assertEqual(attempts_seen, ["global", "ticker"])
        self.assertEqual(out["selector_status"], "ok")
        self.assertEqual(out["selector_source"], "ticker")
        self.assertEqual(out["selector_mode_effective"], "aggressive")
        self.assertTrue(out["abstain"])

    def test_abstain_mode_none_returns_disabled_with_none_source(self):
        called = []

        def runner(source):
            called.append(source)
            return sp.AttemptResult(source=source, status="model_unavailable")

        out = sp._resolve_selector_attempts(
            mode_requested="none",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=runner,
            regime_bucket="unknown",
        )

        self.assertEqual(called, [])
        self.assertEqual(out["selector_status"], "disabled")
        self.assertEqual(out["selector_source"], "none")
        self.assertEqual(out["selector_mode_effective"], "none")
        self.assertFalse(out["abstain"])
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])

    def test_non_ok_invariant_nulls_prob_and_tau(self):
        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=lambda source: sp.AttemptResult(source=source, status="stale_artifact"),
            regime_bucket="trend",
        )

        self.assertNotEqual(out["selector_status"], "ok")
        self.assertEqual(out["selector_source"], "none")
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])
        self.assertFalse(out["abstain"])
        self.assertEqual(out["selector_mode_effective"], "none")

    def test_ok_invariant_has_non_none_source_and_float_prob_tau(self):
        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="ticker",
            global_selector_enabled=False,
            global_selector_policy="prefer_ticker",
            attempt_runner=lambda source: sp.AttemptResult(source=source, status="ok", prob=0.72, tau=0.65),
            regime_bucket="trend",
        )

        self.assertEqual(out["selector_status"], "ok")
        self.assertIn(out["selector_source"], {"ticker", "global"})
        self.assertIsInstance(out["selector_prob"], float)
        self.assertIsInstance(out["selector_threshold"], float)
        self.assertEqual(out["selector_mode_effective"], "conservative")

    def test_attempt_ok_requires_prob_and_tau(self):
        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="ticker",
            global_selector_enabled=False,
            global_selector_policy="prefer_ticker",
            attempt_runner=lambda source: sp.AttemptResult(source=source, status="ok", prob=0.72, tau=None),
            regime_bucket="trend",
        )

        self.assertEqual(out["selector_status"], "disabled_mode")
        self.assertEqual(out["selector_source"], "none")
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])
        self.assertFalse(out["abstain"])

    def test_resolver_public_invariant_cannot_be_bypassed_by_attempts(self):
        def runner(source):
            if source == "ticker":
                return sp.AttemptResult(source="ticker", status="ok", prob=None, tau=None)
            return sp.AttemptResult(source="global", status="model_unavailable")

        out = sp._resolve_selector_attempts(
            mode_requested="conservative",
            selector_source_requested="auto",
            global_selector_enabled=True,
            global_selector_policy="prefer_ticker",
            attempt_runner=runner,
            regime_bucket="trend",
        )
        self.assertNotEqual(out["selector_status"], "ok")
        self.assertEqual(out["selector_source"], "none")
        self.assertIsNone(out["selector_prob"])
        self.assertIsNone(out["selector_threshold"])
        self.assertFalse(out["abstain"])


if __name__ == "__main__":
    unittest.main()
