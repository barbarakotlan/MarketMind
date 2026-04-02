import os
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import portfolio_optimization_service as optimization_service


def _sample_prices():
    index = pd.bdate_range("2025-01-02", periods=252)
    return pd.DataFrame(
        {
            "AAPL": np.linspace(180.0, 230.0, len(index)),
            "MSFT": np.linspace(320.0, 390.0, len(index)),
            "NVDA": np.linspace(110.0, 175.0, len(index)),
        },
        index=index,
    )


class PortfolioOptimizationServiceTests(unittest.TestCase):
    def setUp(self):
        self.portfolio = {
            "cash": 12000.0,
            "positions": {
                "AAPL": {"shares": 10, "avg_cost": 180.0},
                "MSFT": {"shares": 6, "avg_cost": 320.0},
                "NVDA": {"shares": 12, "avg_cost": 110.0},
            },
            "options_positions": {
                "AAPL260116C00200000": {"quantity": 1, "avg_cost": 7.5},
            },
        }

    def test_extract_investable_universe_excludes_options_and_non_us_assets(self):
        eligible, excluded = optimization_service._extract_investable_universe(
            {
                "positions": {
                    "AAPL": {"shares": 5, "avg_cost": 100.0},
                    "MSFT": {"shares": 4, "avg_cost": 200.0},
                    "HK:00700": {"shares": 5, "avg_cost": 40.0},
                },
                "options_positions": {
                    "AAPL260116C00200000": {"quantity": 1, "avg_cost": 7.0},
                },
            }
        )

        self.assertEqual(sorted(eligible.keys()), ["AAPL", "MSFT"])
        self.assertEqual(len(excluded), 2)
        self.assertEqual(excluded[0]["assetClass"], "equity")
        self.assertEqual(excluded[1]["assetClass"], "option")

    def test_black_litterman_uses_prediction_views_and_equal_weight_fallback(self):
        prices = _sample_prices()
        metadata = {
            "AAPL": {"companyName": "Apple", "marketCap": 3_000_000_000_000, "latestPrice": 230.0},
            "MSFT": {"companyName": "Microsoft", "marketCap": float("nan"), "latestPrice": 390.0},
            "NVDA": {"companyName": "NVIDIA", "marketCap": 2_400_000_000_000, "latestPrice": 175.0},
        }
        prediction_snapshots = {
            "AAPL": {"recentClose": 225.0, "recentPredicted": 231.0, "confidence": 82.0, "predictions": [{}, {}, {}]},
            "MSFT": {"recentClose": 388.0, "recentPredicted": 398.0, "confidence": 76.0, "predictions": [{}, {}, {}]},
            "NVDA": {"recentClose": 173.0, "recentPredicted": 170.0, "confidence": 58.0, "predictions": [{}, {}, {}]},
        }

        with patch.object(optimization_service, "_load_market_inputs", return_value=(prices, metadata, [])), patch.object(
            optimization_service.prediction_service,
            "get_prediction_snapshot",
            side_effect=lambda ticker: prediction_snapshots.get(ticker),
        ):
            payload = optimization_service.optimize_paper_portfolio(
                self.portfolio,
                method="black_litterman",
                use_predictions=True,
                max_weight=0.35,
            )

        self.assertEqual(payload["method"], "black_litterman")
        self.assertEqual(payload["assumptions"]["priorSource"], "equal_weight_fallback")
        self.assertGreaterEqual(len(payload["assumptions"]["predictionViewsUsed"]), 2)
        self.assertEqual(len(payload["recommendedAllocations"]), 3)
        self.assertEqual(payload["excludedHoldings"][0]["assetClass"], "option")
        self.assertGreaterEqual(payload["cashPosition"]["targetWeight"], 0.0)
        self.assertIn("expectedAnnualReturn", payload["portfolioMetrics"])

    def test_max_sharpe_can_run_without_predictions(self):
        prices = _sample_prices()
        metadata = {
            "AAPL": {"companyName": "Apple", "marketCap": 3_000_000_000_000, "latestPrice": 230.0},
            "MSFT": {"companyName": "Microsoft", "marketCap": 3_200_000_000_000, "latestPrice": 390.0},
            "NVDA": {"companyName": "NVIDIA", "marketCap": 2_400_000_000_000, "latestPrice": 175.0},
        }

        with patch.object(optimization_service, "_load_market_inputs", return_value=(prices, metadata, [])), patch.object(
            optimization_service.prediction_service,
            "get_prediction_snapshot",
            return_value=None,
        ):
            payload = optimization_service.optimize_paper_portfolio(
                self.portfolio,
                method="max_sharpe",
                use_predictions=False,
                max_weight=0.6,
            )

        self.assertEqual(payload["assumptions"]["returnModel"], "historical_mean")
        self.assertEqual(payload["assumptions"]["predictionViewsUsed"], [])
        self.assertEqual(sorted(payload["universe"]["tickers"]), ["AAPL", "MSFT", "NVDA"])
        self.assertTrue(all(item["action"] in {"buy", "trim", "hold"} for item in payload["rebalanceActions"]))

    def test_optimize_requires_at_least_two_eligible_equities(self):
        with self.assertRaises(optimization_service.PortfolioOptimizationDataError) as exc:
            optimization_service.optimize_paper_portfolio(
                {
                    "cash": 1000.0,
                    "positions": {"AAPL": {"shares": 1, "avg_cost": 180.0}},
                    "options_positions": {},
                }
            )

        self.assertEqual(exc.exception.status_code, 422)
        self.assertEqual(exc.exception.payload["eligibleHoldings"], 1)


if __name__ == "__main__":
    unittest.main()
