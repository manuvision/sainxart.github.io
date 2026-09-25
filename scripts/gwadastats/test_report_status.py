"""Source-health policy tests: bounded transport grace, never invented freshness."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("report_status", Path(__file__).with_name("report_status.py"))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
NOW = datetime(2026, 9, 25, 15, 0, tzinfo=timezone.utc)


def healthy():
    return {"lastAttempt": NOW.isoformat(), "runId": "1234", "runAttempt": "1", "verifiedCategories": 2, "categories": {
        name: {"outcome": "unchanged", "lastSuccess": NOW.isoformat(), "issues": [], "errors": []}
        for name in ("homicides", "roads")
    }}


def degraded(age=timedelta(hours=48), outcome="fallback"):
    status = healthy()
    status["categories"]["roads"].update(
        outcome=outcome, lastSuccess=(NOW - age).isoformat(),
        issues=[{"kind": "transport", "source": "https://www.guadeloupe.gouv.fr", "message": "RemoteDisconnected"}])
    status["verifiedCategories"] = 1 if outcome == "unavailable" else 2
    return status


class SourceHealth(unittest.TestCase):
    def assess(self, status, **kwargs):
        return r.evaluate(status, now=kwargs.pop("now", NOW), run_id="1234", run_attempt="1", **kwargs)

    def test_healthy_check_succeeds(self):
        self.assertEqual(self.assess(healthy())["state"], "healthy")

    def test_healthy_current_source_tolerates_optional_backup_errors(self):
        status = healthy()
        for kind in ["source", "transport", "discovery"]:
            with self.subTest(kind=kind):
                status["categories"]["roads"]["issues"] = [{"kind": kind, "source": "backup", "message": "unavailable backup"}]
                self.assertEqual(self.assess(status)["state"], "healthy")

    def test_short_network_outage_is_explicitly_degraded_without_mutation(self):
        for outcome in ["fallback", "unavailable"]:
            with self.subTest(outcome=outcome):
                status = degraded(outcome=outcome)
                before = deepcopy(status)
                result = self.assess(status)
                self.assertEqual(result["state"], "degraded")
                self.assertIn("retaining the previously verified record and its dates", result["messages"][0])
                self.assertEqual(status, before)

    def test_grace_boundary_is_strictly_less_than_72_hours(self):
        self.assertEqual(self.assess(degraded(timedelta(hours=72) - timedelta(seconds=1)))["state"], "degraded")
        for age in [timedelta(hours=72), timedelta(hours=96)]:
            with self.subTest(age=age):
                self.assertEqual(self.assess(degraded(age))["state"], "failed")

    def test_repeated_attempt_does_not_reset_deadline(self):
        status = degraded()
        self.assertEqual(self.assess(status)["state"], "degraded")
        tomorrow = NOW + timedelta(days=1)
        status["lastAttempt"] = tomorrow.isoformat()
        status["categories"]["homicides"]["lastSuccess"] = tomorrow.isoformat()
        self.assertEqual(self.assess(status, now=tomorrow)["state"], "failed")
        self.assertEqual(status["categories"]["roads"]["lastSuccess"], (NOW - timedelta(days=2)).isoformat())

    def test_parser_discovery_conflict_and_unclassified_failures_never_get_grace(self):
        for kinds in [["source"], ["discovery"], ["conflict"], ["transport", "source"], [], ["unknown"]]:
            with self.subTest(kinds=kinds):
                status = degraded(timedelta(hours=1))
                status["categories"]["roads"]["issues"] = [{"kind": kind, "source": "publisher", "message": "failure"} for kind in kinds]
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_conflicting_totals_fail_even_if_another_source_was_checked(self):
        status = healthy()
        status["categories"]["roads"]["issues"] = [{"kind": "conflict", "source": "publisher", "message": "disagreement"}]
        self.assertEqual(self.assess(status)["state"], "failed")

    def test_missing_invalid_future_and_timezone_free_success_timestamps_fail(self):
        for value in [None, "invalid", "2026-09-25", NOW.replace(tzinfo=None).isoformat(), (NOW + timedelta(seconds=1)).isoformat()]:
            with self.subTest(value=value):
                status = degraded()
                status["categories"]["roads"]["lastSuccess"] = value
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_forged_or_stale_attempt_cannot_extend_grace(self):
        for value in [None, "invalid", NOW.replace(tzinfo=None).isoformat(), (NOW + timedelta(seconds=1)).isoformat(), (NOW - timedelta(minutes=31)).isoformat()]:
            with self.subTest(value=value):
                status = degraded()
                status["lastAttempt"] = value
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_status_from_a_previous_workflow_run_is_rejected(self):
        for run_id in [None, "previous"]:
            with self.subTest(run_id=run_id):
                status = healthy()
                status["runId"] = run_id
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_missing_categories_unknown_outcomes_and_bad_counts_fail(self):
        invalid = [None, [], {}]
        for key in ["homicides", "roads"]:
            status = healthy()
            del status["categories"][key]
            invalid.append(status)
        for outcome in [None, "okay", []]:
            status = healthy()
            status["categories"]["roads"]["outcome"] = outcome
            invalid.append(status)
        for count in [None, True, 0, 3]:
            status = healthy()
            status["verifiedCategories"] = count
            invalid.append(status)
        for status in invalid:
            with self.subTest(status=status):
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_same_run_id_with_old_attempt_is_rejected(self):
        for run_attempt in [None, "2"]:
            with self.subTest(run_attempt=run_attempt):
                status = healthy()
                status["runAttempt"] = run_attempt
                self.assertEqual(self.assess(status)["state"], "failed")

    def test_successful_outcome_requires_a_current_success_timestamp(self):
        status = healthy()
        status["categories"]["roads"]["lastSuccess"] = (NOW - timedelta(days=1)).isoformat()
        self.assertEqual(self.assess(status)["state"], "failed")

    def test_real_recovery_restores_healthy_state(self):
        status = degraded(timedelta(hours=96))
        self.assertEqual(self.assess(status)["state"], "failed")
        status["categories"]["roads"].update(outcome="unchanged", lastSuccess=NOW.isoformat(), issues=[])
        self.assertEqual(self.assess(status)["state"], "healthy")


if __name__ == "__main__":
    unittest.main()
