"""Deterministic source fixtures; no network, accounts, secrets or LLM needed."""
from copy import deepcopy
from datetime import date
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().with_name("update_stats.py")
spec = importlib.util.spec_from_file_location("update_stats", MODULE)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

TODAY = date(2026, 9, 9)
ARTICLE = "https://rci.fm/guadeloupe/infos/Faits-divers/Meurtre-au-Gosier-un-suspect-en-garde-vue"
NEW_ARTICLE = "https://rci.fm/guadeloupe/infos/Faits-divers/Nouveau-bilan"


def rci(body, published="2026-09-06", updated="2026-09-08", related=""):
    return f'''<html><meta itemprop="datePublished" content="{published}T11:41:17-04:00">
    <meta itemprop="dateModified" content="{updated}T05:05:20-04:00">
    <article><div property="schema:text" class="field--name-body"><p>{body}</p></div></article>
    <aside>{related}</aside></html>'''


def roads(count=26, cutoff="30 août 2026", updated="01/09/2026", extra="", deal=False):
    year = int(cutoff[-4:]) - 1
    heading = "Accidentalité - Remontées Rapides" if deal else "Les chiffres de l'accidentalité (baromètres mensuels, autres données)"
    lead = f"Au {cutoff} on dénombrait en Guadeloupe :" if deal else f"En résumé au {cutoff}, on enregistre :"
    return f'''<html><h1>{heading}</h1><p>Mis à jour le {updated}</p>
    <p>{lead}</p><ul><li>362 accidents (346 en {year})</li>
    <li><b>{count} tué</b>s (37 en {year})</li><li>494 victimes (474 en {year})</li></ul>{extra}</html>'''


def current_snapshot():
    return {
        "year": 2026, "reviewedAt": "2026-09-09",
        "homicides": {"count": 28, "asOf": "2026-09-06", "publishedAt": "2026-09-06", "updatedAt": "2026-09-08", "publisher": "RCI", "source": ARTICLE, "checkedAt": "2026-09-09"},
        "roads": {"count": 26, "asOf": "2026-08-30", "publishedAt": "2026-09-01", "updatedAt": "2026-09-01", "publisher": "Préfecture de Guadeloupe", "source": c.PREFECTURE, "checkedAt": "2026-09-09"},
    }


def network_fixture(overrides=None):
    pages = {
        ARTICLE: rci("28 homicides (29 avec Saint-Martin) depuis le début de l’année en Guadeloupe."),
        c.RCI_RSS: f"<rss><channel><item><link>{ARTICLE}</link></item></channel></rss>",
        c.RCI_LIST: f'<a href="{ARTICLE}">Meurtre</a>',
        c.RCI_LIST + "?page=1": f'<a href="{ARTICLE}">Meurtre</a>',
        c.PREFECTURE: roads(),
        c.DEAL: roads(cutoff="23/08/2026", updated="28/08/2026", deal=True),
    }
    pages.update(overrides or {})
    def fetcher(url):
        value = pages.get(url, OSError("offline fixture"))
        if isinstance(value, Exception):
            raise value
        return value
    return fetcher


