"""Shared Flask extensions.

Instances are created here WITHOUT an app so they can be imported at module
scope (e.g. by ``@limiter.limit`` route decorators) and bound to the actual
application later inside ``create_app()`` via ``limiter.init_app(app)``.
"""
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    headers_enabled=True,
    storage_uri=os.getenv('PUBLIC_API_RATE_LIMIT_STORAGE_URL', '').strip() or None,
)


# Rate-limit strings, read once from the environment (same defaults as before).
class RateLimits:
    LIGHT = os.getenv('RATE_LIMIT_LIGHT', '10/minute')
    STANDARD = os.getenv('RATE_LIMIT_STANDARD', '20/minute')
    HEAVY = os.getenv('RATE_LIMIT_HEAVY', '2/minute')
    WRITE = os.getenv('RATE_LIMIT_WRITE', '5/minute')
