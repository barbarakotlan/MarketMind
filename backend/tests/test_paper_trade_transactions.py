import os
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from user_state_store import (
    PaperPortfolioSnapshot,
    PaperTradeExecutionError,
    PaperTradeEvent,
    execute_paper_trade,
    execute_paper_trade_transaction,
    load_portfolio,
    reset_runtime_state,
    save_portfolio,
    session_scope,
)


class PaperTradeTransactionTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.database_url = f"sqlite:///{os.path.join(self.tmpdir.name, 'state.db')}"
        reset_runtime_state()
        with session_scope(self.database_url) as session:
            save_portfolio(
                session,
                "user_a",
                {
                    "cash": 100_000.0,
                    "starting_cash": 100_000.0,
                    "positions": {},
                    "options_positions": {},
                    "transactions": [],
                    "trade_history": [],
                },
            )

    def tearDown(self):
        reset_runtime_state()
        self.tmpdir.cleanup()

    def test_concurrent_orders_cannot_both_spend_the_same_cash(self):
        barrier = threading.Barrier(2)

        def execute_order():
            try:
                execute_paper_trade_transaction(
                    self.database_url,
                    "user_a",
                    action="BUY",
                    symbol="AAPL",
                    quantity=1,
                    price=60_000,
                    after_lock_fn=lambda: barrier.wait(timeout=5),
                )
                return 200
            except PaperTradeExecutionError as exc:
                return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(lambda _index: execute_order(), range(2)))

        self.assertEqual(statuses, [200, 409])
        with session_scope(self.database_url) as session:
            portfolio = load_portfolio(session, "user_a")
            event_count = session.query(PaperTradeEvent).count()
            snapshot_count = session.query(PaperPortfolioSnapshot).count()

        self.assertEqual(portfolio["cash"], 40_000.0)
        self.assertEqual(portfolio["positions"]["AAPL"]["shares"], 1.0)
        self.assertEqual(event_count, 1)
        self.assertEqual(snapshot_count, 1)

    def test_trade_and_snapshot_roll_back_together(self):
        with self.assertRaisesRegex(RuntimeError, "abort transaction"):
            with session_scope(self.database_url) as session:
                execute_paper_trade(
                    session,
                    "user_a",
                    action="BUY_OPTION",
                    symbol="AAPL260116C00150000",
                    quantity=1,
                    price=2.5,
                )
                raise RuntimeError("abort transaction")

        with session_scope(self.database_url) as session:
            portfolio = load_portfolio(session, "user_a")
            self.assertEqual(session.query(PaperTradeEvent).count(), 0)
            self.assertEqual(session.query(PaperPortfolioSnapshot).count(), 0)

        self.assertEqual(portfolio["cash"], 100_000.0)
        self.assertEqual(portfolio["options_positions"], {})

    def test_each_trade_appends_one_immutable_event(self):
        first = execute_paper_trade_transaction(
            self.database_url,
            "user_a",
            action="BUY",
            symbol="MSFT",
            quantity=2,
            price=100,
        )
        second = execute_paper_trade_transaction(
            self.database_url,
            "user_a",
            action="SELL",
            symbol="MSFT",
            quantity=1,
            price=125,
        )

        with session_scope(self.database_url) as session:
            events = session.query(PaperTradeEvent).order_by(PaperTradeEvent.occurred_at).all()

        self.assertEqual(len(events), 2)
        self.assertEqual(str(events[0].id), first["trade"]["id"])
        self.assertEqual(str(events[1].id), second["trade"]["id"])
        self.assertEqual(float(events[0].price), 100.0)
        self.assertEqual(float(events[1].price), 125.0)

    def test_full_portfolio_save_preserves_existing_trade_event_identity(self):
        execute_paper_trade_transaction(
            self.database_url,
            "user_a",
            action="BUY",
            symbol="NVDA",
            quantity=1,
            price=150,
        )

        with session_scope(self.database_url) as session:
            before = session.query(PaperTradeEvent).one()
            event_id = before.id
            portfolio = load_portfolio(session, "user_a")
            save_portfolio(session, "user_a", portfolio)

        with session_scope(self.database_url) as session:
            events = session.query(PaperTradeEvent).all()

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].id, event_id)


if __name__ == "__main__":
    unittest.main()
