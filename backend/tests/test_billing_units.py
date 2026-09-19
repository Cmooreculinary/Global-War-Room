"""Lifetime plan catalog and checkout-origin allow-list."""
import os

import pytest

import billing


def test_lifetime_plan_is_fifteen_dollars_once():
    plan = billing.get_plan("membership_lifetime")
    assert plan is not None
    assert plan["price_usd"] == 15.00
    assert plan["cadence"] == "lifetime"
    assert plan["currency"] == "usd"


def test_monthly_id_still_resolves_to_the_lifetime_price():
    alias = billing.get_plan("membership_monthly")
    assert alias is not None
    assert alias["price_usd"] == 15.00
    assert alias["cadence"] == "lifetime"


def test_public_plans_advertise_only_lifetime():
    plans = billing.public_plans()
    assert [p["id"] for p in plans] == ["membership_lifetime"]


def test_public_base_url_wins(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://warroom.example")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("CHECKOUT_ORIGINS", raising=False)
    assert billing.resolve_checkout_origin("https://evil.example") == "https://warroom.example"


def test_cors_allowlist_accepts_listed_origin(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example, https://other.example")
    assert (
        billing.resolve_checkout_origin("https://app.example/extra")
        == "https://app.example"
    )


def test_cors_allowlist_rejects_unknown_origin(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example")
    with pytest.raises(ValueError):
        billing.resolve_checkout_origin("https://evil.example")


def test_wildcard_cors_only_allows_localhost(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "*")
    assert billing.resolve_checkout_origin("http://localhost:3000") == "http://localhost:3000"
    with pytest.raises(ValueError):
        billing.resolve_checkout_origin("https://evil.example")


def test_origin_with_credentials_is_rejected(monkeypatch):
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example")
    with pytest.raises(ValueError):
        billing.resolve_checkout_origin("https://user:pass@app.example")
