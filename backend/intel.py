"""Intelligence intake for The War Room.

Two ways in:
  * live  — pull today's coverage from free, key-less sources (GDELT + RSS)
  * paste — the user supplies the raw material (articles, cables, transcripts)

Everything that comes out of here carries an outlet and a declared political
lean, because the sifting pass downstream can only strip framing it can see.
A source with an unknown lean is labelled "unlabeled" rather than guessed at.

Nothing here calls an LLM. This module fetches and normalises; personas.py
holds the prompt that turns the result into a neutral brief.
"""
import asyncio
import logging
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Iterable, Optional
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "CerebralCortex-WarRoom/1.0 (+strategic analysis; contact via app)"
FETCH_TIMEOUT = float(os.environ.get("WARROOM_FETCH_TIMEOUT", "12"))
MAX_ITEMS = int(os.environ.get("WARROOM_MAX_ITEMS", "28"))
MAX_PASTED_CHARS = int(os.environ.get("WARROOM_MAX_PASTED_CHARS", "60000"))
LIVE_ENABLED = os.environ.get("WARROOM_LIVE_SOURCES", "1") not in ("0", "false", "False")

# Lean labels are coarse on purpose. They exist so the sifter can notice that a
# framing is carried only by one side of the spectrum — not to rank outlets.
LEANS = ("wire", "left", "center-left", "center", "center-right", "right", "international", "state")


# --------------------------------------------------------------------------- #
# Source registry                                                             #
# --------------------------------------------------------------------------- #

RSS_FEEDS = [
    # outlet, url, lean, country
    ("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml", "center", "UK"),
    ("The Guardian", "https://www.theguardian.com/world/rss", "left", "UK"),
    ("NPR", "https://feeds.npr.org/1004/rss.xml", "center-left", "US"),
    ("Fox News", "https://moxie.foxnews.com/google-publisher/world.xml", "right", "US"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "international", "Qatar"),
    ("Deutsche Welle", "https://rss.dw.com/rdf/rss-en-world", "international", "Germany"),
    ("France 24", "https://www.france24.com/en/rss", "international", "France"),
    ("The Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "international", "India"),
    ("CBC News", "https://www.cbc.ca/webfeed/rss/rss-world", "center-left", "Canada"),
    ("The Japan Times", "https://www.japantimes.co.jp/feed/", "international", "Japan"),
]

# State-controlled outlets. Off by default: they are analytically useful for
# reading what a government wants believed, and useless as corroboration.
# Enable with include_state=True; they are always labelled "state".
STATE_FEEDS = [
    ("Xinhua", "https://english.news.cn/rss/world.xml", "state", "China"),
    ("TASS", "https://tass.com/rss/v2.xml", "state", "Russia"),
]

# GDELT returns a bare domain; map the ones we can label honestly.
DOMAIN_LEAN = {
    "apnews.com": ("Associated Press", "wire"),
    "reuters.com": ("Reuters", "wire"),
    "afp.com": ("Agence France-Presse", "wire"),
    "bbc.com": ("BBC News", "center"),
    "bbc.co.uk": ("BBC News", "center"),
    "theguardian.com": ("The Guardian", "left"),
    "nytimes.com": ("The New York Times", "center-left"),
    "washingtonpost.com": ("The Washington Post", "center-left"),
    "npr.org": ("NPR", "center-left"),
    "cnn.com": ("CNN", "center-left"),
    "politico.com": ("Politico", "center"),
    "axios.com": ("Axios", "center"),
    "thehill.com": ("The Hill", "center"),
    "wsj.com": ("The Wall Street Journal", "center-right"),
    "economist.com": ("The Economist", "center-right"),
    "ft.com": ("Financial Times", "center"),
    "telegraph.co.uk": ("The Telegraph", "right"),
    "foxnews.com": ("Fox News", "right"),
    "nypost.com": ("New York Post", "right"),
    "washingtontimes.com": ("The Washington Times", "right"),
    "aljazeera.com": ("Al Jazeera", "international"),
    "dw.com": ("Deutsche Welle", "international"),
    "france24.com": ("France 24", "international"),
    "timesofindia.indiatimes.com": ("The Times of India", "international"),
    "scmp.com": ("South China Morning Post", "international"),
    "japantimes.co.jp": ("The Japan Times", "international"),
    "haaretz.com": ("Haaretz", "international"),
    "timesofisrael.com": ("The Times of Israel", "international"),
    "kyivindependent.com": ("The Kyiv Independent", "international"),
    "xinhuanet.com": ("Xinhua", "state"),
    "news.cn": ("Xinhua", "state"),
    "tass.com": ("TASS", "state"),
    "rt.com": ("RT", "state"),
    "presstv.ir": ("Press TV", "state"),
}

STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "what", "will", "into",
    "about", "over", "have", "has", "are", "was", "were", "been", "next", "should",
    "would", "could", "their", "there", "them", "they", "than", "then", "when",
    "where", "which", "while", "after", "before", "between", "against", "under",
}


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #

