"""Centralized backend configuration.

Loads environment variables exactly once and in the original order —
project-root ``.env`` first, then ``backend/.env`` which overrides it — and
exposes the provider credentials the fetchers and API read. Importing this
module is the single place that performs dotenv loading for the backend, so
individual modules no longer each call ``load_dotenv()``.
"""
import os

from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)

# Two-stage load: project-root .env first, then backend/.env overrides it.
load_dotenv(os.path.join(_PROJECT_ROOT, '.env'))
load_dotenv(os.path.join(_BACKEND_DIR, '.env'), override=True)

# --- Provider API keys ---
ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
