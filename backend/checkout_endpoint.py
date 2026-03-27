import os
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

# ── Stripe config ─────────────────────────────────────────────────────────────
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]
DATABASE_URL   = os.environ["DATABASE_URL"]

PRICE_IDS = {
    "pro_monthly": os.environ["STRIPE_PRICE_PRO_MONTHLY"],
    "pro_annual":  os.environ["STRIPE_PRICE_PRO_ANNUAL"],
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


# ── Helper: find or upsert stripe_customer_id on AppUser ─────────────────────
def _get_or_create_stripe_customer(clerk_user_id: str, email: str) -> stripe.Customer:
    """
    Look up the Stripe customer ID stored on the user row.
    If none exists yet, search Stripe by email or create a new customer,
    then persist the ID back to the DB.
    """
    with session_scope(DATABASE_URL) as session:
        user = session.get(AppUser, clerk_user_id)

        # Reuse stored customer ID if we have one
        if user and user.stripe_customer_id:
            return stripe.Customer.retrieve(user.stripe_customer_id)

        # Search Stripe by email as fallback
        existing = stripe.Customer.search(query=f'email:"{email}"', limit=1)
        customer = existing.data[0] if existing.data else stripe.Customer.create(email=email)

        # Persist the customer ID so we never create duplicates
        if user:
            user.stripe_customer_id = customer.id
        else:
            # Touch the user row into existence (shouldn't normally happen
            # since Clerk auth syncs users, but defensive fallback)
            session.add(AppUser(
                clerk_user_id=clerk_user_id,
                email=email,
                stripe_customer_id=customer.id,
                plan="free",
                created_at=utcnow(),
                last_seen_at=utcnow(),
            ))

    return customer


def _set_user_plan(stripe_customer_id: str, plan: str, subscription_status: str):
    """Find user by stripe_customer_id and update their plan."""
    with session_scope(DATABASE_URL) as session:
        user = session.scalars(
            select(AppUser).where(AppUser.stripe_customer_id == stripe_customer_id)
        ).first()
        if user:
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

    data    = request.get_json()
    email   = (data.get("email") or "").strip()
    billing = data.get("billing", "monthly")

    if not email:
        return jsonify({"error": "Email is required."}), 400

    price_id = PRICE_IDS.get("pro_annual" if billing == "annual" else "pro_monthly")
    if not price_id:
        return jsonify({"error": f"Unknown billing cadence: {billing}"}), 400

    try:
        customer = _get_or_create_stripe_customer(clerk_user_id, email)

        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            expand=["latest_invoice"],
        )

        invoice = stripe.Invoice.retrieve(
            subscription.latest_invoice.id,
            expand=["confirmation_secret"],
        )

        return jsonify({
            "clientSecret":   invoice.confirmation_secret.client_secret,
            "subscriptionId": subscription.id,
            "customerId":     customer.id,
        })

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
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
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

    data            = request.get_json()
    subscription_id = (data.get("subscriptionId") or "").strip()

    if not subscription_id:
        return jsonify({"error": "subscriptionId is required."}), 400

    try:
        sub = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        return jsonify({
            "status":            sub.status,
            "cancelAtPeriodEnd": sub.cancel_at_period_end,
            "currentPeriodEnd":  sub.current_period_end,
        })
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

    with session_scope(DATABASE_URL) as session:
        user = session.get(AppUser, clerk_user_id)
        if not user:
            return jsonify({"plan": "free", "subscriptionStatus": None})

        return jsonify({
            "plan":               user.plan,
            "subscriptionStatus": user.subscription_status,
        })