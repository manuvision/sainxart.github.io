#!/usr/bin/env python3
"""Conservative, key-free collector for Gwada Stats' dated public totals.

This is a source monitor, not a live death register. Only explicit cumulative
totals in supported source prose are accepted; individual incidents are never
added. Unsupported wording, conflicting totals and fetch failures keep the last
verified record. Python 3.11+; standard library only.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from xml.etree import ElementTree


RCI_RSS = "https://rci.fm/guadeloupe/fb/articles_rss_gp"
RCI_LIST = "https://rci.fm/guadeloupe/infos/Faits-divers"
PREFECTURE = "https://www.guadeloupe.gouv.fr/Actions-de-l-Etat/Securite/Securite-routiere/L-accidentalite-en-chiffres/Les-chiffres-de-l-accidentalite-barometres-mensuels-autres-donnees"
DEAL = "https://www.guadeloupe.developpement-durable.gouv.fr/accidentalite-remontees-rapides-a305.html"
USER_AGENT = "Mozilla/5.0 (compatible; GwadaStats/1.0; +https://manu.vision/gwadastats/)"
ALLOWED_HOSTS = {"rci.fm", "www.guadeloupe.gouv.fr", "www.guadeloupe.developpement-durable.gouv.fr"}
MAX_BYTES = 3_000_000
MAX_ARTICLES = 60
MONTHS = {name: i for i, name in enumerate(
    ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"], 1)}
DATE_PATTERN = r"(?:\d{1,2}/\d{1,2}/20\d{2}|\d{1,2}(?:er)?\s+(?:" + "|".join(MONTHS) + r")\s+20\d{2})"


class SourceError(ValueError):
    """The source is unavailable or its claim cannot be read unambiguously."""


def fold(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", value.lower()).strip()


def parse_date(value: str) -> str:
    value = fold(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return date.fromisoformat(value).isoformat()
    if "/" in value:
        day, month, year = map(int, value.split("/"))
    else:
        day_s, month_s, year_s = value.split()
        day, month, year = int(day_s.removesuffix("er")), MONTHS[month_s], int(year_s)
    return date(year, month, day).isoformat()


class Page(HTMLParser):
    """Extract visible text, RCI article body, metadata and discovered links.

    Inline text stays adjacent, so '<b>tue</b>s' remains 'tues'. Script/style and
    related-article text never become part of an RCI homicide claim.
    """
    BLOCKS = {"p", "div", "section", "article", "main", "li", "ul", "ol", "h1", "h2", "h3", "table", "tr", "td", "br"}
    VOID = {"meta", "link", "img", "input", "br", "hr", "source", "area", "base", "embed", "wbr"}

    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.body_parts: list[str] = []
        self.links: list[str] = []
        self.meta: dict[str, str] = {}
        self.stack: list[tuple[str, bool, bool]] = []
        self.hidden = 0
        self.in_body = 0
        self.feed(html)

    def _append(self, text: str) -> None:
        if not self.hidden:
            self.parts.append(text)
            if self.in_body:
                self.body_parts.append(text)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = dict(attrs)
        if tag == "meta":
            key = attrs_d.get("itemprop") or attrs_d.get("property") or attrs_d.get("name")
            if key:
                self.meta[key.lower()] = attrs_d.get("content") or ""
        if tag in {"a", "link"} and attrs_d.get("href"):
            self.links.append(attrs_d["href"])
        hidden = tag in {"script", "style", "noscript", "svg"}
        body = "field--name-body" in (attrs_d.get("class") or "").split() or attrs_d.get("property") == "schema:text"
        if tag in self.BLOCKS:
            self._append("\n")
        if tag not in self.VOID:
            self.stack.append((tag, hidden, body))
            self.hidden += hidden
            self.in_body += body

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCKS:
            self._append("\n")
        # Recover safely from the optional closing tags found in publisher HTML.
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                for _, hidden, body in self.stack[index:]:
                    self.hidden -= hidden
                    self.in_body -= body
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        self._append(data)

    @property
    def text(self) -> str:
        return "".join(self.parts)

    @property
    def body(self) -> str:
        return "".join(self.body_parts)


def permitted_url(url: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme == "https" and parts.hostname in ALLOWED_HOSTS and not parts.username and not parts.password and parts.port in {None, 443}


class SourceRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if not permitted_url(newurl):
            raise SourceError("Source redirected outside the allowlist")
        return super().redirect_request(request, fp, code, message, headers, newurl)


def fetch(url: str) -> str:
    if not permitted_url(url):
        raise SourceError("URL outside the public-source allowlist")
    try:
        with build_opener(SourceRedirects()).open(Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/rss+xml,application/xml;q=0.9"}), timeout=25) as response:
            if not permitted_url(response.url):
                raise SourceError("Source redirected outside the allowlist")
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise SourceError("Source exceeds the download limit")
            return raw.decode(response.headers.get_content_charset() or "utf-8")
    except SourceError:
        raise
    except Exception as exc:
        raise SourceError(f"{type(exc).__name__}: {exc}") from exc


def publication_dates(page: Page, *, rci: bool) -> tuple[str, str]:
    if rci:
        published = page.meta.get("datepublished", "")[:10]
        updated = page.meta.get("datemodified", published)[:10]
        try:
            return parse_date(published), parse_date(updated)
        except (ValueError, KeyError):
            raise SourceError("Missing valid article publication metadata") from None
    text = fold(page.text)
    updated_match = re.search(r"mis a jour le\s*(" + DATE_PATTERN + ")", text)
    published_match = re.search(r"publie le\s*(" + DATE_PATTERN + ")", text)
    if not updated_match:
        raise SourceError("Missing official page update date")
    updated = parse_date(updated_match[1])
    return parse_date(published_match[1]) if published_match else updated, updated


def make_record(count: int, cutoff: str, published: str, updated: str, publisher: str, source: str, today: date) -> dict:
    if not (0 <= count <= 1000):
        raise SourceError("Count outside the supported annual range")
    if not (published <= updated <= today.isoformat() and cutoff <= updated and cutoff[:4] >= "2000"):
        raise SourceError("Inconsistent or future source dates")
    return {"count": count, "asOf": cutoff, "publishedAt": published, "updatedAt": updated, "publisher": publisher, "source": source}


def extract_homicides(html: str, source: str, today: date) -> dict | None:
    if urlsplit(source).hostname != "rci.fm" or not urlsplit(source).path.startswith("/guadeloupe/infos/"):
        raise SourceError("Homicides must come from an RCI Guadeloupe article")
    page = Page(html)
    published, updated = publication_dates(page, rci=True)
    if not page.body.strip():
        raise SourceError("RCI article body markup was not found")
    candidates = []
    # A claim must be in a single sentence, not assembled from unrelated prose.
    sentences = re.split(r"[.!?\n]+", fold(page.body))
    for original in sentences:
        if not re.search(r"\b\d{1,3}(?:e|eme|er)?\s+homicides?\b", original):
            continue
        sentence = re.sub(r"\(\s*\d{1,3}\s+(?:avec|en (?:incluant|comptant))\s+saint[- ]martin\s*\)", "", original)
        sentence = re.sub(r"\b(?:hors|sans|a lexclusion de)\s+saint[- ]martin\b", "", sentence)
        if re.search(r"saint[- ]martin|saint[- ]barthelemy|martinique|antilles", sentence):
            continue  # Never subtract territories or infer their totals.
        if not re.search(r"\b(?:en|de la|pour la) guadeloupe\b", sentence):
            continue
        if re.search(r"tentatives?\s+d.?homicides?|homicides?\s+(?:involontaires?|routiers?|par arme a feu|par balles?)", sentence):
            continue
        # Require a plain total followed by a reporting verb or the island/year
        # scope. Qualifiers such as 'lies au trafic', 'non elucides', victim
        # groups and municipality-only counts must never stand for all deaths.
        plain_total = re.search(
            r"\b\d{1,3}(?:e|eme|er)?\s+homicides?\s+"
            r"(?:(?:(?:ont ete|a ete|sont|est)\s+)?(?:recenses?|comptabilises?|rapportes?|enregistres?|constates?|denombres?|releves?|commis)\s+)?"
            r"(?:depuis\b|en guadeloupe\b|en 20\d{2}\b|pour l.?annee\b|au\s+" + DATE_PATTERN + r")",
            sentence,
        )
        scoped_claim = re.search(
            r"\b(?:lies?|liees?|associes?|associees?|imputes?|imputees?)\s+(?:au|aux|a la|a des|a un)\b"
            r"|\b(?:non elucides?|elucides?|non resolus?|resolus?|trafic|trafiquants?|reglements? de comptes?|intrafamiliaux|conjugaux|mineurs?|femmes|enfants)\b"
            r"|\b(?:dans|sur|pour) (?:la|les|une|des) (?:seule?s? )?(?:communes?|villes?|quartiers?|circonscriptions?)\b"
            r"|\b(?:commune|ville|quartier|circonscription) de\b",
            sentence,
        )
        if not plain_total or scoped_claim:
            continue
        if re.search(r"\b(?:mois|semaine|jours|trimestre|semestre|pourrait|pourra|devrait|prevoit|prevision|projection|estimation|estime|attendu|hypothetique|environ)\b|\b(?:au moins|plus de|moins de)\s+\d", sentence):
            continue  # Partial periods, estimates and forecasts are not YTD totals.
        explicit_years = set(re.findall(r"\b20\d{2}\b", sentence))
        if len(explicit_years) > 1:
            continue  # Comparative years need human interpretation.
        relative_ytd = bool(re.search(r"\bdepuis le debut de (?:l.?annee|cette annee)\b|\bdepuis le 1er janvier\b", sentence))
        absolute_ytd = bool(re.search(r"(?:depuis|en|pour l.?annee)\s+(?:le 1er janvier\s+)?20\d{2}", sentence))
        if not relative_ytd and not absolute_ytd:
            continue
        reference_year = next(iter(explicit_years), published[:4])
        if reference_year != published[:4]:
            continue  # A retrospective article cannot silently seed a new year.
        matches = re.findall(r"\b(\d{1,3})(?:e|eme|er)?\s+homicides?\b", sentence)
        if len(matches) != 1:
            raise SourceError("Several homicide totals in one claim")
        date_match = re.search(r"\bau\s+(" + DATE_PATTERN + ")", sentence)
        cutoff = parse_date(date_match[1]) if date_match else published
        if cutoff[:4] != reference_year:
            continue
        candidates.append(make_record(int(matches[0]), cutoff, published, updated, "RCI", source, today))
    if not candidates:
        return None
    if len({(item["count"], item["asOf"]) for item in candidates}) != 1:
        raise SourceError("Conflicting explicit homicide totals in the article")
    return candidates[0]


def extract_roads(html: str, source: str, today: date) -> dict | None:
    if source not in {PREFECTURE, DEAL}:
        raise SourceError("Road totals must come from a supported official page")
    page = Page(html)
    published, updated = publication_dates(page, rci=False)
    text = fold(page.text)
    expected_heading = "les chiffres de l'accidentalite" if source == PREFECTURE else "accidentalite - remontees rapides"
    if expected_heading not in text:
        raise SourceError("The supported official annual-summary heading has changed")
    candidates = []
    # Supported official summary: dated total accidents, then deaths, then all
    # victims. This deliberately ignores user-type breakdowns and stale charts.
    for date_match in re.finditer(r"\bau\s+(" + DATE_PATTERN + ")", text):
        cutoff = parse_date(date_match[1])
        prefix = text[max(0, date_match.start() - 180):date_match.start()]
        block = text[date_match.end():date_match.end() + 600]
        next_date = re.search(r"\bau\s+" + DATE_PATTERN, block)
        if next_date:
            block = block[:next_date.start()]
        tally = re.search(r"\b\d{1,4}\s+accidents\b.{0,150}?\b(\d{1,3})\s+tue\s*s\b.{0,150}?\b\d{1,4}\s+victimes\b", block)
        if not tally:
            continue
        if source == PREFECTURE and not re.search(r"en resume\s*$", prefix):
            continue
        if source == DEAL and not re.match(r"\s+on denombrait en guadeloupe\s*:", block):
            continue
        if re.search(r"\b(?:ce mois|cette semaine|mois de|semaine du|bilan mensuel|bilan hebdomadaire|pendant le mois|durant le mois)\b", prefix + block[:tally.end()]):
            continue
        # Both supported pages publish an annual cumulative snapshot, comparing
        # each of the three totals against the preceding year. Require all three
        # comparisons; a generic dated monthly/weekly table is not supported.
        comparisons = re.findall(r"\(\s*\d{1,4}\s+en\s+(20\d{2})\b", block[:tally.end() + 100])
        if len(comparisons) < 3 or any(int(year) != int(cutoff[:4]) - 1 for year in comparisons[:3]):
            continue
        publisher = "Préfecture de Guadeloupe" if source == PREFECTURE else "DEAL de Guadeloupe"
        candidates.append(make_record(int(tally[1]), cutoff, published, updated, publisher, source, today))
    if not candidates:
        return None
    latest = max(item["asOf"] for item in candidates)
    newest = [item for item in candidates if item["asOf"] == latest]
    if len({item["count"] for item in newest}) > 1:
        raise SourceError("Conflicting official road totals for the same date")
    return newest[0]


def article_links(html: str, base: str) -> list[str]:
    if base == RCI_RSS:
        try:
            links = [node.text or "" for node in ElementTree.fromstring(html).findall("./channel/item/link")]
        except ElementTree.ParseError as exc:
            raise SourceError("RCI RSS is not valid XML") from exc
    else:
        links = Page(html).links
    result = []
    for link in links:
        url = urljoin(base, link)
        parts = urlsplit(url)
        if parts.hostname == "rci.fm" and parts.scheme == "https" and re.match(r"^/guadeloupe/infos/[^/]+/[^/]+$", parts.path):
            clean = "https://rci.fm" + parts.path
            if clean not in result:
                result.append(clean)
    return result


def choose_candidate(records: list[dict], year: int) -> dict | None:
    in_year = [item for item in records if item["asOf"].startswith(f"{year}-")]
    if not in_year:
        return None
    latest_date = max(item["asOf"] for item in in_year)
    newest = [item for item in in_year if item["asOf"] == latest_date]
    if len({item["count"] for item in newest}) != 1:
        raise SourceError(f"Conflicting published totals for {latest_date}; retained previous data")
    return max(newest, key=lambda item: (item["updatedAt"], item["source"] == PREFECTURE))


def validate_snapshot(snapshot: dict) -> None:
    year = snapshot.get("year")
    if type(year) is not int or not 2000 <= year <= 9999:
        raise SourceError("Invalid stored reference year")
    reviewed = date.fromisoformat(snapshot["reviewedAt"])
    for key in ("homicides", "roads"):
        item = snapshot[key]
        if type(item.get("count")) is not int:
            raise SourceError("Invalid stored count")
        if date.fromisoformat(item["asOf"]).year != year:
            raise SourceError("Stored category has a different reference year")
        make_record(item["count"], parse_date(item["asOf"]), parse_date(item["publishedAt"]), parse_date(item["updatedAt"]), item["publisher"], item["source"], reviewed)
        if not permitted_url(item["source"]) or not item["publisher"].strip():
            raise SourceError("Invalid stored source")
        if "checkedAt" in item and not item["updatedAt"] <= parse_date(item["checkedAt"]) <= reviewed.isoformat():
            raise SourceError("Invalid stored category check date")


def collect(snapshot: dict, previous_status: dict | None = None, *, today: date | None = None, fetcher=fetch) -> tuple[dict, dict, int]:
    validate_snapshot(snapshot)
    today = today or datetime.now(timezone(timedelta(hours=-4))).date()
    attempt = datetime.now(timezone.utc).isoformat(timespec="seconds")
    previous_status = previous_status or {}
    status = {"lastAttempt": attempt, "categories": {}, "warnings": []}
    for key in ("homicides", "roads"):
        old_status = previous_status.get("categories", {}).get(key, {})
        status["categories"][key] = {"lastSuccess": old_status.get("lastSuccess"), "outcome": "unavailable", "source": snapshot[key]["source"], "errors": []}
    records = {"homicides": [], "roads": []}
    discovery_ok = False
    seeds = [snapshot["homicides"]["source"]]
    source_urls = [RCI_RSS, RCI_LIST, RCI_LIST + "?page=1", PREFECTURE, DEAL]
    with ThreadPoolExecutor(max_workers=4) as pool:
        future_urls = {pool.submit(fetcher, url): url for url in source_urls}
        # Stable ordering keeps article budget and reports reproducible.
        fetched = {}
        for future in as_completed(future_urls):
            url = future_urls[future]
            try:
                fetched[url] = future.result()
            except Exception as exc:
                category = "roads" if url in {PREFECTURE, DEAL} else "homicides"
                status["categories"][category]["errors"].append(f"{url}: {exc}")
        for url in source_urls:
            if url not in fetched:
                continue
            try:
                if url in {PREFECTURE, DEAL}:
                    record = extract_roads(fetched[url], url, today)
                    if record:
                        records["roads"].append(record)
                    else:
                        raise SourceError("No supported dated road total found; source markup or wording may have changed")
                else:
                    links = article_links(fetched[url], RCI_RSS if url == RCI_RSS else url)
                    if not links:
                        raise SourceError("No article links found in discovery source")
                    discovery_ok = True
                    seeds.extend(links)
            except (SourceError, ValueError, KeyError) as exc:
                category = "roads" if url in {PREFECTURE, DEAL} else "homicides"
                status["categories"][category]["errors"].append(f"{url}: {exc}")
        articles = list(dict.fromkeys(seeds))[:MAX_ARTICLES]
        article_futures = {pool.submit(fetcher, url): url for url in articles}
        for future in as_completed(article_futures):
            url = article_futures[future]
            try:
                record = extract_homicides(future.result(), url, today)
                if record:
                    records["homicides"].append(record)
            except (SourceError, ValueError, KeyError) as exc:
                status["categories"]["homicides"]["errors"].append(f"{url}: {exc}")
            except Exception as exc:
                status["categories"]["homicides"]["errors"].append(f"{url}: {type(exc).__name__}: {exc}")
    if not discovery_ok:
        status["categories"]["homicides"]["errors"].append("No working news discovery source; the existing article alone cannot establish a successful current check")
        records["homicides"] = []

    output = deepcopy(snapshot)
    target_year = snapshot["year"]
    if today.year > target_year:
        try:
            rollover = {key: choose_candidate(records[key], today.year) for key in records}
        except SourceError as exc:
            rollover = {}
            status["warnings"].append(str(exc))
        if rollover and all(rollover.values()):
            target_year = today.year
            output["year"] = target_year
        else:
            status["warnings"].append(f"Waiting for verified {today.year} totals in both categories; retaining the dated {target_year} archive")
    successes = 0
    for key in records:
        category_status = status["categories"][key]
        try:
            candidate = choose_candidate(records[key], target_year)
        except SourceError as exc:
            category_status["errors"].append(str(exc))
            continue
        if candidate is None:
            category_status["errors"].append(f"No unambiguous dated {target_year} cumulative total was verified")
            continue
        successes += 1
        category_status["source"] = candidate["source"]
        old = snapshot[key]
        if target_year != snapshot["year"] or candidate["asOf"] > old["asOf"] or (candidate["asOf"] == old["asOf"] and candidate["updatedAt"] >= old["updatedAt"]):
            candidate["checkedAt"] = today.isoformat()
            output[key] = candidate
            category_status["lastSuccess"] = attempt
            category_status["outcome"] = "updated" if any(output[key].get(field) != old.get(field) for field in ("count", "asOf", "publishedAt", "updatedAt", "publisher", "source")) else "unchanged"
        else:
            category_status["outcome"] = "fallback"
            category_status["errors"].append("An older backup total was verified; the displayed newer record was not reverified")
        category_status["verifiedThrough"] = candidate["asOf"]
        if output[key]["count"] < old["count"] and target_year == snapshot["year"]:
            status["warnings"].append(f"{key}: a newer explicit published total is lower ({old['count']} to {output[key]['count']}); this is treated as a source correction")
    # This dates the most recent successful collection. Individual checkedAt
    # dates distinguish partial updates; failures/older backups never freshen
    # the displayed category's check date.
    if any(item["lastSuccess"] == attempt for item in status["categories"].values()):
        output["reviewedAt"] = today.isoformat()
    if successes == 1:
        status["warnings"].append("Only one category was verified; consult individual checkedAt dates and update-status.json")
    validate_snapshot(output)
    status["changed"] = output != snapshot
    status["verifiedCategories"] = successes
    status["referenceYear"] = output["year"]
    status["checkedArticles"] = len(articles)
    return output, status, 0 if successes else 2


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Gwada Stats data.json path")
    parser.add_argument("--status", type=Path, required=True, help="Public update-status.json path")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate, print the result, write nothing")
    args = parser.parse_args(argv)
    try:
        snapshot = json.loads(args.data.read_text(encoding="utf-8-sig"))
        previous = json.loads(args.status.read_text(encoding="utf-8-sig")) if args.status.exists() else {}
        output, status, exit_code = collect(snapshot, previous)
    except (ValueError, KeyError, OSError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    if not args.dry_run:
        if output != snapshot:
            write_json(args.data, output)
        write_json(args.status, status)
    print(json.dumps({"data": output, "status": status}, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
