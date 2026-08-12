"""Feed parsing tests, driven through a mock transport.

These exercise the real fetch functions against realistic payloads — RSS 2.0,
Atom, RDF and the GDELT DOC API — without touching the network, so a parsing
regression is caught even where outbound access is blocked.
"""
import asyncio

import httpx
import pytest

import intel

RSS_2 = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>World</title>
  <item>
    <title>Taiwan reports naval activity in the strait</title>
    <description>&lt;p&gt;Officials said &lt;b&gt;three vessels&lt;/b&gt; were tracked overnight.&lt;/p&gt;</description>
    <link>https://example.org/a</link>
    <pubDate>Tue, 12 Aug 2026 06:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Cricket final draws record crowd</title>
    <description>Unrelated sport coverage.</description>
    <link>https://example.org/b</link>
    <pubDate>Tue, 12 Aug 2026 05:00:00 GMT</pubDate>
  </item>
</channel></rss>"""

ATOM = """<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Strait tensions rise as talks stall</title>
    <summary>Negotiations broke down on Monday.</summary>
    <link href="https://example.net/x"/>
    <updated>2026-08-12T07:30:00Z</updated>
  </entry>
</feed>"""

RDF = """<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <item>
    <title>Strait shipping reroutes around exercise zone</title>
    <description>Carriers announced new routing.</description>
    <link>https://example.de/y</link>
    <dc:date>2026-08-12</dc:date>
  </item>
</rdf:RDF>"""

GDELT_JSON = {
    "articles": [
        {"title": "Wire report on the strait", "domain": "reuters.com",
         "url": "https://reuters.com/1", "seendate": "20260812T060000Z"},
        {"title": "Opinion on the strait", "domain": "foxnews.com",
         "url": "https://foxnews.com/2", "seendate": "20260812T070000Z"},
        {"title": "Coverage from an unlisted site", "domain": "some-outlet.example",
         "url": "https://some-outlet.example/3", "seendate": "20260812T080000Z"},
    ]
}


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _run(coro):
    return asyncio.run(coro)


# ---- RSS / Atom / RDF ----------------------------------------------------- #

def test_rss_parsing_keeps_relevant_items_and_cleans_html():
    async def go():
        async with _client(lambda _r: httpx.Response(200, content=RSS_2.encode())) as c:
            return await intel._fetch_rss(c, "BBC News", "https://feed", "center", ["strait", "taiwan"])

    items = _run(go())
    assert len(items) == 1, "the unrelated item should have been filtered out"
    item = items[0]
    assert item["outlet"] == "BBC News" and item["lean"] == "center"
    assert item["url"] == "https://example.org/a"
    assert "<b>" not in item["summary"] and "three vessels" in item["summary"]


def test_atom_parsing_reads_href_links():
    async def go():
        async with _client(lambda _r: httpx.Response(200, content=ATOM.encode())) as c:
            return await intel._fetch_rss(c, "France 24", "https://feed", "international", ["strait"])

    items = _run(go())
    assert len(items) == 1
    assert items[0]["url"] == "https://example.net/x"
    assert items[0]["published"].startswith("2026-08-12")


def test_rdf_parsing_is_supported():
    async def go():
        async with _client(lambda _r: httpx.Response(200, content=RDF.encode())) as c:
            return await intel._fetch_rss(c, "Deutsche Welle", "https://feed", "international", ["strait"])

    items = _run(go())
    assert len(items) == 1
    assert "shipping" in items[0]["title"].lower()


def test_a_feed_with_no_topic_match_yields_nothing():
    async def go():
        async with _client(lambda _r: httpx.Response(200, content=RSS_2.encode())) as c:
            return await intel._fetch_rss(c, "BBC News", "https://feed", "center", ["saharan", "locusts"])

    assert _run(go()) == []


def test_malformed_xml_raises_for_the_gatherer_to_absorb():
    async def go():
        async with _client(lambda _r: httpx.Response(200, content=b"<rss><broken>")) as c:
            return await intel._fetch_rss(c, "BBC News", "https://feed", "center", ["x"])

    with pytest.raises(Exception):
        _run(go())


# ---- GDELT ---------------------------------------------------------------- #

def test_gdelt_maps_domains_to_outlets_and_leans():
    async def go():
        async with _client(lambda _r: httpx.Response(200, json=GDELT_JSON)) as c:
            return await intel._fetch_gdelt(c, "taiwan strait", 24, 20)

    items = _run(go())
    assert len(items) == 3
    by_outlet = {i["outlet"]: i["lean"] for i in items}
    assert by_outlet["Reuters"] == "wire"
    assert by_outlet["Fox News"] == "right"
    assert "unlabeled" in by_outlet.values(), "an unlisted domain must stay unlabeled"


def test_gdelt_html_error_page_is_treated_as_no_results():
    async def go():
        async with _client(
            lambda _r: httpx.Response(200, text="Your query was too short.", headers={"content-type": "text/html"})
        ) as c:
            return await intel._fetch_gdelt(c, "a", 24, 20)

    assert _run(go()) == []


def test_gdelt_error_status_raises_for_the_gatherer_to_absorb():
    async def go():
        async with _client(lambda _r: httpx.Response(503, text="upstream down")) as c:
            return await intel._fetch_gdelt(c, "taiwan", 24, 20)

    with pytest.raises(httpx.HTTPStatusError):
        _run(go())


# ---- The gatherer absorbs individual failures ----------------------------- #

def test_one_dead_feed_does_not_sink_the_gather(monkeypatch):
    async def ok_gdelt(*_args, **_kwargs):
        return [intel._item("Wire story on the strait", "Reuters", "wire", "https://r/1")]

    async def dead_rss(_client, outlet, *_args, **_kwargs):
        if outlet == "BBC News":
            raise httpx.ConnectError("boom")
        return [intel._item(f"{outlet} on the strait", outlet, "center", f"https://{outlet}/1")]

    monkeypatch.setattr(intel, "_fetch_gdelt", ok_gdelt)
    monkeypatch.setattr(intel, "_fetch_rss", dead_rss)

    result = _run(intel.fetch_live("strait", window_hours=24, limit=10))
    assert result["reachable"] is True
    assert result["items"], "surviving feeds should still produce items"
    assert any("BBC News" in n for n in result["notes"]), "the dead feed must be reported"


def test_total_network_failure_is_reported_not_raised(monkeypatch):
    async def dead(*_args, **_kwargs):
        raise httpx.ConnectError("no route to host")

    monkeypatch.setattr(intel, "_fetch_gdelt", dead)
    monkeypatch.setattr(intel, "_fetch_rss", dead)

    result = _run(intel.fetch_live("strait", window_hours=24, limit=10))
    assert result["items"] == []
    assert result["reachable"] is False
    assert any("outbound network" in n for n in result["notes"])


def test_state_media_is_excluded_unless_requested(monkeypatch):
    called = []

    async def spy_rss(_client, outlet, *_args, **_kwargs):
        called.append(outlet)
        return []

    async def no_gdelt(*_args, **_kwargs):
        return []

    monkeypatch.setattr(intel, "_fetch_gdelt", no_gdelt)
    monkeypatch.setattr(intel, "_fetch_rss", spy_rss)

    _run(intel.fetch_live("topic", include_state=False))
    assert not any(o in ("Xinhua", "TASS") for o in called)

    called.clear()
    _run(intel.fetch_live("topic", include_state=True))
    assert any(o in ("Xinhua", "TASS") for o in called)
