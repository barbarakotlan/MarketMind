import math
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import api_handlers_paper as paper_handlers


class _Request:
    def __init__(self, payload):
        self.payload = payload

    def get_json(self, silent=False):
        return self.payload


def _jsonify(payload):
    return payload


class PaperOptionSecurityTests(unittest.TestCase):
    def setUp(self):
        self.portfolio = {
            "cash": 100_000.0,
            "starting_cash": 100_000.0,
            "positions": {},
            "options_positions": {},
            "transactions": [],
            "trade_history": [],
        }
        self.saved = []

    def _buy(self, payload, *, quote=2.0):
        return paper_handlers.buy_option_handler(
            request_obj=_Request(payload),
            get_current_user_id_fn=lambda: "user_a",
            load_portfolio_fn=lambda _user_id: self.portfolio,
            save_portfolio_with_snapshot_fn=lambda portfolio, _user_id: self.saved.append(portfolio),
            resolve_option_price_fn=lambda _symbol, _side: quote,
            jsonify_fn=_jsonify,
        )

    def test_negative_and_non_finite_prices_cannot_credit_cash(self):
        for bad_price in (-1, 0, math.nan, math.inf, "not-a-number"):
            with self.subTest(price=bad_price):
                self.portfolio["cash"] = 100_000.0
                self.saved.clear()
                body, status = self._buy(
                    {
                        "contractSymbol": "AAPL260116C00150000",
                        "quantity": 1,
                        "price": bad_price,
                    }
                )
                self.assertEqual(status, 400)
                self.assertIn("price", body["error"])
                self.assertEqual(self.portfolio["cash"], 100_000.0)
                self.assertEqual(self.saved, [])

    def test_server_quote_is_used_instead_of_client_price(self):
        response, status = self._buy(
            {
                "contractSymbol": "AAPL260116C00150000",
                "quantity": 2,
                "price": 0.25,
            },
            quote=3.5,
        )

        self.assertEqual(status, 200)
        self.assertTrue(response["success"])
        self.assertEqual(self.portfolio["cash"], 99_300.0)
        self.assertEqual(
            self.portfolio["options_positions"]["AAPL260116C00150000"],
            {"quantity": 2, "avg_cost": 3.5},
        )
        self.assertEqual(self.portfolio["trade_history"][0]["price"], 3.5)

    def test_unavailable_server_quote_does_not_mutate_portfolio(self):
        body, status = self._buy(
            {
                "contractSymbol": "AAPL260116C00150000",
                "quantity": 1,
                "price": 1.0,
            },
            quote=math.nan,
        )

        self.assertEqual(status, 503)
        self.assertIn("quote", body["error"])
        self.assertEqual(self.portfolio["cash"], 100_000.0)
        self.assertEqual(self.saved, [])

    def test_symbol_and_quantity_are_strictly_validated(self):
        cases = [
            {"contractSymbol": "TEST_OPT", "quantity": 1, "price": 1},
            {"contractSymbol": "AAPL260116C00150000", "quantity": 1.5, "price": 1},
            {"contractSymbol": "AAPL260116C00150000", "quantity": True, "price": 1},
            {"contractSymbol": "AAPL260116C00150000", "quantity": 1001, "price": 1},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                body, status = self._buy(payload)
                self.assertEqual(status, 400)
                self.assertIn("error", body)


if __name__ == "__main__":
    unittest.main()
