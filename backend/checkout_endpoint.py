import os
import logging
import stripe
from flask import Blueprint, request, jsonify, g
from functools import wraps
from sqlalchemy import select

from user_state_store import (
    AppUser,
    session_scope,
    utcnow,
)

checkout_bp = Blueprint("checkout", __name__)
logger = logging.getLogger(__name__)

def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _configure_stripe() -> None:
    stripe.api_key = _require_env("STRIPE_SECRET_KEY")


def _get_database_url() -> str:
    return _require_env("DATABASE_URL")


def _get_webhook_secret() -> str:
    return _require_env("STRIPE_WEBHOOK_SECRET")


def _get_price_ids() -> dict:
    return {
        "pro_monthly": _require_env("STRIPE_PRICE_PRO_MONTHLY"),
        "pro_annual": _require_env("STRIPE_PRICE_PRO_ANNUAL"),
    }


# ── Auth helper ───────────────────────────────────────────────────────────────
# We import the auth functions lazily (inside the route) to avoid circular
# imports since require_auth and get_current_user_id live in api.py.
def _require_auth_checkout(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        from api import require_auth as _require_auth
        return _require_auth(f)(*args, **kwargs)
    return wrapper


def _get_user_id():
    """Pull the Clerk user ID set by require_auth onto Flask's g."""
    return getattr(g, 'current_user_id', None)


def _stripe_value(obj, key, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _ensure_app_user(session, clerk_user_id: str, *, email: str | None) -> AppUser:
    user = session.get(AppUser, clerk_user_id)
    now = utcnow()
    if user is None:
        user = AppUser(
            clerk_user_id=clerk_user_id,
            email=email,
            plan="free",
            created_at=now,
            last_seen_at=now,
        )
        session.add(user)
    elif email and not user.email:
        user.email = email
    return user


def _get_authenticated_email(clerk_user_id: str) -> str | None:
    auth_payload = getattr(g, "auth_payload", {}) or {}
    auth_email = str(auth_payload.get("email") or "").strip()
    if auth_email:
        return auth_email

    with session_scope(_get_database_url()) as session:
        user = session.get(AppUser, clerk_user_id)
        if user and user.email:
            return str(user.email).strip()
    return None


# ── Helper: find or upsert stripe_customer_id on AppUser ─────────────────────
def _get_or_create_stripe_customer(clerk_user_id: str, email: str) -> stripe.Customer:
    """
    Look up the Stripe customer ID stored on the user row.
    If none exists yet, create a new customer and persist the ID back to the DB.
    """
    with session_scope(_get_database_url()) as session:
        user = _ensure_app_user(session, clerk_user_id, email=email)

        # Reuse stored customer ID if we have one
        if user and user.stripe_customer_id:
            try:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
                if _stripe_value(customer, "deleted", False):
                    user.stripe_customer_id = None
                else:
                    return customer
            except stripe.error.InvalidRequestError:
                user.stripe_customer_id = None

        customer = stripe.Customer.create(
            email=email,
            metadata={"clerk_user_id": clerk_user_id},
        )

        if user:
            user.stripe_customer_id = customer.id

    return customer


def _set_user_plan(stripe_customer_id: str, plan: str, subscription_status: str):
    """Find user by stripe_customer_id and update their plan."""
    with session_scope(_get_database_url()) as session:
        users = session.scalars(
            select(AppUser).where(AppUser.stripe_customer_id == stripe_customer_id)
        ).all()
        if len(users) != 1:
            if users:
                logger.warning(
                    "Skipping Stripe plan update for customer %s because ownership is ambiguous (%s rows)",
                    stripe_customer_id,
                    len(users),
                )
            return

        user = users[0]
        user.plan = plan
        user.subscription_status = subscription_status


# ── POST /checkout/create-subscription ───────────────────────────────────────
@checkout_bp.route("/checkout/create-subscription", methods=["POST"])
@_require_auth_checkout
def create_subscription():
    """
    Body: { "email": "user@example.com", "billing": "monthly" | "annual" }
    Returns: { "clientSecret": "...", "subscriptionId": "...", "customerId": "..." }
    """
    clerk_user_id = _get_user_id()
    if not clerk_user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data    = request.get_json(silent=True) or {}
    billing = data.get("billing", "monthly")

    email = _get_authenticated_email(clerk_user_id)
    if not email:
        return jsonify({"error": "Authenticated email is required to create a subscription."}), 400

    try:
        _configure_stripe()
        price_id = _get_price_ids().get("pro_annual" if billing == "annual" else "pro_monthly")
        if not price_id:
            return jsonify({"error": f"Unknown billing cadence: {billing}"}), 400

        customer = _get_or_create_stripe_customer(clerk_user_id, email)

        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            expand=["latest_invoice"],
        )

        latest_invoice = _stripe_value(subscription, "latest_invoice")
        latest_invoice_id = _stripe_value(latest_invoice, "id", latest_invoice)
        invoice = stripe.Invoice.retrieve(
            latest_invoice_id,
            expand=["confirmation_secret"],
        )
        confirmation_secret = _stripe_value(invoice, "confirmation_secret")

        return jsonify({
            "clientSecret":   _stripe_value(confirmation_secret, "client_secret"),
            "subscriptionId": _stripe_value(subscription, "id"),
            "customerId":     _stripe_value(customer, "id"),
        })

    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except stripe.error.StripeError as e:
        return jsonify({"error": e.user_message}), 400


# ── POST /checkout/webhook ────────────────────────────────────────────────────
@checkout_bp.route("/checkout/webhook", methods=["POST"])
def stripe_webhook():
    """
    Register in Stripe Dashboard → Developers → Webhooks.
    For local dev: stripe listen --forward-to localhost:5001/checkout/webhook
    """
    payload = request.get_data()
    sig     = request.headers.get("Stripe-Signature", "")

    try:
        _configure_stripe()
        event = stripe.Webhook.construct_event(payload, sig, _get_webhook_secret())
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Invalid signature"}), 400

    etype = event["type"]
    obj   = event["data"]["object"]

    if etype == "invoice.payment_succeeded":
        customer_id = obj["customer"]
        _set_user_plan(customer_id, "pro", "active")

    elif etype == "invoice.payment_failed":
        customer_id = obj["customer"]
        _set_user_plan(customer_id, "free", "past_due")

    elif etype == "customer.subscription.updated":
        customer_id = obj["customer"]
        status      = obj["status"]
        plan        = "pro" if status == "active" else "free"
        _set_user_plan(customer_id, plan, status)

    elif etype == "customer.subscription.deleted":
        customer_id = obj["customer"]
        _set_user_plan(customer_id, "free", "canceled")

    return jsonify({"received": True})


# ── POST /checkout/cancel-subscription ───────────────────────────────────────
@checkout_bp.route("/checkout/cancel-subscription", methods=["POST"])
@_require_auth_checkout
def cancel_subscription():
    """
    Body: { "subscriptionId": "sub_1ABC..." }
    Cancels at period end — user keeps Pro until billing date.
    """
    clerk_user_id = _get_user_id()
    if not clerk_user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data            = request.get_json(silent=True) or {}
    subscription_id = (data.get("subscriptionId") or "").strip()

    if not subscription_id:
        return jsonify({"error": "subscriptionId is required."}), 400

    try:
        _configure_stripe()
        with session_scope(_get_database_url()) as session:
            user = session.get(AppUser, clerk_user_id)
            stripe_customer_id = user.stripe_customer_id if user else None

        if not stripe_customer_id:
            return jsonify({"error": "No linked Stripe customer found for this user."}), 409

        subscription = stripe.Subscription.retrieve(subscription_id)
        subscription_customer_id = str(_stripe_value(subscription, "customer", "") or "")
        if subscription_customer_id != stripe_customer_id:
            return jsonify({"error": "You are not allowed to manage this subscription."}), 403

        sub = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        return jsonify({
            "status":            _stripe_value(sub, "status"),
            "cancelAtPeriodEnd": _stripe_value(sub, "cancel_at_period_end"),
            "currentPeriodEnd":  _stripe_value(sub, "current_period_end"),
        })
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except stripe.error.StripeError as e:
        return jsonify({"error": e.user_message}), 400


# ── GET /checkout/plan-status ─────────────────────────────────────────────────
@checkout_bp.route("/checkout/plan-status", methods=["GET"])
@_require_auth_checkout
def plan_status():
    """
    Returns the current user's plan and subscription status.
    Frontend can call this on load to gate Pro features.
    """
    clerk_user_id = _get_user_id()
    if not clerk_user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        with session_scope(_get_database_url()) as session:
            user = session.get(AppUser, clerk_user_id)
            if not user:
                return jsonify({"plan": "free", "subscriptionStatus": None})

            return jsonify({
                "plan":               user.plan,
                "subscriptionStatus": user.subscription_status,
            })
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
