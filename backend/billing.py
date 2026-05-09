"""Billing — Stripe Checkout for Cerebral Cortex membership.

Pricing v1:
  - 5 free verdicts per archive_id (lifetime, not per month — keeps it simple
    until accounts land; we can prorate on account merge later).
  - $10/month membership unlocks unlimited verdicts.

Identity: the existing per-browser archive_id is treated as the user
identifier. When Google sign-in lands later, we'll map the archive_id onto
the user account and merge subscription state.
"""
import os
from typing import Optional

from emergentintegrations.payments.stripe.checkout import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    StripeCheckout,
)

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