class ExtractHomicides(unittest.TestCase):
    def extract(self, body, **kwargs):
        return c.extract_homicides(rci(body, **kwargs), ARTICLE, TODAY)

    def test_separate_saint_martin_total_is_not_added(self):
        item = self.extract("28 homicides (29 avec Saint-Martin) depuis le début de l’année en Guadeloupe.")
        self.assertEqual((item["count"], item["asOf"], item["updatedAt"]), (28, "2026-09-06", "2026-09-08"))

    def test_explicit_ordinal_cumulative_total(self):
        self.assertEqual(self.extract("C’est le 28e homicide depuis le début de l’année en Guadeloupe.")["count"], 28)

    def test_incident_alone_never_increments(self):
        self.assertIsNone(self.extract("Un homme a été tué hier au Gosier. Une enquête pour homicide est ouverte."))

    def test_combined_geography_is_rejected(self):
        for phrase in ["29 homicides depuis le début de l’année en Guadeloupe et à Saint-Martin.",
                       "29 homicides depuis le début de l’année aux Antilles.",
                       "29 homicides depuis le début de l’année en Martinique."]:
            with self.subTest(phrase=phrase):
                self.assertIsNone(self.extract(phrase))

    def test_attempts_and_subsets_are_rejected(self):
        for phrase in ["28 tentatives d’homicide depuis le début de l’année en Guadeloupe.",
                       "28 homicides par arme à feu depuis le début de l’année en Guadeloupe.",
                       "28 homicides involontaires depuis le début de l’année en Guadeloupe."]:
            with self.subTest(phrase=phrase):
                self.assertIsNone(self.extract(phrase))

    def test_old_year_and_comparison_are_rejected(self):
        self.assertIsNone(self.extract("28 homicides en 2025 en Guadeloupe."))
        self.assertIsNone(self.extract("28 homicides en 2026 en Guadeloupe contre 40 en 2025."))

    def test_scoped_homicide_subsets_are_not_island_totals(self):
        for phrase in ["14 homicides liés au trafic depuis le début de l’année en Guadeloupe.",
                       "20 homicides non élucidés depuis le début de l’année en Guadeloupe.",
                       "14 homicides dans la commune du Gosier depuis le début de l’année en Guadeloupe.",
                       "14 homicides recensés dans la commune du Gosier depuis le début de l’année en Guadeloupe.",
                       "14 homicides en Guadeloupe dans la commune du Gosier depuis le début de l’année.",
                       "14 homicides depuis le début de l’année en Guadeloupe liés au trafic.",
                       "14 homicides de femmes depuis le début de l’année en Guadeloupe.",
                       "14 homicides par strangulation depuis le début de l’année en Guadeloupe.",
                       "14 homicides à Pointe-à-Pitre depuis le début de l’année en Guadeloupe."]:
            with self.subTest(phrase=phrase):
                self.assertIsNone(self.extract(phrase))

    def test_plain_reported_island_total_remains_supported(self):
        self.assertEqual(self.extract("28 homicides ont été recensés en Guadeloupe depuis le début de l’année.")["count"], 28)

    def test_partial_period_and_prediction_are_rejected(self):
        for phrase in ["3 homicides depuis le début du mois en Guadeloupe.",
                       "3 homicides ce mois en Guadeloupe en 2026.",
                       "3 homicides depuis le début de la semaine en Guadeloupe en 2026.",
                       "La Guadeloupe pourrait compter 50 homicides en 2026.",
                       "On estime 50 homicides en 2026 en Guadeloupe.",
                       "Au moins 28 homicides depuis le début de l’année en Guadeloupe."]:
            with self.subTest(phrase=phrase):
                self.assertIsNone(self.extract(phrase))

    def test_related_articles_and_script_are_never_claims(self):
        claim = "29 homicides depuis le début de l’année en Guadeloupe."
        self.assertIsNone(self.extract("Une enquête est ouverte.", related=claim))
        self.assertIsNone(self.extract(f"Une enquête est ouverte.<script>{claim}</script>"))

    def test_conflicting_totals_are_rejected(self):
        with self.assertRaises(c.SourceError):
            self.extract("28 homicides depuis le début de l’année en Guadeloupe. 29 homicides depuis le début de l’année en Guadeloupe.")

    def test_future_and_invalid_dates_are_rejected(self):
        for kwargs in [{"published": "2026-09-10", "updated": "2026-09-10"}, {"published": "2026-02-30"}]:
            with self.subTest(kwargs=kwargs), self.assertRaises((c.SourceError, ValueError)):
                self.extract("28 homicides depuis le début de l’année en Guadeloupe.", **kwargs)


