"""Billing — Stripe Checkout for Cerebral Cortex membership.

Pricing v1:
  - 5 free verdicts per archive_id (lifetime, not per month — keeps it simple
    until accounts land; we can prorate on account merge later).
  - $15 one-time lifetime membership unlocks unlimited verdicts.

Identity: the existing per-browser archive_id is treated as the user
identifier. When Google sign-in lands later, we'll map the archive_id onto
the user account and merge subscription state.

Stripe access goes through the official ``stripe`` SDK. The thin wrapper below
keeps the async, dataclass-shaped surface the rest of the app builds against so
callers stay decoupled from the SDK's synchronous, dict-like objects.
"""
import asyncio
import os
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

import stripe

# --- Plan catalog (server-side authoritative; frontend never sets price) --- #

FREE_VERDICT_LIMIT = 5

_LIFETIME = {
    "id": "membership_lifetime",
    "label": "Lifetime membership",
    "price_usd": 15.00,
    "currency": "usd",
    "cadence": "lifetime",
    "blurb": "Pay once. Unlimited verdicts, courts, and the full bench — forever.",
}

PLANS = {
    "membership_lifetime": _LIFETIME,
    # Older clients and existing Mongo rows still send this id.
    "membership_monthly": {**_LIFETIME, "id": "membership_monthly"},
}

# Product name shown on the Stripe-hosted checkout page.
CHECKOUT_PRODUCT_NAME = "Global War Room Lifetime Membership"


def get_plan(plan_id: str) -> Optional[dict]:
    return PLANS.get(plan_id)


def public_plans() -> list:
    """Plans advertised to the client — one lifetime offer."""
    return [_LIFETIME]


def _normalize_origin(url: str) -> Optional[str]:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    if parsed.username or parsed.password:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def _origin_allowlist() -> list[str]:
    raw = os.environ.get("CHECKOUT_ORIGINS") or os.environ.get("CORS_ORIGINS", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip() and o.strip() != "*"]


def resolve_checkout_origin(requested: str, request_origin: Optional[str] = None) -> str:
    """Pick a Stripe redirect origin the server is willing to send buyers to.

    Order: PUBLIC_BASE_URL (authoritative), then an allow-listed requested /
    Origin header. A wildcard CORS list only permits localhost, so a caller
    cannot mint checkout that returns to an arbitrary phishing host.
    """
    public = _normalize_origin(os.environ.get("PUBLIC_BASE_URL", ""))
    if public:
        return public

    requested_n = _normalize_origin(requested)
    header_n = _normalize_origin(request_origin or "")
    allowed = _origin_allowlist()

    if allowed:
        if requested_n and requested_n in allowed:
            return requested_n
        if header_n and header_n in allowed:
            return header_n
        raise ValueError("Checkout origin is not allow-listed")

    for candidate in (requested_n, header_n):
        if candidate and (
            candidate.startswith("http://localhost")
            or candidate.startswith("https://localhost")
            or candidate.startswith("http://127.0.0.1")
            or candidate.startswith("https://127.0.0.1")
        ):
            return candidate
    raise ValueError("Checkout origin is not allow-listed")


# --------------------------------------------------------------------------- #
# Stripe wrapper — async, dataclass-shaped surface over the ``stripe`` SDK      #
# --------------------------------------------------------------------------- #

@dataclass
class CheckoutSessionRequest:
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: dict = field(default_factory=dict)


@dataclass
class CheckoutSessionResponse:
    session_id: str
    url: Optional[str] = None


@dataclass
class CheckoutStatusResponse:
    status: Optional[str]
    payment_status: Optional[str]
    amount_total: Optional[float]
    currency: Optional[str]
    metadata: dict = field(default_factory=dict)


@dataclass
class WebhookEventResponse:
    event_type: Optional[str]
    session_id: Optional[str]
    payment_status: Optional[str]
    metadata: dict = field(default_factory=dict)


class StripeCheckout:
    """Minimal async facade over Stripe Checkout used by the billing routes."""

    def __init__(self, api_key: str, webhook_url: Optional[str] = None):
        self.api_key = api_key
        self.webhook_url = webhook_url
        self.webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

    async def create_checkout_session(
        self, req: CheckoutSessionRequest
    ) -> CheckoutSessionResponse:
        def _create():
            return stripe.checkout.Session.create(
                api_key=self.api_key,
                mode="payment",
                success_url=req.success_url,
                cancel_url=req.cancel_url,
                line_items=[
                    {
                        "price_data": {
                            "currency": req.currency,
                            "product_data": {"name": CHECKOUT_PRODUCT_NAME},
                            "unit_amount": round(float(req.amount) * 100),
                        },
                        "quantity": 1,
                    }
                ],
                metadata=req.metadata or {},
            )

        session = await asyncio.to_thread(_create)
        return CheckoutSessionResponse(session_id=session.id, url=session.url)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        def _retrieve():
            return stripe.checkout.Session.retrieve(session_id, api_key=self.api_key)

        session = await asyncio.to_thread(_retrieve)
        amount_total = session.get("amount_total")
        return CheckoutStatusResponse(
            status=session.get("status"),
            payment_status=session.get("payment_status"),
            amount_total=(amount_total / 100) if amount_total is not None else None,
            currency=session.get("currency"),
            metadata=dict(session.get("metadata") or {}),
        )

    async def handle_webhook(self, payload: bytes, signature: str) -> WebhookEventResponse:
        def _construct():
            if not self.webhook_secret:
                raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured")
            return stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )

        event = await asyncio.to_thread(_construct)
        session = (event.get("data") or {}).get("object") or {}
        return WebhookEventResponse(
            event_type=event.get("type"),
            session_id=session.get("id"),
            payment_status=session.get("payment_status"),
            metadata=dict(session.get("metadata") or {}),
        )


def stripe_client(webhook_url: str) -> StripeCheckout:
    api_key = os.environ["STRIPE_API_KEY"]
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


async def create_membership_checkout(
    *,
    plan_id: str,
    archive_id: str,
    origin_url: str,
    webhook_url: str,
    request_origin: Optional[str] = None,
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout Session for a fixed plan."""
    plan = get_plan(plan_id)
    if plan is None:
        raise ValueError(f"Unknown plan: {plan_id}")

    origin = resolve_checkout_origin(origin_url, request_origin)
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

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
