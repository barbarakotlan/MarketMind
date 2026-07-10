"""Authorization layer: principals, roles, and capabilities.

Authentication (``api_auth.py``) answers *who are you*; this module answers *what
may you do*. A :class:`Principal` carries the acting identity plus the set of
capabilities it holds, resolved from its roles.

Phase A1 (this module) is deliberately **behavior-preserving**: every
authenticated user is granted the ``user`` role, which holds every non-admin
capability, so nothing is denied until routes begin asserting specific
capabilities (phase A2). The ``g.principal`` set during auth is informational
here — no route reads it for authorization yet.

Capability naming is ``<domain>.<action>`` and stable; the A0 route→capability
map (applied in A2) is:

    /auth/me                         -> account.read
    /deliverables (GET)              -> deliverables.read
    /deliverables (POST/PATCH/PUT/…) -> deliverables.write
    /marketmind-ai/* (GET)           -> ai.read
    /marketmind-ai/* (POST/DELETE)   -> ai.write
    /watchlist (GET)                 -> watchlist.read
    /watchlist/<t> (POST/DELETE)     -> watchlist.write
    /paper/{portfolio,history,transactions} (GET) -> paper.read
    /paper/{buy,sell,options/*,optimize,reset}    -> paper.trade
    /notifications (GET)             -> notifications.read
    /notifications (POST/DELETE)     -> notifications.write
    /prediction-markets/{portfolio,history} (GET) -> prediction_markets.read
    /prediction-markets/{analyze,buy,sell,reset}  -> prediction_markets.trade
    (public-API admin surface)       -> admin.public_api   (admin role only)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, FrozenSet, Iterable, Optional


class Capabilities:
    """Stable capability identifiers, one per (domain, action)."""

    ACCOUNT_READ = "account.read"
    DELIVERABLES_READ = "deliverables.read"
    DELIVERABLES_WRITE = "deliverables.write"
    AI_READ = "ai.read"
    AI_WRITE = "ai.write"
    WATCHLIST_READ = "watchlist.read"
    WATCHLIST_WRITE = "watchlist.write"
    PAPER_READ = "paper.read"
    PAPER_TRADE = "paper.trade"
    PREDICTIONS_RUN = "predictions.run"
    NOTIFICATIONS_READ = "notifications.read"
    NOTIFICATIONS_WRITE = "notifications.write"
    PREDICTION_MARKETS_READ = "prediction_markets.read"
    PREDICTION_MARKETS_TRADE = "prediction_markets.trade"
    # Admin-only.
    ADMIN_PUBLIC_API = "admin.public_api"
    # Developer public-API access (granted to API-key principals).
    PUBLIC_API_READ = "public_api.read"


# Everything a normal signed-in user can do today (full app access). Admin-only
# capabilities are intentionally excluded.
USER_CAPABILITIES: FrozenSet[str] = frozenset(
    {
        Capabilities.ACCOUNT_READ,
        Capabilities.DELIVERABLES_READ,
        Capabilities.DELIVERABLES_WRITE,
        Capabilities.AI_READ,
        Capabilities.AI_WRITE,
        Capabilities.WATCHLIST_READ,
        Capabilities.WATCHLIST_WRITE,
        Capabilities.PAPER_READ,
        Capabilities.PAPER_TRADE,
        Capabilities.PREDICTIONS_RUN,
        Capabilities.NOTIFICATIONS_READ,
        Capabilities.NOTIFICATIONS_WRITE,
        Capabilities.PREDICTION_MARKETS_READ,
        Capabilities.PREDICTION_MARKETS_TRADE,
    }
)

ADMIN_CAPABILITIES: FrozenSet[str] = USER_CAPABILITIES | frozenset(
    {Capabilities.ADMIN_PUBLIC_API}
)

# Roles are named bundles of capabilities. Code-defined for now; a later phase
# may source assignments from Clerk / a local table.
ROLES: Dict[str, FrozenSet[str]] = {
    "user": USER_CAPABILITIES,
    "admin": ADMIN_CAPABILITIES,
}

DEFAULT_ROLE = "user"

# Default capabilities for a developer-API-key principal. The public API is
# read-only; per-key scoping can narrow/extend this later.
PUBLIC_API_CAPABILITIES: FrozenSet[str] = frozenset({Capabilities.PUBLIC_API_READ})

# The full set of known capabilities (union across all roles + API-key defaults).
ALL_CAPABILITIES: FrozenSet[str] = frozenset().union(
    *ROLES.values(), PUBLIC_API_CAPABILITIES
)


@dataclass(frozen=True)
class Principal:
    """The acting identity plus the capabilities it holds."""

    id: str
    kind: str = "user"  # "user" | "api_key"
    roles: FrozenSet[str] = field(default_factory=lambda: frozenset({DEFAULT_ROLE}))
    capabilities: FrozenSet[str] = field(default_factory=frozenset)
    claims: Dict[str, Any] = field(default_factory=dict)

    def has(self, capability: str) -> bool:
        return capability in self.capabilities

    def has_any(self, capabilities: Iterable[str]) -> bool:
        return any(c in self.capabilities for c in capabilities)


def capabilities_for_roles(roles: Iterable[str]) -> FrozenSet[str]:
    caps: set = set()
    for role in roles:
        caps |= ROLES.get(role, frozenset())
    return frozenset(caps)


def roles_from_claims(claims: Optional[Dict[str, Any]]) -> FrozenSet[str]:
    """Resolve roles from Clerk claims, always including the base ``user`` role.

    Clerk can expose roles via ``publicMetadata.roles`` (or a top-level ``roles``
    claim). Unknown role names are ignored. Until admins are provisioned (phase
    A3) this yields ``{"user"}`` for everyone, preserving today's access.
    """
    claims = claims or {}
    raw = (claims.get("publicMetadata") or {}).get("roles")
    if raw is None:
        raw = claims.get("roles")
    if isinstance(raw, str):
        raw = [raw]
    roles = {str(r).strip().lower() for r in (raw or []) if str(r).strip()}
    roles &= set(ROLES)  # drop anything not in the role registry
    roles.add(DEFAULT_ROLE)  # everyone is at least a user
    return frozenset(roles)


def principal_for_user(user_id: str, claims: Optional[Dict[str, Any]] = None) -> Principal:
    """Build a Principal for a Clerk-authenticated user from its token claims."""
    roles = roles_from_claims(claims)
    return Principal(
        id=user_id,
        kind="user",
        roles=roles,
        capabilities=capabilities_for_roles(roles),
        claims=claims or {},
    )


def principal_for_api_key(
    identity: Dict[str, Any],
    capabilities: Optional[Iterable[str]] = None,
) -> Principal:
    """Build a Principal for a developer-API-key request.

    ``identity`` is the authenticated public-API context (client/key metadata).
    Defaults to the read-only public-API capability set; a later phase can derive
    a narrower/wider set from per-key scopes.
    """
    caps = frozenset(capabilities) if capabilities is not None else PUBLIC_API_CAPABILITIES
    return Principal(
        id=str((identity or {}).get("client_id") or ""),
        kind="api_key",
        roles=frozenset(),
        capabilities=caps,
        claims=dict(identity or {}),
    )