class ExtractRoads(unittest.TestCase):
    def test_official_total_survives_inline_markup(self):
        item = c.extract_roads(roads(), c.PREFECTURE, TODAY)
        self.assertEqual((item["count"], item["asOf"]), (26, "2026-08-30"))

    def test_latest_summary_wins_over_stale_chart_and_old_paragraph(self):
        old = "<p>Au 16 août 2026, 350 accidents, 25 tués, 470 victimes.</p><table><tr><td>VL</td><td>5</td></tr></table>"
        self.assertEqual(c.extract_roads(roads(extra=old), c.PREFECTURE, TODAY)["count"], 26)

    def test_road_user_breakdown_is_not_a_total(self):
        body = '<h1>Accidentalité - Remontées Rapides</h1><p>Mis à jour le 28/08/2026</p><p>Au 23/08/2026, on enregistre 7 tués en VL, 7 en moto et 6 piétons.</p>'
        self.assertIsNone(c.extract_roads(body, c.DEAL, TODAY))

    def test_conflicting_same_date_summaries_fail(self):
        with self.assertRaises(c.SourceError):
            c.extract_roads(roads(extra="En résumé au 30 août 2026, 362 accidents (346 en 2025), 27 tués (37 en 2025), 494 victimes (474 en 2025)."), c.PREFECTURE, TODAY)

    def test_monthly_summary_does_not_become_annual(self):
        body = roads().replace("En résumé au", "Bilan mensuel. En résumé au")
        self.assertIsNone(c.extract_roads(body, c.PREFECTURE, TODAY))

    def test_generic_dated_triplet_is_not_supported_annual_format(self):
        body = roads().replace("En résumé au", "Au")
        self.assertIsNone(c.extract_roads(body, c.PREFECTURE, TODAY))

    def test_nonofficial_source_cannot_supply_road_total(self):
        with self.assertRaises(c.SourceError):
            c.extract_roads(roads(), ARTICLE, TODAY)


