import os
import sys
import tempfile
import types
import unittest

os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('KMP_DUPLICATE_LIB_OK', 'TRUE')
os.environ.setdefault('KMP_INIT_AT_FORK', 'FALSE')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from flask import Blueprint
fake_models = types.ModuleType('models')
fake_models.create_dataset = lambda *args, **kwargs: None
fake_models.ensemble_predict = lambda *args, **kwargs: None
fake_models.linear_regression_predict = lambda *args, **kwargs: None
fake_models.random_forest_predict = lambda *args, **kwargs: None
fake_models.xgboost_predict = lambda *args, **kwargs: None
fake_models.lstm_train = lambda *args, **kwargs: None
fake_models.lstm_predict = lambda *args, **kwargs: None
fake_models.transformer_train = lambda *args, **kwargs: None
fake_models.transformer_predict = lambda *args, **kwargs: None
sys.modules['models'] = fake_models
fake_professional_evaluation = types.ModuleType('professional_evaluation')
fake_professional_evaluation.rolling_window_backtest = lambda *args, **kwargs: {}
sys.modules['professional_evaluation'] = fake_professional_evaluation
fake_prediction_service = types.ModuleType('prediction_service')
fake_prediction_service.get_future_prediction_dates = lambda *args, **kwargs: []
sys.modules['prediction_service'] = fake_prediction_service
sys.modules['exchange_session_service'] = types.ModuleType('exchange_session_service')
fake_deliverables = types.ModuleType('deliverables')
fake_deliverables.DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
fake_deliverables.DeliverableError = type('DeliverableError', (Exception,), {'payload': {}, 'status_code': 400})
fake_deliverables.add_deliverable_review = lambda *args, **kwargs: {}
fake_deliverables.build_deliverable_context = lambda *args, **kwargs: {}
fake_deliverables.create_deliverable = lambda *args, **kwargs: {}
fake_deliverables.create_deliverable_preflight = lambda *args, **kwargs: {}
fake_deliverables.generate_deliverable_memo = lambda *args, **kwargs: {}
fake_deliverables.get_deliverable_detail = lambda *args, **kwargs: {}
fake_deliverables.get_deliverable_memo_artifact = lambda *args, **kwargs: {}
fake_deliverables.list_deliverable_memos = lambda *args, **kwargs: []
fake_deliverables.list_deliverables = lambda *args, **kwargs: []
fake_deliverables.replace_deliverable_assumptions = lambda *args, **kwargs: {}
fake_deliverables.update_deliverable = lambda *args, **kwargs: {}
sys.modules['deliverables'] = fake_deliverables
fake_marketmind_ai = types.ModuleType('marketmind_ai')
fake_marketmind_ai.MarketMindAIError = type('MarketMindAIError', (Exception,), {'payload': {}, 'status_code': 400})
fake_marketmind_ai.build_marketmind_ai_context = lambda *args, **kwargs: {}
fake_marketmind_ai.create_artifact_preflight = lambda *args, **kwargs: {}
fake_marketmind_ai.delete_marketmind_ai_chat = lambda *args, **kwargs: None
fake_marketmind_ai.generate_marketmind_ai_artifact = lambda *args, **kwargs: {}
fake_marketmind_ai.generate_marketmind_ai_reply = lambda *args, **kwargs: {}
fake_marketmind_ai.get_bootstrap_payload = lambda *args, **kwargs: {}
fake_marketmind_ai.get_marketmind_ai_artifact_detail = lambda *args, **kwargs: {}
fake_marketmind_ai.get_marketmind_ai_artifact_download = lambda *args, **kwargs: {'bytes': b'', 'filename': 'artifact.docx'}
fake_marketmind_ai.get_marketmind_ai_chat_detail = lambda *args, **kwargs: {}
fake_marketmind_ai.get_marketmind_ai_retrieval_status = lambda *args, **kwargs: {}
fake_marketmind_ai.list_marketmind_ai_artifacts = lambda *args, **kwargs: []
fake_marketmind_ai.list_marketmind_ai_chats = lambda *args, **kwargs: []
sys.modules['marketmind_ai'] = fake_marketmind_ai
fake_checkout_endpoint = types.ModuleType('checkout_endpoint')
fake_checkout_endpoint.checkout_bp = Blueprint('checkout', __name__)
sys.modules['checkout_endpoint'] = fake_checkout_endpoint

