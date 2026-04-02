import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sentiment_service


class _FakeClassifier:
    def __init__(self):
        self.calls = []

    def __call__(self, text, truncation=True, max_length=512):
        self.calls.append(
            {
                "text": text,
                "truncation": truncation,
                "max_length": max_length,
            }
        )
        lowered = str(text).lower()
        if "mixed" in lowered:
            return [[
                {"label": "positive", "score": 0.41},
                {"label": "neutral", "score": 0.32},
                {"label": "negative", "score": 0.27},
            ]]
        if "optimistic" in lowered:
            return [[
                {"label": "positive", "score": 0.82},
                {"label": "neutral", "score": 0.12},
                {"label": "negative", "score": 0.06},
            ]]
        return [[
            {"label": "positive", "score": 0.08},
            {"label": "neutral", "score": 0.18},
            {"label": "negative", "score": 0.74},
        ]]


class SentimentServiceTests(unittest.TestCase):
    def setUp(self):
        sentiment_service.reset_sentiment_runtime_state()

    def tearDown(self):
        sentiment_service.reset_sentiment_runtime_state()

    def test_score_text_returns_disabled_when_feature_flag_is_off(self):
        with patch.dict(os.environ, {"SENTIMENT_INTELLIGENCE_ENABLED": "false"}, clear=False):
            payload = sentiment_service.score_text("This is a meaningful text body for sentiment scoring.")
        self.assertEqual(payload["status"], "unavailable")
        self.assertEqual(payload["reason"], "disabled")

    def test_score_text_rejects_non_english_text(self):
        with patch.dict(os.environ, {"SENTIMENT_INTELLIGENCE_ENABLED": "true"}, clear=False):
            payload = sentiment_service.score_text("公告标题公告标题公告标题公告标题公告标题")
        self.assertEqual(payload["status"], "unavailable")
        self.assertEqual(payload["reason"], "non_english_text")

    def test_score_text_softens_low_confidence_predictions_to_neutral_and_caches(self):
        fake_classifier = _FakeClassifier()
        with patch.dict(os.environ, {"SENTIMENT_INTELLIGENCE_ENABLED": "true"}, clear=False), patch.object(
            sentiment_service,
            "_get_classifier",
            return_value=fake_classifier,
        ):
            first = sentiment_service.score_text("Mixed outlook with some optimistic details but plenty of uncertainty.")
            second = sentiment_service.score_text("Mixed outlook with some optimistic details but plenty of uncertainty.")

        self.assertEqual(first["status"], "scored")
        self.assertEqual(first["label"], "neutral")
        self.assertEqual(second["label"], "neutral")
        self.assertEqual(len(fake_classifier.calls), 1)

    def test_score_long_text_aggregates_multiple_chunks(self):
        fake_classifier = _FakeClassifier()
        long_text = "\n\n".join(
            [
                "Optimistic demand commentary " * 20,
                "Risk factors remain elevated and the filing tone is cautious " * 20,
            ]
        )
        with patch.dict(os.environ, {"SENTIMENT_INTELLIGENCE_ENABLED": "true"}, clear=False), patch.object(
            sentiment_service,
            "_get_classifier",
            return_value=fake_classifier,
        ):
            payload = sentiment_service.score_long_text(long_text, target_size=120, hard_max=180, overlap=40, max_chunks=4)

        self.assertEqual(payload["status"], "scored")
        self.assertIn(payload["label"], {"positive", "neutral", "negative"})
        self.assertGreaterEqual(len(fake_classifier.calls), 2)

    def test_annotate_news_items_and_summarize_collection(self):
        fake_classifier = _FakeClassifier()
        items = [
            {"title": "Optimistic demand outlook", "summary": "Management sounded optimistic about the next two quarters."},
            {"title": "Risk factors expanding", "summary": "The filing disclosed more cautious language on supply chain pressure."},
        ]
        with patch.dict(os.environ, {"SENTIMENT_INTELLIGENCE_ENABLED": "true"}, clear=False), patch.object(
            sentiment_service,
            "_get_classifier",
            return_value=fake_classifier,
        ):
            annotated = sentiment_service.annotate_news_items(items)
            summary = sentiment_service.summarize_collection(annotated, source_types=["news"])

        self.assertEqual(len(annotated), 2)
        self.assertEqual(annotated[0]["sentiment"]["status"], "scored")
        self.assertIsNotNone(summary)
        self.assertEqual(summary["status"], "scored")
        self.assertEqual(summary["scoredCount"], 2)
        self.assertEqual(summary["sourceTypes"], ["news"])


if __name__ == "__main__":
    unittest.main()
