import os
import stripe
from flask import Blueprint, request, jsonify

checkout_bp = Blueprint("checkout", __name__)

# ── Stripe config ─────────────────────────────────────────────────────────────
# Set these in your environment / .env — never hardcode keys
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]

# Price IDs — create these in your Stripe Dashboard:
#   Dashboard → Products → Add Product → "MarketMind Pro"
#   Add two prices: one monthly recurring, one annual recurring
PRICE_IDS = {
    "pro_monthly": os.environ["STRIPE_PRICE_PRO_MONTHLY"],  # e.g. price_1ABC...
    "pro_annual":  os.environ["STRIPE_PRICE_PRO_ANNUAL"],   # e.g. price_1XYZ...
}


# ── POST /api/checkout/create-subscription ────────────────────────────────────
@checkout_bp.route("/checkout/create-subscription", methods=["POST"])
def create_subscription():
    """
    Body:  { "email": "user@example.com", "billing": "monthly" | "annual" }
    Returns: { "clientSecret": "...", "subscriptionId": "...", "customerId": "..." }

    Creates a Stripe Customer (or reuses one) and a Subscription in
    "incomplete" state. The clientSecret is passed to the frontend so
    Stripe's Payment Element can confirm the payment without card data
    ever touching your server.
    """
    data    = request.get_json()
    email   = (data.get("email") or "").strip()
    billing = data.get("billing", "monthly")

    if not email:
        return jsonify({"error": "Email is required."}), 400

    price_id = PRICE_IDS.get("pro_annual" if billing == "annual" else "pro_monthly")
    if not price_id:
        return jsonify({"error": f"Unknown billing cadence: {billing}"}), 400

    try:
        # Reuse existing Stripe customer if one exists for this email.
        # In production: store customer_id in your DB on first creation and
        # look it up here instead of searching — search is slower.
        existing = stripe.Customer.search(query=f'email:"{email}"', limit=1)
        customer = existing.data[0] if existing.data else stripe.Customer.create(email=email)

        # Create subscription in incomplete state — no charge yet.
        # Stripe waits for stripe.confirmPayment() on the frontend.
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


# ── POST /api/checkout/webhook ────────────────────────────────────────────────
@checkout_bp.route("/checkout/webhook", methods=["POST"])
def stripe_webhook():
    """
    Register in Stripe Dashboard → Developers → Webhooks:
        URL: https://yourdomain.com/api/checkout/webhook
        Events: invoice.payment_succeeded, invoice.payment_failed,
                customer.subscription.updated, customer.subscription.deleted

    For local dev use the Stripe CLI:
        stripe listen --forward-to localhost:5000/api/checkout/webhook
    This also prints your local STRIPE_WEBHOOK_SECRET to use in .env.
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
        customer_id     = obj["customer"]
        subscription_id = obj["subscription"]
        # TODO: find user by customer_id in your DB, set plan = "pro"
        print(f"[stripe] payment succeeded | customer={customer_id} sub={subscription_id}")

    elif etype == "invoice.payment_failed":
        customer_id = obj["customer"]
        # TODO: notify user, mark plan as "past_due" in your DB
        print(f"[stripe] payment FAILED | customer={customer_id}")

    elif etype == "customer.subscription.updated":
        customer_id = obj["customer"]
        status      = obj["status"]  # active | past_due | canceled | ...
        # TODO: sync status to your DB
        print(f"[stripe] subscription updated | customer={customer_id} status={status}")

    elif etype == "customer.subscription.deleted":
        customer_id = obj["customer"]
        # TODO: downgrade user to free in your DB
        print(f"[stripe] subscription cancelled | customer={customer_id}")

    return jsonify({"received": True})


# ── POST /api/checkout/cancel-subscription ────────────────────────────────────
@checkout_bp.route("/checkout/cancel-subscription", methods=["POST"])
def cancel_subscription():
    """
    Body: { "subscriptionId": "sub_1ABC..." }

    Sets cancel_at_period_end=True so the user keeps Pro access until
    their current billing period ends — no immediate cutoff.
    """
    data            = request.get_json()
    subscription_id = (data.get("subscriptionId") or "").strip()

    if not subscription_id:
        return jsonify({"error": "subscriptionId is required."}), 400

    try:
        sub = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
        return jsonify({
            "status":             sub.status,
            "cancelAtPeriodEnd":  sub.cancel_at_period_end,
            "currentPeriodEnd":   sub.current_period_end,
        })
    except stripe.error.StripeError as e:
        return jsonify({"error": e.user_message}), 400