class Collection(unittest.TestCase):
    def test_successful_unchanged_run_preserves_exact_counts_and_cutoffs(self):
        before = current_snapshot()
        output, status, code = c.collect(before, today=TODAY, fetcher=network_fixture())
        self.assertEqual(output, before)
        self.assertEqual(code, 0)
        self.assertEqual(status["verifiedCategories"], 2)

    def test_total_network_failure_does_not_write_freshness_or_counts(self):
        before = current_snapshot()
        previous = {"categories": {"homicides": {"lastSuccess": "2026-09-08T09:00:00+00:00"}}}
        def offline(url):
            raise OSError("network unavailable")
        output, status, code = c.collect(before, previous, today=date(2026, 9, 10), fetcher=offline)
        self.assertEqual(output, before)
        self.assertEqual(code, 2)
        self.assertEqual(status["categories"]["homicides"]["lastSuccess"], previous["categories"]["homicides"]["lastSuccess"])
        self.assertIsNone(status["categories"]["roads"]["lastSuccess"])

    def test_missing_discovery_is_visible_even_if_old_article_fetches(self):
        failures = {url: OSError("discovery unavailable") for url in (c.RCI_RSS, c.RCI_LIST, c.RCI_LIST + "?page=1")}
        output, status, code = c.collect(current_snapshot(), today=TODAY, fetcher=network_fixture(failures))
        self.assertEqual(code, 0)
        self.assertEqual(status["verifiedCategories"], 1)
        self.assertEqual(status["categories"]["homicides"]["outcome"], "unavailable")

    def test_one_official_source_outage_uses_backup_without_regressing_cutoff(self):
        output, status, code = c.collect(current_snapshot(), today=date(2026, 9, 10), fetcher=network_fixture({c.PREFECTURE: OSError("502")}))
        self.assertEqual(output["roads"]["asOf"], "2026-08-30")
        self.assertEqual(output["roads"]["checkedAt"], "2026-09-09")
        self.assertEqual(status["categories"]["roads"]["outcome"], "fallback")
        self.assertEqual(status["categories"]["roads"]["verifiedThrough"], "2026-08-23")
        self.assertEqual(status["verifiedCategories"], 2)

    def test_partial_new_check_keeps_failed_category_checked_at(self):
        failures = {url: OSError("unavailable") for url in (c.RCI_RSS, c.RCI_LIST, c.RCI_LIST + "?page=1")}
        failures[c.PREFECTURE] = roads(27, "9 septembre 2026", "10/09/2026")
        output, status, code = c.collect(current_snapshot(), today=date(2026, 9, 10), fetcher=network_fixture(failures))
        self.assertEqual(output["reviewedAt"], "2026-09-10")
        self.assertEqual(output["homicides"]["checkedAt"], "2026-09-09")
        self.assertEqual(output["roads"]["checkedAt"], "2026-09-10")

    def test_newer_explicit_record_updates_without_incrementing(self):
        new = rci("30 homicides depuis le début de l’année en Guadeloupe.", "2026-09-09", "2026-09-09")
        fixture = network_fixture({c.RCI_RSS: f"<rss><channel><item><link>{NEW_ARTICLE}</link></item></channel></rss>", NEW_ARTICLE: new})
        output, status, code = c.collect(current_snapshot(), today=TODAY, fetcher=fixture)
        self.assertEqual(output["homicides"]["count"], 30)
        self.assertEqual(output["homicides"]["source"], NEW_ARTICLE)

    def test_newer_source_correction_can_lower_count(self):
        fixture = network_fixture({c.PREFECTURE: roads(25, "8 septembre 2026", "09/09/2026")})
        output, status, code = c.collect(current_snapshot(), today=TODAY, fetcher=fixture)
        self.assertEqual(output["roads"]["count"], 25)
        self.assertTrue(any("correction" in warning for warning in status["warnings"]))

    def test_conflicting_new_sources_keep_previous_category(self):
        conflicting = rci("29 homicides depuis le début de l’année en Guadeloupe.")
        fixture = network_fixture({c.RCI_RSS: f"<rss><channel><item><link>{NEW_ARTICLE}</link></item></channel></rss>", NEW_ARTICLE: conflicting})
        output, status, code = c.collect(current_snapshot(), today=TODAY, fetcher=fixture)
        self.assertEqual(output["homicides"], current_snapshot()["homicides"])
        self.assertEqual(status["categories"]["homicides"]["outcome"], "unavailable")

    def test_rollover_waits_for_both_categories(self):
        new = rci("1 homicide depuis le début de l’année en Guadeloupe.", "2027-01-02", "2027-01-02")
        fixture = network_fixture({c.RCI_RSS: f"<rss><channel><item><link>{NEW_ARTICLE}</link></item></channel></rss>", NEW_ARTICLE: new})
        output, status, code = c.collect(current_snapshot(), today=date(2027, 1, 3), fetcher=fixture)
        self.assertEqual(output["year"], 2026)
        self.assertEqual(output["homicides"]["count"], 28)
        self.assertTrue(any("Waiting" in warning for warning in status["warnings"]))

    def test_rollover_changes_both_records_together(self):
        new = rci("1 homicide depuis le début de l’année en Guadeloupe.", "2027-01-02", "2027-01-02")
        fixture = network_fixture({c.RCI_RSS: f"<rss><channel><item><link>{NEW_ARTICLE}</link></item></channel></rss>", NEW_ARTICLE: new,
                                  c.PREFECTURE: roads(2, "2 janvier 2027", "03/01/2027")})
        output, status, code = c.collect(current_snapshot(), today=date(2027, 1, 3), fetcher=fixture)
        self.assertEqual((output["year"], output["homicides"]["count"], output["roads"]["count"]), (2027, 1, 2))

    def test_stored_mixed_years_fail_before_fetch(self):
        before = current_snapshot()
        before["roads"]["asOf"] = "2025-08-30"
        with self.assertRaises(c.SourceError):
            c.collect(before, today=TODAY, fetcher=network_fixture())

    def test_discovery_rejects_external_and_martinique_links(self):
        html = f'<a href="{ARTICLE}">ok</a><a href="https://rci.fm/martinique/infos/Faits-divers/Story">no</a><a href="https://evil.example/guadeloupe/infos/Faits-divers/Story">no</a>'
        self.assertEqual(c.article_links(html, c.RCI_LIST), [ARTICLE])


if __name__ == "__main__":
    unittest.main()
