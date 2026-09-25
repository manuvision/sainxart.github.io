"""Report source health without treating brief publisher outages as bad data."""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path


CATEGORIES = {"homicides", "roads"}
GRACE = timedelta(hours=72)
MAX_ATTEMPT_AGE = timedelta(minutes=30)
OUTCOMES = {"updated", "unchanged", "unavailable", "fallback"}
ISSUE_KINDS = {"transport", "source", "discovery", "conflict"}


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("missing timestamp")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp has no timezone")
    return parsed.astimezone(timezone.utc)


def evaluate(status, *, now=None, run_id=None, run_attempt=None):
    """Return healthy/degraded/failed; only typed transport issues get grace.

    Grace is measured from the last genuine successful category check. Neither
    repeated attempts nor an older backup report extend that deadline.
    """
    now = now or datetime.now(timezone.utc)
    result = {"state": "healthy", "messages": [], "categories": []}

    def fail(message):
        result["state"] = "failed"
        result["messages"].append(message)

    if not isinstance(status, dict):
        fail("No valid source-check status was produced.")
        return result
    if run_id is not None and status.get("runId") != str(run_id):
        fail("The source-check status does not belong to this workflow run.")
    if run_attempt is not None and status.get("runAttempt") != str(run_attempt):
        fail("The source-check status does not belong to this workflow attempt.")
    try:
        attempt = timestamp(status.get("lastAttempt"))
        if attempt > now or now - attempt > MAX_ATTEMPT_AGE:
            raise ValueError("attempt is in the future or more than 30 minutes old")
    except (ValueError, TypeError):
        fail("The source-check attempt timestamp is missing, invalid, future-dated or stale.")
        return result
    categories = status.get("categories")
    if not isinstance(categories, dict) or set(categories) != CATEGORIES:
        fail("The source-check status must contain both homicides and roads.")
        return result
    verified = status.get("verifiedCategories")
    if type(verified) is not int or not 0 <= verified <= 2:
        fail("The verified-category count is invalid.")
    expected_verified = 0
    for name in sorted(CATEGORIES):
        category = categories[name]
        entry = {"name": name, "state": "failed", "outcome": "invalid", "lastSuccess": None}
        result["categories"].append(entry)
        if not isinstance(category, dict) or not isinstance(category.get("outcome"), str) or category["outcome"] not in OUTCOMES:
            fail(name + ": missing or unknown check outcome.")
            continue
        outcome = category["outcome"]
        entry.update(outcome=outcome, lastSuccess=category.get("lastSuccess"))
        if outcome != "unavailable":
            expected_verified += 1
        issues = category.get("issues")
        if not isinstance(issues, list) or any(
            not isinstance(issue, dict) or not isinstance(issue.get("kind"), str) or issue["kind"] not in ISSUE_KINDS
            or not isinstance(issue.get("source"), str) or not isinstance(issue.get("message"), str)
            for issue in issues
        ):
            fail(name + ": missing or invalid issue classification.")
            continue
        try:
            last_success = timestamp(category.get("lastSuccess"))
            if last_success > attempt:
                raise ValueError("last success follows the attempt")
        except (ValueError, TypeError):
            fail(name + ": no valid previous successful check; automatic grace is unavailable.")
            continue
        if any(issue["kind"] == "conflict" for issue in issues):
            fail(name + ": conflicting source totals require review.")
        elif outcome in {"updated", "unchanged"}:
            if last_success != attempt:
                fail(name + ": a successful outcome lacks a successful check for this attempt.")
            else:
                entry["state"] = "healthy"
        elif not issues or any(issue["kind"] != "transport" for issue in issues):
            fail(name + ": this failure is not a classified temporary network outage.")
        elif attempt - last_success >= GRACE:
            fail(name + ": source access has not recovered within 72 hours of the last successful check.")
        else:
            entry["state"] = "degraded"
            if result["state"] != "failed":
                result["state"] = "degraded"
            deadline = (last_success + GRACE).isoformat(timespec="seconds")
            result["messages"].append(
                name + ": temporary publisher outage; retaining the previously verified record and its dates. "
                "Last successful check: " + category["lastSuccess"] + ". Grace expires: " + deadline + "."
            )
    if type(verified) is int and verified != expected_verified:
        fail("The verified-category count does not match the check outcomes.")
    return result


def annotation(message):
    return message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def main():
    path = Path("gwadastats/update-status.json")
    try:
        status = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        status = None
    assessment = evaluate(status, run_id=os.environ.get("GITHUB_RUN_ID"), run_attempt=os.environ.get("GITHUB_RUN_ATTEMPT"))
    lines = ["## Gwada Stats source check", "", "Health: **" + assessment["state"] + "**", ""]
    if isinstance(status, dict):
        lines.append("Attempt: " + str(status.get("lastAttempt", "unavailable")))
    for category in assessment["categories"]:
        lines.append("- **" + category["name"] + "**: " + category["state"] + " (" + category["outcome"]
                     + "); last successful check: " + str(category["lastSuccess"] or "unavailable"))
    for message in assessment["messages"]:
        lines.append("- " + message)
        level = "error" if assessment["state"] == "failed" else "warning"
        print("::" + level + "::" + annotation(message))
    if isinstance(status, dict):
        categories = status.get("categories")
        if isinstance(categories, dict):
            for name, category in categories.items():
                if isinstance(category, dict) and isinstance(category.get("errors"), list):
                    for error in category["errors"]:
                        print(name + ": " + str(error).replace("\r", " ").replace("\n", " "))
        if isinstance(status.get("warnings"), list):
            lines.extend("- " + str(warning) for warning in status["warnings"])
    lines += ["", "[Public data](https://manu.vision/gwadastats/data.json) · [Check details](https://manu.vision/gwadastats/update-status.json)", ""]
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as output:
            output.write("\n".join(lines))
    if assessment["state"] == "failed":
        raise SystemExit("Source health requires attention. Previous verified data and dates were preserved where sources could not be verified.")
    if assessment["state"] == "degraded":
        print("Update completed with a temporary source outage. The affected category was not freshly verified.")
    else:
        print("Both displayed categories were verified during this attempt.")


if __name__ == "__main__":
    main()