import api as backend_api
from user_state_store import AppUser, reset_runtime_state, session_scope, utcnow


class _ValidTicker:
    def __init__(self, _symbol):
        self.info = {"regularMarketPrice": 100.0}


class SubscriptionLimitTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.tmp_root = self.tmpdir.name
        self.state_db_path = os.path.join(self.tmp_root, 'user_state.db')
        self.original_state = {
            'BASE_DIR': backend_api.BASE_DIR,
            'DATABASE': backend_api.DATABASE,
            'DATABASE_URL': backend_api.DATABASE_URL,
            'PERSISTENCE_MODE': backend_api.PERSISTENCE_MODE,
            'USER_DATA_DIR': backend_api.USER_DATA_DIR,
            'PORTFOLIO_FILE': backend_api.PORTFOLIO_FILE,
            'NOTIFICATIONS_FILE': backend_api.NOTIFICATIONS_FILE,
            'PREDICTION_PORTFOLIO_FILE': backend_api.PREDICTION_PORTFOLIO_FILE,
            'ALLOW_LEGACY_USER_DATA_SEED': backend_api.ALLOW_LEGACY_USER_DATA_SEED,
            'verify_clerk_token': backend_api.verify_clerk_token,
            'limiter_enabled': backend_api.limiter.enabled,
            'predict_stock_handler': backend_api.market_data_handlers.predict_stock_handler,
            'yf_ticker': backend_api.yf.Ticker,
        }

        reset_runtime_state()
        backend_api.BASE_DIR = self.tmp_root
        backend_api.DATABASE = os.path.join(self.tmp_root, 'marketmind_test.db')
        backend_api.DATABASE_URL = f"sqlite:///{self.state_db_path}"
        backend_api.PERSISTENCE_MODE = 'postgres'
        backend_api.USER_DATA_DIR = os.path.join(self.tmp_root, 'user_data')
        backend_api.PORTFOLIO_FILE = os.path.join(self.tmp_root, 'paper_portfolio.json')
        backend_api.NOTIFICATIONS_FILE = os.path.join(self.tmp_root, 'notifications.json')
        backend_api.PREDICTION_PORTFOLIO_FILE = os.path.join(self.tmp_root, 'prediction_portfolio.json')
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = False
        backend_api.verify_clerk_token = lambda token: {
            'sub': token,
            'email': f'{token}@example.com',
            'username': token,
        }
        backend_api.limiter.enabled = False
        backend_api.market_data_handlers.predict_stock_handler = lambda *args, **kwargs: backend_api.jsonify({'ok': True})
        backend_api.yf.Ticker = _ValidTicker

        os.makedirs(backend_api.USER_DATA_DIR, exist_ok=True)
        backend_api._JWKS_CACHE.clear()
        backend_api.init_db()
        backend_api.app.testing = True
        self.client = backend_api.app.test_client()

    def tearDown(self):
        backend_api.BASE_DIR = self.original_state['BASE_DIR']
        backend_api.DATABASE = self.original_state['DATABASE']
        backend_api.DATABASE_URL = self.original_state['DATABASE_URL']
        backend_api.PERSISTENCE_MODE = self.original_state['PERSISTENCE_MODE']
        backend_api.USER_DATA_DIR = self.original_state['USER_DATA_DIR']
        backend_api.PORTFOLIO_FILE = self.original_state['PORTFOLIO_FILE']
        backend_api.NOTIFICATIONS_FILE = self.original_state['NOTIFICATIONS_FILE']
        backend_api.PREDICTION_PORTFOLIO_FILE = self.original_state['PREDICTION_PORTFOLIO_FILE']
        backend_api.ALLOW_LEGACY_USER_DATA_SEED = self.original_state['ALLOW_LEGACY_USER_DATA_SEED']
        backend_api.verify_clerk_token = self.original_state['verify_clerk_token']
        backend_api.limiter.enabled = self.original_state['limiter_enabled']
        backend_api.market_data_handlers.predict_stock_handler = self.original_state['predict_stock_handler']
        backend_api.yf.Ticker = self.original_state['yf_ticker']
        reset_runtime_state()
        self.tmpdir.cleanup()

    def _auth_headers(self, user_id='user_free'):
        return {'Authorization': f'Bearer {user_id}'}

    def _seed_user(self, clerk_user_id, *, plan='free'):
        with session_scope(backend_api.DATABASE_URL) as session:
            session.add(
                AppUser(
                    clerk_user_id=clerk_user_id,
                    email=f'{clerk_user_id}@example.com',
                    username=clerk_user_id,
                    plan=plan,
                    created_at=utcnow(),
                    last_seen_at=utcnow(),
                )
            )

    def test_free_user_cannot_add_more_than_ten_watchlist_items(self):
        headers = self._auth_headers('watchlist_user')
        for index in range(10):
            response = self.client.post(f'/watchlist/T{index}', headers=headers)
            self.assertEqual(response.status_code, 201)

        blocked = self.client.post('/watchlist/EXTRA', headers=headers)
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()['limitKey'], 'watchlist_items')

    def test_free_user_cannot_create_more_than_two_active_alerts(self):
        headers = self._auth_headers('alerts_user')
        for ticker in ('AAPL', 'MSFT'):
            response = self.client.post(
                '/notifications',
                headers=headers,
                json={'ticker': ticker, 'condition': 'above', 'target_price': 123.45},
            )
            self.assertEqual(response.status_code, 201)

        blocked = self.client.post(
            '/notifications',
            headers=headers,
            json={'ticker': 'NVDA', 'condition': 'above', 'target_price': 150.0},
        )
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()['limitKey'], 'active_alerts')

    def test_free_user_cannot_exceed_monthly_paper_trade_limit(self):
        user_id = 'paper_user'
        headers = self._auth_headers(user_id)
        trades = []
        for index in range(20):
            trades.append(
                {
                    'type': 'BUY',
                    'ticker': f'T{index}',
                    'shares': 1,
                    'price': 10.0,
                    'total': 10.0,
                    'timestamp': '2026-04-01T12:00:00+00:00',
                }
            )
        backend_api.save_portfolio_with_snapshot(
            {
                'cash': 99800.0,
                'starting_cash': 100000.0,
                'positions': {},
                'options_positions': {},
                'transactions': [],
                'trade_history': trades,
            },
            user_id,
        )

        blocked = self.client.post('/paper/buy', headers=headers, json={'ticker': 'AAPL', 'shares': 1})
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()['limitKey'], 'paper_trades_per_month')

    def test_free_user_cannot_trade_prediction_markets(self):
        headers = self._auth_headers('prediction_user')
        blocked = self.client.post(
            '/prediction-markets/buy',
            headers=headers,
            json={'market_id': 'm1', 'outcome': 'YES', 'contracts': 1, 'exchange': 'polymarket'},
        )
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()['limitKey'], 'prediction_market_trades_per_month')

    def test_free_user_prediction_quota_blocks_sixth_request(self):
        headers = self._auth_headers('prediction_quota_user')
        for _ in range(5):
            response = self.client.get('/predict/LinReg/AAPL', headers=headers)
            self.assertEqual(response.status_code, 200)

        blocked = self.client.get('/predict/LinReg/AAPL', headers=headers)
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.get_json()['limitKey'], 'prediction_requests_per_day')


if __name__ == '__main__':
    unittest.main()
