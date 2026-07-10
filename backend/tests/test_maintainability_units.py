import os
import sys
import unittest
from datetime import date, timedelta
from unittest import mock


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api_handlers_paper as paper_handlers
import marketmind_ai
import research_document_builder
import user_journey_harness
import user_state_store


class MaintainabilityUnitTests(unittest.TestCase):
    def test_history_helpers_build_window_ledger_and_summary(self):
        start_date, end_date = paper_handlers._history_window(
            "1m",
            today=date(2026, 7, 10),
            first_tx_date=date(2026, 1, 1),
            date_cls=date,
            timedelta_cls=timedelta,
        )
        positions = {}
        cash = paper_handlers._apply_equity_transaction(
            100_000.0,
            positions,
            {"type": "BUY", "ticker": "AAPL", "shares": 2, "total": 200},
        )
        cash = paper_handlers._apply_equity_transaction(
            cash,
            positions,
            {"type": "SELL", "ticker": "AAPL", "shares": 1, "total": 120},
        )
        summary = paper_handlers._history_summary(
            period="1m",
            start_date=start_date,
            end_date=end_date,
            start_value=100_000.0,
            end_value=100_100.0,
        )

        self.assertEqual(start_date, date(2026, 6, 10))
        self.assertEqual(cash, 99_920.0)
        self.assertEqual(positions, {"AAPL": 1})
        self.assertEqual(summary["wealth_generated"], 100.0)

    def test_sec_document_orchestrator_combines_each_source_type(self):
        context = {
            "assetId": "AAPL",
            "ticker": "AAPL",
            "market": "US",
            "secFilingsSummary": {
                "type": "10-K",
                "accessionNumber": "filing-1",
                "sections": [{"key": "risk", "title": "Risk", "text": "Material risk."}],
            },
            "filingChangeSummary": {
                "comparisonForm": "10-K",
                "sectionChanges": [{"key": "risk", "status": "changed", "currentExcerpt": "New risk."}],
            },
            "insiderActivitySummary": [{"insiderName": "Director", "activity": "Purchase"}],
            "beneficialOwnershipSummary": [{"owners": ["Holder"], "ownershipPercent": 6.5}],
        }

        documents = research_document_builder._build_sec_documents(context)

        self.assertEqual(
            {document["payload"]["docType"] for document in documents},
            {"sec_section", "filing_change", "insider_activity", "beneficial_ownership"},
        )

    def test_ai_fallback_helpers_keep_sec_and_directional_context(self):
        context = {
            "secFilingsSummary": {
                "type": "10-K",
                "date": "2026-01-31",
                "sections": [{"title": "Risk Factors"}],
            },
            "predictionSnapshot": {"recentPredicted": 110, "recentClose": 100},
        }

        sec_bullets = marketmind_ai._fallback_sec_bullets(context)
        directional = marketmind_ai._fallback_directional_lines(
            context,
            [{"role": "user", "content": "Should I buy AAPL?"}],
        )

        self.assertIn("10-K", sec_bullets[0])
        self.assertIn("Context-based lean", "\n".join(directional))

    def test_state_restore_orchestrates_each_domain_before_export(self):
        session = mock.Mock()
        restored = {"watchlist_items": []}
        helpers = (
            "_clear_user_state",
            "_restore_account_state",
            "_restore_paper_state",
            "_restore_prediction_state",
            "_restore_deliverable_state",
        )
        with (
            mock.patch.multiple(
                user_state_store,
                **{name: mock.DEFAULT for name in helpers},
            ) as patched,
            mock.patch.object(
                user_state_store,
                "export_user_state",
                return_value=restored,
            ) as export_state,
        ):
            result = user_state_store.restore_user_state(session, "user_1", {})

        for helper in patched.values():
            helper.assert_called_once_with(session, "user_1", {})
        session.flush.assert_called_once_with()
        export_state.assert_called_once_with(session, "user_1")
        self.assertIs(result, restored)

    def test_journey_orchestrator_runs_each_phase_in_order(self):
        results = []
        calls = []
        phase_names = (
            "_run_week_1_research",
            "_run_week_2_alerting",
            "_run_week_3_paper_trading",
            "_run_week_4_prediction_markets",
        )
        patches = [
            mock.patch.object(
                user_journey_harness,
                name,
                side_effect=lambda _client, *, results, phase=name: calls.append(phase),
            )
            for name in phase_names
        ]
        with patches[0], patches[1], patches[2], patches[3]:
            user_journey_harness._run_journey(object(), results=results)

        self.assertEqual(calls, list(phase_names))


if __name__ == "__main__":
    unittest.main()