def _clean(text: Optional[str], limit: int = 600) -> str:
    """Strip tags and collapse whitespace out of feed HTML."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def topic_terms(topic: str) -> list:
    """Significant terms from a topic string, for relevance filtering."""
    words = re.findall(r"[a-zA-Z][a-zA-Z'\-]{2,}", (topic or "").lower())
    return [w for w in words if w not in STOPWORDS]


def _is_relevant(text: str, terms: Iterable[str], threshold: int = 1) -> bool:
    if not terms:
        return False
    haystack = text.lower()
    return sum(1 for t in terms if t in haystack) >= threshold


def _outlet_for_domain(domain: str) -> tuple:
    d = (domain or "").lower().strip()
    if d.startswith("www."):
        d = d[4:]
    if d in DOMAIN_LEAN:
        return DOMAIN_LEAN[d]
    # try the registrable suffix (edition.cnn.com -> cnn.com)
    parts = d.split(".")
    for i in range(len(parts) - 2, -1, -1):
        candidate = ".".join(parts[i:])
        if candidate in DOMAIN_LEAN:
            return DOMAIN_LEAN[candidate]
    return (d or "unknown source", "unlabeled")


def _item(title: str, outlet: str, lean: str, url: str = "", published: str = "", summary: str = "") -> dict:
    return {
        "title": _clean(title, 300),
        "outlet": outlet,
        "lean": lean,
        "url": url,
        "published": published,
        "summary": _clean(summary, 600),
    }


def _dedupe(items: list) -> list:
    """Drop repeats by URL, then by normalised title (wire copy runs everywhere)."""
    seen_urls, seen_titles, out = set(), set(), []
    for it in items:
        url = (it.get("url") or "").split("?")[0]
        key = re.sub(r"[^a-z0-9 ]", "", (it.get("title") or "").lower())
        key = " ".join(key.split()[:9])
        if url and url in seen_urls:
            continue
        if key and key in seen_titles:
            continue
        if url:
            seen_urls.add(url)
        if key:
            seen_titles.add(key)
        out.append(it)
    return out


def _balance(items: list, cap: int) -> list:
    """Round-robin across leans so one prolific feed cannot dominate the brief."""
    if len(items) <= cap:
        return items
    buckets: dict = {}
    for it in items:
        buckets.setdefault(it["lean"], []).append(it)
    out, order = [], sorted(buckets.keys())
    while len(out) < cap and any(buckets[k] for k in order):
        for lean in order:
            if buckets[lean] and len(out) < cap:
                out.append(buckets[lean].pop(0))
    return out


# --------------------------------------------------------------------------- #
# Fetchers                                                                    #
# --------------------------------------------------------------------------- #

async def _fetch_gdelt(client: httpx.AsyncClient, topic: str, window_hours: int, limit: int) -> list:
    """GDELT DOC 2.0 — a topic search across ~100k outlets worldwide, no key."""
    query = " ".join(topic.split())[:180]
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        f"?query={quote_plus(query)}"
        f"&mode=ArtList&maxrecords={min(limit, 75)}"
        f"&timespan={max(1, window_hours)}h"
        "&sort=hybridrel&format=json&sourcelang=english"
    )
    r = await client.get(url)
    r.raise_for_status()
    # GDELT answers malformed queries with an HTML/plaintext error, not JSON.
    if "json" not in r.headers.get("content-type", "") and not r.text.lstrip().startswith("{"):
        logger.info("GDELT returned non-JSON for %r: %s", topic, r.text[:160])
        return []
    articles = (r.json() or {}).get("articles") or []
    items = []
    for a in articles:
        outlet, lean = _outlet_for_domain(a.get("domain", ""))
        items.append(_item(
            title=a.get("title", ""),
            outlet=outlet,
            lean=lean,
            url=a.get("url", ""),
            published=a.get("seendate", ""),
        ))
    return items


async def _fetch_rss(client: httpx.AsyncClient, outlet: str, url: str, lean: str, terms: list) -> list:
    """Pull one feed and keep the entries that touch the topic."""
    r = await client.get(url)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    ns = {"atom": "http://www.w3.org/2005/Atom", "rdf": "http://purl.org/rss/1.0/"}

    nodes = root.findall(".//item") or root.findall(".//rdf:item", ns) or root.findall(".//atom:entry", ns)
    items = []
    for node in nodes:
        title = _node_text(node, (
            "title",
            "{http://purl.org/rss/1.0/}title",
            "{http://www.w3.org/2005/Atom}title",
        ))
        summary = _node_text(node, (
            "description",
            "{http://purl.org/rss/1.0/}description",
            "{http://www.w3.org/2005/Atom}summary",
            "{http://www.w3.org/2005/Atom}content",
        ))
        link = _node_text(node, ("link", "{http://purl.org/rss/1.0/}link"))
        if not link:
            atom_link = node.find("{http://www.w3.org/2005/Atom}link")
            link = atom_link.get("href", "") if atom_link is not None else ""
        published = _node_text(node, (
            "pubDate",
            "{http://purl.org/dc/elements/1.1/}date",
            "{http://www.w3.org/2005/Atom}updated",
            "{http://www.w3.org/2005/Atom}published",
        ))
        if not title:
            continue
        if not _is_relevant(f"{title} {summary}", terms):
            continue
        items.append(_item(title, outlet, lean, link, published, summary))
    return items


def _node_text(node, tags: Iterable[str]) -> str:
    for tag in tags:
        el = node.find(tag)
        if el is not None and (el.text or "").strip():
            return el.text.strip()
    return ""


async def fetch_live(
    topic: str,
    window_hours: int = 24,
    limit: int = MAX_ITEMS,
    include_state: bool = False,
) -> dict:
    """Gather today's coverage of a topic.

    Returns {items, reachable, notes}. Never raises on network trouble — a war
    room with no wire is still a war room, it just says so.
    """
    if not LIVE_ENABLED:
        return {"items": [], "reachable": False, "notes": ["Live sources are disabled on this deployment."]}

    terms = topic_terms(topic)
    notes: list = []
    feeds = list(RSS_FEEDS) + (list(STATE_FEEDS) if include_state else [])

    async with httpx.AsyncClient(
        timeout=FETCH_TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        tasks = [_fetch_gdelt(client, topic, window_hours, limit)]
        tasks += [_fetch_rss(client, outlet, url, lean, terms) for outlet, url, lean, _ in feeds]
        labels = ["GDELT"] + [outlet for outlet, *_ in feeds]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    items, failures = [], []
    for label, result in zip(labels, results):
        if isinstance(result, Exception):
            failures.append(label)
            logger.info("War Room source %s unavailable: %s", label, result)
            continue
        items.extend(result)

    if failures:
        notes.append(f"Unreachable this run: {', '.join(failures)}.")
    if len(failures) == len(labels):
        notes.append("No live source could be reached — the host may have no outbound network.")

    items = _balance(_dedupe(items), limit)
    if not items and not failures:
        notes.append("Live sources reachable, but nothing published in the window matched this topic.")
    return {"items": items, "reachable": len(failures) < len(labels), "notes": notes}


# --------------------------------------------------------------------------- #
# Pasted material                                                             #
# --------------------------------------------------------------------------- #

PASTE_SPLIT = re.compile(r"\n\s*(?:-{3,}|={3,}|\*{3,})\s*\n")
PASTE_HEADER = re.compile(r"^\s*(?:\[(?P<b>[^\]]{2,60})\]|(?P<a>[A-Z][\w .'&-]{2,40}?)\s*[:—-])\s*")


def normalize_pasted(pasted: str) -> list:
    """Turn pasted source material into labelled items.

    Splits on `---` / `===` rules, and reads an optional leading `Outlet:` or
    `[Outlet]` marker off each block. Anything unmarked is carried through as a
    user-supplied document with an unlabeled lean, which is honest: we do not
    know who wrote it, and the sifter is told not to treat it as corroboration.
    """
    text = (pasted or "").strip()
    if not text:
        return []
    if len(text) > MAX_PASTED_CHARS:
        text = text[:MAX_PASTED_CHARS]

    blocks = [b.strip() for b in PASTE_SPLIT.split(text) if b.strip()]
    if not blocks:
        return []

    items = []
    for i, block in enumerate(blocks, start=1):
        first_line, _, rest = block.partition("\n")
        outlet, lean, body = f"User-supplied document {i}", "unlabeled", block
        m = PASTE_HEADER.match(first_line)
        if m and len(first_line) < 120:
            label = (m.group("b") or m.group("a") or "").strip()
            if label:
                outlet = label
                lean = _lean_for_named_outlet(label)
                remainder = first_line[m.end():].strip()
                body = f"{remainder}\n{rest}".strip() if remainder else rest.strip() or block
        items.append(_item(
            title=_clean(body.split("\n")[0], 200),
            outlet=outlet,
            lean=lean,
            summary=body,
        ))
    return items


def _lean_for_named_outlet(label: str) -> str:
    """Match a pasted `Outlet:` label against the registry, else leave unlabeled."""
    norm = re.sub(r"[^a-z0-9]", "", label.lower())
    for outlet, lean in DOMAIN_LEAN.values():
        if re.sub(r"[^a-z0-9]", "", outlet.lower()) == norm:
            return lean
    for outlet, _url, lean, _country in RSS_FEEDS + STATE_FEEDS:
        if re.sub(r"[^a-z0-9]", "", outlet.lower()) == norm:
            return lean
    return "unlabeled"


# --------------------------------------------------------------------------- #
# Rendering for the sifter                                                    #
# --------------------------------------------------------------------------- #

def source_spread(items: list) -> dict:
    """Count items per lean — shown to the user and to the sifter."""
    spread: dict = {}
    for it in items:
        spread[it["lean"]] = spread.get(it["lean"], 0) + 1
    return dict(sorted(spread.items(), key=lambda kv: (-kv[1], kv[0])))


def render_source_block(items: list, char_budget: int = 48000) -> str:
    """Format items for the sifting prompt, outlet and lean attached to each."""
    if not items:
        return "(no source material supplied)"
    lines, used = [], 0
    for i, it in enumerate(items, start=1):
        body = it["summary"] or it["title"]
        entry = (
            f"[{i}] OUTLET: {it['outlet']} | LEAN: {it['lean']}"
            + (f" | PUBLISHED: {it['published']}" if it.get("published") else "")
            + f"\nHEADLINE: {it['title']}\n"
            + (f"TEXT: {body}\n" if body and body != it["title"] else "")
        )
        if used + len(entry) > char_budget:
            lines.append(f"\n(+{len(items) - i + 1} further items omitted for length)")
            break
        lines.append(entry)
        used += len(entry)
    return "\n".join(lines)


def gather_summary(items: list, mode: str, notes: list) -> dict:
    """The provenance block returned to the client alongside the brief."""
    return {
        "mode": mode,
        "item_count": len(items),
        "outlets": sorted({it["outlet"] for it in items}),
        "spread": source_spread(items),
        "notes": notes,
        "gathered_at": datetime.now(timezone.utc).isoformat(),
    }


def public_items(items: list) -> list:
    """Trim items for the client — enough to click through and audit."""
    return [
        {k: it.get(k, "") for k in ("title", "outlet", "lean", "url", "published")}
        for it in items
    ]


__all__ = [
    "LIVE_ENABLED",
    "MAX_ITEMS",
    "RSS_FEEDS",
    "STATE_FEEDS",
    "fetch_live",
    "gather_summary",
    "normalize_pasted",
    "public_items",
    "render_source_block",
    "source_spread",
    "topic_terms",
]
