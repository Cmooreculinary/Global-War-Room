"""Billing — Stripe Checkout for Cerebral Cortex membership.

Pricing v1:
  - 5 free verdicts per archive_id (lifetime, not per month — keeps it simple
    until accounts land; we can prorate on account merge later).
  - $10/month membership unlocks unlimited verdicts.

Identity: the existing per-browser archive_id is treated as the user
identifier. When Google sign-in lands later, we'll map the archive_id onto
the user account and merge subscription state.
"""
import json
import os
from typing import Optional

import stripe
from pydantic import BaseModel, Field

# --- Plan catalog (server-side authoritative; frontend never sets price) --- #

FREE_VERDICT_LIMIT = 5

PLANS = {
    "membership_monthly": {
        "id": "membership_monthly",
        "label": "Cortex Membership",
        "price_usd": 10.00,
        "currency": "usd",
        "cadence": "monthly",
        "blurb": "Unlimited verdicts. Court sessions. The full bench.",
    },
}


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "usd"
    success_url: str
    cancel_url: str
    metadata: Optional[dict[str, str]] = None


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: int
    currency: str
    metadata: dict[str, str] = Field(default_factory=dict)


class WebhookEventResponse(BaseModel):
    event_type: str
    event_id: str
    session_id: Optional[str] = None
    payment_status: Optional[str] = None
    metadata: dict[str, str] = Field(default_factory=dict)


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: Optional[str] = None):
        self.api_key = api_key
        self.webhook_url = webhook_url
        self.webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        stripe.api_key = api_key

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        amount_in_cents = int(request.amount * 100)
        metadata = dict(request.metadata or {})
        if self.webhook_url:
            metadata["webhook_url"] = self.webhook_url
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": request.currency,
                    "product_data": {"name": "Cortex Membership"},
                    "unit_amount": amount_in_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata=metadata,
        )
        return CheckoutSessionResponse(url=session.url, session_id=session.id)

    async def get_checkout_status(self, checkout_session_id: str) -> CheckoutStatusResponse:
        session = stripe.checkout.Session.retrieve(checkout_session_id)
        return CheckoutStatusResponse(
            status=session.status,
            payment_status=session.payment_status,
            amount_total=session.amount_total or 0,
            currency=session.currency or "usd",
            metadata=dict(session.metadata or {}),
        )

    async def handle_webhook(self, payload: bytes, signature: Optional[str] = None) -> WebhookEventResponse:
        if self.webhook_secret:
            event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
            event = event.to_dict() if hasattr(event, "to_dict") else dict(event)
        else:
            event = json.loads(payload.decode("utf-8"))

        event_type = event["type"]
        event_id = event["id"]
        data = event.get("data") or {}
        if not isinstance(data, dict) and hasattr(data, "to_dict"):
            data = data.to_dict()
        obj = data.get("object") or {}
        if not isinstance(obj, dict) and hasattr(obj, "to_dict"):
            obj = obj.to_dict()
        metadata = dict(obj.get("metadata") or {})
        session_id = None
        payment_status = None

        if event_type in ("checkout.session.completed", "checkout.session.expired"):
            session_id = obj.get("id")
            payment_status = obj.get("payment_status")
        elif event_type == "payment_intent.succeeded":
            session_id = metadata.get("checkout_session_id")
            payment_status = "paid"
        elif event_type == "payment_intent.payment_failed":
            session_id = metadata.get("checkout_session_id")
            payment_status = "failed"

        return WebhookEventResponse(
            event_type=event_type,
            event_id=event_id,
            session_id=session_id,
            payment_status=payment_status,
            metadata=metadata,
        )


def get_plan(plan_id: str) -> Optional[dict]:
    return PLANS.get(plan_id)


def stripe_client(webhook_url: str) -> StripeCheckout:
    api_key = os.environ["STRIPE_API_KEY"]
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


async def create_membership_checkout(
    *,
    plan_id: str,
    archive_id: str,
    origin_url: str,
    webhook_url: str,
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout Session for a fixed plan."""
    plan = get_plan(plan_id)
    if plan is None:
        raise ValueError(f"Unknown plan: {plan_id}")

    success_url = f"{origin_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/pricing"

    sc = stripe_client(webhook_url)
    req = CheckoutSessionRequest(
        amount=plan["price_usd"],
        currency=plan["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "plan_id": plan_id,
            "archive_id": archive_id,
            "product": "cortex_membership",
        },
    )
    return await sc.create_checkout_session(req)
